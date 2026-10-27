# CADungeon (nome in codice)

Gioco da tavolo digitale per browser, ispirato ai dungeon crawler a squadra contro un Overlord.
Ambientato nel mondo di Duels. Nomi, mostri, testi e avventure sono originali: niente materiale
di Descent (nomi, quest, illustrazioni, carte). Le meccaniche si possono prendere come ispirazione.
Le immagini di riferimento servono solo come ispirazione di stile: mai ricalcarle.

## Come lavoriamo
- Il progetto è sviluppato in vibe coding: spiega le scelte in modo semplice, senza troppo gergo.
- Prima di scrivere codice per una funzione nuova, descrivi in due righe cosa farai.
- Proponi cambiamenti piccoli e verificabili. Dopo ogni passo il gioco deve restare avviabile.
- Se una decisione non è in questo file e cambia l'architettura, chiedi prima.

## Stack
- Angular (ultima versione stabile) con componenti standalone e signals.
- PixiJS per la scena di gioco. Va avviato fuori da NgZone (`runOutsideAngular`).
- PeerJS per tutto ciò che è veloce ed effimero.
- Firebase: il progetto esiste e verrà collegato, ma per ora NON usare Auth né Hosting.
  Firestore solo per ciò che deve restare (avventure, mappe, eroi, salvataggi). Predisporre
  un servizio di persistenza dietro un'interfaccia, così oggi può essere in memoria o su file.

## Architettura di rete
- Un giocatore è l'host e ha lo stato autoritativo. Gli altri inviano intenzioni, l'host le
  valida e rimanda lo stato.
- PeerJS: puntatori, pedine in movimento, anteprime del percorso, animazioni.
- Firestore: risultato di un turno, checkpoint di salvataggio, eroi, avventure. Poche scritture
  per turno, mai decine al secondo.
- Il contenuto delle stanze non scoperte resta sull'host e viene inviato ai giocatori solo
  quando la stanza si rivela.
- PeerServer e TURN: in sviluppo va bene il server pubblico di PeerJS. Per la produzione
  serviranno un PeerServer proprio e un TURN (non più gratuito).

## Ruoli
- L'Overlord è un ruolo, non una persona. Il ruolo può essere affidato a un umano o a uno script.
- La prima versione usa l'Overlord scriptato. L'interfaccia di regole è unica: lo script e
  l'umano usano le stesse azioni.
- Script v1: i mostri vanno verso l'eroe più vicino e attaccano. I segnalini Minaccia sono
  il budget per far apparire mostri. Un po' di casualità nella scelta del bersaglio.

## Viste
Il gioco avrà 3 viste sulla stessa scena: **Giocatore**, **Overlord** ed **Editor**. Gli attuali strumenti di sviluppo
(P tile, D porte, O ostacoli) sono l'embrione dell'Editor. Route e lobby sono rimandate: per ora c'è una sola pagina.

## Mappa e tile
- Una sola unità: la cella. Dimensione proposta: 64 px, da usare ovunque (SVG compresi).
- Un tile ha dimensione in celle (es. 2x4, 4x4, 2x2) e aperture (lato, posizione in celle dal
  vertice in alto a sinistra, larghezza), descritte in un file JSON (public/tiles/). Il pavimento
  oggi è disegnato da codice; un SVG accanto al JSON è previsto solo se servirà.
- Rotazione a scatti di 90 gradi. Due tile si agganciano se hanno aperture che si guardano
  con la stessa larghezza.
- Una mappa è solo un elenco di tile con posizione e rotazione, più un seed per i dettagli
  generati (public/maps/). È anche il formato salvato e quello dell'editor futuro.
- Un'apertura senza tile vicino si disegna come muro (rete di sicurezza mentre si costruisce).
- I tile sono come tessere di un puzzle: ogni tipo ha attacchi (aperture) fissi, larghi 2 celle.
  Catalogo (file in public/tiles/):
  - Punto morto 2x1 (1 attacco, su un lato lungo): chiude le uscite senza sbocco. Una mappa
    finita ha un punto morto su ogni attacco rimasto libero.
  - Corridoi, attacchi solo alle estremità: corto 2x2 e medio 2x4 e lungo 2x6 (2 attacchi);
    a T (2x4 con una sezione 2x2 al centro di un lato lungo, 3 attacchi); a croce (2x4 con due
    sporgenze 2x1 al centro dei lati lunghi, 4 attacchi); gomito
    (corridoio 2x4 piegato di 90 gradi alla fine: tre blocchi 2x2 a L, 2 attacchi).
  - Stanze, 4 attacchi sempre al centro dei lati: base 4x4, media 4x6, enorme 6x6.
- La forma di un tile è un rettangolo (size) oppure l'unione di più rettangoli (rects, come T e
  croce). Le aperture stanno sempre sul bordo del rettangolo che contiene il tile.
