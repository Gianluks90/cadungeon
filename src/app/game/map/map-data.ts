import type { GlobalBehavior } from '../pieces/pawn-behavior';
import type { Wall } from '../board/wall';
import type { Loot } from '../board/marker';
import type { PawnBehavior } from '../pieces/pawn-behavior';
import type { PawnLook } from '../pieces/pawn-look';
import { Door } from '../board/door';
import { ChestTable, Marker } from '../board/marker';
import { Obstacle } from '../board/obstacle';
import type { ItemMod } from '../items/item';
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
  /** Finisce il turno del Maligno (dopo che i mostri hanno giocato, prima che cominci il round dopo): serve per ricompense e penalità a fine turno, di solito con una condizione. */
  /** Un eroe usa una zona (la voce "!" `label` se è adiacente a una sua casella o ci sta dentro, al costo `cost` della zona): `zoneId` è il suo id. */
  | { kind: 'zoneUsed'; zoneId: string }
  /**
   * Un eroe entra in una casella della zona venendo da fuori (anche solo passandoci sopra). Con `everyStep` scatta a ogni passo che finisce su una casella della zona, anche venendo da
   * un'altra sua casella: per le stanze piene di trappole, dove ogni volta che si mette piede su una casella pericolosa scatta.
   */
  | { kind: 'zoneEntered'; zoneId: string; everyStep?: boolean; /** Solo quando si fa scattare (non nei dati): il passo viene da fuori dalla zona. */ fromOutside?: boolean }
  | { kind: 'evilTurnEnd'; /** Solo alla fine di questo round (da 1); senza, a ogni round. */ round?: number }
  /** Comincia il turno del Maligno (dopo che ha ricaricato l'Odio e pescato, prima che i mostri agiscano): serve per effetti che si ripetono a ogni round, di solito con una condizione. */
  | { kind: 'evilTurnStart'; /** Solo all'inizio del turno del Maligno di questo round (da 1); senza, a ogni round. */ round?: number };

/**
 * Una zona di innesco: un gruppo di caselle (qualunque forma, anche non collegate; possono stare su ostacoli, buche, bauli, pedine) che non blocca niente e non si vede in partita.
 * Gli eventi la usano come innesco: "un eroe usa una zona" (voce nel menu del "!" quando l'eroe è adiacente a una sua casella o ci sta dentro) e "un eroe entra in una zona".
 * Senza un evento che la usi la voce non compare.
 */
