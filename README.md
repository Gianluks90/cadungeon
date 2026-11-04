# CADungeon (nome in codice)

Gioco da tavolo digitale per browser, ispirato ai dungeon crawler a squadra contro un Maligno,
ambientato nel mondo di Duels. Stile visivo da disegno tecnico (mappa CAD): linee sottili, toni di
grigio, pochi elementi colorati.

Stack: Angular (standalone + signals), PixiJS, PeerJS, Firebase (solo Firestore, più avanti).
Le regole complete e le decisioni di stile stanno in [CLAUDE.md](CLAUDE.md); i valori reali dello
stile in [docs/style-guide.md](docs/style-guide.md).

## Per cominciare
- `npm install`, poi `npm start` (server di sviluppo) o `npm run build` (la cartella `dist/` contiene solo ciò che sta in `public/` più il codice).
- `npm run i18n:check`: controlla che ogni testo dell'interfaccia abbia la sua riga in `it.json` e in `en.json` (da lanciare dopo ogni modifica ai testi).
- Dove stanno le cose: `src/app/game/` (scena di gioco e regole, stato in `state/`), `src/app/editor/` (l'editor delle avventure), `src/app/ui/` (componenti dell'interfaccia), `src/app/i18n/` (lingue), `public/` (i dati: mappe, eroi, mostri, oggetti, tile, immagini), `docs/` (regole e schede dei contenuti).
- Il materiale di riferimento (PDF, immagini di altri giochi) sta solo sul computer, in `docs/riferimenti/`: è ignorato da git (come ogni `*.pdf`) e non va mai nel repository né nella build.

## Roadmap

Legenda: ✅ fatto · 🟡 in parte · 🔜 prossimo · ⬜ da fare · 💤 fuori scope per ora

### Fase 1 — Fondamenta ✅
- ✅ Scheletro Angular con PixiJS, sfondo di puntini, zoom e pan (rotella, pinch, tasti + e -)
- ✅ Tile di prova in stile blueprint: muri a doppia linea, varchi con stipiti, pavimento a griglia, fratture
- ✅ Aggancio dei tile sulle aperture compatibili (rotazione a scatti di 90°)
- ✅ Pedina con punti movimento, passo per passo, che si ferma davanti ai muri