- La geometria dei muri è fatta di segmenti: serve per movimento e linea di vista.
- Le porte sono dati dell'avventura, non dei tile: un lato di cella sulla griglia (x, y, orizzontale
  o verticale) e lo stato aperta/chiusa. Per ora stanno nel file della mappa (campo `doors`).
  Anche gli ostacoli naturali sono dati dell'avventura: campo `obstacles` (tipo, casella, lunghezza,
  eventualmente verticale). Tre tipi in tre lunghezze (1x1, 2x1, 3x1), ruotabili: roccia, buca, acqua.
  I segnalini sulla mappa (per ora glifi, scale, scrigni e oggetti a terra) sono dati dell'avventura: campo `markers` (tipo, casella, stato;
  gli scrigni hanno anche `tier`: `copper`, `silver` o `gold`, `contents`, l'elenco dei premi che danno
  (`progress` con `amount`, `rune` con `color`, `key` con `keyId`, `coins`, `item` con `itemId`: l'oggetto va a chi apre lo scrigno, e se non ha posto lo scrigno resta chiuso), e `rotation`, 0/90/180/270; gli oggetti a terra sono
  `potion` (`kind`: `heal` o `vital`), `coins`, `key` (`keyId`), `rune` (`color`) e `item` (`itemId`: un oggetto del catalogo, come le reliquie, che non stanno in nessun mazzo e le mette l'avventura qui o negli scrigni; chi entra lo raccoglie, equipaggiato se ci sta, altrimenti nello zaino, e se non ha posto resta a terra; le reliquie non si vendono); le scale sono `stairs` con `link`, un'etichetta della coppia che non si vede, e `rotation`:
  due scale con la stessa etichetta sono i due capi di una scalinata).
  Un'avventura ha un obiettivo (`objective`: `{kind: 'defeat', pieceId, text}`, vince chi sconfigge quella pedina, di solito il boss), e le pedine dei mostri possono essere uniche (`unique`), avere un bottino (`drop`, come il contenuto di uno scrigno: `removeMonster` in `state/loot.ts`), abilità in più (`traits`) e immunità (`immune`). Anche le pedine di partenza (squadra, nome, casella, velocità, immagine del ritratto) sono dati dell'avventura: campo
  `pieces` del file della mappa; senza, parte un solo eroe. Un eroe può richiamare la sua scheda (`hero`, un file di public/heroes/ con
  ferite, armatura, velocità, valore, abilità e dadi: vedi docs/REGOLE.md, sezione 10); i campi scritti sulla pedina la sostituiscono. Un mostro si richiama dal catalogo con `monster` (un id di `public/monsters/catalog.json`: nome, immagini `<image>-token.webp` e `-portrait.webp`, dimensione, tipo di attacco, e per la versione normale e quella potenziata ferite per scaglione di giocatori (2-3, 4, 5; i giocatori sono gli eroi più il Signore Supremo), velocità, armatura, dadi e abilità a parole; si aggiungono mostri solo aggiungendo voci al file) e i campi scritti sulla pedina lo sostituiscono. Può avere `enhanced: true` (potenziato, la versione forte della sua carta: anello rosso; i normali hanno l'anello standard) e `size` (`{w, h}`: 1×1, 1×2, 2×2 o 2×3, e ruotato 2×1 o 3×2; `x`,`y` sono la casella in alto a sinistra).
  Una porta può avere una serratura (`lock`): `{kind:'key', keyId, pickable}` per le chiavi (si scassinano,
  a meno che `pickable` sia false) o `{kind:'rune', color:'red'|'blue'|'green'}` per le chiavi runiche (non si
  scassinano). `unlocked` dice che la serratura è già stata aperta. Chiavi e chiavi runiche possedute stanno
  nello stato del gruppo (`party` nella mappa per le prove); come mostrare l'inventario si deciderà dopo.
  Una porta può stare ovunque ci siano due muri ai lati, non solo fra due stanze: la sua lunghezza
  non si salva ma si calcola da muro a muro, e non può superare la larghezza di un passaggio
  (2 celle).
- Muri, contorno, pavimento e fratture si disegnano da codice a partire dal JSON. Gli SVG a mano
  servono solo per gli oggetti (barili, bauli, scale, torce).
- Il JSON del tile descrive solo forma, aperture e pavimento. Torce, scale, barili, bauli e
  gli altri oggetti NON sono proprietà del tile: sono dati dell'avventura (tipo e cella), piazzati
  dall'autore dell'avventura o dal master. Così i tile restano neutri e riutilizzabili.

## Stile visivo (decisioni prese)
Principio: la mappa è una mappa. Resta molto minimale, senza campiture colorate.

### Sfondo
- Sfondo scuro, nero caldo, con griglia di puntini piccoli, radi e quasi invisibili.
- Il tile ha un fondo pieno opaco sotto il disegno: i puntini restano solo fuori dal dungeon
  e non si mescolano alle linee del tile.

### Tile
Aspetto da disegno tecnico: una mappa CAD, come un blueprint su una tavola luminosa.
- Niente colori né campiture: solo linee e toni di grigio neutro (niente marroncino).
- Pavimento: tinta unita, scura, quasi come lo sfondo ma distinguibile. Nessun gradiente di luce.
- Griglia: ogni cella è delimitata da linee sottili, sempre 1 pixel a schermo a qualsiasi zoom.
  Le linee proseguono attraverso i varchi.
- Fratture: solo su alcune lastre (circa il 13%), sottili come la griglia, naturali (percorso che
  devia poco per volta, ogni tanto un ramo). Partono da un bordo della lastra, si fermano quando
  arrivano a un altro bordo e restano lontane dai muri.
- Ostacoli, statici (niente shader) tranne le righe dell'acqua, che scorrono piano:
  - Roccia: masso grigio irregolare (forma dal seed della mappa), con attorno piccoli sassi e detriti
    sparsi solo per scena, dentro le celle dell'ostacolo.
  - Buca: un incavo nel pavimento. Bordo sottile e tenue, gradiente verso l'interno dal colore del
    pavimento al nero, e quattro linee a 45 gradi che partono dagli angoli verso il centro e sfumano nel
    nero, per dare profondità (corte, così nelle buche piccole non si toccano).
  - Acqua: un contorno azzurro sottile, un fondo dello stesso azzurro con un'opacità bassissima (7%, `waterFill`) e una campitura a righe ondulate al 10% di opacità. Le righe sono sfasate a scalino (un quarto d'onda ciascuna) per una texture uniforme e scorrono in
    loop, una a destra e la successiva a sinistra, una lunghezza d'onda ogni 6 secondi. L'opacità delle righe varia di poco (dal 10% al 15%), alternata fra righe pari e dispari. Bordi arrotondati, tutti con lo stesso raggio; dove tocca un muro arriva fino al
    muro, e ogni angolo che tocca un muro (anche uno solo dei due lati) resta vivo, così il bordo corre dritto fino al muro. È uno dei pochi elementi colorati.
  Buche e acqua vicine dello stesso tipo si fondono in un'unica forma; le rocce restano sempre singole.
  Buche vicine contano anche come una sola buca per le regole (uscita, salto).
- Area di movimento dell'eroe attivo: solo il contorno ambra dell'unione delle caselle raggiungibili, un
  unico anello continuo che corre sul filo delle celle e rientra solo accanto ai muri; pulsa lentamente
  nell'opacità. Nessun riempimento. Il percorso sotto il puntatore evidenzia le caselle attraversate in
  giallo tenue (15%), senza linea né numeri (per ora).
- Icone: Google Material Symbols come file SVG in public/icons/ (mai come font) e gli SVG degli oggetti in
  public/tokens/ (lucchetto delle porte a chiave, pozione, monete, chiavi), colorati con un ruolo del
  tema; se un file manca compare una forma di riserva. Elenco e regole nella guida di stile.
- Scala: elemento architettonico, quindi dello stesso colore del dungeon (come muri e griglia, nessun colore a parte).
  Occupa tutta la cella. I tre lati chiusi sono muri veri, spessi come gli altri e fusi con quelli vicini; il quarto
  lato è aperto, da cui si entra (rotazione a scatti di 90 gradi con `rotation`). Dentro, i gradini riempiono tutto lo
  spazio, dalla parete chiusa al lato aperto, come rettangoli a linea sottile dagli angoli smussati. Niente lettere: un
  filo sottile tratteggiato unisce i due capi quando si conoscono entrambi. Parte dal bordo della prima cella e corre in
  orizzontale o in verticale; se la destinazione non è allineata curva generosamente negli angoli (come i bordi dell'acqua),
  prosegue e, se serve, curva di nuovo, per arrivare dritto sulla seconda. Nella cella non ci sono crepe.
- Glifo: impresso nel pavimento, solo linee: un cerchio a doppia linea inscritto nella cella una stella a quattro punte al centro (lati molto incurvati
  verso l'interno, effetto elfico) e quattro cerchietti,
  appena più larghi della doppia linea e pieni del colore del pavimento (coprono le linee), nei punti in cui le
  diagonali della cella incontrano il cerchio (le diagonali non si disegnano). Due
  stati: spento ha lo stesso colore e opacità delle crepe e sta fermo; acceso è bianco con un alone e pulsa piano.
  La prima volta che si accende il colore sfuma nel bianco e un'unica onda parte dal centro e si espande. Una
  cella con un glifo non ha crepe né altri dettagli ambientali. Sta sotto ostacoli e porte.
- Scrigno: visto dall'alto, rettangolo con contorno nitido nel colore del tipo (rame, argento, oro: tre colori del tema,
  diversi dal marrone delle porte). Chiuso ha il coperchio tondo, reso con linee parallele al lato lungo sempre più
  fitte verso i bordi, e un fermaglio. Aperto resta sulla mappa come cassa vuota con un interno a incavo come le buche,
  ma con il fondo ben definito; aprendolo il coperchio si ribalta in una breve animazione. Nessuna crepa nella cella.
- Porta: segmento marrone sulla linea della griglia, da muro a muro. Chiusa è piena, aperta è solo un
  contorno sottile. Uno dei pochi elementi colorati, perché è interagibile.
- Muro: doppia linea chiara sottile con un vuoto scuro in mezzo, spesso. Non deve sembrare fatto
  di mattoni. Gli angoli sono pieni (la linea sporge a coprire lo spigolo).
- Varco fra due aree distinte (stanza, corridoio, ...): ai due lati sporge un piccolo blocco (stipite),
  nello stesso stile del muro, chiuso su tre lati (sopra, sotto e in punta). Serve a riconoscere il
  varco ed è dove si agganciano i cardini. Un punto morto non è un'area a sé: il suo varco non ha
  stipiti (nel JSON del tile: `"deadEnd": true`).
- Altri elementi grafici colorati solo se necessari (torce, oggetti interagibili).
- Le misure stanno in src/app/game/constants.ts. Colori, opacità e spessori di linea sono token per ruolo in
  src/app/game/theme.ts (un colore = un significato; un tema è una tabella ruolo -> valore). Mai valori
  scritti a mano nel rendering. La guida di stile è in docs/style-guide.md.

### Dettagli scenici
- Ossa, rametti, ragnatele, macchie si aggiungono sopra le fratture del pavimento.
- Per ora (`map/scenery.ts`, misure in `SCENERY`) ce ne sono due, a linee sottili come le fratture e senza colori nuovi; rametti e macchie sono stati provati e tolti (si rivedono uno alla volta). **Ossa (spente per ora: il disegno non convince, il codice resta e `boneChance` in `SCENERY` è a 0)**: un'asta con il contorno, più stretta al centro, con le estremità diverse (due nodi tondi, una sola rotula o il bordo dritto; il fondo è quello del pavimento, così le fratture non le attraversano), da una a due vicine; il 40% sono spezzate con il bordo a zig-zag, più strette dove si rompono: nel 65% dei casi resta un solo frammento (l'altro non c'è), altrimenti due pezzi ben staccati e storti; il pezzo rotto ha sempre un capo intero a due nodi o dritto (mai la rotula sola, che sembrerebbe altro); circa il 3,5% delle caselle, non accanto a un'apertura né sopra qualcosa. **Teschi** (di eroi precedenti): cranio ovale, mandibola con qualche dente, due orbite scure e il naso, a contorno sottile, ruotati a caso; circa l'1,5% delle caselle, con le stesse esclusioni. **Ragnatele**: solo negli angoli dove si incontrano due muri e non accanto a un'apertura (30% di quegli angoli: nell'avventura gli angoli idonei sono 16, quindi circa cinque ragnatele), da 4 a 6 fili a ventaglio ognuno con il suo angolo e la sua lunghezza, archi a distanze diverse e con cedimenti diversi, qualche arco strappato e qualche filo che sfugge oltre la punta; non accanto a un'apertura né sopra glifi, segnalini o ostacoli. **Sassi e detriti**: nelle caselle vicine a una roccia (anche in diagonale), con il 55% di probabilità e fino a tre sassi (contorno e riempimento come quelli delle rocce, ma di raggio 1,4-2,8 px e al 50% di opacità, perché non ricordino i blocchi) più qualche detrito piccolissimo, più fitti dal lato della roccia; mai in acqua, in buche o sui glifi, ma possono stare sotto un segnalino o un oggetto (sono disegnati sotto). Ogni casella decide da sola (seme della mappa + posizione).
- Sono generati dal codice a partire da un seed salvato con la mappa, così tutti i client vedono
  le stesse cose senza sincronizzarle. Non vanno su aperture, ostacoli e caselle con un glifo.
- Sono solo estetica. Rocce, fosse e acqua sono invece logica di gioco.

### Livelli di disegno (dal basso)
1. Fondo pieno del tile.
2. Pavimento: tinta unita, griglia di celle e fratture.
3. Dettagli scenici.
4. Oggetti (barili, bauli, scale, glifi, torce).
5. Muri.
6. Luce e ombra.
- Gli SVG vengono convertiti in texture una sola volta (atlas). Mai centinaia di nodi SVG nel DOM.

### Luce
- Tutto ciò che è vivo è caldo: torce (glow lento), pedina attiva, oggetti interagibili.
- Torce (`torches` nel file della mappa, `torches/torch-view.ts`): dati dell'avventura, non del tile. Ognuna è agganciata a un incrocio della griglia sul muro (`x`, `y` = angolo in alto a sinistra della casella x, y) e ha un lato `facing` (N, E, S, W) verso cui sporge dal muro, verso la stanza. Disegno visto dall'alto: una staffa sottile (come le linee dei muri) che sporge dalla faccia interna del muro e regge una coppa ad anello, con dentro il fuoco: quattro strati a lingue (rosso-arancio, arancio, giallo, quasi bianco) che cambiano forma di continuo, qualche scintilla che sale verso la stanza, e un alone caldo che si somma al pavimento (raggio 2,6 celle). La luce cade solo sulle caselle già esplorate e non esce dai muri; la torcia si vede quando una delle due caselle che illumina è esplorata. Il fuoco e l'alone ondeggiano piano (`TORCH` in `constants.ts`). Per ora la luce non è bloccata dalle porte né dagli angoli (la luce e l'ombra vere sono l'ultimo livello di disegno, da fare). Per ora nessuna avventura le usa: il codice resta pronto e saranno un elemento cosmetico dell'editor, che l'autore dell'avventura inserisce se vuole.
- Le caselle non esplorate sono vuote e leggermente opache (un velo del colore dello sfondo); ciò che gli eroi
  hanno visto resta a piena opacità.

### Riferimento visivo
- Il file docs/riferimento-visivo.png è uno schizzo dell'atmosfera voluta: fondo nero con puntini
  solo fuori dal dungeon, muro a doppia linea, scale con triangolo verde che punta fuori dalla
  mappa. È un riferimento di atmosfera, non un layout esatto. Il pavimento a lastre rotte dello
  schizzo è superato: vale lo stile "Tile" descritto sopra.
- Altre immagini in docs/riferimenti/ servono solo come ispirazione. Mai ricalcarle.

### Effetto onda sullo sfondo (IDEA, forse non verrà adottata)
- Un'onda parte dal centro e pulsa verso l'esterno.
- I puntini toccati dall'onda si accendono. Colore provvisorio: bianco acceso, finché non
  sceglieremo un colore di accento. Il colore deve stare in una sola variabile, facile da cambiare.
- Si usa come caricamento e, più avanti, come feedback di azioni.

### Interfaccia
- L'interfaccia è in HTML (componenti Angular con signals, in src/app/ui/) sopra il canvas di Pixi, che resta solo
  per la scena. Contenitori scuri (`--c-surface`) a spigoli secchi: ogni pannello, pillola, bottone, tab e ritratto usa `--radius-1` (2 px); tondo (`--radius-round`) solo il token "!" sopra la pedina e le pedine sulla mappa. Stile tecnico, deciso con docs/PIANO-DESIGN.md (sostituisce le vecchie pillole tondeggianti). Niente menu di testo.
- In alto a sinistra: per primo il logo dell'app (public/logo/, SVG usato come maschera, colorato come il testo; per ora un
  segnaposto) come bottone a pillola che apre il menu generale dell'app: una tendina sotto il logo (stile mat-menu, una colonna di voci; si chiude con un tocco fuori, Esc o una scelta) con "Impostazioni" e "Concludi partita" (segnaposto: dicono "Non ancora disponibile") e "Componenti", che apre il catalogo dei componenti (`app-components-dialog`): una finestra a due colonne, a sinistra la ricerca (nome, tipo, testi delle regole; senza accenti né maiuscole) e l'elenco delle categorie raggruppate (Personaggi: Eroi e Mostri; Oggetti: Negozio; Consumabili: Pozioni (curativa e di vitalità, con il prezzo del negozio: non sono oggetti del catalogo); Tesori: Rame, Argento, Oro; Reliquie; Abilità: Combattimento, Sotterfugio, Magia) con quanti elementi hanno o quanti corrispondono alla ricerca, a destra le card della categoria scelta in una griglia a due colonne dove ogni riga è alta quanto la sua card più grande, con le copie (×N) dove si sanno e senza il divisorio del piede (nel catalogo non ci sono azioni). Le card degli eroi (`app-hero-card`, dalle schede in `public/heroes/`, elencate in `index.json`; senza oggetti iniziali, perché non sono fissi, e con un'abilità segnaposto "lorem ipsum" finché non è definita) e dei mostri (`app-monster-card`, con le due versioni in due box uno sotto l'altro) mostrano tutti i parametri (sono pubblici). Le card degli oggetti non hanno segni di quota (gli angoli gialli o blu sembravano una selezione). Poi le pillole con icona, testo e valore per i contatori (Conquista, Round; poi le Chiavi raccolte, vicine alle chiavi runiche; il denaro non è in alto: sta solo nell'Inventario di ogni eroe), più una pillola solo icona per ognuna delle chiavi runiche presenti nella partita (al massimo 3: le trova
  `runesInPlay`, tra porte, oggetti a terra, scrigni e gruppo): grigia e tenue finché non è trovata, poi nel colore della runa. Dopo le chiavi runiche, il pallino "?" (`app-legend`) apre la **Legenda**: un pannello sotto la riga dei contatori, che scorre se serve, con un piccolo disegno (SVG semplici nei colori del tema, `--cad-*`) e una riga di spiegazione per ogni cosa che si vede in mappa (muri, porte, roccia, buca, acqua, scale, glifi, non esplorato, area di movimento), per gli oggetti (scrigni, pozioni, denaro, chiavi) e per pedine e menu "!". Niente comandi da tastiera né colori né temi: c'è un solo tema, quello scuro. Una cosa nuova in mappa si aggiunge anche lì (`GROUPS` in `ui/legend.component.ts`).
- In basso a sinistra (soprattutto per il mobile, la parte bassa è del giocatore; in diagonale rispetto al Signore supremo, in alto a destra): una striscia di tab attaccati, uno per ogni eroe (l'Overlord non è qui: sta in alto a destra), ognuno con bordo sottile e angoli a 2 px (nessuna spalla concava: la striscia poggia sul footer). Chi ha il turno
  ha il tab espanso e più lungo (nome con a destra il numero di pozioni (icona della pozione) e il tasto dell'inventario, in grigio come il bordo; cuori; poi una riga di valori: movimento con footprint in
  verde, fatica con water_drop in arancione, armatura con shield in bianco, e a destra, staccato, il tasto delle informazioni `i`, in grigio come il bordo;
  solo i valori attuali, senza il massimo; niente contatore degli attacchi né Valore nel tab, troppo pieno: il Valore sta solo sull'immagine dell'eroe nei pannelli e
  per gli attacchi si troverà un altro modo con il combattimento); quando cambia l'eroe attivo, il tab di prima si comprime e il nuovo si allarga, insieme. Chi ha già agito ha il ritratto
  desaturato. L'Overlord, che in interfaccia si chiama "Signore supremo", ha un suo blocco, separato dal gruppo, in alto a destra (`app-overlord-panel`), con le stesse dimensioni di un tab espanso di un eroe (320 × 76 px; su schermi stretti si restringe): ritratto segnaposto (public/characters/overlord.webp), nome e contatori in riga: Minaccia (sempre visibile, tutti la vedono), Mazzo (carte rimaste, in rosso) e carte in mano. Lo vedono tutti, anche con l'Overlord scriptato (serve a capire cosa sta per succedere). Un tocco accende e spegne la vista Overlord; bordo rosso con la vista accesa o nel suo turno. Le notifiche stanno sotto di lui. Il basso è sempre "il mio lato" e l'alto "l'avversario": con la scelta del ruolo i due si scambieranno.
- Due pannelli per ogni eroe, aperti dal tasto dello zaino (`tokens/items/backpack`, a destra del nome) e dalla `i` (in basso a destra nel tab attivo): dentro una cornice comune
  (`app-hero-panel`) sopra la barra, lunga quanto l'elenco dei tab degli eroi (senza l'Overlord; a tutta larghezza su schermi stretti), che sta sopra il bottone
  contestuale. Altezza fissa e uguale per tutti e due (corpo che scorre se serve); a destra del pannello (il gruppo è in basso a sinistra) l'immagine a figura intera dell'eroe
  (`portraitFull` della scheda, `<nome>_full` in public/characters/), di dimensione fissa e ritagliata a riempire (cover), un po' ruotata (+4°) e infilata
  sotto il bordo del pannello, che le sta sopra e non si restringe (su schermi stretti l'immagine non si mostra); in basso a destra il **Valore** (la Conquista che il gruppo perde se l'eroe muore) in una stella a 16 punte nera col bordo sottile e il numero al centro; sul suo piede, un fondo opaco con il nome
  dell'eroe e il sottotitolo (la classe, in maiuscolo); all'apertura il pannello sale appena (10 px, 240 ms) e appare, e nello stesso momento l'immagine
  scivola da sotto di lui verso destra fino al suo posto (340 ms); in cima due etichette a cartella, "Informazioni" e "Inventario" (contornate in alto, a sinistra e a destra, si dividono la larghezza,
  quella aperta si fonde con il corpo), cliccabili per passare dall'una all'altra. Niente X: si chiudono con un tocco fuori, Esc, o quando cambia l'eroe attivo.
  - Informazioni (`i`): "Parametri" (i cuori, con a destra il valore numerico della salute e fra i due una riga a puntini quasi invisibile che si allunga
    in base ai cuori; poi velocità, fatica, armatura; il Valore non c'è: sta sull'immagine), "Attributi" (per ora solo il segnaposto "Presto disponibile": le quattro caratteristiche
    sono in pausa), i dadi d'attacco extra (Mischia,
    Distanza, Magia, con un cubo `deployed_code` per ogni dado), "Abilità primaria" (quella a parole, stampata sulla scheda) e "Abilità secondarie" (le carte abilità pescate a inizio partita: tante per ramo quante dice `skills` della scheda, e quelle comprate al campo; per ora card di solo testo, `app-skill-card`).
  - Inventario (cassa): le monete (solo qui), le pozioni (3 posti), "Mani libere N", gli oggetti equipaggiati e lo zaino come card
    complete (in cima icona, nome, tipo e mani e a destra i dadi dell'oggetto come cubi colorati senza testo: un cubo per ogni dado dell'arma, del suo colore (rosso, verde, blu, giallo, bianco); poi a tutta larghezza una sezione "Abilità" con
    le diciture semplici: uno o più `bolt` per Scarica affiancati all'effetto, senza due punti, e "Bonus di supporto +1 danno"; la descrizione c'è nel modello ma non si mostra; in fondo un piede con a sinistra i tasti e a destra il valore) con i tasti
    Equipaggia/Nello zaino (2 punti, con l'icona delle impronte e il numero in verde) e Scarta (0). Dare un oggetto a un eroe adiacente è un'azione del bottone contestuale, 1 punto.
- Scheda dei mostri (pubblica: nel regolamento, passo 3B, le carte riepilogative dei mostri stanno scoperte vicino al tavolo "in modo che tutti i giocatori possano vederle e consultarle"; segreta è solo la mano del Signore supremo): toccando un mostro che si vede compare il menu con le armi e, in fondo, la voce **Scheda** (icona `info`, sempre presente anche se non si può attaccare). Nella **vista Overlord**, che si accende toccando il blocco dell'Overlord (bordo rosso finché è accesa; provvisorio: poi la vista sarà una scelta di ruolo) si vedono anche i mostri non ancora scoperti e toccandone uno la scheda si apre direttamente. La scheda è `app-hero-panel`: stessa cornice dei pannelli degli eroi (immagine a figura intera a destra, etichetta unica "Informazioni"), sopra la barra e lunga quanto l'elenco degli eroi; mai insieme al pannello di un eroe. Dentro (`app-monster-sheet`): parametri (cuori, ferite, velocità, armatura, dimensione), attacco (tipo e dadi, il nero è il dado potere) e abilità speciali.
- Attacco (docs/REGOLE.md, sezioni 5-7): nel turno di un eroe che ha attacchi, un tocco su un nemico che si vede apre sopra di lui un menu aperto con le armi equipaggiate che si possono usare (`app-context-menu` con `autoOpen`, icona `swords`): la mischia solo se il nemico è adiacente, distanza e magia se c'è linea di vista (la gittata la decidono i dadi), i pugni se non ha un'arma da mischia; le voci non possibili restano, con il motivo (nessun attacco, nessuna linea di vista). La scelta apre `app-attack-dialog`, una finestra al centro di altezza fissa (il contenuto scorre, con il piede dei tasti sempre in vista): in mezzo arma, dadi e distanza; ai lati le carte dell'eroe (a sinistra) e del nemico (a destra), inclinate di 4° e infilate sotto il pannello come l'immagine dei pannelli degli eroi, con nome, sottotitolo e cuori e, solo sulla carta di chi difende, l'armatura in uno scudo nero appena sopra il piede (stesso stile del Valore dell'eroe): il numero, quello valido contro quel tipo di attacco (anche per i nemici: le loro carte sono pubbliche). I dadi 3D rotolano sullo schermo sopra la finestra, senza una zona dedicata; su schermi stretti le carte non si mostrano. Passi: anteprima (si può annullare senza spendere l'attacco), tiro, esito (facce uscite, scelta gittata/cuore sulle facce multivalenti, abilità da attivare con le Scariche (bottoni ripetibili, con il contatore di quante volte, spenti se non bastano le Scariche), verdetto) e "Applica", che consuma l'attacco, toglie le ferite e fa svanire (rosso, lentamente) il nemico sconfitto; il colpo fatale a un mostro potenziato dà all'eroe 50 monete sue (`ENHANCED_KILL_COINS`, dal manuale; la notifica lo dice). I bonus fissi delle carte abilità e degli oggetti equipaggiati per quel tipo di attacco (danno, gittata, onde di potere) e le eccezioni di vista compaiono sotto i dadi, con il nome di chi li dà (`state/effects.ts`: `effectsOf`, `statBonus`, `attackBonus`; stessi `effects` per carte abilità e oggetti). Le regole stanno in `state/combat.ts` (`attackOptions`, `planAttack`, `resolveAttack`, `applyAttack`), che non conosce l'interfaccia; il tiro arriva da fuori (`FaceRoll[]`), così nel multigiocatore lo deciderà l'host.
- Turno dell'Overlord (docs/REGOLE.md, sezione 9): dopo l'ultimo eroe `passTurn` mette la fase `overlord` e la scena (`runOverlordTurn`) gioca ogni mostro con le decisioni di `state/overlord.ts` (`planMonsterMove`, `chooseMonsterTarget`): cammina con la stessa animazione degli eroi (`pieces.walk`, la camera non segue i mostri non visibili) e attacca con la stessa finestra (`auto`: la sua carta a sinistra, "Attaccante" al posto dell'arma, niente tasti: tira l'Overlord, le scelte le fa lo script e dopo il tiro una barra sottile in basso si esaurisce in 5 secondi, poi l'attacco si applica e il pannello si chiude da solo; con il mouse sopra il tempo si ferma, con il tocco si ferma al tocco e riparte con un altro tocco o un tocco altrove, come per le notifiche). Un eroe che muore svanisce in rosso come per la caduta. All'inizio del suo turno una notifica dice quanti punti Minaccia ricarica (1 per eroe: "Turno del Signore supremo: ricarica N punti Minaccia"). Intanto i comandi degli eroi sono bloccati (`overlordBusy`); alla fine `endOverlordTurn` fa partire il nuovo round.
- Niente bordi gialli sugli eroi attivi dell'interfaccia (tab e scheda): ci sono già molti colori; l'eroe attivo si riconosce dal tab espanso.
- Contenitori con un bordo sottile chiaro (`ui.panelBorder`), perché il nero da solo non si distingue dallo sfondo.
- Comandi dell'eroe, a schermo e da tastiera (gli stessi, `tapCommand`): in basso a destra sopra il footer tre pallini solo icona (`app-action-controls`):
  Correre (R), Combattere (C), Riposo (S); l'azione scelta ha il bordo acceso, un secondo tocco la toglie, e dove c'è una tastiera (puntatore preciso)
  la lettera compare in un angolo. Spenti durante l'attacco, il turno dell'Overlord e il catalogo. Passa (Invio) è un tab quadrato con icona e testo
  in fondo alla striscia dei tab, a destra dell'ultimo eroe, fuori dal flusso (non sposta il centro della barra né i pannelli). Il footer serve solo agli strumenti di sviluppo.
- Costi in punti movimento: dove un testo dice quanto costa un'azione (notifiche, motivi per cui non è possibile, didascalie del bottone contestuale), il costo è il
  valore con l'icona `footprint`, in verde (il colore del movimento), mai "N punti movimento" a parole (si scrive `{mov:N}` nel testo: `app-cost-text`;
  nei suggerimenti col mouse, che non hanno icone, si riscrive a parole). Lo stesso vale per la fatica: valore con l'icona `water_drop` in arancione (`--c-stamina`), mai "N fatica" a parole (si scrive `{fat:N}`; i tasti, le notifiche e i bottoni delle abilità usano `app-cost-text`). Fanno eccezione i testi di descrizione delle carte, che restano frasi. Nei bottoni con un costo (Usa, Equipaggia, +1 dado potere) il costo va prima del testo, senza puntino di separazione; solo icona e valore sono colorati, il testo resta bianco, e il bordo e un fondo appena visibile (8%) prendono il colore del costo (verde il movimento, arancione la fatica, ambra se non ce n'è) solo al passaggio del mouse.
- Tocco (mobile): dove con il mouse c'è il suggerimento al passaggio, con il tocco si guarda il tipo di puntatore di ogni evento (non il dispositivo, così un portatile
  con schermo touch usato con il mouse resta un desktop). Nel menu del bottone contestuale il primo tocco su un pallino lo seleziona e mostra la didascalia (nome e
  costo, o il motivo), il secondo lo esegue. Un tocco su un'icona con un suggerimento (statistiche, pozioni, dadi...) lo mostra come notifica. I bottoni spenti non sono
  `disabled` ma `aria-disabled`: un clic o un tocco mostra il motivo come notifica (anche con il mouse).