export interface Zone {
  id: string;
  cells: { x: number; y: number }[];
  /** Il testo dell'azione nel menu ("Getta la reliquia"); senza, "Usa". */
  label?: string;
  /** Punti movimento che costa usarla (di base 0); non si paga se scatta solo il ramo "Altrimenti" di un evento. */
  cost?: number;
  /** Parte disattivata: non fa scattare niente finché un evento la attiva (`setZone`). Una zona non si consuma mai da sola: la spegne solo un effetto. */
  off?: boolean;
}

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
  /** Solo negli eventi "sconfitto": la pedina non muore, esce dalla mappa e dopo `turns` turni del Maligno torna a piena salute in una casella già scoperta, lontana almeno `distance` caselle dagli eroi (o la più lontana possibile). */
  | { kind: 'revive'; turns: number; distance: number }
  /** Se la pedina sta aspettando di tornare in vita, la sua sconfitta si ripete adesso (con le variabili di adesso): così un evento può "chiudere" un ritorno in vita. */
  | { kind: 'finishRevival'; pieceId: string; pieceIds?: string[] }
  /**
   * Una prova con i dadi: l'eroe che ha fatto scattare l'evento legge `text` (markdown) e tira tanti dadi competenza quanti sono i dadi in più del suo attacco `dice` (come dice la sua
   * scheda: nessun dado, nessun tiro e la prova fallisce; l'energia non si spende). Con almeno `needs` scintille (1 se manca) la prova è superata e valgono gli effetti di `onSuccess`,
   * altrimenti quelli di `onFail`. Di base l'eroe può spendere 1 energia per ogni dado competenza in più prima di tirare (massimo `CHECK_MAX_DICE` dadi); con `noEnergy` non può. Con `refusable` l'eroe può anche rinunciare: non succede niente, e se la prova veniva da un'interazione il costo si restituisce e l'interazione
   * resta disponibile.
   */
  | { kind: 'check'; title?: string; text: string; dice: 'melee' | 'ranged' | 'magic'; needs?: number; refusable?: boolean; noEnergy?: boolean; onSuccess: EventEffect[]; onFail: EventEffect[] }
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
  /** Cambia il comportamento speciale di un nemico (`behavior`; senza, normale): vale dal turno del Maligno dopo. */
  | { kind: 'setBehavior'; pieceId: string; pieceIds?: string[]; behavior?: PawnBehavior }
  /** L'eroe che ha fatto scattare l'evento riceve un premio (come il contenuto di un baule, `Loot`): Conquista, denaro (a ogni eroe), chiavi e chiavi runiche vanno al gruppo; un oggetto va all'eroe (se non ha posto cade a terra nella sua casella). */
  | { kind: 'give'; reward: Loot }
  /** Mette un oggetto del catalogo a terra (`where`: accanto alle caselle di partenza degli eroi, in una casella libera a caso): per esempio la Principessa da portare in salvo. */
  | { kind: 'placeItem'; itemId: string; where: 'nearStart' }
  /** Sposta un oggetto del catalogo già a terra in mappa (`markerId`, il suo id) accanto alle caselle di partenza degli eroi, in una casella libera a caso; se il segnalino non c'è più o è già stato raccolto non fa niente (e se l'evento non scatta resta dov'è). */
  | { kind: 'moveItem'; markerId: string; where: 'nearStart' }
  /**
   * Una pedina "che entra più tardi" (`PieceData.delayed`) entra in gioco: se c'è `markerId` (un segnalino Incontro) prende il suo posto (il segnalino sparisce), altrimenti compare dov'è stata
   * piazzata nell'editor; se la casella è occupata, in quella libera più vicina. La scena la mostra con la camera che la inquadra.
   */
  | { kind: 'enterPiece'; pieceId: string; markerId?: string }
  /** Toglie dalla mappa gli ostacoli di un tipo (acqua, buca, macerie, o tutti) che stanno in un'area (`area`: id di `MapData.areas`): svaniscono rimpicciolendosi, come se defluissero via. Chi li attraversava da prima passa liberamente. */
  | { kind: 'removeObstacles'; area: string; obstacle: 'water' | 'pit' | 'rock' | 'all' }
  /** L'eroe che ha fatto scattare l'evento muore (come cadendo in una buca letale: perde Conquista pari al suo valore e va in città). Senza un eroe che lo ha causato non fa niente. */
  | { kind: 'killActor' }
  /** Attiva o disattiva una zona di innesco (`Zone.off`): disattivata non fa scattare niente e la sua voce non compare. */
  | { kind: 'setZone'; zoneId: string; state: 'on' | 'off' }
  /** Fa crescere un oggetto che ha dei livelli (`ItemDef.levels`): +`amount` (1 se manca) fino al livello finale. Non fa niente per un oggetto che non cresce. */
  | { kind: 'levelItem'; itemId: string; amount?: number }
  /** Un eroe a scelta del gruppo riceve un oggetto (una dialog chiede chi; con un solo eroe lo riceve lui): per l'oggetto con cui si comincia, con "gli eroi rivelano l'area di partenza". Se non ha posto cade a terra. */
  | { kind: 'giveChosen'; itemId: string }
  /** Il turno degli eroi finisce adesso: chi non ha ancora agito perde ciò che gli resta (movimento, attacchi) e comincia subito il turno del Maligno. Se scatta fuori dal turno degli eroi non fa niente. */
  | { kind: 'endHeroesTurn' }
  /** Cambia l'Odio del Maligno (anche in negativo, mai sotto 0). */
  | { kind: 'hatred'; amount: number }
  /** Il Maligno pesca `count` carte (1 se manca) dal suo mazzo, come a inizio turno (la mano non supera il limite). */
  | { kind: 'drawCard'; count?: number }
  /** Aggiunge un pezzo al finale della vittoria (di solito con una condizione, per i finali alternativi): `text` (markdown) compare dopo la conclusione dell'obiettivo e `points` (anche negativi) si somma ai punti Conquista dell'obiettivo. Non fa vincere: conta se poi la partita si vince. */
  | { kind: 'addEnding'; text?: string; points?: number }
  /** Toglie `amount` ferite a un nemico (le ripristina, senza superare il massimo): nel gioco da tavolo "scarta segnalini ferita". */
  | { kind: 'heal'; pieceId: string; pieceIds?: string[]; amount: number }
  /** Cambia lo stato di un glifo (il glifo nella casella `x`, `y`): spento, acceso o bloccato. Bloccato è rosso e pulsa come uno acceso, ma non si accende e non si viaggia da lui né verso di lui; acceso da un evento non dà Conquista. */
  | { kind: 'setGlyph'; x: number; y: number; state: 'off' | 'on' | 'blocked' }
  /** Cambia lo stato di una scalinata (la coppia di cui una scala sta nella casella `x`, `y`): `open` è presente, `collapsed` è crollata (al suo posto c'è l'ostacolo scelto nell'editor). Vale nei due sensi. */
  | { kind: 'setStairs'; x: number; y: number; state: 'open' | 'collapsed' }
  /** Accende o spegne la morte permanente: finché è accesa un eroe che muore è eliminato (niente città, niente ritorno) e, se non resta nessun eroe, il Maligno vince. */
  | { kind: 'permadeath'; on: boolean }
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
/**
 * Le varianti di preparazione di un'avventura (dialog "Preparazione" dell'editor). Tutto facoltativo: senza, la partita parte con le regole di base.
 * Valgono solo a inizio partita, quindi non stanno nello snapshot.
 */
