import { RuneColor } from '../game/board/door';
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
 * - una o più aree (diverse da quella di partenza) senza descrizione;
 * - area di partenza non designata. Da implementare (per ora solo testo fra i controlli non disponibili): l'area di partenza senza glifo acceso iniziale e senza aree di posizionamento degli eroi.
 * Gli avvertimenti sono cose che si possono lasciare così, ma forse non è voluto (mappa vuota, uscite non chiuse).
 * `openExits` sono le uscite dei tile che non portano a niente.
 */
export function validate(map: MapData, openExits: number, unassignedTiles = 0): Check[] {
  const out: Check[] = [];
  const add = (id: string, level: CheckLevel, text: string) => out.push({ id, level, text });

  // Informazioni
  const missing: string[] = [];
  if (!map.title?.trim()) missing.push('titolo');
  if (!map.intro?.trim()) missing.push('introduzione');
  if (!(map.objective?.description ?? map.objective?.text)?.trim()) missing.push('obiettivo');
  if (typeof map.progress !== 'number') missing.push('punti Conquista iniziali');
  for (const m of missing) add(`info-${m}`, 'error', `Informazione mancante: ${m}`);
  if (!missing.length) add('info', 'ok', 'Titolo, introduzione, obiettivo e punti Conquista iniziali inseriti');

  // Aree: l'area di partenza si controlla; il glifo acceso iniziale non ancora (i glifi non sono ancora nell'editor)
  if (map.areas?.some((a) => a.start)) add('start-area', 'ok', 'Area di partenza designata');
  else add('start-area', 'error', 'Area di partenza mancante');
  if (map.tiles.length) {
    if (unassignedTiles > 0) add('unassigned', 'error', unassignedTiles === 1 ? 'Una tessera non appartiene a nessuna area' : `${unassignedTiles} tessere non appartengono a nessuna area`);
    else add('unassigned', 'ok', 'Ogni tessera appartiene a un\'area');
  }
  // Descrizioni: ogni area diversa da quella di partenza deve averne una (compare quando gli eroi la rivelano)
  const others = (map.areas ?? []).filter((a) => !a.start);
  if (others.length) {
    if (others.some((a) => !a.text?.trim())) add('area-text', 'error', 'Una o più aree sono senza descrizione');
    else add('area-text', 'ok', 'Ogni area ha la sua descrizione');
  }
  add('start-glyph', 'todo', 'L\'area di partenza non ha il glifo acceso iniziale: il controllo arriverà con i glifi');
  add('start-placement', 'todo', 'L\'area di partenza non ha le aree di posizionamento degli eroi: il controllo arriverà con le aree di posizionamento');

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
