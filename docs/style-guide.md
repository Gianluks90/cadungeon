# Guida di stile di CADungeon

Questa guida descrive lo stile **come è oggi nel codice**. I valori vengono da `src/app/game/theme.ts`
(colori e opacità per ruolo, spessori di linea) e da `src/app/game/constants.ts` (misure e regole).
Se cambia uno dei due file, va aggiornata anche la guida.

## 1. Principi

- **Stile lineare da tavola tecnica.** La mappa è una mappa: contorni sottili e campiture a tratti, mai
  riempimenti pieni e colorati. L'effetto è quello di un disegno su una tavola luminosa.
- **L'ambiente sta nei grigi.** Pavimento, muri, griglia, crepe, pietre e fosse sono grigi neutri
  (nessun marroncino). L'acqua è l'unica eccezione ambientale, in azzurro sottile.
- **I colori sono riservati a UI e significato.** Ambra per ciò che è vivo o selezionato, marrone per le porte
  (si possono usare), rosso per ciò che è ostile, verde solo negli strumenti di sviluppo.
- **Un colore = un significato.** Se serve un significato nuovo, serve un ruolo nuovo in `theme.ts`, non un
  valore scritto a mano. Nessun colore, opacità o spessore sta fuori dai token.
- **Un tema è una tabella ruolo → valore.** Il rendering legge sempre `theme.color.*` e `theme.alpha.*` al momento
  di disegnare; `setTheme(nome)` cambia i valori e la scena si ridisegna.

## 2. Ruoli colore

Valori in `theme.ts`. Per ora c'è un solo tema, quello scuro. Un tema blueprint (blu e bianco) è stato provato e scartato: per essere coerente avrebbe richiesto una palette solo bianca e blu per ogni elemento.

| Ruolo (`theme.color.*`) | Valore | Dove si usa |
|---|---|---|
| `background` | `#0c0a08` | Sfondo della scena, della pagina e dei pulsanti |
| `dots` | `#6b635a` | Puntini dello sfondo, fuori dal dungeon |
| `floor` | `#151515` | Pavimento dei tile (tinta unita); inizio del gradiente delle fosse |
| `floorHighlight` | `#2a2318` | Pavimento del tile che si sta per agganciare (strumento di sviluppo) |
| `linePrimary` | `#646464` | Linee chiare dei muri e degli stipiti |
| `wallGap` | `#101010` | Striscia scura in mezzo alle due linee del muro |
| `lineSecondary` | `#585858` | Griglia delle celle |
| `lineDetail` | `#484848` | Crepe del pavimento |
| `accentActive` | `#e0a040` | Anello dell'eroe attivo |
| `accentReach` | `#e0a040` | Contorno dell'area di movimento |
| `accentSelect` | `#e0a040` | Porta già presente evidenziata nell'anteprima (si toglierebbe) |
| `accentNotice` | `#e0a040` | Testo degli avvisi |
| `accentDev` | `#e0a040` | Solo sviluppo: uscita libera di un tile mentre lo si piazza |
| `accentUiSoft` | `#f0d060` | Caselle del percorso sotto il puntatore |
| `accentDoor` | `#6b4a33` | Porte (contorno, tratteggio, anta, arco) |
| `doorKey` | `#b08d5f` | Icona (e anello) della chiave sul distintivo di una porta a chiave |
| `rune.red` | `#c4574d` | Chiave runica rossa e le porte che apre (icona e anello del distintivo) |
| `rune.blue` | `#4d8fd0` | Chiave runica blu e le porte che apre |
| `rune.green` | `#5fae6a` | Chiave runica verde e le porte che apre |
| `chest.copper` | `#b8683a` | Scrigno di rame: contorno, linee del coperchio, fermaglio e linee dell'interno |
| `chest.silver` | `#b8bcc2` | Scrigno d'argento (stessi usi) |
| `chest.gold` | `#d9b23a` | Scrigno d'oro (stessi usi) |
| `potion.glass` | `#9a9a9a` | Vetro della boccetta delle pozioni a terra |
| `potion.heal` | `#b48ad9` | Liquido della pozione curativa (lilla) |
| `potion.vital` | `#f0a030` | Liquido della pozione di vitalità (arancione) |
| `coin` | `#d9b23a` | Monete d'oro (segnalino Denaro): riempimento pieno; anche l'icona della pillola del Denaro |
| `compass` | `#dc143c` | Freccia e N dell'indicatore del nord (cremisi): un pallino in basso a sinistra |
| `coinEdge` | `#7a5f17` | Contorno sottile di ogni moneta, più scuro: separa le monete che si sovrappongono |
| `glyphOn` | `#f4f4f4` | Glifo acceso (bianco, pulsante) e il suo alone; da spento il glifo usa `lineDetail`, come le crepe |
| `danger` | `#9a4a46` | Anello dei mostri |
| `invalid` | `#ff7070` | Tinta dell'anteprima di un ostacolo che non si può piazzare |
| `positive` | `#5fbf6a` | Solo sviluppo: uscita di un tile che si collega a un'apertura |
| `token.fill` | `#1d1c1a` | Fondo della pedina |
| `token.portrait` | `#3c3a37` | Segnaposto dell'immagine dell'eroe |
| `token.idle` | `#77736c` | Anello degli eroi non attivi |
| `water.line` | `#4a8fb0` | Contorno dell'acqua |
| `water.texture` | `#4a8fb0` | Righe ondulate dell'acqua |
| `pit.line` | `#6a6a6a` | Bordo della fossa |
| `pit.ray` | `#8a8a8a` | Linee a 45° della fossa |
| `pit.depth` | `#000000` | Dove finisce il gradiente della fossa (il fondo) |
| `stone.fill` | `#262626` | Riempimento dei massi e dei sassi |
| `stone.line` | `#7a7a7a` | Contorno e crepe dei massi, sassi, detriti |
| `ui.text` | `#d8cfc4` | Testo principale (movimento ed eroe attivo) |
| `ui.textMuted` | `#8a8178` | Testo secondario e pulsanti |
| `ui.border` | `#3a352f` | Bordo dei pulsanti; anche i quarti di cuore vuoti |
| `ui.panel` | `#000000` | Fondo nero dei contenitori (pillole in alto, barra degli eroi in basso) |
| `ui.panelBorder` | `#5a554d` | Bordo sottile (1 px) di pillole, barra, notifiche e pallini del bottone contestuale: il nero da solo non si distingue dallo sfondo |
| `stat.movement` | `#6cc070` | Punti movimento nella barra (verde) |
| `stat.fatigue` | `#f0a030` | Fatica nella barra (arancione, goccia; il valore della scheda, per ora non si spende) |
| `stat.attack` | `#d2504a` | Attacchi nella barra (rosso) e dadi d'attacco nella scheda |
| `health` | `#d2504a` | Cuori carichi (la salute): il rosso è riconosciuto come tale dal giocatore |