export interface AdventureSetup {
  /** Monete in più a ogni eroe durante la preparazione, a passi di 25 (anche negative; il totale non scende sotto 0). */
  extraCoins?: number;
  /** I tipi di tesoro che il negozio di preparazione già vende (di base nessuno: servono gli scrigni aperti). */
  pregameTreasures?: ('copper' | 'silver' | 'gold')[];
  /** Carte tolte dal Mazzo del Male: una voce = una copia (la stessa carta si ripete per togliere più copie). */
  evilDeckRemove?: string[];
  /** Carte del Male già in gioco a inizio partita: ognuna toglie una copia dal mazzo, senza doppioni. */
  evilStartInPlay?: string[];
  /** Quante carte ha in mano il Maligno all'inizio (da 0 a EVIL_HAND_MAX; se manca, EVIL_START_HAND). */
  evilStartHand?: number;
}

export interface MapData {
  /** Varianti di preparazione dell'avventura: denaro, tesori in negozio, Mazzo del Male. */
  setup?: AdventureSetup;
  seed: number;
  tiles: MapTileRef[];
  /** Le aree con un nome e un testo da leggere quando gli eroi le rivelano (facoltativo: un'area esiste anche solo con l'`area` scritta sui tile). */
  areas?: { id: string; /** Una riga sotto il nome (l'editor la chiede per le aree diverse da quella di partenza). */ subtitle?: string; text?: string; /** L'area di partenza degli eroi (una sola). */ start?: boolean; /** Dove sta l'etichetta con il nome dell'area (il centro, in caselle): se manca la posiziona da sola `placeAreaLabels`. */ label?: { x: number; y: number }; /** Le caselle dell'area, quando non coincide con tile interi (per esempio un corridoio diviso in due da una porta). Valgono più di `area` sul tile. */ cells?: { x: number; y: number }[] }[];
  /** Porte: per ora stanno nel file della mappa, ma sono dati dell'avventura, non dei tile. */
  doors?: Door[];
  /** Ostacoli naturali (rocce, buche, acqua): dati dell'avventura. */
  obstacles?: Obstacle[];
  /** Le zone di innesco: gruppi di caselle di qualunque forma (anche non collegate) dove succede qualcosa (vedi `Zone`). */
  zones?: Zone[];
  /** Gli oggetti del catalogo che l'avventura personalizza (livelli, maledizione, valori): vedi `ItemMod`. */
  itemMods?: ItemMod[];
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
  /** L'immagine (`id` della raccolta dei gettoni, con una carta `portrait`) che compare inclinata accanto alle regole speciali. Facoltativa. */
  rulesImage?: string;
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