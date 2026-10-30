import { isItemCondition } from '../game/map/map-data';
import { translate as t } from '../i18n/i18n.service';
import type { PawnBehavior } from '../game/pieces/pawn-behavior';
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

const colorName = (c: RuneColor): string => t(`validator.color.${c}`);

/** I colori delle chiavi runiche che gli eventi consegnano agli eroi (effetto "Consegna un premio", anche dentro i rami di una Prova). */
export function runeKeysFromEvents(map: MapData): Set<RuneColor> {
  const found = new Set<RuneColor>();
  for (const e of map.events ?? []) for (const f of flattenEffects([...e.then, ...(e.else ?? [])])) if (f.kind === 'give' && f.reward.kind === 'rune') found.add(f.reward.color);
  return found;
}

/** I colori delle chiavi runiche che l'avventura mette da qualche parte: a terra, in uno scrigno o come bottino di una pedina. */
function runeKeysPlaced(map: MapData): Set<RuneColor> {
  const found = new Set<RuneColor>();
  for (const m of map.markers ?? []) {
    if (m.type === 'rune') found.add(m.color);
    if (m.type === 'chest') for (const l of m.contents ?? []) if (l.kind === 'rune') found.add(l.color);
  }
  for (const p of map.pieces ?? []) for (const l of p.drop ?? []) if (l.kind === 'rune') found.add(l.color);
  for (const c of runeKeysFromEvents(map)) found.add(c);
  return found;
}

/**
 * Il validatore generale dell'avventura: l'elenco di ciò che va e ciò che non va. Gli errori sono le cose obbligatorie senza le quali l'avventura non si può usare:
 * - informazioni mancanti (titolo, introduzione, obiettivo, punti Conquista iniziali);
 * - una porta runica senza la chiave runica di quel colore da qualche parte;
 * - tessere che non appartengono a nessuna area (`unassignedTiles`, calcolate dall'editor);
 * - uno o più bauli senza ricompensa (meno ricompense nella tabella dei ritrovamenti che bauli di quel tipo);
 * - una o più aree (diverse da quella di partenza) senza descrizione;
 * - area di partenza non designata, senza il glifo acceso iniziale o senza caselle di posizionamento degli eroi (servono almeno 4 caselle, per 4 eroi: così ci sono tutte anche giocando in 2 o in 5).
 * Gli avvertimenti sono cose che si possono lasciare così, ma forse non è voluto (mappa vuota, uscite non chiuse).
 * `openExits` sono le uscite dei tile che non portano a niente.
 */
/** Un comportamento «accanto a…» il cui ostacolo non c'è più in mappa. */
const behaviorLost = (map: MapData, b?: PawnBehavior): boolean => b?.kind === 'endNear' && !(map.obstacles ?? []).some((o) => o.x === b.x && o.y === b.y);

