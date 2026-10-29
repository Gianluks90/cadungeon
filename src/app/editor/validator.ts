import { RuneColor } from '../game/board/door';
import type { Marker } from '../game/board/marker';
import { THIS_PIECE, targetsOf, triggersOf } from '../game/map/map-data';
import { HERO_START_CELLS } from '../game/constants';
import type { AdventureEvent, EventEffect, EventTrigger, MapData } from '../game/map/map-data';

/** Com'è andato un controllo: `ok` a posto, `warning` va bene ma manca qualcosa, `error` è sbagliato (l'avventura non si può usare), `todo` il controllo non c'è ancora. */
export type CheckLevel = 'ok' | 'warning' | 'error' | 'todo';

export interface Check {
  id: string;
  level: CheckLevel;
  text: string;
}

/** Lo stato complessivo: l'errore pesa più dell'avvertimento, che pesa più del niente. I controlli `todo` non contano. */
export function overall(checks: readonly Check[]): 'ok' | 'warning' | 'error' {
  if (checks.some((c) => c.level === 'error')) return 'error';
  if (checks.some((c) => c.level === 'warning')) return 'warning';
  return 'ok';
}

const COLOR_NAMES: Record<RuneColor, string> = { red: 'rossa', blue: 'blu', green: 'verde' };

/** I colori delle chiavi runiche che l'avventura mette da qualche parte: a terra, in uno scrigno o come bottino di una pedina. */
function runeKeysPlaced(map: MapData): Set<RuneColor> {
  const found = new Set<RuneColor>();
  for (const m of map.markers ?? []) {
    if (m.type === 'rune') found.add(m.color);
    if (m.type === 'chest') for (const l of m.contents ?? []) if (l.kind === 'rune') found.add(l.color);
  }
  for (const p of map.pieces ?? []) for (const l of p.drop ?? []) if (l.kind === 'rune') found.add(l.color);
  return found;
}

/**
 * Il validatore generale dell'avventura: l'elenco di ciò che va e ciò che non va. Gli errori sono le cose obbligatorie senza le quali l'avventura non si può usare:
 * - informazioni mancanti (titolo, introduzione, obiettivo, punti Conquista iniziali);
 * - una porta runica senza la chiave runica di quel colore da qualche parte;
 * - tessere che non appartengono a nessuna area (`unassignedTiles`, calcolate dall'editor);
 * - uno o più bauli senza ricompensa (meno ricompense nella tabella dei ritrovamenti che bauli di quel tipo);
 * - una o più aree (diverse da quella di partenza) senza descrizione;
 * - area di partenza non designata, senza il glifo acceso iniziale o senza caselle di posizionamento degli eroi (servono esattamente 4 caselle, per 4 eroi: così ci sono tutte anche giocando in 2 o in 5).
 * Gli avvertimenti sono cose che si possono lasciare così, ma forse non è voluto (mappa vuota, uscite non chiuse).
 * `openExits` sono le uscite dei tile che non portano a niente.
 */