- Messaggi: una notifica in alto al centro (`app-toasts`). Entra dall'alto, al centro dello schermo in cima (su schermi stretti, sotto il blocco del Signore supremo), con il ritratto dell'autore (di solito l'eroe attivo; l'Overlord per le sue cose, il gioco senza ritratto per le notizie generali) e un titolo (la categoria, dedotta dall'icona: `noticeTitle`), poi si espande e mostra il testo (con le icone dei costi) e l'icona. Una barra sottile in fondo si esaurisce in circa 4,6 secondi e alla fine parte la dissolvenza. Con il mouse il tempo si ferma finché il puntatore è sopra; con il tocco si ferma al tocco e riparte con un secondo tocco sulla notifica o un tocco altrove (si guarda il tipo di puntatore di ogni evento).
- Azioni contestuali (`app-context-menu`, regole in `contextActions`): quando il PG è vicino a qualcosa di usabile (porta, scrigno, scala, glifo) compare sopra la sua
  pedina un bottone tondo con un punto esclamativo; un clic lo apre in tanti pallini, uno per azione, con il costo e,
  se non è possibile, il motivo. Sostituisce il clic sulle porte e sugli scrigni. Il viaggio da glifo a glifo si sceglie ancora
  cliccando il glifo di destinazione.
- La mappa non ruota: il nord è sempre in alto. L'indicatore del nord è un pallino fisso in cima alla colonna dei comandi della camera, sul lato destro (`app-compass`, dentro `app-zoom-controls`), nello stile dei pallini solo
  icona (come le chiavi runiche): una freccia con la punta in su e una N in un font con le grazie (serif), entrambe piene di cremisi (`compass`). I comandi della camera
  sono pallini separati in colonna sul lato destro, a metà altezza (`app-zoom-controls`): mostra tutta la mappa (`fit_screen`: stessa inquadratura di quando si carica, con lo stesso scorrimento), centra sull'eroe attivo (pan e zoom insieme: lo porta al centro con lo zoom di 4 click su +
  dallo zoom iniziale, circa 2,4×, in uno scorrimento di 450 ms; si interrompe se si trascina o si zooma), poi + e −. Mentre un eroe si muove la camera lo segue con il solo pan (lo zoom non cambia, inseguimento morbido); se
  nel frattempo si trascina o si zooma, smette di seguirlo fino alla fine di quel movimento. È dell'interfaccia e non della mappa (un token sulla mappa sparirebbe appena si zooma): resta fermo qualunque sia lo zoom.
