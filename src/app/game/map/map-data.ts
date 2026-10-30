import type { GlobalBehavior } from '../pieces/pawn-behavior';
import type { Wall } from '../board/wall';
import type { Loot } from '../board/marker';
import type { PawnBehavior } from '../pieces/pawn-behavior';
import type { PawnLook } from '../pieces/pawn-look';
import { Door } from '../board/door';
import { ChestTable, Marker } from '../board/marker';
import { Obstacle } from '../board/obstacle';
import { PartyData } from '../party';
import { PieceData } from '../pieces/piece';
import { Rotation, TileDef, loadTileDef, rotateTile, tileCells } from './tile';

/** Una riga della mappa salvata: quale tile, dove (in celle) e con quale rotazione. */
export interface MapTileRef {
  tile: string;
  x: number;
  y: number;
  rot: Rotation;
  /** L'area a cui appartiene il tile (un id scelto dall'autore): i tile con lo stesso id formano un'area, per esempio una stanza o i corridoi fra un gruppo di porte. Senza, il tile non fa parte di nessuna area. */
  area?: string;
}

/**
 * L'obiettivo dell'avventura. `defeat`: sconfiggere una pedina (`pieceId`, di solito il boss): quando non c'è più, gli eroi vincono. `text`: solo testo, senza una condizione di vittoria
 * automatica (come lo scrive l'editor finché non si sceglie una pedina). `text` è come lo si dice in breve ai giocatori, `description` il testo lungo che si legge a inizio partita,
 * `conclusion` il testo (markdown) che compare quando l'obiettivo è raggiunto, `reward` i punti Conquista che dà il raggiungerlo.
 */
export type AdventureObjective =
  | { kind: 'defeat'; pieceId: string; text?: string; description?: string; conclusion?: string; reward?: number }
  | { kind: 'text'; text?: string; description?: string; conclusion?: string; reward?: number }
  | { kind: 'event'; text?: string; description?: string; conclusion?: string; reward?: number };

/**
 * Gli eventi dell'avventura (docs/REGOLE.md, "Eventi"): "quando succede X, se vale Y, fai Z". Le variabili sono interruttori (acceso/spento, tutti spenti all'inizio) con un nome scelto
 * dall'autore: gli eventi li accendono e li leggono, e così la partita si ricorda cosa è successo (un cuore trovato, un fratello già morto).
 */
export type EventTrigger =
  /** Una pedina è sconfitta (esce dalla mappa); l'evento gira prima del bottino e della vittoria. */
  | { kind: 'defeated'; pieceId: string }
  /** Uno scrigno è aperto in un'area (`area`: id di `MapData.areas`). */
  | { kind: 'chestOpened'; area: string }
  /** Un eroe raccoglie un oggetto a terra (voce "Raccogli" del menu): `markerId` è l'`id` del segnalino, assegnato dall'editor. */
  | { kind: 'pickedUp'; markerId: string }
  /** Gli eroi vedono per la prima volta l'area. */
  | { kind: 'areaRevealed'; area: string }
  /** Un eroe adiacente interagisce con la pedina (voce "?" del menu contestuale, badge "?" sulla miniatura): costa `cost` punti movimento (se manca, `INTERACT_COST`) e si può fare una volta sola. */
  | { kind: 'interact'; pieceId: string; cost?: number; onlyInactive?: boolean }
  /**
   * Non c'è più nessun nemico fra quelli scelti (`pieceIds`; senza, qualunque nemico) nella mappa o, se c'è `area`, in quell'area: sono sconfitti, rimossi da un evento o usciti
   * dall'area camminando. Scatta nel passaggio da "ce n'è almeno uno" a "non ce n'è più", una volta per volta; non scatta se all'inizio non ce n'era nessuno.
   */
  | { kind: 'cleared'; pieceIds?: string[]; area?: string }
  /** Un eroe usa un segnalino Incontro (markerId: il suo id): è il menu del "!" quando ci si ferma sulla sua casella. */
  | { kind: 'encounterUsed'; markerId: string }
  /**
   * I segnalini Incontro scelti (markerIds; senza, tutti) non sono più nella mappa o, se c'è rea, in quell'area: sono stati usati. Scatta nel passaggio da "ce n'è almeno uno" a
   * "non ce n'è più", una volta per volta, e non scatta se all'inizio non ce n'erano.
   */
  | { kind: 'encountersGone'; markerIds?: string[]; area?: string }
  /** Finisce il turno del Signore supremo (dopo che i mostri hanno giocato, prima che cominci il round dopo): serve per ricompense e penalità a fine turno, di solito con una condizione. */
  | { kind: 'overlordTurnEnd' };

