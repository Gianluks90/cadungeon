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
- Un tile ha dimensione in celle (es. 2x4, 4x4, 2x2), aspetto SVG e aperture (lato, posizione,
  larghezza) descritte in un file JSON accanto allo SVG.
- Rotazione a scatti di 90 gradi. Due tile si agganciano se hanno aperture che si guardano
  con la stessa larghezza.
- Una mappa è solo un elenco di tile con posizione e rotazione. È anche il formato salvato
  e quello dell'editor futuro.
- Un'apertura senza tile vicino si disegna come muro. Non esistono tile "punto morto".
- La geometria dei muri è fatta di segmenti: serve per movimento e linea di vista.
- Muri e contorno di un tile si disegnano da codice a partire dal JSON. Gli SVG a mano servono
  solo per pavimenti e oggetti (barili, bauli, scale, torce).
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
- Niente colori né campiture: solo linee e toni di grigio.
- Pavimento: grigio uniforme, fatto di lastre quadrate (una per cella) con spaccature a linea
  sottile: piastrelle rotte, non crepe generiche. Nessun gradiente di luce sul pavimento.
- Muro: contorno spesso fatto da una doppia linea, con un grigio leggermente diverso dal fondo
  del tile. Non deve sembrare fatto di mattoni.
- Acqua (quando verrà implementata): azzurra, con una texture. È uno dei pochi elementi colorati.
- Altri elementi grafici colorati solo se necessari (torce, oggetti interagibili).

### Dettagli scenici
- Ossa, rametti, ragnatele, macchie si aggiungono sopra crepe e scaglie.
- Sono generati dal codice a partire da un seed salvato con la mappa, così tutti i client vedono
  le stesse cose senza sincronizzarle. Non vanno su aperture e ostacoli.
- Sono solo estetica. Rocce, fosse e acqua sono invece logica di gioco.

### Livelli di disegno (dal basso)
1. Fondo pieno del tile.
2. Pavimento (crepe e scaglie), con variazione per cella (rotazione di 90 gradi, tono).
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
  solo fuori dal dungeon, muro a doppia linea, pavimento a lastre rotte, scale con triangolo
  verde che punta fuori dalla mappa. È un riferimento di atmosfera, non un layout esatto.
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
