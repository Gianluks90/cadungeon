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

Valori in `theme.ts`. "Blueprint" è una **bozza**: le proposte non sono ancora state rifinite a schermo.

| Ruolo (`theme.color.*`) | Dark (oggi) | Blueprint (bozza) | Dove si usa |
|---|---|---|---|
| `background` | `#0c0a08` | `#0a2a4d` | Sfondo della scena, della pagina e dei pulsanti |
| `dots` | `#6b635a` | `#bcd6f5` | Puntini dello sfondo, fuori dal dungeon |
| `floor` | `#151515` | `#0f3b6b` | Pavimento dei tile (tinta unita); inizio del gradiente delle fosse |
| `floorHighlight` | `#2a2318` | `#1a5694` | Pavimento del tile che si sta per agganciare (strumento di sviluppo) |
| `linePrimary` | `#646464` | `#f2f6ff` | Linee chiare dei muri e degli stipiti |
| `wallGap` | `#101010` | `#0a2f57` | Striscia scura in mezzo alle due linee del muro |
| `lineSecondary` | `#585858` | `#dbe9ff` | Griglia delle celle |
| `lineDetail` | `#484848` | `#dbe9ff` | Crepe del pavimento |
| `accentActive` | `#e0a040` | `#ffe9a0` | Anello dell'eroe attivo |
| `accentReach` | `#e0a040` | `#ffe9a0` | Contorno dell'area di movimento |
| `accentSelect` | `#e0a040` | `#ffe9a0` | Porta già presente evidenziata nell'anteprima (si toglierebbe) |
| `accentNotice` | `#e0a040` | `#ffe9a0` | Testo degli avvisi |
| `accentDev` | `#e0a040` | `#ffe9a0` | Solo sviluppo: uscita libera di un tile mentre lo si piazza |
| `accentUiSoft` | `#f0d060` | `#fff3c4` | Caselle del percorso sotto il puntatore |
| `accentDoor` | `#6b4a33` | `#c9b48a` | Porte (contorno, tratteggio, anta, arco) |
| `doorKey` | `#b08d5f` | `#e6d6b0` | Icona (e anello) della chiave sul distintivo di una porta a chiave |
| `rune.red` | `#c4574d` | `#ff7a6b` | Chiave runica rossa e le porte che apre (icona e anello del distintivo) |
| `rune.blue` | `#4d8fd0` | `#7fb8ff` | Chiave runica blu e le porte che apre |
| `rune.green` | `#5fae6a` | `#8fe0a0` | Chiave runica verde e le porte che apre |
| `danger` | `#9a4a46` | `#ff6b4a` | Anello dei mostri |
| `invalid` | `#ff7070` | `#ff6b4a` | Tinta dell'anteprima di un ostacolo che non si può piazzare |
| `positive` | `#5fbf6a` | `#9fe3ff` | Solo sviluppo: uscita di un tile che si collega a un'apertura |
| `token.fill` | `#1d1c1a` | `#0a2a4d` | Fondo della pedina |
| `token.portrait` | `#3c3a37` | `#1a4a7e` | Segnaposto dell'immagine dell'eroe |
| `token.idle` | `#77736c` | `#dbe9ff` | Anello degli eroi non attivi |
| `water.line` | `#4a8fb0` | `#9fd8ff` | Contorno dell'acqua |
| `water.texture` | `#4a8fb0` | `#9fd8ff` | Righe ondulate dell'acqua |
| `pit.line` | `#6a6a6a` | `#dbe9ff` | Bordo della fossa |
| `pit.ray` | `#8a8a8a` | `#dbe9ff` | Linee a 45° della fossa |
| `pit.depth` | `#000000` | `#06213f` | Dove finisce il gradiente della fossa (il fondo) |
| `stone.fill` | `#262626` | `#0f3b6b` | Riempimento dei massi e dei sassi |
| `stone.line` | `#7a7a7a` | `#f2f6ff` | Contorno e crepe dei massi, sassi, detriti |
| `ui.text` | `#d8cfc4` | `#f2f6ff` | Testo principale (movimento ed eroe attivo) |
| `ui.textMuted` | `#8a8178` | `#bcd6f5` | Testo secondario e pulsanti |
| `ui.border` | `#3a352f` | `#3a6a9e` | Bordo dei pulsanti |

L'interfaccia in HTML (testi e pulsanti) prende i colori da variabili CSS (`--cad-bg`, `--cad-ui-text`,
`--cad-ui-text-muted`, `--cad-ui-border`, `--cad-notice`) che `setTheme` aggiorna.