/** Una condizione su una variabile: è accesa (`is` vero) o spenta. */
export interface VariableCondition {
  variable: string;
  is: boolean;
}

/** Una condizione su un oggetto del catalogo: in questo momento è con un eroe, a terra (un segnalino sulla mappa) o con un mostro (o, con `not`, non lo è). */
export interface ItemCondition {
  item: string;
  at: 'hero' | 'ground' | 'monster';
  /** Vale se l'oggetto NON sta lì (per esempio "non è con un eroe": a terra o con un mostro). */
  not?: boolean;
}

/** Una condizione di un evento: tutte quelle di un evento devono valere. */
export type EventCondition = VariableCondition | ItemCondition;

export const isItemCondition = (c: EventCondition): c is ItemCondition => 'item' in c;

export type EventEffect =
  /** Una dialog con il testo (markdown) e "Ho letto". */
  | { kind: 'message'; title?: string; text: string }
  /** Cambia la Conquista (anche in negativo). */
  | { kind: 'progress'; amount: number }
  | { kind: 'setVariable'; variable: string; value: boolean }
  /** Cambia per il resto della partita i valori di una pedina (anche una che aspetta di tornare in vita): somme (o sottrazioni) alle ferite massime e attuali, alla velocità e all'armatura. */
  | { kind: 'modifyMonster'; pieceId: string; pieceIds?: string[]; wounds?: number; speed?: number; armor?: number }
  /** Solo negli eventi "sconfitto": la pedina non muore, esce dalla mappa e dopo `turns` turni del Signore supremo torna a piena salute in una casella già scoperta, lontana almeno `distance` caselle dagli eroi (o la più lontana possibile). */
  | { kind: 'revive'; turns: number; distance: number }
  /** Se la pedina sta aspettando di tornare in vita, la sua sconfitta si ripete adesso (con le variabili di adesso): così un evento può "chiudere" un ritorno in vita. */
  | { kind: 'finishRevival'; pieceId: string; pieceIds?: string[] }
  /**
   * Una prova con i dadi: l'eroe che ha fatto scattare l'evento legge `text` (markdown) e tira tanti dadi potere quanti sono i dadi in più del suo attacco `dice` (come dice la sua
   * scheda: nessun dado, nessun tiro e la prova fallisce; la fatica non si spende). Con almeno `needs` onde (1 se manca) la prova è superata e valgono gli effetti di `onSuccess`,
   * altrimenti quelli di `onFail`. Di base l'eroe può spendere 1 fatica per ogni dado potere in più prima di tirare (massimo `CHECK_MAX_DICE` dadi); con `noFatigue` non può. Con `refusable` l'eroe può anche rinunciare: non succede niente, e se la prova veniva da un'interazione il costo si restituisce e l'interazione
   * resta disponibile.
   */
  | { kind: 'check'; title?: string; text: string; dice: 'melee' | 'ranged' | 'magic'; needs?: number; refusable?: boolean; noFatigue?: boolean; onSuccess: EventEffect[]; onFail: EventEffect[] }
  /** Si apre una porta evento (`lock: {kind:'event', id}`): da ora è una porta aperta e libera come le altre. */
  | { kind: 'openDoor'; doorId: string }
  /** Un nemico inattivo si attiva: perde il flag `inactive` e da ora agisce come un nemico qualunque (con i suoi valori normali). */
  | { kind: 'activate'; pieceId: string; pieceIds?: string[] }
  /** Una pedina esce dalla mappa senza essere sconfitta (per esempio dopo una prova superata): niente bottino, niente eventi "sconfitto". */
  | { kind: 'removePiece'; pieceId: string; pieceIds?: string[] }
  /** Un nemico invincibile (PieceData.invincible) torna vulnerabile: da ora le ferite contano. */
  | { kind: 'makeVulnerable'; pieceId: string; pieceIds?: string[] }
  /** Toglie un'immunità a un nemico: immunity è ll (tutti gli stati) o una voce di Piece.immune. Le altre immunità restano. */
  | { kind: 'removeImmunity'; pieceId: string; pieceIds?: string[]; immunity: string }
  /** Cambia l'aspetto visivo di un nemico (`look`: pietra o cristallo; senza, normale): il vecchio stile svanisce con una dissolvenza. Non cambia nient'altro (inattivo e invincibile restano). */
  | { kind: 'setLook'; pieceId: string; pieceIds?: string[]; look?: PawnLook }
  /** Cambia il comportamento speciale di un nemico (`behavior`; senza, normale): vale dal turno del Signore supremo dopo. */
  | { kind: 'setBehavior'; pieceId: string; pieceIds?: string[]; behavior?: PawnBehavior }
  /** L'eroe che ha fatto scattare l'evento riceve un premio (come il contenuto di un baule, `Loot`): Conquista, denaro (a ogni eroe), chiavi e chiavi runiche vanno al gruppo; un oggetto va all'eroe (se non ha posto cade a terra nella sua casella). */
  | { kind: 'give'; reward: Loot }
  /** Mette un oggetto del catalogo a terra (`where`: accanto alle caselle di partenza degli eroi, in una casella libera a caso): per esempio la Principessa da portare in salvo. */
  | { kind: 'placeItem'; itemId: string; where: 'nearStart' }
  /** Cambia la Minaccia del Signore supremo (anche in negativo, mai sotto 0). */
  | { kind: 'threat'; amount: number }
  /** Il Signore supremo pesca `count` carte (1 se manca) dal suo mazzo, come a inizio turno (la mano non supera il limite). */
  | { kind: 'drawCard'; count?: number }
  /** Aggiunge un pezzo al finale della vittoria (di solito con una condizione, per i finali alternativi): `text` (markdown) compare dopo la conclusione dell'obiettivo e `points` (anche negativi) si somma ai punti Conquista dell'obiettivo. Non fa vincere: conta se poi la partita si vince. */
  | { kind: 'addEnding'; text?: string; points?: number }
  /** Gli eroi vincono: la partita finisce con la conclusione e i punti dell'obiettivo (più i pezzi aggiunti con `addEnding`). */
  | { kind: 'win' };