- Pedine sulla mappa: cerchi con l'immagine dell'eroe, bordo acceso per l'eroe attivo. I mostri grandi hanno la stessa forma allargata: un cerchio più grande per 2×2, una capsula per 1×2 e 2×3, con lo stesso margine dal bordo delle caselle; occupano tutte le loro caselle (bloccano il movimento e la vista, si vedono se se ne vede una qualunque). Si muovono con la sagoma intera (docs/REGOLE.md, "Movimento dei mostri grandi"): la pedina del Segugio infernale cambia forma quando si piega. Nell'interfaccia (tab della barra e scheda completa) il
  ritratto è invece un quadrato smussato (non tondo), che si affianca meglio alla curva del tab.
- Punti vita a cuori, divisi in quarti (le ferite massime degli eroi sono multipli di 4).
- Rivelazione: ciò che si scopre compare con una breve animazione (il velo svanisce; un mostro appare con scala da 1.2 a 1).

## Regole di gioco
La fonte vincolante è **docs/REGOLE.md** (round, azioni, movimento, caratteristiche e prove, dadi d'attacco, difesa, surge,
ferite, morte, Conquista, Overlord, scheda eroe). Dove CLAUDE.md e REGOLE.md non coincidono, vale REGOLE.md.
In particolare le prove di REGOLE.md (scassinare, saltare una buca) sostituiscono gli attuali "riesce sempre".
Il PDF in docs/riferimenti/ è solo ispirazione e non va nel repository pubblico.

