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
  Anche le pedine di partenza (squadra, nome, casella, velocità) sono dati dell'avventura: campo
  `pieces` del file della mappa; senza, parte un solo eroe.
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
- Ostacoli, tutti statici (niente shader né animazioni):
  - Roccia: masso grigio irregolare (forma dal seed della mappa), con attorno piccoli sassi e detriti
    sparsi solo per scena, dentro le celle dell'ostacolo.
  - Buca: un incavo nel pavimento. Bordo sottile e tenue, gradiente verso l'interno dal colore del
    pavimento al nero, e quattro linee a 45 gradi che partono dagli angoli verso il centro e sfumano nel
    nero, per dare profondità (corte, così nelle buche piccole non si toccano).
  - Acqua: solo un contorno azzurro sottile e una campitura a righe ondulate al 10% di opacità (nessun
    riempimento pieno). Bordi arrotondati, tutti con lo stesso raggio; dove tocca un muro arriva fino al
    muro, anche negli angoli. È uno dei pochi elementi colorati.
  Buche e acqua vicine dello stesso tipo si fondono in un'unica forma; le rocce restano sempre singole.
  Buche vicine contano anche come una sola buca per le regole (uscita, salto).
- Area di movimento dell'eroe attivo: solo il contorno ambra dell'unione delle caselle raggiungibili, un
  unico anello continuo che corre sul filo delle celle e rientra solo accanto ai muri; pulsa lentamente
  nell'opacità. Nessun riempimento. Il percorso sotto il puntatore evidenzia le caselle attraversate in
  giallo tenue (15%), senza linea né numeri (per ora).
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
- Sono generati dal codice a partire da un seed salvato con la mappa, così tutti i client vedono
  le stesse cose senza sincronizzarle. Non vanno su aperture e ostacoli.
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
- Le stanze non scoperte sono opache, la stanza iniziale a opacità piena.

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
- Nessun header o menu fisso. Pochi comandi sparsi e contestuali.
- Un click su un elemento apre un menu con le sole azioni possibili in quel momento, con il
  motivo se non lo sono.
- Rosa dei venti discreta. Rotazione della mappa a scatti di 90 gradi, testi sempre leggibili.
- Pedine: cerchi con l'immagine dell'eroe, bordo acceso per l'eroe attivo.
- Punti vita a cuori, divisi in quarti (le ferite massime degli eroi sono multipli di 4).
- Rivelazione di una stanza: gli oggetti compaiono con scale da 1.2 a 1, scaglionati.
- IDEA PER DOPO (non ora): pannello eroi laterale a pillola nera. Gli eroi sono pallini; quello
  attivo si espande in scheda, e gli altri pallini restano sopra e sotto di lui.

## Regole di gioco, versione 1
- Round: turni degli eroi (ordine libero fra loro), poi turno dell'Overlord.
- Azioni dell'eroe: Correre (movimento doppio, niente attacchi), Combattere (fino a due
  attacchi, niente movimento), Avanzare (movimento normale e un attacco).
- Porte: si trovano sulle linee fra le caselle. Aprirle o chiuderle costa 2 punti movimento e si fa da
  una casella adiacente (anche in diagonale). Chiusa blocca movimento, linea di vista e attacchi.
- Eroe attivo: un clic su un altro eroe lo seleziona (ordine libero fra gli eroi); ognuno ha i suoi
  punti movimento, che tornano al massimo a ogni nuovo round.
- Ostacoli: roccia e acqua bloccano il movimento (la roccia blocca anche la vista, l'acqua no) ma non
  le diagonali accanto a loro. La buca non blocca la vista. Entrarci significa cadere: 1 ferita che
  l'armatura non riduce, e il movimento finisce lì. Da una buca si esce con 2 punti movimento su una
  casella libera adiacente alla buca. Si può saltare una buca spendendo 3 punti per ogni spazio
  saltato. Dentro una buca non si vede fuori, ma da fuori si vede chi è dentro. I mostri grandi
  subiscono la buca solo se finiscono interamente dentro.
- Movimento a caselle, anche in diagonale. Si può passare tra amici ma non finire su una casella
  occupata. Muri, porte chiuse, rocce e nemici bloccano.
- Attacco: dichiarare lo spazio, verificare la linea di vista, tirare i dadi. Un "mancato" fa
  fallire l'attacco. La somma dei numeri deve raggiungere la distanza. Il danno è la somma dei
  cuori meno l'armatura.
- Rivelazione: un'area si scopre quando un eroe ha linea di vista su di essa.
- L'Overlord non può far apparire mostri in uno spazio visto da un eroe.
- Progresso: tesoro condiviso degli eroi. Si guadagna con glifi e scrigni, si perde quando un
  eroe muore. Se arriva a zero, gli eroi perdono.
- Obiettivo della prima avventura: raggiungere e sconfiggere il boss.

## Fuori scope per ora
Carte abilità, mercato e città, tesori, famigli, dadi energia, fatica, comandi (mira, schivata,
guardia, riposo), mostri grandi, effetti durevoli, editor di avventure, acquisti, cosmetici,
achievement, Auth e Hosting, pannello eroi a pillola.

## Prime tappe
1. Scheletro Angular con PixiJS, sfondo con puntini, zoom e pan (rotella, pinch e due piccoli
   tasti + e -). L'effetto onda non fa parte di questa tappa.
2. Tre o quattro tile di prova piazzati a mano sulla griglia.
3. Aggancio dei tile sulle aperture compatibili.
4. Una pedina con punti movimento che si muove casella per casella e si ferma davanti ai muri.