export interface AdventureEvent {
  id: string;
  /** Un nome per riconoscerlo nell'editor. */
  name?: string;
  when: EventTrigger;
  /** Altri inneschi: l'evento scatta quando succede when oppure uno di questi ("quando… oppure quando…"). */
  orWhen?: EventTrigger[];
  /** Scatta una sola volta: dopo il primo scatto non parte più (se le condizioni non valgono non conta come scatto). */
  once?: boolean;
  /** Tutte le condizioni devono valere (E). Senza, l'evento scatta sempre. */
  if?: EventCondition[];
  /** Gli effetti se le condizioni valgono (o se non ce ne sono). */
  then: EventEffect[];
  /** Gli effetti se le condizioni non valgono. */
  else?: EventEffect[];
}

/** Il formato salvato della mappa: solo un elenco di tile e il seme per i dettagli. */
export interface MapData {
  seed: number;
  tiles: MapTileRef[];
  /** Le aree con un nome e un testo da leggere quando gli eroi le rivelano (facoltativo: un'area esiste anche solo con l'`area` scritta sui tile). */
  areas?: { id: string; name?: string; /** Una riga sotto il nome (l'editor la chiede per le aree diverse da quella di partenza). */ subtitle?: string; text?: string; /** L'area di partenza degli eroi (una sola). */ start?: boolean; /** Le caselle dell'area, quando non coincide con tile interi (per esempio un corridoio diviso in due da una porta). Valgono più di `area` sul tile. */ cells?: { x: number; y: number }[] }[];
  /** Porte: per ora stanno nel file della mappa, ma sono dati dell'avventura, non dei tile. */
  doors?: Door[];
  /** Ostacoli naturali (rocce, buche, acqua): dati dell'avventura. */
  obstacles?: Obstacle[];
  /** Comportamenti globali dei mostri (per tipo, o per tutti): vedi `GlobalBehavior`. */
  behaviors?: GlobalBehavior[];
  /** Muri dell'avventura (segmenti sulla griglia che bloccano movimento e vista, senza creare aree): dati dell'avventura. */
  walls?: Wall[];
  /** Segnalini sulla mappa (glifi, ...): dati dell'avventura. */
  markers?: Marker[];
  /** Pedine all'inizio: dati dell'avventura. Se mancano, parte un solo eroe. */
  pieces?: PieceData[];
  /** Regole speciali dell'avventura (markdown): un messaggio che gli eroi leggono dopo l'obiettivo a inizio partita e che si rilegge dal tasto Obiettivo. Facoltativo. */
  rules?: string;
  /** Conquista di partenza degli eroi (se manca, DEFAULT_PROGRESS). */
  progress?: number;
  /** Chiavi e chiavi runiche che il gruppo ha all'inizio (per le prove). */
  party?: PartyData;
  /** L'obiettivo dell'avventura: sconfiggere una pedina (`pieceId`, di solito il boss). Quando non c'è più, gli eroi vincono; `text` è come lo si dice ai giocatori. */
  objective?: AdventureObjective;
  /** Il titolo dell'avventura e la sua introduzione (testo lungo): si leggono in una dialog prima di mettere in campo gli eroi. Senza `intro` e senza `start` la partita parte subito. */
  title?: string;
  intro?: string;
  /** La tabella dei ritrovamenti degli scrigni: le ricompense casuali di ogni tipo (fino a 3, 2 per l'oro). Uno scrigno con `contents` suoi non la usa. */
  chestTable?: ChestTable;
  /** I nomi delle variabili degli eventi (tutte spente all'inizio) e gli eventi stessi. */
  variables?: string[];
  events?: AdventureEvent[];
  /** Le torce appese ai muri: `x`, `y` è l'incrocio della griglia a cui sono agganciate (l'angolo in alto a sinistra della casella x, y) e `facing` la direzione in cui sporgono dal muro, verso la stanza. */
  torches?: { x: number; y: number; facing: 'N' | 'E' | 'S' | 'W' }[];
  /** Le caselle dell'area di partenza fra cui gli eroi scelgono dove cominciare. Senza, valgono le caselle libere intorno al glifo iniziale acceso. */
  start?: { x: number; y: number }[];
}