### Regole dell'ambiente già implementate (da portare in REGOLE.md)
Dettagli di porte, ostacoli, rivelazione, scrigni, scale, oggetti e glifi che REGOLE.md non ripete.

- Porte: si trovano sulle linee fra le caselle. Aprirle o chiuderle costa 2 punti movimento e si fa da
  una casella adiacente (anche in diagonale). Chiusa blocca movimento, linea di vista e attacchi.
  Si apre e si chiude con un'animazione dell'anta attorno al cardine.
- Porte con serratura: a chiave si apre con la chiave giusta (costo normale), oppure si scassina (4 punti
  movimento, per ora riesce sempre e poi la porta si apre) se la porta lo permette. Le runiche si aprono solo
  con la chiave runica del colore giusto (rossa, blu o verde): non si scassinano e i mostri non le aprono mai.
  Una serratura aperta resta aperta per sempre.
- Eroe attivo: un clic su un altro eroe lo seleziona (ordine libero fra gli eroi); ognuno ha i suoi
  punti movimento, che tornano al massimo a ogni nuovo round.
- Ostacoli: roccia e acqua bloccano il movimento (la roccia blocca anche la vista, l'acqua no) ma non
  le diagonali accanto a loro. La buca non blocca la vista. Entrarci significa cadere: 1 ferita che
  l'armatura non riduce, e il movimento finisce lì. Da una buca si esce con 2 punti movimento su una
  casella libera adiacente alla buca. Si può saltare una buca spendendo 3 punti per ogni spazio
  saltato. Dentro una buca non si vede fuori, ma da fuori si vede chi è dentro. I mostri grandi
  subiscono la buca solo se finiscono interamente dentro.
- Campo visivo (linea di vista): una linea dritta dal centro della casella di chi guarda al centro della casella
  da vedere. La bloccano muri, porte chiuse, rocce e altre creature (anche i compagni): si vede la creatura, non
  ciò che le sta dietro. Acqua e buche non la bloccano; chi è dentro una buca vede solo la propria casella. Una
  linea che sfiora soltanto l'estremità di un muro non è bloccata: blocca solo se lo attraversa davvero.
  Il campo visivo non si disegna.
- Rivelazione: si scoprono i singoli elementi, non le stanze intere. Vale la vista di tutti gli eroi insieme.
  Le caselle viste restano esplorate per sempre (come se gli eroi avessero preso nota). Rocce, buche, acqua e porte
  si rivelano quando si vede una delle loro caselle; un mostro quando si vede la sua casella, e da allora si
  vede sempre. Si ricalcola a ogni passo e quando si apre o chiude una porta. Se compare un mostro, il movimento
  si ferma. Le caselle non esplorate restano vuote e leggermente opache; chi costruisce la mappa vede tutto.
- Scrigni: occupano una casella ma NON sono ostacoli (come da regolamento). Un eroe deve entrare nella casella e
  spendere 2 punti movimento per aprirlo (clic sulla casella in cui sta); un altro personaggio nella stessa casella
  non può esserci, perché due pedine non si fermano sulla stessa casella. Il tipo (rame, argento, oro) si vede subito;
  il contenuto lo decide l'avventura (`contents`): Conquista da +2 a +4, chiavi runiche
  e denaro, dati al gruppo all'apertura. In più, di solito, ogni eroe pesca un tesoro dal mazzo del tipo dello scrigno (rame, argento, oro; docs/REGOLE.md,
  sezione 3c); chi crea l'avventura lo può togliere con `random: false`. I tre mazzi sono pieni (docs/cards/bronze-, silver- e gold-treasure.md). Maledizioni sono fuori scope. Scelta nostra, diversa dal regolamento (che toglie il
  segnalino): lo scrigno aperto resta sulla mappa come cassa vuota, solo scenica. Per ora gli scrigni sono senza
  serratura. I mostri non li aprono e non possono fermarsi su uno scrigno (regola che varrà quando i mostri si muoveranno
  da soli). Si rivelano come gli altri elementi.
