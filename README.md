# CADungeon (nome in codice)

Gioco da tavolo digitale per browser, ispirato ai dungeon crawler a squadra contro un Overlord,
ambientato nel mondo di Duels. Stile visivo da disegno tecnico (mappa CAD): linee sottili, toni di
grigio, pochi elementi colorati.

Stack: Angular (standalone + signals), PixiJS, PeerJS, Firebase (solo Firestore, più avanti).
Le regole complete e le decisioni di stile stanno in [CLAUDE.md](CLAUDE.md); i valori reali dello
stile in [docs/style-guide.md](docs/style-guide.md).

## Roadmap

Legenda: ✅ fatto · 🔜 prossimo · ⬜ da fare · 💤 fuori scope per ora

### Fase 1 — Fondamenta ✅
- ✅ Scheletro Angular con PixiJS, sfondo di puntini, zoom e pan (rotella, pinch, tasti + e -)
- ✅ Tile di prova in stile blueprint: muri a doppia linea, varchi con stipiti, pavimento a griglia, fratture
- ✅ Aggancio dei tile sulle aperture compatibili (rotazione a scatti di 90°)
- ✅ Pedina con punti movimento, passo per passo, che si ferma davanti ai muri

### Fase 2 — Mappa e mondo di gioco ✅
- ✅ Porte da muro a muro, apribili e chiudibili, con animazione dell'anta
- ✅ Porte con serratura: chiavi, scasso, chiavi runiche (rossa, blu, verde)
- ✅ Pedine multiple, eroe attivo selezionabile, regole di passaggio fra amici
- ✅ Ostacoli naturali: roccia, buca (caduta, uscita, salto), acqua animata
- ✅ Stile minimale e token di stile per ruolo (`theme.ts`), guida di stile
- ✅ Linea di vista ed esplorazione: rivelazione in tempo reale degli elementi, caselle esplorate
- ✅ Glifi: accensione, viaggio fra glifi scoperti, onda di accensione
- ✅ Scrigni (rame, argento, oro) con contenuti definiti dall'avventura
- ✅ Oggetti a terra: pozioni, denaro, chiavi, chiavi runiche (SVG in `public/tokens/`)
- ✅ Scale: coppie collegate, vista condivisa fra i due capi, filo tratteggiato
- ✅ Mappe di prova in `public/maps/` (porte, ostacoli, scale, ...)

### Fase 3 — Ciclo del round e stato unico ✅
Regole in [docs/REGOLE.md](docs/REGOLE.md), che è la fonte vincolante.
- ✅ Stato di gioco unico e serializzabile (`GameState` in `src/app/game/state/`: pedine, porte, segnalini, esplorazione, gruppo, round)
- ✅ Azioni come funzioni sullo stato (`src/app/game/state/actions.ts`): porte, scrigni, passi, raggiungibilità, esplorazione, nuovo round, scelta dell'eroe
- ✅ Fase del round e scorte dell'eroe (punti movimento e attacchi, Correre e Combattere, Passa), con tre pulsanti provvisori
- ✅ Ciclo del round: turno degli eroi (ordine libero), turno dell'Overlord (script), nuovo round
- ✅ Conquista nello stato (glifi +3, scrigni +2/+4, a 0 gli eroi perdono; per ora solo nella riga di stato)