/** Un tile già ruotato e collocato: x, y è l'angolo in alto a sinistra, in celle. */
export interface PlacedTile {
  def: TileDef;
  x: number;
  y: number;
  /** Vedi `MapTileRef.area`. */
  area?: string;
  /** L'area di singole caselle ("x,y" della mappa → id dell'area): ha la precedenza su `area` (vedi `MapData.areas[].cells`). */
  areaCells?: Map<string, string>;
}

export async function loadMap(url: string): Promise<{ data: MapData; placed: PlacedTile[] }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Mappa "${url}" non trovata`);
  const data: MapData = await res.json();

  const ids = [...new Set(data.tiles.map((t) => t.tile))];
  const defs = new Map(await Promise.all(ids.map(async (id) => [id, await loadTileDef(id)] as const)));

  const placed: PlacedTile[] = data.tiles.map((t) => ({
    def: rotateTile(defs.get(t.tile)!, t.rot),
    x: t.x,
    y: t.y,
    area: t.area,
  }));
  // Le aree fatte di singole caselle (editor): ogni casella va al tile che la contiene.
  for (const a of data.areas ?? []) {
    for (const c of a.cells ?? []) {
      const tile = placed.find((t) => tileCells(t.def).has(`${c.x - t.x},${c.y - t.y}`));
      if (tile) (tile.areaCells ??= new Map()).set(`${c.x},${c.y}`, a.id);
    }
  }
  return { data, placed };
}

/** Nel campo `pieceId` di un effetto: "il nemico dell'evento", cioè quello sconfitto o con cui si è interagito (vale solo se l'innesco è "sconfitto" o "interagisce"). */
export const THIS_PIECE = '$this';

/** Tutti gli inneschi di un evento: `when` e poi `orWhen`. */
export const triggersOf = (e: AdventureEvent): EventTrigger[] => [e.when, ...(e.orWhen ?? [])];

/** I nemici su cui agisce un effetto (`pieceId` e poi `pieceIds`), senza ripetizioni; `$this` non è ancora risolto. */
export const targetsOf = (e: { pieceId: string; pieceIds?: string[] }): string[] => [...new Set([e.pieceId, ...(e.pieceIds ?? [])].filter(Boolean))];