export function validate(map: MapData, openExits: number, unassignedTiles = 0, unknownPieces = 0): Check[] {
  const out: Check[] = [];
  const add = (id: string, level: CheckLevel, text: string) => out.push({ id, level, text });

  // Elementi non riconosciuti (segnaposto arancioni): l'avventura non si può giocare finché non si sostituiscono o si tolgono
  if (unknownPieces > 0) add('unknown-pieces', 'error', unknownPieces === 1 ? 'Un elemento non riconosciuto (segnaposto arancione): sostituiscilo o eliminalo, altrimenti l\'avventura non è giocabile' : `${unknownPieces} elementi non riconosciuti (segnaposto arancioni): sostituiscili o eliminali, altrimenti l'avventura non è giocabile`);

  // Scale: ogni scalinata ha due capi (due scale con la stessa coppia); una sola, o più di due, non collega niente
  const ends = new Map<string, number>();
  for (const m of map.markers ?? []) if (m.type === 'stairs') ends.set(m.link, (ends.get(m.link) ?? 0) + 1);
  if (ends.size) {
    const broken = [...ends.values()].filter((n) => n !== 2).length;
    if (broken) add('stairs', 'error', broken === 1 ? 'Una scala è senza la sua coppia: mettine un\'altra per collegarla, o eliminala' : ` scalinate non hanno due capi: ogni scala ha bisogno della sua coppia`);
    else add('stairs', 'ok', ends.size === 1 ? 'La scalinata ha i suoi due capi' : 'Tutte le scalinate hanno i loro due capi');
  }

  // Informazioni
  const missing: string[] = [];
  if (!map.title?.trim()) missing.push('titolo');
  if (!map.intro?.trim()) missing.push('introduzione');
  if (!(map.objective?.description ?? map.objective?.text)?.trim()) missing.push('obiettivo');
  if (typeof map.progress !== 'number') missing.push('punti Conquista iniziali');
  if (!map.objective?.conclusion?.trim()) missing.push('testo di conclusione');
  if (typeof map.objective?.reward !== 'number') missing.push('punti Conquista dell\'obiettivo');
  for (const m of missing) add(`info-${m}`, 'error', `Informazione mancante: ${m}`);
  if (!missing.length) add('info', 'ok', 'Titolo, introduzione, obiettivo, conclusione e punti Conquista iniziali inseriti');

  // Condizione di vittoria: un nemico da sconfiggere (scelto e in mappa) oppure un evento che fa vincere
  const goal = map.objective;
  const events = map.events ?? [];
  const wins = events.some((e) => [...e.then, ...(e.else ?? [])].some((f) => f.kind === 'win'));
  if (goal?.kind === 'event') {
    if (wins) add('goal-target', 'ok', "Un evento fa vincere l'avventura");
    else add('goal-target', 'error', "La vittoria è affidata a un evento, ma nessun evento ha l'effetto Vinci l'avventura");
  } else if (goal?.kind !== 'defeat') add('goal-target', 'error', 'Nessuna condizione di vittoria scelta');
  else if (!(map.pieces ?? []).some((p) => p.id === goal.pieceId)) add('goal-target', 'error', 'Il nemico da sconfiggere non è più in mappa');
  else if ((map.pieces ?? []).find((p) => p.id === goal.pieceId)?.invincible && !events.some((e) => flattenEffects([...e.then, ...(e.else ?? [])]).some((f) => f.kind === 'makeVulnerable' && targetsOf(f).includes(goal.pieceId)))) add('goal-target', 'error', 'Il nemico da sconfiggere è invincibile e nessun evento lo rende vulnerabile: non si potrà vincere');
  else add('goal-target', 'ok', 'Il nemico da sconfiggere è in mappa');

  // Eventi: ogni evento ha i suoi controlli (`validateEvents`), qui si elencano con il nome davanti
  if (events.length) {
    const issues = validateEvents(map);
    let n = 0;
    events.forEach((e, i) => {
      for (const x of issues.get(e.id) ?? []) add(`event-${x.level}-${n++}`, x.level, `${e.name || `Evento ${i + 1}`}: ${x.text}`);
    });
    if (!issues.size) add('events', 'ok', events.length === 1 ? 'Evento verificato' : 'Eventi verificati');
  }

  // Aree: l'area di partenza si controlla; il glifo acceso iniziale non ancora (i glifi non sono ancora nell'editor)
  if (map.areas?.some((a) => a.start)) add('start-area', 'ok', 'Area di partenza designata');
  else add('start-area', 'error', 'Area di partenza mancante');
  if (map.tiles.length) {
    if (unassignedTiles > 0) add('unassigned', 'error', unassignedTiles === 1 ? 'Una tessera non appartiene a nessuna area' : `${unassignedTiles} tessere non appartengono a nessuna area`);
    else add('unassigned', 'ok', 'Ogni tessera appartiene a un\'area');
  }
  // Bauli: ognuno ha bisogno di una ricompensa della tabella (a meno che abbia un contenuto suo)
  const chests = (map.markers ?? []).filter((m): m is Extract<typeof m, { type: 'chest' }> => m.type === 'chest' && !m.contents?.length);
  if (chests.length) {
    const lacking = (['copper', 'silver', 'gold'] as const).some((tier) => chests.filter((c) => c.tier === tier).length > (map.chestTable?.[tier]?.length ?? 0));
    if (lacking) add('chest-rewards', 'error', 'Uno o più bauli sono senza ricompensa');
    else add('chest-rewards', 'ok', 'Ogni baule ha la sua ricompensa');
  }

  // Descrizioni: ogni area diversa da quella di partenza deve averne una (compare quando gli eroi la rivelano)
  const others = (map.areas ?? []).filter((a) => !a.start);
  if (others.length) {
    if (others.some((a) => !a.text?.trim())) add('area-text', 'error', 'Una o più aree sono senza descrizione');
    else add('area-text', 'ok', 'Ogni area ha la sua descrizione');
  }
  // L'area di partenza ha il glifo già acceso e le caselle dove gli eroi scelgono di cominciare
  const startArea = map.areas?.find((a) => a.start);
  if (startArea) {
    const inArea = new Set((startArea.cells ?? []).map((c) => `${c.x},${c.y}`));
    const glyph = (map.markers ?? []).some((m) => m.type === 'glyph' && m.active && inArea.has(`${m.x},${m.y}`));
    add('start-glyph', glyph ? 'ok' : 'error', glyph ? 'L\'area di partenza ha il glifo acceso iniziale' : 'L\'area di partenza non ha il glifo acceso iniziale');
    const cells = (map.start ?? []).filter((c) => inArea.has(`${c.x},${c.y}`)).length;
    if (cells < HERO_START_CELLS) add('start-placement', 'error', cells ? `L'area di partenza ha ${cells} ${cells === 1 ? 'casella' : 'caselle'} di posizionamento degli eroi: ne servono ${HERO_START_CELLS}` : 'L\'area di partenza non ha le caselle di posizionamento degli eroi');
    else add('start-placement', 'ok', `L'area di partenza ha le ${HERO_START_CELLS} caselle di posizionamento degli eroi`);
  }

  // Porte runiche
  const runeDoors = [...new Set((map.doors ?? []).flatMap((d) => (d.lock?.kind === 'rune' ? [d.lock.color] : [])))];
  const keys = runeKeysPlaced(map);
  const lost = runeDoors.filter((c) => !keys.has(c));
  for (const c of lost) add(`rune-${c}`, 'error', `Porta runica ${COLOR_NAMES[c]}: la chiave runica ${COLOR_NAMES[c]} non è stata posizionata`);
  if (runeDoors.length && !lost.length) add('rune', 'ok', 'Ogni porta runica ha la sua chiave runica');

  // Porte evento: nessuno le apre a mano, quindi serve un evento che le apra
  const eventDoors = [...new Set((map.doors ?? []).flatMap((d) => (d.lock?.kind === 'event' ? [d.lock.id] : [])))];
  const opened = new Set((map.events ?? []).flatMap((e) => flattenEffects([...e.then, ...(e.else ?? [])]).flatMap((f) => (f.kind === 'openDoor' ? [f.doorId] : []))));
  const sealed = eventDoors.filter((id) => !opened.has(id));
  if (sealed.length) add('event-doors', 'error', sealed.length === 1 ? 'Una porta evento non è aperta da nessun evento: resterebbe chiusa per sempre' : `${sealed.length} porte evento non sono aperte da nessun evento: resterebbero chiuse per sempre`);
  else if (eventDoors.length) add('event-doors', 'ok', 'Ogni porta evento ha un evento che la apre');

  // Avvertimenti
  if (!map.tiles.length) add('empty', 'warning', 'La mappa è vuota: nessuna tessera piazzata');
  else if (openExits > 0) add('exits', 'warning', (openExits === 1 ? 'Un\'uscita non è chiusa (nessun tile collegato né punto morto)' : `${openExits} uscite non sono chiuse (nessun tile collegato né punto morto)`) + '. Se è una scelta, puoi ignorare questo avviso: non blocca l\'avventura.');
  else add('exits', 'ok', 'Tutte le uscite sono collegate o chiuse');

  return out;
}