export function validate(map: MapData, openExits: number, unassignedTiles = 0, unknownPieces = 0): Check[] {
  const out: Check[] = [];
  const add = (id: string, level: CheckLevel, text: string) => out.push({ id, level, text });

  // Elementi non riconosciuti (segnaposto arancioni): l'avventura non si può giocare finché non si sostituiscono o si tolgono
  if (unknownPieces > 0) add('unknown-pieces', 'error', unknownPieces === 1 ? t('validator.unknownOne') : t('validator.unknownMany', { n: unknownPieces }));

  // Scale: ogni scalinata ha due capi (due scale con la stessa coppia); una sola, o più di due, non collega niente
  const ends = new Map<string, number>();
  for (const m of map.markers ?? []) if (m.type === 'stairs') ends.set(m.link, (ends.get(m.link) ?? 0) + 1);
  if (ends.size) {
    const broken = [...ends.values()].filter((n) => n !== 2).length;
    if (broken) add('stairs', 'error', broken === 1 ? t('validator.stairsOne') : t('validator.stairsMany', { n: broken }));
    else add('stairs', 'ok', ends.size === 1 ? t('validator.stairsOkOne') : t('validator.stairsOkMany'));
  }

  // Informazioni
  const missing: ('title' | 'intro' | 'objective' | 'progress' | 'conclusion' | 'reward')[] = [];
  if (!map.title?.trim()) missing.push('title');
  if (!map.intro?.trim()) missing.push('intro');
  if (!(map.objective?.description ?? map.objective?.text)?.trim()) missing.push('objective');
  if (typeof map.progress !== 'number') missing.push('progress');
  if (!map.objective?.conclusion?.trim()) missing.push('conclusion');
  if (typeof map.objective?.reward !== 'number') missing.push('reward');
  for (const m of missing) add(`info-${m}`, 'error', t('validator.infoMissing', { field: t(`validator.field.${m}`) }));
  if (!missing.length) add('info', 'ok', t('validator.infoOk'));

  // Condizione di vittoria: un nemico da sconfiggere (scelto e in mappa) oppure un evento che fa vincere
  const goal = map.objective;
  const events = map.events ?? [];
  const wins = events.some((e) => [...e.then, ...(e.else ?? [])].some((f) => f.kind === 'win'));
  if (goal?.kind === 'event') {
    if (wins) add('goal-target', 'ok', t('validator.goalEventOk'));
    else add('goal-target', 'error', t('validator.goalEventMissing'));
  } else if (goal?.kind !== 'defeat') add('goal-target', 'error', t('validator.goalNone'));
  else if (!(map.pieces ?? []).some((p) => p.id === goal.pieceId)) add('goal-target', 'error', t('validator.goalGone'));
  else if ((map.pieces ?? []).find((p) => p.id === goal.pieceId)?.invincible && !events.some((e) => flattenEffects([...e.then, ...(e.else ?? [])]).some((f) => f.kind === 'makeVulnerable' && targetsOf(f).includes(goal.pieceId)))) add('goal-target', 'error', t('validator.goalInvincible'));
  else add('goal-target', 'ok', t('validator.goalOk'));

  // Comportamenti dei nemici: «termina il turno accanto a…» ha bisogno dell'ostacolo scelto
  const lostBehavior = (map.pieces ?? []).filter((p) => behaviorLost(map, p.behavior)).length;
  if (lostBehavior) add('behaviors', 'error', lostBehavior === 1 ? t('validator.behaviorOne') : t('validator.behaviorMany', { n: lostBehavior }));

  // Segnalini incontro: ognuno deve essere usato da un evento (altrimenti in partita mostrerebbe un "?" senza effetto)
  if ((map.markers ?? []).some((m) => m.type === 'encounter')) {
    const loose = unlinkedEncounters(map).length;
    if (loose) add('encounters', 'error', loose === 1 ? t('validator.encountersOne') : t('validator.encountersMany', { n: loose }));
    else add('encounters', 'ok', t('validator.encountersOk'));
  }

  // Eventi: ogni evento ha i suoi controlli (`validateEvents`), qui si elencano con il nome davanti
  if (events.length) {
    const issues = validateEvents(map);
    let n = 0;
    events.forEach((e, i) => {
      for (const x of issues.get(e.id) ?? []) add(`event-${x.level}-${n++}`, x.level, `${e.name || t('validator.eventName', { n: i + 1 })}: ${x.text}`);
    });
    if (!issues.size) add('events', 'ok', events.length === 1 ? t('validator.eventsOkOne') : t('validator.eventsOkMany'));
  }

  // Aree: l'area di partenza si controlla; il glifo acceso iniziale non ancora (i glifi non sono ancora nell'editor)
  if (map.areas?.some((a) => a.start)) add('start-area', 'ok', t('validator.startAreaOk'));
  else add('start-area', 'error', t('validator.startAreaMissing'));
  if (map.tiles.length) {
    if (unassignedTiles > 0) add('unassigned', 'error', unassignedTiles === 1 ? t('validator.unassignedOne') : t('validator.unassignedMany', { n: unassignedTiles }));
    else add('unassigned', 'ok', t('validator.unassignedOk'));
  }
  // Bauli: ognuno ha bisogno di una ricompensa della tabella (a meno che abbia un contenuto suo)
  const chests = (map.markers ?? []).filter((m): m is Extract<typeof m, { type: 'chest' }> => m.type === 'chest' && !m.contents?.length);
  if (chests.length) {
    const lacking = (['copper', 'silver', 'gold'] as const).some((tier) => chests.filter((c) => c.tier === tier).length > (map.chestTable?.[tier]?.length ?? 0));
    if (lacking) add('chest-rewards', 'error', t('validator.chestLacking'));
    else add('chest-rewards', 'ok', t('validator.chestOk'));
  }

  // Descrizioni: ogni area diversa da quella di partenza deve averne una (compare quando gli eroi la rivelano)
  const others = (map.areas ?? []).filter((a) => !a.start);
  if (others.length) {
    if (others.some((a) => !a.text?.trim())) add('area-text', 'error', t('validator.areaTextMissing'));
    else add('area-text', 'ok', t('validator.areaTextOk'));
  }
  // L'area di partenza ha il glifo già acceso e le caselle dove gli eroi scelgono di cominciare
  const startArea = map.areas?.find((a) => a.start);
  if (startArea) {
    const inArea = new Set((startArea.cells ?? []).map((c) => `${c.x},${c.y}`));
    const glyph = (map.markers ?? []).some((m) => m.type === 'glyph' && m.active && inArea.has(`${m.x},${m.y}`));
    add('start-glyph', glyph ? 'ok' : 'error', glyph ? t('validator.startGlyphOk') : t('validator.startGlyphMissing'));
    const cells = (map.start ?? []).filter((c) => inArea.has(`${c.x},${c.y}`)).length;
    if (cells < HERO_START_CELLS) add('start-placement', 'error', cells ? (cells === 1 ? t('validator.startCellsOne', { min: HERO_START_CELLS }) : t('validator.startCellsFew', { n: cells, min: HERO_START_CELLS })) : t('validator.startCellsNone'));
    else add('start-placement', 'ok', t('validator.startCellsOk', { n: cells, min: HERO_START_CELLS }));
  }

  // Porte runiche
  const runeDoors = [...new Set((map.doors ?? []).flatMap((d) => (d.lock?.kind === 'rune' ? [d.lock.color] : [])))];
  const keys = runeKeysPlaced(map);
  const lost = runeDoors.filter((c) => !keys.has(c));
  for (const c of lost) add(`rune-${c}`, 'error', t('validator.runeMissing', { color: colorName(c) }));
  if (runeDoors.length && !lost.length) add('rune', 'ok', t('validator.runeOk'));

  // Porte evento: nessuno le apre a mano, quindi serve un evento che le apra
  const eventDoors = [...new Set((map.doors ?? []).flatMap((d) => (d.lock?.kind === 'event' ? [d.lock.id] : [])))];
  const opened = new Set((map.events ?? []).flatMap((e) => flattenEffects([...e.then, ...(e.else ?? [])]).flatMap((f) => (f.kind === 'openDoor' ? [f.doorId] : []))));
  const sealed = eventDoors.filter((id) => !opened.has(id));
  if (sealed.length) add('event-doors', 'error', sealed.length === 1 ? t('validator.eventDoorOne') : t('validator.eventDoorMany', { n: sealed.length }));
  else if (eventDoors.length) add('event-doors', 'ok', t('validator.eventDoorOk'));

  // Avvertimenti
  if (!map.tiles.length) add('empty', 'warning', t('validator.emptyMap'));
  else if (openExits > 0) add('exits', 'warning', openExits === 1 ? t('validator.exitsOne') : t('validator.exitsMany', { n: openExits }));
  else add('exits', 'ok', t('validator.exitsOk'));

  return out;
}