L'interfaccia in HTML (testi e pulsanti) prende i colori da variabili CSS (`--cad-bg`, `--cad-ui-text`,
`--cad-ui-text-muted`, `--cad-ui-border`, `--cad-notice`, `--cad-ui-panel`, `--cad-ui-panel-border`, `--cad-coin`, `--cad-compass`, `--cad-rune-red`, `--cad-rune-blue`, `--cad-rune-green`, `--cad-stat-movement`, `--cad-stat-fatigue`, `--cad-stat-attack`, `--cad-accent-active`, `--cad-health`,
`--cad-heart-empty-alpha`) che `setTheme` aggiorna.

### Opacità standard (`theme.alpha.*`)

| Uso | Valore |
|---|---|
| `dots` | 0.55 |
| `grid` | 0.55 |
| `crack` | 0.75 |
| `exitMarker` | 0.9 |
| `ghost` (tile senza aggancio) | 0.35 |
| `reach` (contorno area di movimento, massimo) | 0.55 |
| `pathCell` | 0.15 |
| `doorLine` (contorno) | 0.8 |
| `doorHatch` (tratteggio) | 0.4 |
| `doorArc` | 0.35 |
| `doorPreview` | 0.9 |
| `doorIcon` (icona sul distintivo delle porte bloccate) | 0.95 |
| `pitLine` | 0.5 |
| `pitRay` (all'inizio, poi sfuma a 0) | 0.5 |
| `waterLine` | 0.85 |
| `waterTexture` / `waterTextureMax` (righe dell'acqua: minimo e massimo; le righe pari e dispari si alternano) | 0.1 / 0.15 |
| `stoneDetail` (crepe dei massi) | 0.45 |
| `stoneDebris` | 0.55 |
| `stairsLink` (filo che unisce i capi delle scale) | 0.35 |
| `chestLid` (linee del coperchio) / `chestInside` (fondo e angoli dell'interno) | 0.55 / 0.5 |
| `glyphOnMin` / `glyphOnMax` (pulsazione del glifo acceso) | 0.55 / 1 |
| `glyphGlow` (alone dei tratti del glifo acceso) | 0.22 |
| `unexplored` (velo sulle caselle non esplorate) | 0.55 |
| `portraitIdle` (ritratto di un eroe non attivo) | 0.7 |
| `heartEmpty` (quarti di cuore persi) | 0.45 |
| `previewValid` / `previewInvalid` | 0.6 / 0.3 |

L'area di movimento pulsa: l'opacità del suo contorno oscilla da `reach × 0.2` a `reach` in 2,6 s.

## 3. Scala degli spessori di linea

Definita in `theme.ts` come `LINE` (non cambia da tema a tema). `hairline` si disegna con `pixelLine`: resta
1 pixel a schermo a qualsiasi zoom, come la griglia. Gli altri sono in pixel del mondo e crescono con lo zoom.

| Token | Valore | Dove si usa |
|---|---|---|
| `LINE.hairline` | 1 | Griglia, crepe, contorno e tratteggio delle porte, bordo e linee delle fosse, contorno e righe dell'acqua, contorno e crepe dei massi, contorno dei sassi, scrigni (contorno e righe), glifi (tutti i tratti e l'onda) |
| `LINE.pebble` | 1,2 | (oggi non usato) |
| `LINE.thin` | 1,5 | Contorno dell'area di movimento |
| `LINE.medium` | 2 | Anello delle pedine non attive, ciascuna delle due linee del muro |
| `LINE.strong` | 3 | Anello dell'eroe attivo |

Il **muro** è un blocco di 14 px (`WALL_WIDTH_PX`) fatto di due linee chiare da 2 px e una striscia scura in mezzo.
Oggi **non c'è distinzione fra muro esterno e interno**: sono uguali, come gli stipiti dei varchi (lunghi 20 px).

## 4. Tratti di significato

I "tratti" sono il linguaggio con cui lo stile dice cosa sono le cose senza riempirle. Sono statici, tranne le righe dell'acqua e i glifi accesi.

| Tratto | Dove | Come è fatto oggi |
|---|---|---|
| **Detriti** | Rocce | Intorno al masso, per ogni cella: 2 sassi (raggio 3–5 px, contorno `LINE.hairline`) e 5 detriti (puntini pieni, raggio 1–2 px, opacità `stoneDebris`), a posizioni casuali dal seme della mappa, fuori dal masso, a 2 px dal bordo delle celle |
| **Onde** | Acqua | Righe orizzontali ondulate, `LINE.hairline`, a passo di 8 px, onda alta 1,5 px e lunga 18 px, al 10%, tagliate dalla forma dell'acqua; ogni riga è sfasata di un quarto d'onda rispetto alla precedente (a scalino, texture uniforme) e scorre in loop, le righe pari a destra e le dispari a sinistra, di un'onda ogni 6 s (`WATER_FLOW_PERIOD_MS`); l'opacità respira fra `waterTexture` e `waterTextureMax`, due volte ogni 6 s e con le righe pari e dispari in contrasto di fase (`WATER_SHIMMER_CYCLES`; ferme per chi riduce il movimento); contorno `LINE.hairline` |
| **Linee di profondità** | Fosse | Quattro linee a 45° dagli angoli esterni verso il centro, lunghe 18 px lungo gli assi, `LINE.hairline`, in 8 tratti che sfumano da 0,5 a 0; sotto, un gradiente a 9 fasce da 3 px dal colore del pavimento a `pit.depth` |
| **Scala** | Segnalini | Elemento architettonico: stessi colori del dungeon, nessun ruolo suo. Occupa tutta la cella. I tre lati chiusi sono muri veri: segmenti di muro (`markers/stairs-walls.ts`) disegnati insieme agli altri nel livello dei muri, quindi dello stesso spessore (`WALL_WIDTH_PX`) e fusi con i muri vicini. Il quarto lato è aperto (di default il basso; `rotation` a scatti di 90°). I gradini riempiono tutto lo spazio dentro i muri: 5 rettangoli a `LINE.hairline` in `lineSecondary`, separati da 3 px, a 3 px dai muri, con gli angoli smussati (raggio 2,5 px). Niente lettere. Il filo che unisce i capi: tratteggio 6 px + 6 px, `LINE.hairline` in `lineSecondary` al 35% (`stairsLink`), solo se si conoscono entrambi. Percorso ortogonale: parte dal bordo della prima cella lungo l'asse più lungo (orizzontale-verticale-orizzontale, o verticale-orizzontale-verticale), con gli angoli curvi (curva di Bézier, raggio massimo 56 px, ridotto se i tratti sono corti: `STAIRS_LINK_CORNER_RADIUS_PX`); se i capi sono allineati è una retta. Il tratteggio segue la curva senza interrompersi. Nessuna crepa nella cella. I muri della scala compaiono quando la scala viene scoperta |
| **Oggetti a terra** | Segnalini | Chiave: l'SVG `public/tokens/little_key.svg` (`ICONS.keyPickup`) di 32 px nel colore `doorKey`, lo stesso del lucchetto della porta che apre. Il Denaro è disegnato da codice, come le rocce: 100 monete piccole viste dall'alto (una per ogni moneta che vale il segnalino): cerchietti pieni in `coin` (oro) con un contorno sottile in `coinEdge`, in un mucchio dal contorno irregolare più fitto al centro, circa il 12% sparse intorno, sempre a 11 px dal bordo della cella, dal seme della mappa (`COIN_*` in `constants.ts`). Chiave runica: l'SVG `public/tokens/rune_key.svg` (`ICONS.runeKey`) di 34 px, tutto nel colore della chiave (`rune.red/blue/green`, gli stessi delle porte che apre). Statici; raccolti spariscono |
| **Scrigno** | Segnalini | Visto dall'alto: rettangolo 84% × 62% della cella (resta staccato dai bordi) con angoli vivi, contorno nitido ma sottile (`LINE.hairline`, 1 px a schermo, opacità piena) nel colore del tipo (`chest.copper/silver/gold`). Chiuso: coperchio tondo: due linee verticali a 3,5 px dai lati corti e, fra le due, linee orizzontali (`LINE.hairline`, `chestLid`) a distanza (i/8)^2,5 della metà dello scrigno dal lato lungo (i = 3…8, 8 = centro): fittissime vicino ai lati lunghi e sempre più rade verso il centro. Le due fasce alle estremità sono lisce, e un fermaglio 8×7 px sul lato lungo davanti. Aperto: resta come cassa vuota; l'interno è un incavo come le buche, con una cornice larga 7 px che sfuma da `floor` a `pit.depth` in 4 fasce, un fondo nero col suo bordo sottile (`chestInside`) e quattro linee che vanno dagli angoli esterni a quelli del fondo. Apertura: in 0,38 s il coperchio si ribalta verso il lato lungo dietro (si schiaccia fino a sparire) e scopre l'interno; chi riduce il movimento vede il cambio di colpo. Sulla cella non ci sono crepe. Ruota a scatti di 90° (`rotation` nei dati): il coperchio si apre sempre dal lato "dietro" |
| **Glifo** | Segnalini | Linee sottili (`LINE.hairline`, 1 px a schermo; i cerchi sono poligoni a 64 lati perché `pixelLine` non funziona sui cerchi veri; niente riempimenti): un cerchio a doppia linea inscritto nella cella (raggio 44%, linee a 4 px) una stella a quattro punte al centro (punte al 74% del raggio del cerchio interno, lati molto incurvati verso l'interno: effetto elfico) e quattro cerchietti (raggio 6,5% della cella, poco più larghi della doppia linea), centrati sulla fascia fra le due linee dove le diagonali incontrano il cerchio e pieni del colore `floor`: coprono le linee del cerchio. Spento: `lineDetail` con l'opacità `crack`, fermo. Acceso: `glyphOn` con un alone largo 5 px al 22% che pulsa tra 55% e 100% in 2,4 s (ogni glifo sfasato). La prima volta che si accende: sfumatura in 0,45 s e un'unica onda (anello) che si espande fino a 3 volte il raggio in 0,8 s. Nella cella non ci sono crepe. Chi riduce il movimento li vede fermi |
| **Velo** | Caselle non esplorate | Il colore dello sfondo al 55%: le lascia vuote e un po' spente, con la struttura (pavimento, griglia, muri) ancora leggibile |
| **Distintivo** | Porte bloccate | Un disco (colore del pavimento) con un anello sottile e, dentro, l'icona: una chiave (`doorKey`) per le porte a chiave, un rombo (la runa) nel colore della chiave runica per quelle runiche. Sta al centro della porta e sparisce in 0,3 s quando la serratura si apre |
| **Tratteggio diagonale** | Porte | Linee a 45° con passo di 4 px lungo gli assi, `LINE.hairline`, dentro un rettangolo da 8 px di spessore con contorno sottile. Incrociato quando la porta ha una serratura chiusa. Arco di apertura tratteggiato con trattino e vuoto di 4 px |

Regole comuni:

- **Mai un riempimento pieno** per un oggetto: contorno sottile e, se serve, un tratteggio a bassa opacità.
- Il tratteggio e le righe sono **allineati al mondo**, così restano continui fra forme vicine.
- Le linee degli oggetti **non si sovrappongono a quelle dei muri**: le porte stanno a 2 px dalle facce dei muri e
  degli stipiti (`DOOR_WALL_CLEARANCE_PX`); l'acqua si ferma sulla faccia interna del muro, e un suo angolo che tocca un muro (anche da un solo lato) resta vivo: il bordo corre dritto fino al muro, mentre gli angoli lontani dai muri sono arrotondati.
- Tutto ciò che è casuale (sassi, crepe, angoli) dipende dal **seme della mappa**: uguale su ogni client, niente
  da sincronizzare.

## 5. Ordine dei livelli (z-order), dal basso

Come sono impilati oggi nella scena:

1. **Sfondo:** colore di fondo e puntini (fuori dal mondo, non si muovono con le celle).
2. **Pavimento:** tinta unita di ogni tile, opaca (copre i puntini).
3. **Griglia e crepe:** sopra il pavimento di ciascun tile.
4. **Muri e stipiti:** tutti i muri sopra tutti i pavimenti.
4b. **Segnalini:** i glifi, le scale, gli scrigni e gli oggetti a terra (nell'ordine: glifi, scrigni, oggetti), sopra muri e pavimento, sotto gli ostacoli.
5. **Ambiente:** rocce, fosse e acqua (forma e campitura).
6. **Porte:** contorno, tratteggio, anta, arco e distintivi delle serrature; sopra l'ambiente.
6b. **Velo dell'esplorazione:** un rettangolo per ogni casella non ancora esplorata, nel colore di `background` con
   opacità `unexplored`; sopra mappa, ostacoli e porte, sotto le pedine. Svanisce in 350 ms (`REVEAL_ANIM_MS`) quando
   la casella si scopre. Nessun elemento si disegna in una casella non rivelata; negli strumenti di piazzamento non c'è velo. Aprire o chiudere è
   un'animazione dell'anta attorno al cardine (380 ms, `DOOR_ANIM_MS`): arco e tratteggio restano allineati.
7. **Area di movimento** (contorno ambra pulsante) e **caselle del percorso**.
8. **Token:** pedine, sopra tutto ciò che sta sulla mappa.
9. **Interfaccia in HTML:** testi, avvisi e pulsanti di zoom, sopra il canvas.

Nota: l'anteprima del percorso sta **sotto** le pedine (oggi). Gli strumenti di sviluppo (uscite dei tile, anteprima
di porte e ostacoli, tile "fantasma") si disegnano nel livello della cosa che anteprimano.

## 6. Token e sprite

- Una pedina o uno sprite deve avere sempre un **contorno o un alone in `linePrimary`** (o nel colore del
  suo ruolo, se ne ha uno: `accentActive` per l'attivo, `danger` per il mostro), così si legge su qualsiasi tema e
  su qualsiasi pavimento.
- Oggi la pedina è un cerchio con anello (`LINE.strong` se attiva, `LINE.medium` altrimenti), fondo `token.fill` e un
  segnaposto per l'immagine (`token.portrait`). Gli eroi con un'immagine (`portrait` nei dati della pedina, un'immagine quadrata in
  `public/characters/`) mostrano il ritratto ritagliato a cerchio dentro l'anello, un po' tenue (`portraitIdle`) se non sono attivi;
  i mostri e chi non ha l'immagine tengono il segnaposto. Gli sprite veri andranno dentro lo stesso anello.
- Nessun sprite contiene colori propri per l'ambiente: i colori vengono dai ruoli.

## 7. Icone

- **Google Material Symbols, come file SVG scaricati**, mai come font: uno per icona in `public/icons/<nome>.svg`
  (stile *Outlined*, peso 200 = tratto sottile, riempimento spento, dimensione ottica 24). Si caricano con
  `src/app/game/icons/icon-loader.ts` e si disegnano come vettori, colorati con un ruolo del tema.
- I nomi usati sono in `ICONS` (`constants.ts`), così si possono cambiare in un posto solo. Se un file manca, compare
  una forma semplice di riserva (chiave o rombo): il gioco funziona anche senza.
- **Tratto sottile**, vettoriali, alla scala `LINE`. Un solo colore per significato: ambra (`accentReach`) per movimento
  e costo, rosso (`danger`) solo per il danno, `doorKey` per le chiavi normali, `rune.*` per le runiche.
- Nessuna icona usa un colore che non sia un ruolo; nessun riempimento pieno oltre al disco del distintivo (colore del pavimento).
- Icone dell'interfaccia in HTML (`<app-icon>`, maschera CSS colorata come il testo): `brightness_empty` (Progresso), `autorenew` (Round), `footprint` (punti movimento), `swords` (attacchi), `skull` (Overlord, Minaccia), `water_drop` (fatica), `shield` (armatura), `deployed_code` (un dado extra, ripetuta per valore), `close`, `priority_high` (bottone contestuale), `door_front`, `lock`, `lock_open`, `inventory_2` (scrigno), `stairs`, `warning` e `info` (azioni e notifiche).
- Icone oggi: `tokens/padlock` (lucchetto sulla porta a chiave, colore `doorKey`) e `diamond` (porta runica), più gli SVG
  degli oggetti a terra in `public/tokens/` (pozione, pila di monete, chiave, chiave runica). `public/icons/key.svg` non è più usato. Il percorso non ha ancora icone: evidenzia solo le
  caselle in `accentUiSoft`.

## 8. Checklist per ogni nuovo elemento

1. **Solo token.** Nessun `0x…`, `#…`, spessore o opacità scritti a mano nel rendering: ruolo in `theme.ts`, misure in `constants.ts`.
2. **Un colore, un significato.** Se il valore esiste già per un altro significato, non riusarlo: crea un ruolo o segnalalo.
3. **Niente riempimenti pieni**: contorno sottile + tratti a bassa opacità.
4. **Test a occhi socchiusi:** a colpo d'occhio si distingue ancora cosa è muro, ostacolo, porta, pedina?
5. **Test in scala di grigi:** l'elemento si legge senza il colore? L'ambiente non deve essere più chiaro della pietra.
6. **Non toccare le linee dei muri** e controllare lo z-order della sezione 5.
7. Aggiornare questa guida e la sezione "Stile visivo" di `CLAUDE.md`.

## 9. Punti aperti

Cose trovate nel codice che la guida registra ma non risolve (vedi anche il rapporto della fase 1):

- **Ambra: un valore, cinque ruoli.** `#e0a040` è il valore di `accentActive`, `accentReach`, `accentSelect`,
  `accentNotice` e `accentDev`: i ruoli sono separati (ciascuno può cambiare da solo), ma oggi sullo schermo
  sono lo stesso colore. Se due di questi significati si confondono, basta dare un valore diverso al ruolo.
- **Due gialli.** l'ambra (`#e0a040`) e `accentUiSoft` (`#f0d060`) sono due valori per significati vicini
  (selezione/movimento e percorso).
- **Rosso: nemico e non valido.** `danger` (`#9a4a46`, anello dei mostri) e `invalid` (`#ff7070`, anteprima non
  valida) sono rossi diversi. Il testo dice che il rosso è "solo danno", ma oggi marca anche l'ostilità.
- **Grigi vicini.** Le linee secondarie e di dettaglio sono sei grigi quasi uguali (`#484848`, `#585858`, `#646464`,
  `#6a6a6a`, `#7a7a7a`, `#8a8a8a`), scelti a occhio: potrebbero ridursi a una scala.
- **Verde: sviluppo e runa.** `rune.green` (`#5fae6a`) è la chiave runica verde, `positive` (`#5fbf6a`) è lo sviluppo:
  due ruoli con valori quasi uguali, da distinguere se si confondono.
- **Verde.** `positive` (`#5fbf6a`) esiste solo per lo strumento di sviluppo e non ha un ruolo di prodotto.
- **Muro esterno / interno.** Non c'è distinzione di spessore, anche se la guida di stile la prevede.
- **Opacità dei testi** (0.45, 0.9, 0.8, 0.6) sono ancora scritte nell'HTML della scena, non nei token.