/** Gli effetti di una lista con anche quelli dentro i due rami delle Prove (a qualunque profondità). */
export function flattenEffects(list: readonly EventEffect[]): EventEffect[] {
  return list.flatMap((f) => (f.kind === 'check' ? [f, ...flattenEffects(f.onSuccess), ...flattenEffects(f.onFail)] : [f]));
}

/** Il nome di un oggetto a terra nell'elenco degli eventi: "Denaro · Area 2 · casella 3, 4" (senza l'area se la casella non ne ha). */
export function pickupLabel(m: Marker, area?: string): string {
  const name =
    m.type === 'potion' ? (m.kind === 'heal' ? 'Pozione curativa' : 'Pozione di vitalità')
    : m.type === 'coins' ? 'Denaro'
    : m.type === 'key' ? 'Chiave'
    : m.type === 'rune' ? `Chiave runica ${{ red: 'rossa', blue: 'blu', green: 'verde' }[m.color]}`
    : m.type === 'item' ? 'Oggetto'
    : 'Segnalino';
  return `${name} · ${area ? `${area} · ` : ''}casella ${m.x}, ${m.y}`;
}

/** Gli id dei nemici su cui c'è un evento: quelli che lo fanno scattare (sconfitto, interazione, gruppo) o che ne subiscono gli effetti. */
export function piecesWithEvents(map: MapData): Set<string> {
  const out = new Set<string>();
  for (const e of map.events ?? []) {
    for (const w of triggersOf(e)) {
      if (w.kind === 'defeated' || w.kind === 'interact') out.add(w.pieceId);
      else if (w.kind === 'cleared') for (const id of w.pieceIds ?? []) out.add(id);
    }
    for (const f of flattenEffects([...e.then, ...(e.else ?? [])])) if (f.kind === 'modifyMonster' || f.kind === 'finishRevival' || f.kind === 'activate' || f.kind === 'removePiece' || f.kind === 'makeVulnerable' || f.kind === 'removeImmunity') for (const id of targetsOf(f)) if (id !== THIS_PIECE) out.add(id);
  }
  return out;
}