### Opacità standard (`theme.alpha.*`)

| Uso | Dark | Blueprint (bozza) |
|---|---|---|
| `dots` | 0.55 | 0.3 |
| `grid` | 0.55 | 0.3 |
| `crack` | 0.75 | 0.4 |
| `exitMarker` | 0.9 | 0.9 |
| `ghost` (tile senza aggancio) | 0.35 | 0.35 |
| `reach` (contorno area di movimento, massimo) | 0.55 | 0.7 |
| `pathCell` | 0.15 | 0.18 |
| `doorLine` (contorno) | 0.8 | 0.9 |
| `doorHatch` (tratteggio) | 0.4 | 0.5 |
| `doorArc` | 0.35 | 0.4 |
| `doorPreview` | 0.9 | 0.9 |
| `doorIcon` (icona sul distintivo delle porte bloccate) | 0.95 | 0.95 |
| `pitLine` | 0.5 | 0.6 |
| `pitRay` (all'inizio, poi sfuma a 0) | 0.5 | 0.5 |
| `waterLine` | 0.85 | 0.85 |
| `waterTexture` | 0.1 | 0.14 |
| `stoneDetail` (crepe dei massi) | 0.45 | 0.5 |
| `stoneDebris` | 0.55 | 0.6 |
| `portraitIdle` (ritratto di un eroe non attivo) | 0.7 | 0.7 |
| `previewValid` / `previewInvalid` | 0.6 / 0.3 | 0.6 / 0.3 |

L'area di movimento pulsa: l'opacità del suo contorno oscilla da `reach × 0.2` a `reach` in 2,6 s.

## 3. Scala degli spessori di linea

Definita in `theme.ts` come `LINE` (non cambia da tema a tema). `hairline` si disegna con `pixelLine`: resta
1 pixel a schermo a qualsiasi zoom, come la griglia. Gli altri sono in pixel del mondo e crescono con lo zoom.

| Token | Valore | Dove si usa |
|---|---|---|
| `LINE.hairline` | 1 | Griglia, crepe, contorno e tratteggio delle porte, bordo e linee delle fosse, contorno e righe dell'acqua, crepe dei massi |
| `LINE.pebble` | 1,2 | Contorno dei sassi attorno al masso |
| `LINE.thin` | 1,5 | Contorno dell'area di movimento |
| `LINE.medium` | 2 | Contorno del masso, anello delle pedine non attive, ciascuna delle due linee del muro |
| `LINE.strong` | 3 | Anello dell'eroe attivo |

Il **muro** è un blocco di 14 px (`WALL_WIDTH_PX`) fatto di due linee chiare da 2 px e una striscia scura in mezzo.
Oggi **non c'è distinzione fra muro esterno e interno**: sono uguali, come gli stipiti dei varchi (lunghi 20 px).

## 4. Tratti di significato

I "tratti" sono il linguaggio con cui lo stile dice cosa sono le cose senza riempirle. Tutti sono statici.

| Tratto | Dove | Come è fatto oggi |
|---|---|---|
| **Detriti** | Rocce | Intorno al masso, per ogni cella: 2 sassi (raggio 3–5 px, contorno `LINE.pebble`) e 5 detriti (puntini pieni, raggio 1–2 px, opacità `stoneDebris`), a posizioni casuali dal seme della mappa, fuori dal masso, a 2 px dal bordo delle celle |
| **Onde** | Acqua | Righe orizzontali ondulate, `LINE.hairline`, a passo di 8 px, onda alta 1,5 px e lunga 18 px, al 10%, tagliate dalla forma dell'acqua; contorno `LINE.hairline` |
| **Linee di profondità** | Fosse | Quattro linee a 45° dagli angoli esterni verso il centro, lunghe 18 px lungo gli assi, `LINE.hairline`, in 8 tratti che sfumano da 0,5 a 0; sotto, un gradiente a 9 fasce da 3 px dal colore del pavimento a `pit.depth` |
| **Distintivo** | Porte bloccate | Un disco (colore del pavimento) con un anello sottile e, dentro, l'icona: una chiave (`doorKey`) per le porte a chiave, un rombo (la runa) nel colore della chiave runica per quelle runiche. Sta al centro della porta e sparisce in 0,3 s quando la serratura si apre |
| **Tratteggio diagonale** | Porte | Linee a 45° con passo di 4 px lungo gli assi, `LINE.hairline`, dentro un rettangolo da 8 px di spessore con contorno sottile. Incrociato quando la porta ha una serratura chiusa. Arco di apertura tratteggiato con trattino e vuoto di 4 px |

Regole comuni:

- **Mai un riempimento pieno** per un oggetto: contorno sottile e, se serve, un tratteggio a bassa opacità.
- Il tratteggio e le righe sono **allineati al mondo**, così restano continui fra forme vicine.
- Le linee degli oggetti **non si sovrappongono a quelle dei muri**: le porte stanno a 2 px dalle facce dei muri e
  degli stipiti (`DOOR_WALL_CLEARANCE_PX`); l'acqua si ferma sulla faccia interna del muro.
- Tutto ciò che è casuale (sassi, crepe, angoli) dipende dal **seme della mappa**: uguale su ogni client, niente
  da sincronizzare.

## 5. Ordine dei livelli (z-order), dal basso

Come sono impilati oggi nella scena:

1. **Sfondo:** colore di fondo e puntini (fuori dal mondo, non si muovono con le celle).
2. **Pavimento:** tinta unita di ogni tile, opaca (copre i puntini).
3. **Griglia e crepe:** sopra il pavimento di ciascun tile.
4. **Muri e stipiti:** tutti i muri sopra tutti i pavimenti.
5. **Ambiente:** rocce, fosse e acqua (forma e campitura).
6. **Porte:** contorno, tratteggio, anta, arco e distintivi delle serrature; sopra l'ambiente. Aprire o chiudere è
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
- Icone oggi: `key` (porta a chiave) e `diamond` (porta runica). Il percorso non ha ancora icone: evidenzia solo le
  caselle in `accentUiSoft`.

## 8. Checklist per ogni nuovo elemento

1. **Solo token.** Nessun `0x…`, `#…`, spessore o opacità scritti a mano nel rendering: ruolo in `theme.ts`, misure in `constants.ts`.
2. **Un colore, un significato.** Se il valore esiste già per un altro significato, non riusarlo: crea un ruolo o segnalalo.
3. **Niente riempimenti pieni**: contorno sottile + tratti a bassa opacità.
4. **Test a occhi socchiusi:** a colpo d'occhio si distingue ancora cosa è muro, ostacolo, porta, pedina?
5. **Test in scala di grigi:** l'elemento si legge senza il colore? L'ambiente non deve essere più chiaro della pietra.
6. **Test nel tema blueprint:** `cadungeonSetTheme('blueprint')` nella console del browser (solo in sviluppo), poi `'dark'`.
7. **Non toccare le linee dei muri** e controllare lo z-order della sezione 5.
8. Aggiornare questa guida e la sezione "Stile visivo" di `CLAUDE.md`.

## 9. Punti aperti

Cose trovate nel codice che la guida registra ma non risolve (vedi anche il rapporto della fase 1):

- **Ambra: un valore, cinque ruoli.** `#e0a040` è il valore di `accentActive`, `accentReach`, `accentSelect`,
  `accentNotice` e `accentDev`: i ruoli sono separati (ciascuno può cambiare da solo), ma oggi sullo schermo
  sono lo stesso colore. Se due di questi significati si confondono, basta dare un valore diverso al ruolo.
- **Due gialli.** l'ambra (`#e0a040`) e `accentUiSoft` (`#f0d060`) sono due valori per significati vicini
  (selezione/movimento e percorso). Il tema blueprint chiede un solo giallo pallido.
- **Rosso: nemico e non valido.** `danger` (`#9a4a46`, anello dei mostri) e `invalid` (`#ff7070`, anteprima non
  valida) sono rossi diversi. Il testo dice che il rosso è "solo danno", ma oggi marca anche l'ostilità.
- **Grigi vicini.** Le linee secondarie e di dettaglio sono sei grigi quasi uguali (`#484848`, `#585858`, `#646464`,
  `#6a6a6a`, `#7a7a7a`, `#8a8a8a`), scelti a occhio: potrebbero ridursi a una scala.
- **Verde: sviluppo e runa.** `rune.green` (`#5fae6a`) è la chiave runica verde, `positive` (`#5fbf6a`) è lo sviluppo:
  due ruoli con valori quasi uguali, da distinguere se si confondono.
- **Verde.** `positive` (`#5fbf6a`) esiste solo per lo strumento di sviluppo e non ha un ruolo di prodotto.
- **Muro esterno / interno.** Non c'è distinzione di spessore, anche se la guida di stile la prevede.
- **Opacità dei testi** (0.45, 0.9, 0.8, 0.6) sono ancora scritte nell'HTML della scena, non nei token.