### Fase 2 — Mappa e mondo di gioco ✅
- ✅ Porte da muro a muro, apribili e chiudibili, con animazione dell'anta
- ✅ Porte con serratura: chiavi, scasso, chiavi runiche (rossa, blu, verde) e porte evento (si aprono solo con un evento)
- ✅ Pedine multiple, eroe attivo selezionabile, regole di passaggio fra amici
- ✅ Ostacoli naturali: roccia, buca (caduta, uscita, salto), acqua animata; muri d'autore (segmenti cosmetici che bloccano movimento e vista)
- ✅ Stile minimale e token di stile per ruolo (`theme.ts`), guida di stile
- ✅ Linea di vista ed esplorazione: rivelazione in tempo reale degli elementi, caselle esplorate
- ✅ Glifi: accensione, viaggio fra glifi scoperti, onda di accensione; **glifi gemelli** (si accendono, si bloccano e si spengono sempre insieme, riconoscibili dai cerchietti pieni)
- ✅ Scrigni (rame, argento, oro) con la tabella dei ritrovamenti dell'avventura
- ✅ Oggetti a terra: pozioni, denaro, chiavi, chiavi runiche, oggetti del catalogo (SVG in `public/tokens/`)
- ✅ Scale: coppie collegate, vista condivisa fra i due capi, filo tratteggiato (anche con il percorso scelto dall'autore)
- ✅ Segnalino Incontro: un punto della mappa con un'azione scelta dall'autore; può bloccare movimento e vista, usarsi dalle caselle adiacenti ed essere riutilizzabile
- ✅ Mappe in `public/maps/`: le avventure fatte con l'editor, più `catalog` (tutti i tile) e `test` (mappa di prova)

### Fase 3 — Ciclo del round e stato unico ✅
Regole in [docs/REGOLE.md](docs/REGOLE.md), che è la fonte vincolante.
- ✅ Stato di gioco unico e serializzabile (`GameState` in `src/app/game/state/`: pedine, porte, segnalini, esplorazione, gruppo, round, eventi)
- ✅ Azioni come funzioni sullo stato (`src/app/game/state/actions.ts`): porte, scrigni, passi, raggiungibilità, esplorazione, nuovo round, scelta dell'eroe
- ✅ Fase del round e scorte dell'eroe (punti movimento e attacchi, Correre e Combattere, Passa)
- ✅ Ciclo del round: turno degli eroi (ordine libero), turno del Maligno (script), nuovo round
- ✅ Conquista nello stato (glifi +3, scrigni +2/+4, a 0 gli eroi perdono; contatore sul bordo sinistro)

### Fase 4 — Schema UI della vista Giocatore ✅
- ✅ Contatori ancorati al bordo sinistro (Conquista, Round, Chiavi), componente cuore a quarti, icone SVG (`src/app/ui/`)
- ✅ Barra in basso al centro con i tab degli eroi (l'attivo si espande), ritratto desaturato per chi ha agito; comandi dell'eroe a schermo (pallini Correre, Combattere, Prepararsi sopra i tab e tab Passa in fondo) e da tastiera (R, C, E, Invio; S scheda, I inventario, F centra, Z tutta la mappa)
- ✅ Blocco del Maligno in alto al centro (ritratto, Odio, Mazzo, carte in mano, tasto Obiettivo; un tocco accende la vista del Maligno)
- ✅ Notifiche in alto a destra che entrano dall'alto, con ritratto di chi parla, icona e testo
- ✅ Bottone "!" sopra la pedina e pallini delle azioni contestuali (porte, scrigni, scale, Incontri, interazioni), con costo e motivo
- ✅ Scheda con le informazioni dell'eroe (tasto "i" nel tab) e pannello dell'inventario separato (tasto con la cassa): dadi, pozioni, mani libere, oggetti come card complete
- ✅ Indicatore del nord (la mappa non ruota, il nord è sempre in alto) in cima alla colonna dei comandi della camera, sul lato destro a metà altezza (mostra tutta la mappa, centra sull'eroe, + e −)
- ✅ Pozioni: ogni eroe porta fino a 3 pozioni (le compra nel negozio di prima della partita), le raccoglie con l'azione "Raccogli", le beve (curativa +4 ferite) o le dà a un eroe adiacente
- ✅ Equipaggiamento: catalogo oggetti (`public/items/`), mani/armatura/oggetti vari equipaggiati e zaino da 3, ri-equipaggiarsi a 2 punti, scartare a 0, dare a 1; denaro personale (300 monete meno gli acquisti iniziali); tesori degli scrigni da 3 mazzi
- ✅ La città: viaggio dai glifi (tutto il movimento), pedina fuori dalla mappa, un servizio per visita (Negozio, Tempio, Campo di addestramento), ritorno su un glifo (gratis dallo stesso, 25 monete da un altro)
- ✅ Carte tesoro (tre mazzi), abilità secondarie (tre rami: Combattimento, Astuzia, Magia) assegnate prima di partire e campo di addestramento (nuove abilità, dadi d'attacco)
- ✅ Catalogo esplorabile dei componenti (menu del logo → Componenti): eroi, mostri, famigli, oggetti, tesori per mazzo, reliquie e abilità, con ricerca e categorie
- 💤 Prove d20 al posto dei "riesce sempre" (in pausa: le caratteristiche sono della 2ª edizione, fuori dalle schede)

### Fase 5 — Combattimento ✅
- ✅ Schede degli eroi (`public/heroes/`, dieci eroi): ferite, energia, armatura, velocità, valore, abilità primaria, dadi dei tre attacchi
- ✅ Catalogo dei mostri (14 tipi, normale e potenziato) e scheda per il Maligno; armi degli eroi nel catalogo oggetti
- ✅ Dadi d'attacco 3D (base ed extra, gittata, cuori, scintille, mancato) e armatura fissa; per ora il tiro è nel browser (il risultato dovrà deciderlo l'host)
- ✅ Attacco in mischia, a distanza e magico con linea di vista, menu delle armi e finestra dell'attacco; attacchi attraverso le scale; ordini di Prepararsi (Mira, Schivata, Riposo, Guardia)
- ✅ Oggetti e abilità: cure, scudi, mantelli, ripetere i dadi, Telecinesi, Vigilanza, Acrobata; **famigli** (Francor, Nero, Ying e Yang, Zanna: non sono pedine, si muovono dopo il turno dell'eroe)
- ✅ Morte dell'eroe: perdita di Conquista, città e rientro senza pagare, dissolvenza in rosso (per caduta in una buca o per le ferite); morte permanente se l'avventura la accende
- ✅ Energia (movimento, dado competenza in più, Riposo, pozione dell'Energia) e stati (fiamma, rete, stordimento, veleno, Aura, Paura, Presa, Immortale, Contraccolpo); abilità da usare con costo
- ✅ Parole chiave dei mostri: Volo, Raggiungimento, Colpo veloce, Spazzata, Esplosione, Soffio, Stregoneria, Comando (i livelli uguali si sommano)
- ✅ Bottino dei nemici: 50 monete per il colpo fatale a un mostro potenziato; il `drop` di un oggetto, una chiave o altro per i nemici speciali, scritto nell'avventura
- ✅ Nemici **feribili solo con un'arma** (`onlyHurtBy`), invincibili o immuni, da Personalizza

### Fase 6 — Maligno scriptato 🟡
- 🟡 Interfaccia di azioni unica (script e umano usano le stesse): le regole sono funzioni sullo stato; la vista del Maligno (`/evil/<mappa>`) lo fa giocare a mano, in locale; manca il livello comune per il multigiocatore
- ✅ Odio (1 per eroe a round) come budget, mazzo di 36 carte con mano, evocazione dei mostri fuori vista, trappole armate, eventi, carte Potere, Rospo, aree che si svegliano alla rivelazione
- ✅ **Comportamenti dei nemici** (vincoli su dove si fermano, per lo script e per il Maligno umano): "Resta fermo", "Termina il turno accanto a…" e "Raccoglie gli oggetti trasportabili", da Personalizza, dall'effetto "Cambia il comportamento" e dal pannello dei comportamenti globali. Altri comportamenti speciali si aggiungono a `pawn-behavior.ts` e a `monsterMayStop` in `src/app/game/state/evil.ts`
- ✅ Mostri che si avvicinano all'eroe più vicino e attaccano il più ferito, con un po' di caso (anche i mostri grandi, con la loro sagoma: i 2×2 come personaggi normali, la Salamandra piegandosi e ruotando; il Drago girando di 90°)

### Fase 7 — Avventure giocabili ✅
- ✅ **Sei avventure** fatte con l'editor, nella scelta dell'avventura: Nelle Tenebre, I fratelli Durnog, Questioni di vita e di morte, Un drago arrogante, Gli ultimi voleri e Il guardiano eterno (in `public/maps/`; gli altri tre posti arriveranno)
- ✅ Inizio della partita: dialog di introduzione e obiettivo (da confermare), regole speciali, tasto Obiettivo sempre disponibile, scelta delle caselle di partenza (se due eroi scelgono la stessa, uno viene spostato lì accanto); le aree viste fin dal piazzamento si presentano come le altre
- ✅ Condizioni di vittoria (sconfiggere il boss, o un evento) e di sconfitta (Conquista a zero), con la schermata finale e i finali alternativi
- ✅ Eventi dell'avventura ("quando succede X, se vale Y, fai Z"): nemico sconfitto, baule aperto, area rivelata, interazione con un nemico ("?"), gruppo di nemici svuotato, oggetto raccolto, segnalino Incontro usato o tutti usati, inizio e fine del turno del Maligno (anche solo in un round); con più inneschi ("oppure"), condizioni su variabili e oggetti e "una sola volta"; effetti: messaggi, Conquista, variabili, modifiche e ritorno in vita dei nemici, nemici inattivi o che entrano più tardi, invincibili che tornano vulnerabili, immunità, aspetto e comportamento, porte evento, ostacoli che spariscono, glifi e scale cambiati di stato, premi, prove con i dadi competenza, vittoria (docs/REGOLE.md, sezione 2e)
- ✅ **Oggetti trasportati e PNG** (avventura 4, la Principessa): oggetto trasportato per gli eroi e per i mostri (penalità di movimento, Posa, cade a terra), aspetto dei gettoni (immagine o icona e titolo) per Incontro e oggetti a terra, carta accanto alle regole speciali; 💤 PNG con scheda propria (una squadra nuova)
- ✅ **Avventura 6 (Il Guardiano Eterno)**: il Costrutto che compare a fine round, un nemico che si ferisce solo con la Spada di luce, il segnalino Incontro con le sue opzioni, l'acqua che defluisce e le coppie di glifi gemelli
- ✅ Catalogo completo dei tile in `public/tiles/` (11 tile, con la stanza enorme 8×8 a otto uscite) e punti morti su ogni attacco libero
- 🟡 Dettagli scenici generati dal seed: fatti ragnatele negli angoli, sassi intorno alle rocce; ossa e teschi (spenti, da ridisegnare), rametti e macchie da rivedere una alla volta
- 💤 Torce: pronte nel codice (campo `torches` nella mappa, fuoco animato e alone caldo), ma nessuna avventura le usa; saranno un elemento cosmetico dell'editor
- 💤 Atlas delle texture per gli SVG: le icone si caricano già una volta sola; l'unico foglio si farà solo se la mappa diventa pesante

### Fase 8 — Struttura dell'app 🟡
Le pagine di oggi: la home (logo, "Giocatore singolo", "Multiplayer", "Continua", "Editor"; schermo intero, lingua; profilo, impostazioni e audio sono tasti che non fanno ancora nulla), la scelta dell'avventura (`/adventures`), la scelta degli eroi e l'equipaggiamento (`/party/<mappa>`), la sala d'attesa (`/lobby/<codice>`), il gioco (`/play/<mappa>`), la vista del Maligno (`/evil/<mappa>`) e l'editor (`/editor`).
- ✅ **Routing** (Angular Router, pagine caricate al bisogno)
- 🟡 **Multilingua** (italiano ed English): servizio e pipe `t` in `src/app/i18n/`, testi in `it.json` e `en.json` (una chiave in meno in una lingua non compila), scelta della lingua dal tasto della home. Tradotta tutta l'interfaccia e i cataloghi; `npm run i18n:check` controlla che ogni testo abbia la riga in tutte e due le lingue. I testi delle avventure non si traducono per ora.
- ✅ **Home page**: sfondo a puntini che si illuminano al passaggio, logo con il titolo in cerchio, quattro tasti
- ✅ **Scelta dell'avventura**: nove schede (otto avventure) con titolo, bandierina dell'obiettivo e segno di completamento, sotto un'intestazione come quella delle pagine dopo
- ✅ **Grafica** (home, Impostazioni): modalità Leggera, Normale e Massima e voci singole (nitidezza, bordi smussati, retinatura dei muri, dettagli del pavimento, animazioni), salvate nel browser, per alleggerire i computer con poca memoria
- ✅ **Preparazione della partita**: scelta di 2-4 eroi, equipaggiamento con il negozio di prima della partita (300 monete a testa), abilità secondarie assegnate; il Maligno è sempre automatico (quello umano sta nella vista `/evil`); poi la preparazione di inizio partita (introduzione, obiettivo, caselle di partenza)
- 🟡 **Lobby**: la sala d'attesa è fatta (crea una partita con un codice o entra con un codice, scelta degli eroi e dell'equipaggiamento, "Pronto"; PeerJS, server pubblico); il gioco in rete non c'è ancora (fase 10)
- 🟡 **Menu e impostazioni**: "Concludi partita" e "Componenti" funzionano; le impostazioni (volume, animazioni ridotte, come mostrare i punti ferita: **Cuori** come oggi o **Valore numerico**) non ci sono ancora
- 🟡 **Fine partita**: la schermata di vittoria o sconfitta c'è, con "Ricomincia" e "Guarda la mappa"; manca il ritorno alla home dalla schermata
- 🟡 **Salvare e riprendere** una partita: fatti in locale (tasto Salva, salvataggio automatico a fine turno, "Continua" della home, `SaveStore` su localStorage); su Firestore con la fase 11

### Fase 9 — Editor delle avventure 🟡
L'editor è la pagina /editor (tasto Editor della home): una scena Pixi con la camera della mappa, la cassetta degli attrezzi in basso e le dialog dell'avventura sul lato sinistro. Lavora sul formato di sempre (MapData) e salva la bozza nel browser; i file delle avventure si esportano e importano come JSON.
- ✅ **Mappa**: tessere agganciate come un puzzle (rotazione, auto-rotazione, piazzamento libero con Maiusc), elimina, punti morti, annulla e rifai
- ✅ **Aree**: si scelgono pezzo per pezzo, con area di partenza, sottotitolo, descrizione letta alla rivelazione ed etichetta spostabile
- ✅ **Elementi**: porte (con serratura e porta evento), ostacoli e muri, glifi (anche gemelli) e caselle di partenza, scale (coppie, con percorso del filo), bauli con la tabella dei ritrovamenti (una griglia 2×2 con tutti i premi), oggetti a terra, segnalino Incontro (con le sue opzioni); ⬜ torce e altri dettagli scenici
- ✅ **Nemici**: dal catalogo (normali, potenziati), con Personalizza (nome unico, modificatori, abilità con livello, bottino, inattivo o che entra più tardi, aspetto, feribile solo con un'arma, invincibile, comportamento, immunità); ⬜ Mimic travestiti da scrigno
- ✅ **Eventi**: lo strumento Eventi, con le variabili, gli inneschi, le condizioni, gli effetti e le prove annidate
- ✅ **Testi e regole dell'avventura**: titolo, introduzione, obiettivi, regole speciali, Conquista iniziale, condizione di vittoria (nemico sconfitto o evento), conclusione e comportamenti globali dei mostri; ⬜ più obiettivi
- ✅ **Zone di innesco** (nella cassetta degli Eventi): gruppi di caselle di qualunque forma che gli eventi usano come innesco ("un eroe usa una zona", "entra in una zona", anche a ogni passo), che si attivano e disattivano con un effetto; **buche** personalizzabili (normale, invalicabile, letale)
- ✅ **Oggetti speciali** (avventura 7, La Spada Nera): oggetti che crescono con i livelli, maledetti (non si tolgono, si cedono e si autoequipaggiano) e con la maledizione di fine turno; "un eroe a scelta riceve un oggetto"
- ✅ **Oggetti personalizzati dall'editor** (cassetta Oggetti e tesori): per ogni avventura si cambia un oggetto del catalogo (livelli con dadi e scintille, maledetto, maledizione di fine turno) senza toccare il catalogo; negli eventi compare con l'icona genetics
- ✅ **Seleziona in mappa**: le scelte di nemici, segnalini, glifi, scale, ostacoli, aree e porte nelle dialog si possono fare con un clic sulla mappa, e "Mostrami dov'è" porta la camera sull'elemento
- ✅ **Verifica**: errori, avvisi e controlli non ancora disponibili (informazioni mancanti, uscite aperte, aree e tessere senza area, scale e glifi gemelli spaiati, porte e chiavi, bauli senza ricompensa, eventi con riferimenti rotti, Incontri senza evento); ⬜ avventure impossibili da finire
- 🟡 **Salvare, aprire e provare**: fatti salva nel browser, esporta e importa JSON, nuova avventura; ⬜ "prova subito" dall'editor e la persistenza su Firestore (fase 11)

### Fase 10 — Multigiocatore ⬜
La sala d'attesa è già della fase 8; qui c'è il gioco in rete.
- ⬜ Host con stato autoritativo; gli altri inviano intenzioni, l'host valida e risponde
- ⬜ PeerJS per puntatori, pedine in movimento, anteprime del percorso, animazioni
- ⬜ Contenuto delle stanze non scoperte solo sull'host, inviato quando si rivela
- ⬜ Maligno affidabile a un giocatore umano

### Fase 11 — Persistenza 🟡
- ✅ Servizio di persistenza dietro un'interfaccia: oggi su localStorage (`SaveStore`, `DraftStore`, `LobbyStore`)
- ⬜ Collegamento a Firestore: avventure, mappe, eroi, salvataggi (poche scritture per turno)
- ⬜ Checkpoint di salvataggio e risultato dei turni

### Fase 12 — Produzione ⬜
- ⬜ **Repository nuovo e pulito** (con il nome definitivo) prima di creare il progetto Firebase, così non si porta dietro il materiale di riferimento della storia attuale
- ⬜ PeerServer proprio e server TURN
- ⬜ Firebase Auth e Hosting
- ⬜ Rifinitura, prestazioni, test su dispositivi touch

### Idee e fuori scope per ora 💤
- 💤 **Fusione di stanze**: una funzione dell'editor per unire due o più stanze (tessere affiancate) in un ambiente solo, togliendo i muri e gli spezzoni di muro che le separano, per creare ambienti con forme fuori dall'ordinario. Coi pezzi di oggi non è molto vantaggiosa (per le stanze grandi conviene un tile dedicato, come la 8×8), ma potrebbe servire in futuro. Da decidere: quali muri vanno via (tutti quelli fra le tessere scelte?), come cambiano uscite e punti morti, come si ripartiscono le aree
- 💤 Scrigni con serratura
- 💤 Vista del Maligno umana in rete (la parte locale c'è già, `/evil/<mappa>`)
- 💤 Acquisti, cosmetici, achievement
- 💤 Pannello eroi laterale a pillola
- 💤 Effetto onda sullo sfondo (idea, forse non verrà adottata)

## Provarla online (GitHub Pages)
Ogni push su `dev` pubblica l'app su GitHub Pages con il workflow `.github/workflows/pages.yml`. Una volta sola: nel repository, **Settings → Pages → Source: GitHub Actions**.
L'indirizzo è `https://<utente>.github.io/cadungeon/`: dalla home si va su "Giocatore singolo" per scegliere l'avventura, oppure si scrive l'indirizzo diretto: `/play/<mappa>` per un'avventura di `public/maps/` (per esempio `/play/nelle-tenebre`), `/play/catalog` (tutti i tile del catalogo) e `/play/test` (la mappa di prova).

## Ultima cosa da fare
- 💤 **Inventare nomi originali per tutto**: eroi, mostri, oggetti, tesori, abilità, stati, ambientazioni e avventure oggi usano nomi (e testi) ispirati al regolamento di riferimento. Prima di pubblicare vanno tutti sostituiti con nomi nostri, nel mondo di Duels (vedi la regola di originalità all'inizio di CLAUDE.md). Conviene farlo a fine progetto, quando i contenuti sono stabili.