/** Un problema trovato in un evento: `error` lo rende inutilizzabile o contraddittorio, `warning` va bene ma è sospetto. */
export interface EventIssue {
  level: 'warning' | 'error';
  text: string;
}

/** Lo stato di un evento a partire dai suoi problemi: nessuno = `ok`. */
export function eventLevel(issues: readonly EventIssue[] | undefined): 'ok' | 'warning' | 'error' {
  if (issues?.some((x) => x.level === 'error')) return 'error';
  return issues?.length ? 'warning' : 'ok';
}

const sameOne = (a: EventTrigger, b: EventTrigger) =>
  a.kind === b.kind && (a.kind === 'cleared' ? JSON.stringify(a) === JSON.stringify(b) : a.kind === 'defeated' || a.kind === 'interact' ? a.pieceId === (b as typeof a).pieceId : a.kind === 'pickedUp' ? a.markerId === (b as typeof a).markerId : a.area === (b as { area: string }).area);

/** Due eventi hanno una causa in comune se un loro innesco è lo stesso. */
const sameTrigger = (a: AdventureEvent, b: AdventureEvent) => triggersOf(a).some((x) => triggersOf(b).some((y) => sameOne(x, y)));

/** Due eventi non possono scattare insieme se uno chiede una variabile accesa e l'altro la stessa spenta. */
const exclusive = (a: AdventureEvent, b: AdventureEvent) => (a.if ?? []).some((x) => (b.if ?? []).some((y) => y.variable === x.variable && y.is !== x.is));