- Scale (scalinate): due segnalini con la stessa etichetta (`link`, non si vede) collegano due punti della mappa, anche lontani e senza
  corridoi: non ci sono piani, tutte le parti di mappa si vedono insieme ma possono restare separate. Un eroe (non un
  mostro) su una scala passa all'altra per 1 punto movimento, e poi può proseguire. Si può usare anche se l'altro capo
  non è ancora stato visto: la nuova area si rivela subito. Vista: chi è su un capo rivela l'altro capo (con la sua
  icona) e le 8 caselle intorno; chi è adiacente a un capo (e lo vede) vede l'altro capo. I tre lati chiusi sono muri: si
  entra solo dal lato aperto e bloccano la vista come gli altri muri. Gli attacchi passano attraverso le scale come se
  i due capi fossero adiacenti (quando ci sarà il combattimento). I mostri grandi non le usano (fuori scope). Nella
  scatola ce ne sono 6, cioè 3 coppie. Si riconoscono dal filo sottile tratteggiato che unisce i due capi quando si
  conoscono entrambi, non dal colore.
- Zona iniziale: gli eroi partono sopra o accanto a un glifo attivo (come da regolamento), nella parte iniziale della
  mappa; mostri, porte e oggetti dell'avventura sono già nei dati della mappa e restano nascosti finché non si
  rivelano.
