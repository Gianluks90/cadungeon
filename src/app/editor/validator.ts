import { RuneColor } from '../game/board/door';
import { HERO_START_CELLS } from '../game/constants';
import type { MapData } from '../game/map/map-data';

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
  else add('goal-target', 'ok', 'Il nemico da sconfiggere è in mappa');

  // Eventi: ogni riferimento (nemico, area, variabile) deve esistere
  if (events.length) {
    const pieces = new Set((map.pieces ?? []).map((p) => p.id));
    const areas = new Set((map.areas ?? []).map((a) => a.id));
    const vars = new Set(map.variables ?? []);
    const label = (e: (typeof events)[number], i: number) => e.name || `Evento ${i + 1}`;
    const broken: string[] = [];
    const never: Set<string> = new Set();
    const set = new Set(events.flatMap((e) => [...e.then, ...(e.else ?? [])].flatMap((f) => (f.kind === 'setVariable' && f.value ? [f.variable] : []))));
    events.forEach((e, i) => {
      const w = e.when;
      if (w.kind === 'defeated' ? !pieces.has(w.pieceId) : !areas.has(w.area)) broken.push(`${label(e, i)}: ${w.kind === 'defeated' ? 'il nemico non è più in mappa' : "l'area non esiste più"}`);
      for (const c of e.if ?? []) {
        if (!vars.has(c.variable)) broken.push(`${label(e, i)}: la variabile "${c.variable}" non esiste più`);
        else if (c.is && !set.has(c.variable)) never.add(c.variable);
      }
      for (const f of [...e.then, ...(e.else ?? [])]) {
        if (f.kind === 'setVariable' && !vars.has(f.variable)) broken.push(`${label(e, i)}: la variabile "${f.variable}" non esiste più`);
        if ((f.kind === 'modifyMonster' || f.kind === 'finishRevival') && !pieces.has(f.pieceId)) broken.push(`${label(e, i)}: il nemico da ${f.kind === 'modifyMonster' ? 'modificare' : 'far tornare in vita'} non è più in mappa`);
        if (f.kind === 'revive' && w.kind !== 'defeated') broken.push(`${label(e, i)}: "torna in vita" vale solo per un nemico sconfitto`);
        if (f.kind === 'message' && !f.text.trim()) broken.push(`${label(e, i)}: un messaggio è senza testo`);
      }
      if (!e.then.length) broken.push(`${label(e, i)}: senza effetti`);
    });
    if (broken.length) for (const [n, b] of broken.entries()) add(`event-broken-${n}`, 'error', b);
    else add('events', 'ok', events.length === 1 ? "L'evento è a posto" : 'Gli eventi sono a posto');
    for (const v of never) add(`event-never-${v}`, 'warning', `La variabile "${v}" è letta come accesa ma nessun evento la accende`);
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

  // Avvertimenti
  if (!map.tiles.length) add('empty', 'warning', 'La mappa è vuota: nessuna tessera piazzata');
  else if (openExits > 0) add('exits', 'warning', (openExits === 1 ? 'Un\'uscita non è chiusa (nessun tile collegato né punto morto)' : `${openExits} uscite non sono chiuse (nessun tile collegato né punto morto)`) + '. Se è una scelta, puoi ignorare questo avviso: non blocca l\'avventura.');
  else add('exits', 'ok', 'Tutte le uscite sono collegate o chiuse');

  return out;
}