/** I problemi di ogni evento (per id; gli eventi senza problemi non compaiono): riferimenti che non esistono più, condizioni o effetti che si contraddicono, eventi che non possono mai scattare. */
export function validateEvents(map: MapData): Map<string, EventIssue[]> {
  const out = new Map<string, EventIssue[]>();
  const events = map.events ?? [];
  const pieces = new Set((map.pieces ?? []).map((p) => p.id));
  const vars = new Set(map.variables ?? []);
  const effectsOf = (e: AdventureEvent): EventEffect[] => flattenEffects([...e.then, ...(e.else ?? [])]);
  const turnedOn = new Set(events.flatMap((e) => effectsOf(e).flatMap((f) => (f.kind === 'setVariable' && f.value ? [f.variable] : []))));
  const revivable = new Set(events.filter((e) => effectsOf(e).some((f) => f.kind === 'revive')).flatMap((e) => triggersOf(e).flatMap((t) => (t.kind === 'defeated' ? [t.pieceId] : []))));
  const label = (e: AdventureEvent) => e.name || `Evento ${events.indexOf(e) + 1}`;
  const push = (e: AdventureEvent, level: EventIssue['level'], text: string) => out.set(e.id, [...(out.get(e.id) ?? []), { level, text }]);

  for (const e of events) {
    const triggers = triggersOf(e);
    const hasThis = triggers.some((t) => t.kind === 'defeated' || t.kind === 'interact');
    const hasDefeated = triggers.some((t) => t.kind === 'defeated');
    const hasCleared = triggers.some((t) => t.kind === 'cleared');
    for (const w of triggers) {
    if (w.kind === 'defeated' || w.kind === 'interact') {
      if (!pieces.has(w.pieceId)) push(e, 'error', 'il nemico non è più in mappa');
      else if (w.kind === 'interact' && (map.pieces ?? []).find((p) => p.id === w.pieceId)?.team !== 'monster') push(e, 'error', "si può interagire solo con un nemico");
      else if (w.kind === 'interact' && w.onlyInactive && !(map.pieces ?? []).find((p) => p.id === w.pieceId)?.inactive) push(e, 'warning', "l'interazione è solo per nemici inattivi, ma questo non lo è: non sarà mai disponibile");
    } else if (w.kind === 'cleared') {
      for (const id of w.pieceIds ?? []) if (!pieces.has(id)) push(e, 'error', 'uno dei nemici della lista non è più in mappa');
      if (w.area && !(map.areas ?? []).some((a) => a.id === w.area)) push(e, 'error', "l'area non esiste più");
      if (!w.pieceIds?.length && !(map.pieces ?? []).some((p) => p.team === 'monster')) push(e, 'warning', 'non ci sono nemici in mappa: non scatterà mai');
    } else if (w.kind === 'pickedUp') {
      if (!(map.markers ?? []).some((m) => 'id' in m && m.id === w.markerId)) push(e, 'error', "l'oggetto non è più in mappa");
    } else {
      const area = (map.areas ?? []).find((a) => a.id === w.area);
      if (!area) push(e, 'error', "l'area non esiste più");
      else if (w.kind === 'chestOpened' && area.cells?.length && !(map.markers ?? []).some((m) => m.type === 'chest' && area.cells!.some((c) => c.x === m.x && c.y === m.y))) push(e, 'error', "nell'area non c'è nessun baule: l'evento non scatterà mai");
    }
    }
    const seenTriggers = new Set<string>();
    for (const w of triggers) {
      const key = JSON.stringify(w);
      if (seenTriggers.has(key)) push(e, 'warning', 'ha due inneschi uguali: uno basta');
      seenTriggers.add(key);
    }

    const cond = new Map<string, Set<boolean>>();
    for (const c of e.if ?? []) {
      if (!vars.has(c.variable)) push(e, 'error', `la variabile "${c.variable}" non esiste più`);
      else if (c.is && !turnedOn.has(c.variable)) push(e, 'warning', `"${c.variable}" è letta come accesa ma nessun evento la accende: la condizione non sarà mai vera`);
      cond.set(c.variable, (cond.get(c.variable) ?? new Set()).add(c.is));
    }
    for (const [v, is] of cond) if (is.size > 1) push(e, 'error', `le condizioni si contraddicono su "${v}" (accesa e spenta insieme): non scatta mai`);
    if (e.else?.length && !e.if?.length) push(e, 'warning', 'ha degli effetti in "Altrimenti" ma nessuna condizione: non scatteranno mai');
    if (!e.then.length) push(e, 'error', 'senza effetti');

    for (const [name, list] of [['Allora', flattenEffects(e.then)], ['Altrimenti', flattenEffects(e.else ?? [])]] as const) {
      const set = new Map<string, Set<boolean>>();
      for (const f of list) {
        if (f.kind === 'setVariable') {
          if (!vars.has(f.variable)) push(e, 'error', `la variabile "${f.variable}" non esiste più`);
          set.set(f.variable, (set.get(f.variable) ?? new Set()).add(f.value));
        }
        if (f.kind === 'modifyMonster' || f.kind === 'finishRevival' || f.kind === 'activate' || f.kind === 'removePiece' || f.kind === 'makeVulnerable' || f.kind === 'removeImmunity') {
          const verb = { modifyMonster: 'modificare', finishRevival: 'far tornare in vita', activate: 'attivare', removePiece: 'rimuovere', makeVulnerable: 'rendere vulnerabile', removeImmunity: "privare di un'immunità" }[f.kind];
          const ids = targetsOf(f);
          if (!ids.length) push(e, 'error', `non è scelto il nemico da ${verb}`);
          if (ids.includes(THIS_PIECE) && !hasThis) push(e, 'error', '"il nemico dell\'evento" si può usare solo con gli inneschi "sconfitto" o "interagisce"');
          for (const id of ids) if (id !== THIS_PIECE && !pieces.has(id)) push(e, 'error', `il nemico da ${verb} non è più in mappa`);
          if (f.kind === 'activate') {
            const known = ids.flatMap((id) => (map.pieces ?? []).filter((p) => p.id === id));
            if (known.length && known.every((p) => !p.inactive)) push(e, 'warning', 'attiva nemici che non sono inattivi: non cambia niente');
          }
          if (f.kind === 'finishRevival' && ids.some((id) => pieces.has(id) && !revivable.has(id))) push(e, 'warning', 'chiude il ritorno in vita di un nemico che nessun evento fa tornare in vita');
        }
        if (f.kind === 'check') {
          if (!f.text.trim()) push(e, 'error', 'una prova è senza testo');
          if (!f.onSuccess.length && !f.onFail.length) push(e, 'warning', 'una prova senza effetti in nessuno dei due rami: non cambia niente');
          if (f.kind === 'check' && hasCleared) push(e, 'warning', 'una prova dopo "non c\'è più nessun nemico": la tira l\'eroe attivo, anche se non c\'entra con ciò che è successo');
        }
        if (f.kind === 'openDoor' && !(map.doors ?? []).some((d) => d.lock?.kind === 'event' && d.lock.id === f.doorId)) push(e, 'error', 'la porta evento da aprire non è più in mappa');
        if (f.kind === 'modifyMonster' && !f.wounds && !f.speed && !f.armor) push(e, 'warning', 'una modifica a un nemico non cambia niente');
        if (f.kind === 'revive' && !hasDefeated) push(e, 'error', '"torna in vita" vale solo per un nemico sconfitto');
        if (f.kind === 'message' && !f.text.trim()) push(e, 'error', 'un messaggio è senza testo');
        if (f.kind === 'progress' && !f.amount) push(e, 'warning', 'dà 0 punti Conquista');
      }
      for (const [v, is] of set) if (is.size > 1) push(e, 'error', `in "${name}" la variabile "${v}" è accesa e spenta insieme`);
      if (list.filter((f) => f.kind === 'revive').length > 1) push(e, 'warning', `in "${name}" c'è più di un "torna in vita"`);
      if (list.some((f) => f.kind === 'revive') && list.some((f) => f.kind === 'win')) push(e, 'error', `in "${name}" "torna in vita" e "vinci l'avventura" si contraddicono`);
    }
  }

  // Due eventi con la stessa causa che possono scattare insieme, se uno fa vincere
  events.forEach((a, i) => {
    for (const b of events.slice(i + 1)) {
      if (!sameTrigger(a, b) || exclusive(a, b)) continue;
      for (const [x, y] of [[a, b], [b, a]] as const) {
        const xs = x.then;
        const ys = y.then;
        if (xs.some((f) => f.kind === 'win') && ys.some((f) => f.kind === 'revive')) push(x, 'error', `può scattare insieme a "${label(y)}", che fa tornare in vita: si contraddicono`);
        else if (xs.some((f) => f.kind === 'win') || ys.some((f) => f.kind === 'win')) push(x, 'warning', `può scattare insieme a "${label(y)}" e uno dei due fa vincere l'avventura: aggiungi una condizione che li distingua`);
      }
    }
  });
  return out;
}