/** Gli effetti di una lista con anche quelli dentro i due rami delle Prove (a qualunque profondità). */
export function flattenEffects(list: readonly EventEffect[]): EventEffect[] {
  return list.flatMap((f) => (f.kind === 'check' ? [f, ...flattenEffects(f.onSuccess), ...flattenEffects(f.onFail)] : [f]));
}

/** Gli id dei segnalini incontro che nessun evento usa: né "un eroe usa un incontro" su di loro né "gli incontri non ci sono più" che li comprenda (lista, o tutti; nell'area, se c'è). */
export function unlinkedEncounters(map: MapData): string[] {
  const triggers = (map.events ?? []).flatMap(triggersOf);
  const areaOf = (x: number, y: number) => (map.areas ?? []).find((a) => a.cells?.some((c) => c.x === x && c.y === y))?.id;
  return (map.markers ?? []).flatMap((m) => {
    if (m.type !== 'encounter') return [];
    const linked = !!m.id && triggers.some((t) => (t.kind === 'encounterUsed' && t.markerId === m.id) || (t.kind === 'encountersGone' && (!t.markerIds?.length || t.markerIds.includes(m.id!)) && (!t.area || t.area === areaOf(m.x, m.y))));
    return linked ? [] : [m.id ?? ''];
  });
}

