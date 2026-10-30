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
- ✅ Barra in basso al centro con i tab degli eroi (l'attivo si espande), ritratto desaturato per chi ha agito; comandi dell'eroe a schermo (pallini Correre, Combattere, Prepararsi, Riposo sopra i tab e tab Passa in fondo) e da tastiera (R, C, E, Q, Invio)
- ✅ Blocco del Signore supremo in alto al centro (ritratto, Minaccia, Mazzo, carte in mano, tasto Obiettivo; un tocco accende la vista Overlord)
- ✅ Notifiche in alto a destra che entrano dall'alto, con ritratto di chi parla, icona e testo
- ✅ Bottone "!" sopra la pedina e pallini delle azioni contestuali (porte, scrigni, scale), con costo e motivo; tolto il clic sulle porte e sugli scrigni
- ✅ Scheda con le informazioni dell'eroe (tasto "i" nel tab) e pannello dell'inventario separato (tasto con la cassa): dadi, pozioni, mani libere, oggetti come card complete
- ✅ Indicatore del nord (la mappa non ruota, il nord è sempre in alto) in cima alla colonna dei comandi della camera, sul lato destro a metà altezza (mostra tutta la mappa, centra sull'eroe, + e −)
- ✅ ~~Legenda della mappa~~: provata e poi tolta (il pallino "?" dei comandi della camera non c'è più)
- ✅ Pozioni: ogni eroe porta fino a 3 pozioni (parte con una curativa), le raccoglie con l'azione "Raccogli" (0 punti: passandoci sopra non basta; vale per tutti gli oggetti a terra), le beve (curativa +4 ferite) o le dà a un eroe adiacente (1 punto, azioni contestuali)
- ✅ Equipaggiamento: catalogo oggetti (`public/items/`, la Spada), mani/armatura/oggetti vari equipaggiati e zaino da 3, ri-equipaggiarsi a 2 punti, scartare a 0, dare a 1; denaro personale (300 meno gli acquisti iniziali); tesori degli scrigni da 3 mazzi (disattivabili con `random: false`)
- ✅ La città: viaggio dai glifi (tutto il movimento), pedina fuori dalla mappa, un servizio per visita (Negozio con pozioni, tesori, oggetti e vendita; Tempio; Campo di addestramento), ritorno su un glifo (gratis dallo stesso, 25 monete da un altro)
- ✅ Carte tesoro (tre mazzi), abilità secondarie pescate a inizio partita e campo di addestramento (nuove abilità, dadi d'attacco)
- ✅ Catalogo esplorabile dei componenti (menu del logo → Componenti): oggetti del negozio, tesori per mazzo, reliquie e abilità, con ricerca e categorie
- 💤 Prove d20 al posto dei "riesce sempre" (in pausa: le caratteristiche sono della 2ª edizione, fuori dalle schede)

### Fase 5 — Combattimento ✅
- ✅ Schede degli eroi (archetipi pronti, `public/heroes/`): ferite, fatica, armatura, velocità, valore, abilità iniziali, dadi dei tre attacchi
- ✅ Catalogo dei mostri (tutti e dodici i tipi, normale e potenziato) e scheda per l'Overlord; armi degli eroi nel catalogo oggetti
- ✅ Dadi d'attacco 3D (base ed extra, gittata, cuori, onde, mancato) e armatura fissa; per ora il tiro è nel browser (il risultato dovrà deciderlo l'host)
- ✅ Attacco in mischia, a distanza e magico con linea di vista, menu delle armi e finestra dell'attacco; ✅ attacchi attraverso le scale; ✅ ordini di Prepararsi (Mira, Schivata, Guardia); 🟡 oggetti e abilità rimasti: fatti cure, scudi, mantelli e ripetere i dadi; restano i famigli, in [docs/cards/abilities.md](docs/cards/abilities.md), sezione 8
- ✅ Morte dell'eroe: perdita di Conquista, città e rientro senza pagare, dissolvenza in rosso (per caduta in una buca o per le ferite)
- ✅ Fatica (movimento, dado potere in più, Riposo, pozione del vigore) e stati (fiamma, rete, stordimento, veleno, Aura, Paura, Presa, Immortale, Contraccolpo); abilità da usare con costo
- ✅ Parole chiave dei mostri: Volo, Raggiungimento, Colpo veloce, Spazzata, Esplosione, Soffio, Stregoneria, Comando; ✅ abilità Telecinesi, Vigilanza e Acrobata
- ✅ Bottino dei nemici: fatte le 50 monete per il colpo fatale a un mostro potenziato; il `drop` di un oggetto, una chiave o altro per i nemici speciali, scritto nell'avventura

### Fase 6 — Overlord scriptato 🟡
- 🟡 Interfaccia di azioni unica (script e umano usano le stesse): le regole sono funzioni sullo stato; manca il livello comune per l'Overlord umano
- ✅ Minaccia (1 per eroe a round) come budget, mazzo di 36 carte con mano, evocazione dei mostri fuori vista, trappole armate, eventi, carte Potere, Rospo, aree che si svegliano alla rivelazione
- ✅ **Comportamenti dei nemici** (vincoli su dove si fermano, per lo script e per il Signore supremo umano): "Resta fermo" e "Termina il turno accanto a…" (Kisst-Haa e l'albero), da Personalizza e dall'effetto "Cambia il comportamento". Altri comportamenti speciali si aggiungono a `pawn-behavior.ts` e a `monsterMayStop` in `src/app/game/state/overlord.ts`
- ✅ Mostri che si avvicinano all'eroe più vicino e attaccano il più ferito, con un po' di caso (anche i mostri grandi, con la loro sagoma: i 2×2 come personaggi normali, la Salamandra piegandosi e ruotando; il Drago girando di 90°)

### Fase 7 — Prima avventura giocabile 🟡
- 🟡 Avventura completa: zona iniziale con glifo, mostri, porte, oggetti, boss (bozza in `public/maps/ogre-lair.json`, su `/play/ogre-lair`: quattro stanze, porta runica, boss con la Spada di luce; la prima avventura fatta con l'editor è `public/maps/nelle-tenebre.json`, `/play/nelle-tenebre`)
- ✅ Inizio della partita: dialog di introduzione e obiettivo (da confermare), tasto Obiettivo sempre disponibile, scelta delle caselle di partenza (se due eroi scelgono la stessa, uno viene spostato lì accanto)
- ✅ Condizioni di vittoria (sconfiggere il boss, o un evento) e di sconfitta (Conquista a zero), con la schermata finale
- ✅ Eventi dell'avventura ("quando succede X, se vale Y, fai Z"): nemico sconfitto, baule aperto, area rivelata, interazione con un nemico ("?"), gruppo di nemici svuotato, oggetto raccolto, segnalino Incontro usato o tutti usati; con più inneschi ("oppure") e "una sola volta"; effetti: messaggi, Conquista, variabili, modifiche e ritorno in vita dei nemici, nemici inattivi che si attivano, nemici invincibili che tornano vulnerabili, immunità da togliere, porte evento, prove con i dadi potere, vittoria (docs/REGOLE.md, sezione 2e)
- 🟡 **Oggetti trasportati e PNG** (avventura 4, la Principessa): fatti l'oggetto trasportato per gli eroi (penalità di movimento, niente viaggio da glifo, Posa, cade a terra se chi la porta muore) e l'effetto "Metti un oggetto a terra accanto alla partenza"; ✅ mostri che trasportano e comportamenti globali (pannello Comportamenti, per tipo di mostro, con "ignora" in Personalizza), ✅ condizione "dove sta l'oggetto" negli eventi e finali alternativi con "Aggiungi al finale" (testo e punti ±), ✅ "fine del turno del Signore supremo" con Minaccia e carte da pescare, ✅ testo "Regole speciali" dopo l'obiettivo, ✅ aspetto dei gettoni (immagine o icona e titolo) per Incontro e oggetti a terra, e oggetto del catalogo piazzabile con "Sposta un oggetto accanto alla partenza"; ✅ immagini della Principessa (gettone e carta accanto alle regole speciali); 💤 PNG con scheda propria (una squadra nuova)
- ✅ Catalogo completo dei tile in `public/tiles/` (11 tile, con la stanza enorme 8×8 a otto uscite) e punti morti su ogni attacco libero nelle mappe di gioco (la validazione dei pezzi mancanti sarà nell'editor)
- 🟡 Dettagli scenici generati dal seed: fatti ragnatele negli angoli, sassi intorno alle rocce e teschi; ossa (spente, da ridisegnare), rametti e macchie da rivedere una alla volta
- 💤 Torce: pronte nel codice (campo `torches` nella mappa, fuoco animato e alone caldo), ma nessuna avventura le usa; saranno un elemento cosmetico dell'editor;
- 💤 Atlas delle texture per gli SVG: le icone si caricano già una volta sola; l'unico foglio si farà solo se la mappa diventa pesante

### Fase 8 — Struttura dell'app 🔜
Oggi ci sono la home (logo, "Nuova partita" e "Continua" spenti, "Editor" che funziona; profilo, impostazioni e lingua sono tasti che non fanno ancora nulla), la pagina di gioco (`/play/<map>`) e l'editor (`/editor`). Per diventare un'app servono (decisioni da prendere insieme prima di scrivere codice, perché cambiano l'architettura):
- 🟡 **Routing** (Angular Router, pagine caricate al bisogno): fatti home, gioco (`/play/<map>`) ed editor (`/editor`); manca la vista Overlord (CLAUDE.md, "Viste")
- 🟡 **Multilingua** (italiano ed English): servizio e pipe `t` in `src/app/i18n/`, testi in `it.json` e `en.json` (una chiave in meno in una lingua non compila), scelta della lingua dal tasto della home. Tradotta tutta l'interfaccia (home, scelta dell'avventura, editor, partita) e i cataloghi; `npm run i18n:check` controlla che ogni testo abbia la riga in tutte e due le lingue. Le avventure non si traducono per ora.
- 🟡 **Home page**: fatta con lo sfondo a puntini, il logo e i tre tasti; mancano la scelta dell'avventura, le impostazioni e i crediti
- ⬜ **Scelta dell'avventura** (le mappe di `public/maps/` diventano un elenco con titolo, descrizione e numero di eroi)
- ⬜ **Preparazione della partita**: quanti giocatori (2-4 eroi), scelta degli eroi, chi è il Signore supremo (script o umano); poi la preparazione di inizio partita che c'è già (introduzione, obiettivo, caselle di partenza)
- ⬜ **Lobby**: crea una partita / entra con un codice (si appoggia al multigiocatore, fase 10; prima basta la parte locale)
- ⬜ **Menu e impostazioni**: oggi "Impostazioni" e "Concludi partita" sono segnaposto (volume, lingua, animazioni ridotte, tornare alla home)
- ⬜ **Fine partita**: dalla schermata di vittoria o sconfitta si torna alla home o si rigioca
- ⬜ **Salvare e riprendere** una partita (si lega alla persistenza, fase 11)

### Fase 9 — Editor delle avventure 🟡
L'editor è la pagina /editor (tasto Editor della home): una scena Pixi con la camera della mappa, la cassetta degli attrezzi in basso e le dialog dell'avventura sul lato sinistro. Lavora sul formato di sempre (MapData) e salva la bozza nel browser; i file delle avventure si esportano e importano come JSON.
- ✅ **Mappa**: tessere agganciate come un puzzle (rotazione, auto-rotazione, piazzamento libero con Maiusc), elimina, punti morti, annulla e rifai
- ✅ **Aree**: si scelgono pezzo per pezzo, con area di partenza, sottotitolo e descrizione letta alla rivelazione
- ✅ **Elementi**: porte (con serratura e porta evento), ostacoli e muri (segmenti sulla griglia da 1 e da 4 lati, cosmetici che bloccano movimento e vista, senza creare aree), glifi e caselle di partenza, scale (coppie, con percorso del filo), bauli con la tabella dei ritrovamenti, oggetti a terra, segnalino Incontro (cerchio con il "?", si usa fermandosi sulla casella; un incontro senza evento è un errore); ⬜ torce e altri dettagli scenici
- ✅ **Nemici**: dal catalogo (normali, potenziati), con Personalizza (nome unico, modificatori, abilità della carta da togliere con ripristino, bottino, inattivo, aspetto di pietra, invincibile, elenco delle immunità); ⬜ Mimic travestiti da scrigno
- ✅ **Testi e regole dell'avventura**: titolo, introduzione, obiettivi, Conquista iniziale, condizione di vittoria (nemico sconfitto o evento) e conclusione; ⬜ più obiettivi
- ✅ **Verifica**: errori, avvisi e controlli non ancora disponibili (informazioni mancanti, uscite aperte, aree e tessere senza area, scale spaiate, porte e chiavi, bauli senza ricompensa, eventi con riferimenti rotti); ⬜ avventure impossibili da finire
- 🟡 **Salvare, aprire e provare**: fatti salva nel browser, esporta e importa JSON, nuova avventura; ⬜ "prova subito" dall'editor e la persistenza su Firestore (fase 11)

### Fase 10 — Multigiocatore ⬜
- ⬜ Host con stato autoritativo; gli altri inviano intenzioni, l'host valida e risponde
- ⬜ PeerJS per puntatori, pedine in movimento, anteprime del percorso, animazioni
- ⬜ Contenuto delle stanze non scoperte solo sull'host, inviato quando si rivela
- ⬜ Overlord affidabile a un giocatore umano

### Fase 11 — Persistenza ⬜
- ⬜ Servizio di persistenza dietro un'interfaccia (in memoria o su file)
- ⬜ Collegamento a Firestore: avventure, mappe, eroi, salvataggi (poche scritture per turno)
- ⬜ Checkpoint di salvataggio e risultato dei turni

### Fase 12 — Produzione ⬜
- ⬜ PeerServer proprio e server TURN
- ⬜ Firebase Auth e Hosting
- ⬜ Rifinitura, prestazioni, test su dispositivi touch

### Idee e fuori scope per ora 💤
- 💤 **Fusione di stanze**: una funzione dell'editor per unire due o più stanze (tessere affiancate) in un ambiente solo, togliendo i muri e gli spezzoni di muro che le separano, per creare ambienti con forme fuori dall'ordinario. Coi pezzi di oggi non è molto vantaggiosa (per le stanze grandi conviene un tile dedicato, come la 8×8), ma potrebbe servire in futuro. Da decidere: quali muri vanno via (tutti quelli fra le tessere scelte?), come cambiano uscite e punti morti, come si ripartiscono le aree
- 💤 Famigli, scrigni con serratura
- 💤 Vista Overlord umana (l'interfaccia comune di azioni è della fase 6)
- 💤 Acquisti, cosmetici, achievement
- 💤 Pannello eroi laterale a pillola
- 💤 Effetto onda sullo sfondo (idea, forse non verrà adottata)

## Provarla online (GitHub Pages)
Ogni push su `dev` pubblica l'app su GitHub Pages con il workflow `.github/workflows/pages.yml`. Una volta sola: nel repository, **Settings → Pages → Source: GitHub Actions**.
L'indirizzo è `https://<utente>.github.io/cadungeon/`; la home non ha ancora un modo per scegliere la mappa (il tasto Editor porta a `/editor`); si scrive l'indirizzo diretto: `/play/stairs` (l'altra mappa di prova), `/play/combat` (per provare combattimento e linea di vista) e `/play/ogre-lair` (la bozza della prima avventura) e `/play/nelle-tenebre` (la prima avventura fatta con l'editor).

## Ultima cosa da fare
- 💤 **Inventare nomi originali per tutto**: eroi, mostri, oggetti, tesori, abilità, stati, ambientazioni e avventure oggi usano nomi (e testi) ispirati al regolamento di riferimento. Prima di pubblicare vanno tutti sostituiti con nomi nostri, nel mondo di Duels (vedi la regola di originalità all'inizio di CLAUDE.md). Conviene farlo a fine progetto, quando i contenuti sono stabili.