### Fase 4 — Schema UI della vista Giocatore ✅
- ✅ Pillole in alto (Conquista, Round), componente cuore a quarti, icone SVG (`src/app/ui/`)
- ✅ Barra in basso a sinistra con i tab degli eroi (l'attivo si espande), pallino desaturato per chi ha agito; comandi dell'eroe a schermo (pallini Correre, Combattere, Riposo in basso a destra e bottone Passa in fondo ai tab) e da tastiera (R, C, S, Invio)
- ✅ Blocco del Signore supremo in alto a destra (ritratto, Mazzo, carte in mano, Minaccia nella vista Overlord)
- ✅ Notifiche in alto al centro che scendono dall'alto, con ritratto di chi parla, icona e testo
- ✅ Bottone "!" sopra la pedina e pallini delle azioni contestuali (porte, scrigni, scale), con costo e motivo; tolto il clic sulle porte e sugli scrigni
- ✅ Scheda con le informazioni dell'eroe (tasto "i" nel tab) e pannello dell'inventario separato (tasto con la cassa): dadi, pozioni, mani libere, oggetti come card complete
- ✅ Indicatore del nord (la mappa non ruota, il nord è sempre in alto) in cima alla colonna dei comandi della camera, sul lato destro a metà altezza (mostra tutta la mappa, centra sull'eroe, + e −)
- ✅ Legenda della mappa (pallino "?" in alto): un disegno e una spiegazione per ogni elemento che si vede in mappa
- ✅ Pozioni: ogni eroe porta fino a 3 pozioni (parte con una curativa), raccolte a 0 punti, le beve (curativa +4 ferite) o le dà a un eroe adiacente (1 punto, azioni contestuali)
- ✅ Equipaggiamento: catalogo oggetti (`public/items/`, la Spada), mani/armatura/oggetti vari equipaggiati e zaino da 3, ri-equipaggiarsi a 2 punti, scartare a 0, dare a 1; denaro personale (300 meno gli acquisti iniziali); tesori degli scrigni da 3 mazzi (disattivabili con `random: false`)
- ✅ La città: viaggio dai glifi (tutto il movimento), pedina fuori dalla mappa, un servizio per visita (Negozio con pozioni, tesori, oggetti e vendita; Tempio; Campo di addestramento), ritorno su un glifo (gratis dallo stesso, 25 monete da un altro)
- ✅ Carte tesoro (tre mazzi), abilità secondarie pescate a inizio partita e campo di addestramento (nuove abilità, dadi d'attacco)
- ✅ Catalogo esplorabile dei componenti (menu del logo → Componenti): oggetti del negozio, tesori per mazzo, reliquie e abilità, con ricerca e categorie
- 💤 Prove d20 al posto dei "riesce sempre" (in pausa: le caratteristiche sono della 2ª edizione, fuori dalle schede)

### Fase 5 — Combattimento 🔜
- ✅ Schede degli eroi (archetipi pronti, `public/heroes/`): ferite, fatica, armatura, velocità, valore, abilità iniziali, dadi dei tre attacchi
- ✅ Catalogo dei mostri (tutti e dodici i tipi, normale e potenziato) e scheda per l'Overlord; armi degli eroi nel catalogo oggetti
- ✅ Dadi d'attacco 3D (base ed extra, gittata, cuori, onde, mancato) e armatura fissa; per ora il tiro è nel browser (il risultato dovrà deciderlo l'host)
- ✅ Attacco in mischia, a distanza e magico con linea di vista, menu delle armi e finestra dell'attacco; ⬜ attacchi attraverso le scale, effetti delle abilità (Esplosione, stordimento...)
- ✅ Morte dell'eroe: perdita di Conquista, città e rientro senza pagare, dissolvenza in rosso (per caduta in una buca o per le ferite)
- ✅ Fatica (movimento, dado potere in più, Riposo, pozione di vitalità) e stati (fiamma, rete, stordimento, veleno, Aura, Paura, Presa, Immortale, Contraccolpo); abilità da usare con costo
- ✅ Parole chiave dei mostri: Volo, Raggiungimento, Colpo veloce, Spazzata, Esplosione, Soffio, Stregoneria, Comando; ⬜ abilità Telecinesi, Vigilanza e Acrobata
- ✅ Bottino dei nemici: fatte le 50 monete per il colpo fatale a un mostro potenziato; il `drop` di un oggetto, una chiave o altro per i nemici speciali, scritto nell'avventura

### Fase 6 — Overlord scriptato 🔜
- 🟡 Interfaccia di azioni unica (script e umano usano le stesse): le regole sono funzioni sullo stato; manca il livello comune per l'Overlord umano
- ✅ Minaccia (1 per eroe a round) come budget, mazzo di 36 carte con mano, evocazione dei mostri fuori vista, trappole armate, eventi, carte Potere, Rospo, aree che si svegliano alla rivelazione
- ✅ Mostri che si avvicinano all'eroe più vicino e attaccano il più ferito, con un po' di caso (i mostri grandi per ora non si muovono)

### Fase 7 — Prima avventura giocabile 🔜
- 🟡 Avventura completa: zona iniziale con glifo, mostri, porte, oggetti, boss (bozza in `public/maps/avventura.json`, con `?mappa=avventura`: quattro stanze, porta runica, boss con la Spada di luce)
- ✅ Inizio della partita: dialog di introduzione e obiettivo (da confermare), tasto Obiettivo sempre disponibile, scelta delle caselle di partenza (se due eroi scelgono la stessa, uno viene spostato lì accanto)
- ✅ Condizioni di vittoria (sconfiggere il boss) e di sconfitta (Conquista a zero), con la schermata finale
- ✅ Catalogo completo dei tile in `public/tiles/` (10 tile) e punti morti su ogni attacco libero nelle mappe di gioco (la validazione dei pezzi mancanti sarà nell'editor)
- 🟡 Dettagli scenici generati dal seed: fatti ragnatele negli angoli, sassi intorno alle rocce e teschi; ossa (spente, da ridisegnare), rametti e macchie da rivedere una alla volta
- 💤 Torce: pronte nel codice (campo `torches` nella mappa, fuoco animato e alone caldo), ma nessuna avventura le usa; saranno un elemento cosmetico dell'editor
- ⬜ Luce e ombra come ultimo livello di disegno
- 💤 Atlas delle texture per gli SVG: le icone si caricano già una volta sola; l'unico foglio si farà solo se la mappa diventa pesante

### Fase 8 — Multigiocatore ⬜
- ⬜ Host con stato autoritativo; gli altri inviano intenzioni, l'host valida e risponde
- ⬜ PeerJS per puntatori, pedine in movimento, anteprime del percorso, animazioni
- ⬜ Contenuto delle stanze non scoperte solo sull'host, inviato quando si rivela
- ⬜ Overlord affidabile a un giocatore umano

### Fase 9 — Persistenza ⬜
- ⬜ Servizio di persistenza dietro un'interfaccia (in memoria o su file)
- ⬜ Collegamento a Firestore: avventure, mappe, eroi, salvataggi (poche scritture per turno)
- ⬜ Checkpoint di salvataggio e risultato dei turni

### Fase 10 — Produzione ⬜
- ⬜ PeerServer proprio e server TURN
- ⬜ Firebase Auth e Hosting
- ⬜ Rifinitura, prestazioni, test su dispositivi touch

### Idee e fuori scope per ora 💤
- 💤 Famigli, comandi (mira, schivata, guardia), scrigni con serratura
- 💤 Movimento speciale dei mostri grandi (oggi stanno fermi e attaccano se un eroe è alla portata)
- 💤 Vista Editor completa (oggi ne esiste l'embrione: strumenti P, D, O), vista Overlord umana, route e lobby
- 💤 Acquisti, cosmetici, achievement
- 💤 Pannello eroi laterale a pillola
- 💤 Effetto onda sullo sfondo (idea, forse non verrà adottata)

## Provarla online (GitHub Pages)
Ogni push su `dev` pubblica l'app su GitHub Pages con il workflow `.github/workflows/pages.yml`. Una volta sola: nel repository, **Settings → Pages → Source: GitHub Actions**.
L'indirizzo è `https://<utente>.github.io/cadungeon/`; con `?mappa=scale` si apre l'altra mappa di prova con `?mappa=combattimento` quella per provare combattimento e linea di vista e con `?mappa=avventura` la bozza della prima avventura.

## Ultima cosa da fare
- 💤 **Inventare nomi originali per tutto**: eroi, mostri, oggetti, tesori, abilità, stati, ambientazioni e avventure oggi usano nomi (e testi) ispirati al regolamento di riferimento. Prima di pubblicare vanno tutti sostituiti con nomi nostri, nel mondo di Duels (vedi la regola di originalità all'inizio di CLAUDE.md). Conviene farlo a fine progetto, quando i contenuti sono stabili.