/** Il nome di un oggetto a terra nell'elenco degli eventi: "Denaro · Area 2 · casella 3, 4" (senza l'area se la casella non ne ha). */
export function pickupLabel(m: Marker, area?: string, itemName?: (id: string) => string | undefined): string {
  const name =
    m.type === 'potion' ? (m.kind === 'heal' ? t('pickup.healPotion') : t('pickup.vitalPotion'))
    : m.type === 'coins' ? t('pickup.coins')
    : m.type === 'key' ? t('pickup.key')
    : m.type === 'rune' ? t('pickup.rune', { color: colorName(m.color) })
    : m.type === 'item' ? (m.look?.title?.trim() || itemName?.(m.itemId) || t('pickup.item'))
    : m.type === 'encounter' ? (m.label?.trim() || t('pickup.encounter'))
    : t('pickup.token');
  return `${name} · ${area ? `${area} · ` : ''}${t('pickup.cell', { x: m.x, y: m.y })}`;
}

/** Gli id dei nemici su cui c'è un evento: quelli che lo fanno scattare (sconfitto, interazione, gruppo) o che ne subiscono gli effetti. */
export function piecesWithEvents(map: MapData): Set<string> {
  const out = new Set<string>();
  for (const e of map.events ?? []) {
    for (const w of triggersOf(e)) {
      if (w.kind === 'defeated' || w.kind === 'interact') out.add(w.pieceId);
      else if (w.kind === 'cleared') for (const id of w.pieceIds ?? []) out.add(id);
    }
    for (const f of flattenEffects([...e.then, ...(e.else ?? [])])) if (f.kind === 'modifyMonster' || f.kind === 'finishRevival' || f.kind === 'activate' || f.kind === 'removePiece' || f.kind === 'makeVulnerable' || (f.kind === 'setLook' || f.kind === 'setBehavior') || f.kind === 'removeImmunity') for (const id of targetsOf(f)) if (id !== THIS_PIECE) out.add(id);
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
  a.kind === b.kind && (a.kind === 'overlordTurnEnd' ? true : a.kind === 'cleared' || a.kind === 'encountersGone' ? JSON.stringify(a) === JSON.stringify(b) : a.kind === 'encounterUsed' ? a.markerId === (b as typeof a).markerId : a.kind === 'defeated' || a.kind === 'interact' ? a.pieceId === (b as typeof a).pieceId : a.kind === 'pickedUp' ? a.markerId === (b as typeof a).markerId : a.area === (b as { area: string }).area);

/** Due eventi hanno una causa in comune se un loro innesco è lo stesso. */
const sameTrigger = (a: AdventureEvent, b: AdventureEvent) => triggersOf(a).some((x) => triggersOf(b).some((y) => sameOne(x, y)));

/** Due eventi non possono scattare insieme se uno chiede una variabile accesa e l'altro la stessa spenta. */
const ITEM_PLACES = ['hero', 'ground', 'monster', 'none'];

/** I posti in cui un oggetto può stare perché valgano tutte le condizioni di `e` su di lui (null se `e` non ne ha). */
const allowedAt = (e: AdventureEvent, item: string): Set<string> | null => {
  let set = null as Set<string> | null;
  for (const c of e.if ?? []) {
    if (!isItemCondition(c) || c.item !== item) continue;
    const here = new Set(c.not ? ITEM_PLACES.filter((p) => p !== c.at) : [c.at]);
    set = set ? new Set([...set].filter((p) => here.has(p))) : here;
  }
  return set;
};

const exclusive = (a: AdventureEvent, b: AdventureEvent) =>
  (a.if ?? []).some((x) => {
    if (isItemCondition(x)) {
      const mine = allowedAt(a, x.item);
      const theirs = allowedAt(b, x.item);
      return !!mine && !!theirs && ![...mine].some((p) => theirs.has(p)); // nessun posto in cui valgano insieme
    }
    return (b.if ?? []).some((y) => !isItemCondition(y) && y.variable === x.variable && y.is !== x.is);
  });

/** I problemi di ogni evento (per id; gli eventi senza problemi non compaiono): riferimenti che non esistono più, condizioni o effetti che si contraddicono, eventi che non possono mai scattare. */
export function validateEvents(map: MapData): Map<string, EventIssue[]> {
  const out = new Map<string, EventIssue[]>();
  const events = map.events ?? [];
  const pieces = new Set((map.pieces ?? []).map((p) => p.id));
  const vars = new Set(map.variables ?? []);
  const effectsOf = (e: AdventureEvent): EventEffect[] => flattenEffects([...e.then, ...(e.else ?? [])]);
  const turnedOn = new Set(events.flatMap((e) => effectsOf(e).flatMap((f) => (f.kind === 'setVariable' && f.value ? [f.variable] : []))));
  const revivable = new Set(events.filter((e) => effectsOf(e).some((f) => f.kind === 'revive')).flatMap((e) => triggersOf(e).flatMap((t) => (t.kind === 'defeated' ? [t.pieceId] : []))));
  const label = (e: AdventureEvent) => e.name || t('validator.eventName', { n: events.indexOf(e) + 1 });
  const push = (e: AdventureEvent, level: EventIssue['level'], text: string) => out.set(e.id, [...(out.get(e.id) ?? []), { level, text }]);

  for (const e of events) {
    const triggers = triggersOf(e);
    const hasThis = triggers.some((t) => t.kind === 'defeated' || t.kind === 'interact');
    const hasDefeated = triggers.some((t) => t.kind === 'defeated');
    const hasCleared = triggers.some((t) => t.kind === 'cleared');
    for (const w of triggers) {
    if (w.kind === 'defeated' || w.kind === 'interact') {
      if (!pieces.has(w.pieceId)) push(e, 'error', t('validator.ev.pieceGone'));
      else if (w.kind === 'interact' && (map.pieces ?? []).find((p) => p.id === w.pieceId)?.team !== 'monster') push(e, 'error', t('validator.ev.interactEnemyOnly'));
      else if (w.kind === 'interact' && w.onlyInactive && !(map.pieces ?? []).find((p) => p.id === w.pieceId)?.inactive) push(e, 'warning', t('validator.ev.interactInactive'));
    } else if (w.kind === 'cleared') {
      for (const id of w.pieceIds ?? []) if (!pieces.has(id)) push(e, 'error', t('validator.ev.listPieceGone'));
      if (w.area && !(map.areas ?? []).some((a) => a.id === w.area)) push(e, 'error', t('validator.ev.areaGone'));
      if (!w.pieceIds?.length && !(map.pieces ?? []).some((p) => p.team === 'monster')) push(e, 'warning', t('validator.ev.noEnemies'));
    } else if (w.kind === 'encounterUsed') {
      if (!(map.markers ?? []).some((m) => m.type === 'encounter' && m.id === w.markerId)) push(e, 'error', t('validator.ev.encounterGone'));
    } else if (w.kind === 'encountersGone') {
      const here = (map.markers ?? []).filter((m) => m.type === 'encounter');
      for (const id of w.markerIds ?? []) if (!here.some((m) => m.id === id)) push(e, 'error', t('validator.ev.listEncounterGone'));
      if (w.area && !(map.areas ?? []).some((a) => a.id === w.area)) push(e, 'error', t('validator.ev.areaGone'));
      if (!here.length) push(e, 'warning', t('validator.ev.noEncounters'));
    } else if (w.kind === 'pickedUp') {
      if (!(map.markers ?? []).some((m) => 'id' in m && m.id === w.markerId)) push(e, 'error', t('validator.ev.itemGone'));
    } else if (w.kind !== 'overlordTurnEnd') {
      const area = (map.areas ?? []).find((a) => a.id === w.area);
      if (!area) push(e, 'error', t('validator.ev.areaGone'));
      else if (w.kind === 'chestOpened' && area.cells?.length && !(map.markers ?? []).some((m) => m.type === 'chest' && area.cells!.some((c) => c.x === m.x && c.y === m.y))) push(e, 'error', t('validator.ev.noChestInArea'));
    }
    }
    const seenTriggers = new Set<string>();
    for (const w of triggers) {
      const key = JSON.stringify(w);
      if (seenTriggers.has(key)) push(e, 'warning', t('validator.ev.duplicateTrigger'));
      seenTriggers.add(key);
    }

    const cond = new Map<string, Set<boolean>>();
    const itemsSeen = new Set<string>();
    for (const c of e.if ?? []) {
      if (isItemCondition(c)) {
        itemsSeen.add(c.item);
        continue;
      }
      if (!vars.has(c.variable)) push(e, 'error', t('validator.ev.varGone', { name: c.variable }));
      else if (c.is && !turnedOn.has(c.variable)) push(e, 'warning', t('validator.ev.varNeverOn', { name: c.variable }));
      cond.set(c.variable, (cond.get(c.variable) ?? new Set()).add(c.is));
    }
    for (const item of itemsSeen) if (allowedAt(e, item)!.size === 0) push(e, 'error', t('validator.ev.itemContradiction', { name: item }));
    for (const [v, is] of cond) if (is.size > 1) push(e, 'error', t('validator.ev.varContradiction', { name: v }));
    if (e.else?.length && !e.if?.length) push(e, 'warning', t('validator.ev.elseNoCondition'));
    if (!e.then.length) push(e, 'error', t('validator.ev.noEffects'));

    for (const [name, list] of [[t('validator.ev.branch.then'), flattenEffects(e.then)], [t('validator.ev.branch.else'), flattenEffects(e.else ?? [])]] as const) {
      const set = new Map<string, Set<boolean>>();
      for (const f of list) {
        if (f.kind === 'setVariable') {
          if (!vars.has(f.variable)) push(e, 'error', t('validator.ev.varGone', { name: f.variable }));
          set.set(f.variable, (set.get(f.variable) ?? new Set()).add(f.value));
        }
        if (f.kind === 'modifyMonster' || f.kind === 'finishRevival' || f.kind === 'activate' || f.kind === 'removePiece' || f.kind === 'makeVulnerable' || (f.kind === 'setLook' || f.kind === 'setBehavior') || f.kind === 'removeImmunity') {
          const verb = t(`validator.ev.verb.${f.kind}`);
          const ids = targetsOf(f);
          if (!ids.length) push(e, 'error', t('validator.ev.noTarget', { verb }));
          if (ids.includes(THIS_PIECE) && !hasThis) push(e, 'error', t('validator.ev.thisPieceMisuse'));
          for (const id of ids) if (id !== THIS_PIECE && !pieces.has(id)) push(e, 'error', t('validator.ev.targetGone', { verb }));
          if (f.kind === 'activate') {
            const known = ids.flatMap((id) => (map.pieces ?? []).filter((p) => p.id === id));
            if (known.length && known.every((p) => !p.inactive)) push(e, 'warning', t('validator.ev.activateNoop'));
          }
          if (f.kind === 'setBehavior') {
            if (behaviorLost(map, f.behavior)) push(e, 'error', t('validator.ev.behaviorObstacleGone'));
          }
          if (f.kind === 'finishRevival' && ids.some((id) => pieces.has(id) && !revivable.has(id))) push(e, 'warning', t('validator.ev.finishRevivalNoop'));
        }
        if (f.kind === 'moveItem') {
          if (!(map.markers ?? []).some((m) => m.type === 'item' && m.id === f.markerId)) push(e, 'error', t('validator.ev.moveItemGone'));
          if (!(map.start ?? []).length) push(e, 'error', t('validator.ev.moveItemNoStart'));
        }
        if (f.kind === 'placeItem' && !(map.start ?? []).length) push(e, 'error', t('validator.ev.placeItemNoStart'));
        if (f.kind === 'check') {
          if (!f.text.trim()) push(e, 'error', t('validator.ev.checkNoText'));
          if (!f.onSuccess.length && !f.onFail.length) push(e, 'warning', t('validator.ev.checkNoEffects'));
          if (f.kind === 'check' && hasCleared) push(e, 'warning', t('validator.ev.checkAfterCleared'));
        }
        if (f.kind === 'openDoor' && !(map.doors ?? []).some((d) => d.lock?.kind === 'event' && d.lock.id === f.doorId)) push(e, 'error', t('validator.ev.doorGone'));
        if (f.kind === 'modifyMonster' && !f.wounds && !f.speed && !f.armor) push(e, 'warning', t('validator.ev.modifyNoop'));
        if (f.kind === 'revive' && !hasDefeated) push(e, 'error', t('validator.ev.reviveNoDefeated'));
        if (f.kind === 'message' && !f.text.trim()) push(e, 'error', t('validator.ev.messageNoText'));
        if (f.kind === 'progress' && !f.amount) push(e, 'warning', t('validator.ev.progressZero'));
      }
      for (const [v, is] of set) if (is.size > 1) push(e, 'error', t('validator.ev.varOnOff', { branch: name, name: v }));
      if (list.filter((f) => f.kind === 'revive').length > 1) push(e, 'warning', t('validator.ev.multiRevive', { branch: name }));
      if (list.some((f) => f.kind === 'revive') && list.some((f) => f.kind === 'win')) push(e, 'error', t('validator.ev.reviveWin', { branch: name }));
    }
  }

  // Due eventi con la stessa causa che possono scattare insieme, se uno fa vincere
  events.forEach((a, i) => {
    for (const b of events.slice(i + 1)) {
      if (!sameTrigger(a, b) || exclusive(a, b)) continue;
      for (const [x, y] of [[a, b], [b, a]] as const) {
        const xs = x.then;
        const ys = y.then;
        if (xs.some((f) => f.kind === 'win') && ys.some((f) => f.kind === 'revive')) push(x, 'error', t('validator.ev.winRevive', { name: label(y) }));
        else if (xs.some((f) => f.kind === 'win') || ys.some((f) => f.kind === 'win')) push(x, 'warning', t('validator.ev.winTogether', { name: label(y) }));
      }
    }
  });
  return out;
}