- Oggetti a terra: la pozione è l'SVG di public/tokens/potion.svg (vetro grigio, solo il liquido colorato: lilla la
  curativa, arancione quella di vitalità). Un eroe che entra nella loro casella li raccoglie da solo, anche solo passandoci sopra, senza
  spendere punti movimento; i mostri non raccolgono. Raccolti spariscono dalla mappa.
  - Pozione curativa (4 ferite, un cuore intero) e pozione di vitalità (riporta la fatica al massimo, 1 punto movimento per berla, non si beve se è già al massimo): ogni
    eroe ha il suo set di massimo 3 pozioni (docs/REGOLE.md, sezione 3b). Raccoglierla non costa punti movimento (se ne porta già 3
    resta a terra), bere costa 1 punto, darla a un eroe adiacente costa 1 punto: sono azioni del bottone contestuale. Ogni eroe mostra
    quante ne porta nel tab (icona della pozione e numero) e quali nella scheda completa (3 posti).
  - Denaro (un elemento ambientale disegnato da codice, come le rocce: un mucchio di 100 monete (una per ogni moneta che vale il segnalino),
    cerchietti piccoli visti dall'alto, pieni d'oro (`coin`) con un contorno sottile più scuro (`coinEdge`), più fitti al centro con quelle in alto sopra le altre,
    il contorno del mucchio irregolare, e circa il 12% sparse intorno; tutto lontano dai bordi della cella (11 px) per non finire in un muro; dal seme della mappa): un segnalino vale 100 monete per OGNUNO degli eroi (anche morti o in città), non per
    chi lo raccoglie. Il denaro è personale: ogni eroe ha il suo (`coins` della pedina, 300 all'inizio meno ciò che ha comprato); si vede solo nel pannello Inventario dell'eroe. Un eroe morto perde metà del denaro (per difetto).
  - Chiave normale (l'SVG public/tokens/little_key.svg, colore delle porte a chiave; dati: `key` con `keyId`): raccolta
    (da terra o da uno scrigno) entra nel gruppo (`party.keys`) e apre la porta a chiave con lo stesso `keyId`.
  - Chiave runica (l'SVG public/tokens/rune_key.svg, colorato come la porta che apre): non è un oggetto (non va nello zaino). Raccolta (da terra o da uno scrigno) sblocca per tutti gli
    eroi le porte di quel colore (`party.runeKeys`). Il bottino dei nemici (anche le chiavi) si farà con il combattimento.
- Glifi: un eroe che entra nella casella di un glifo spento lo accende, anche solo passandoci sopra; da acceso
  resta acceso. Accenderlo vale +3 alla Conquista. I mostri non possono fermarsi su un
  glifo acceso, ma possono passarci sopra o attaccare chi ci sta. Il glifo si rivela come gli altri elementi.
  Viaggio: un eroe fermo su un glifo acceso, con almeno 1 punto movimento, può andare su un altro glifo acceso,
  già scoperto dagli eroi e senza nessuna pedina sopra (amica o nemica), spendendo tutti i punti movimento che gli
  restano (il turno di movimento finisce lì). Solo gli eroi. Finché un eroe è su un glifo acceso, le sue destinazioni
  emettono l'onda di accensione, ripetuta a intervalli. Un glifo con una pedina sopra non emette bagliore. Quando ci
  sarà la città (fuori scope per ora) i glifi permetteranno anche di andare in città e tornare per 1 punto
  movimento, una volta per turno, e agli eroi morti di rientrare nel dungeon.
- Morte di un eroe (docs/REGOLE.md, sezione 8; oggi solo cadendo in una buca a 1 ferita): il gruppo perde Conquista pari al suo valore, lui perde metà del denaro e va in città
  a ferite piene (`killHero`, `CityStay.dead`); il suo turno finisce subito e dal round dopo rientra su un glifo acceso senza pagare. Sulla mappa la pedina resta un momento, sfuma lentamente
  (`HERO_DEATH_FADE_MS`, circa 2 secondi) e diventa rossa (`danger`), poi sparisce.
- Città (docs/REGOLE.md, sezione 3d): un eroe su un glifo acceso viaggia in città spendendo tutto il movimento (minimo 1); la sua pedina esce dalla
  mappa (non vede, non blocca, non è adiacente) e il tab dice "In città". Sceglie un solo servizio (Negozio: pozioni, tesori dai mazzi, oggetti con scorte
  limitate, vendita a metà prezzo arrotondato per difetto a 25 monete (minimo 25); i tesori di un tipo si comprano solo dopo che il gruppo ha aperto uno scrigno di quel tipo; Campo di addestramento: 1000 monete per una nuova carta abilità a caso del ramo scelto, 500 per un dado in più a uno dei tre attacchi, fino a 5; Tempio, inventato da noi: salute al massimo per 100 monete), poi passa il turno
  (i servizi esistono solo nel turno dell'arrivo). Al turno dopo deve tornare, anche se non ha visitato niente: la scelta del glifo parte da sola quando tocca a
  lui (i glifi acceso, scoperti, liberi e che può pagare brillano, la camera si sposta sul glifo di partenza, si clicca quello scelto; non si annulla, e se nessun
  glifo è libero può solo passare): quello di partenza è gratis, un altro costa 25 monete. Il pannello dell'eroe ha una terza etichetta "Città" e il tab un
  tasto `castle`, ma solo nel turno dell'arrivo (poi sono disabilitati).
- Inizio della partita (docs/REGOLE.md, sezione 0b; `state/setup.ts`): se la mappa ha `intro` o `start`, a partire a mappa vuota (gli eroi sono tenuti da parte) compare `app-adventure-dialog` con il titolo (`title`) e l'introduzione (`intro`), che si chiude solo con "Ho letto" (z-index 860, testo lungo che scorre); poi lo stesso per l'obiettivo (`objective.description`, o `text`); poi si segnano le caselle di `start` con un cerchio giallo a trattini, senza riempimento, che lampeggia piano (`START_MARK`) e una barra in alto al centro dice "Scegli la casella di partenza di ..." mentre gli eroi scelgono uno alla volta toccando una casella (se è già presa, `placeHero` lo mette a caso accanto). Finita la scelta la camera va sull'eroe attivo e comincia il turno. Durante tutto questo i comandi degli eroi sono fermi. Il tasto "Obiettivo" (pillola con `flag` in alto, `app-pill button`) riapre il testo dell'obiettivo in qualunque momento, con "Chiudi", Esc o un tocco fuori. Le conferme sono in `state.setup` (`required`, `confirmed`) così nel multigiocatore servirà la conferma di tutti. Senza `intro` né `start` (mappe di prova) la partita parte subito e compare la vecchia notifica dell'obiettivo.
- Eroi: una partita ne ha da 2 a 4. Con due giocatori il giocatore eroe ne controlla due, perché l'altro giocatore è il Signore supremo (per questo gli scaglioni dei mostri contano gli eroi più il Signore supremo). Oggi ce ne sono due, Anarien e Ferdinand.
- Obiettivo della prima avventura: raggiungere e sconfiggere il boss.



## Stati
- Gli stati (`state/status.ts`, `docs/REGOLE.md` sezione 2c, `docs/cards/stati.md`) sono `Piece.status` con i segnalini di fiamma, rete, stordimento e veleno. L'attacco li piazza (`inflictionsFrom` legge le regole scritte a parole di armi e mostri: Bruciare, Veleno, Ragnatela, Stordire e le frasi di Placare e Pietrificare; le onde "+1 segnalino stordito/bruciare" ne aggiungono), l'immunità si legge con `immuneTo` (regola `immune` degli effetti, o `Piece.immune` dei mostri). A inizio turno `applyTurnStart` (con i dadi potere tirati dalla scena in `resolveTurnStart`) toglie fiamma e rete, fa le ferite, toglie la mobilità con la rete e rende stordita la creatura. Aura (`applyStep`), Paura (`resolveAttack`), Presa (`isGrappled`) e Immortale (`applyAttackNow`) sono attive.
- Come si vedono: i cuori verdi accanto a quelli delle ferite (veleno, un quarto = un segnalino), nel tab dell'eroe attivo le icone di fiamma, rete e stordimento con il numero tra l'armatura e la `i` (oltre tre, un `+`), nei pannelli un elenco "Stati", sulla pedina in alto a destra un cerchietto colorato per stato con la lettera e il numero.

## Abilità e Contraccolpo
- Le carte abilità con un effetto opzionale (`trigger` con `optional`) hanno un bottone "Usa · costo" sulla loro card nella scheda dell'eroe (`state/skills.ts`: `skillActions`, `useSkill`; un puntino giallo sul tasto `i` del tab quando ce n'è una da usare). Condizioni e costi: vedi docs/cards/abilities.md, "Abilità da usare". L'attacco in più "con la stessa arma" blocca le armi a quella (`lockedWeapon`).
- Camera di chi gioca: ogni cambiamento di pan e zoom si ricorda (`userCam`) e, con un piccolo ritardo, si salva nel localStorage (`cad-camera:<mappa>`); alla partenza si ritrova l'ultima inquadratura. Nel turno automatico dell'Overlord la camera la muove lo script e la camera dell'utente resta quella di prima: quando un mostro attacca un eroe la camera si adatta (pan e, se serve, zoom indietro) perché entrambe le pedine stiano nell'area libera dello schermo (`frameBoth`; se ci stanno già non si muove), e a fine turno, quando ricomincia quello degli eroi, ognuno torna alla sua inquadratura (`restoreUserCamera`).
- Contraccolpo (`state/knockback.ts`; i mostri grandi sono più pesanti: 3 spazi meno uno per ogni casella oltre la prima, quindi il Segugio infernale 2 spazi, Ogre e Drago nessuno, con una notifica; la sagoma si sposta intera e si evidenzia la sua casella in alto a sinistra): la pedina spostata *salta* fino alla nuova casella (scala da 1 a 1,5 e di nuovo a 1 durante lo spostamento, `PiecesController.jump`) e all'atterraggio dal suo bordo partono linee grigie a raggiera (`FX.jump*`, `FX.burst*`); vale per i Contraccolpi di eroi e mostri (nel gioco l'abilità dell'Ogre si chiama Contraccolpo); dopo l'attacco la scena evidenzia le caselle dove spostare il bersaglio e una barra in basso al centro (sopra i tab) dice di toccarne una o "Resta fermo"; per i mostri sceglie lo script. Per provarlo, nella mappa `combattimento` c'è un Ogre (ha Contraccolpo) nella stanza media; una pedina può anche avere abilità in più nella mappa (`traits`).

## Fatica
- La fatica è un valore con massimo (`fatigue`, `maxFatigue`; Esperto alza il massimo e il valore). Nel tab dell'eroe attivo il valore della fatica è un tasto: spende 1 fatica per 1 punto movimento (`fatigueForMovement`). Nella finestra dell'attacco, dopo il tiro, "+1 dado potere" spende 1 fatica per un dado nero in più (fino a 5, `addPowerDie`: i dadi 3D si aggiungono a quelli sul tavolo). Il Riposo (tasto S, azione `rest`) azzera movimento e attacchi e a inizio round riporta la fatica al massimo se non si sono subite ferite (`hurtWhileResting`).

## Interfaccia da fare (non ancora presente)
- Il negozio della città (oggi gli acquisti iniziali sono scritti nelle schede) e il bottino dei nemici.
- Un catalogo esplorabile delle carte (oggetti, tesori per mazzo, reliquie, abilità): sfogliare, filtrare per tipo, mazzo e ramo, vedere ogni carta come le card dell'inventario. Pensato anche per far vedere cosa c'è nei mazzi senza svelarne l'ordine.

## Fuori scope per ora
Carte abilità, mercato e città, tesori, famigli, dadi energia, comandi (mira, schivata,
guardia), mostri grandi, effetti durevoli, editor di avventure, acquisti, cosmetici,
achievement, Auth e Hosting.
