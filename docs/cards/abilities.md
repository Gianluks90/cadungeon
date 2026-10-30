# Catalogo delle abilità da costruire

Tutto ciò che oggi è solo testo (`rules`, `surge`, `ability` nelle schede) e che dovrà diventare logica.
Una riga per abilità, con il tipo, il testo originale, chi la usa e cosa serve per costruirla.

**Tipi**
- **Passiva**: vale finché l'oggetto è equipaggiato o l'eroe la possiede, senza azioni.
- **Onda** (nel gioco `surge`): si paga con le Scariche ottenute dai dadi durante un attacco.
- **Attiva**: l'eroe la attiva da solo, pagando un costo (fatica, esaurire la carta...).
- **Parola chiave**: un termine di regola con un numero (Perforare 1, Perforare 10...).
- **Stato**: un effetto sul bersaglio o sull'eroe che dura (Stordire, Veleno...).

**Stato di avanzamento**: ✅ già in gioco · 🟡 parziale · ⬜ da fare. Cosa manca, in ordine di propedeuticità (cosa va fatto prima di cosa), è nella sezione 8.

## 1. Passive degli oggetti

| Abilità | Testo | Oggetto | Stato | Note |
|---|---|---|---|---|
| Armatura | +N armatura | Armatura di cuoio (+1), Cotta di maglia (+2), Mantello dell'inganno (+1), Cotta a piastre (+3), Corazza runica (+4), Armatura dorata (+2), Mantello delle nebbie (+1), Mantello Elfico (+2), Cotta di Squame di Drago (+4) | ✅ | `armor` dell'oggetto sommata all'armatura dell'eroe (`armorOf`). La riduzione del danno aspetta il combattimento. |
| Movimento ridotto | Movimento ridotto a 4 (3 per le armature pesanti) | Cotta di maglia, Cotta a piastre, Armatura dorata, Cotta di Squame di Drago | ✅ | `speedCap`: limita la velocità "stampata" sulla scheda; i bonus (Anello della Rapidità) si sommano dopo. Vale dal round dopo averla indossata. |
| Divieto di equipaggiamento | Impossibile equipaggiare "Rune" | Cotta di maglia, Cotta a piastre, Armatura dorata, Cotta di Squame di Drago | ✅ | `forbidsTags: ["rune"]`, in tutti e due i sensi. Il tag `rune` dà l'etichetta "Runa". |
| Reliquia | Non si vende, non sta in nessun mazzo | Le quattro reliquie | ✅ | Tag `relic`: si trovano solo come segnalino sulla mappa (`item`) o negli scrigni (`contents`). |
| Immunità (Armatura dorata e Cotta di Squame di Drago sono nascoste con `hide`) | Sei immune a: Aura, Bruciare, Contraccolpo, Paura, Presa, Ragnatela, Stordire e Veleno | Corazza runica; Armatura dorata (Presa, Tramortire), Cotta di Squame di Drago (Sanguinare, Veleno, Bruciare) | ✅ | Generica (`immunitiesIn` in `state/status.ts`): un oggetto equipaggiato, una carta o un'abilità di un mostro è immune a qualcosa solo scrivendolo nel suo testo ("Sei immune a Presa e Tramortire", "Sei immune alle seguenti abilità: Aura, Bruciare, ...", "Immune a Veleno"); la tabella dei nomi (Tramortire = Stordire, Fiamma = Bruciare...) è nello stesso file e per un nome nuovo basta una riga. Vale quindi anche per Armatura dorata e Cotta di Squame di Drago, quando si riattiveranno. "Sanguinare" non è uno stato del gioco e si ignora. Resta valida anche la regola `immune` degli `effects`. |
| Movimento extra | Durante il tuo turno disponi di 1 punto movimento in più, anche se non ne hai altri | Anello della Rapidità | ✅ | `movementBonus`: si somma a ogni azione, anche a Combattere (che dà 0 punti). |
| Bonus a distanza | Quando esegui attacchi a distanza, guadagni +1 danno e +2 gittata | Elmo scorpione | ✅ | `effects` di tipo `attack` (danno e gittata a distanza). |
| Bonus in magia | Quando esegui attacchi magici, guadagni +2 gittata e +2 danni | Anello dell'arcano | ✅ | `effects` di tipo `attack` (gittata e danno in magia). |
| Danno extra in mischia | Quando esegui attacchi corpo a corpo, guadagni +1 danno | Cintura di forza | ✅ | `effects` di tipo `attack` (danno in mischia). |
| Onde bonus | Quando esegui attacchi con quest'arma, guadagni N onde di potere bonus (1 o 2; tipo di attacco dell'arma) | Intreccio di mana (1, magia), Ascia dentata (1), Bastone del fuoco (2), Bastone della Conoscenza (2), Ascia di ghiaccio (2) | ✅ | Le onde bonus (`surges`) si sommano alle Scariche del tiro. |
| Dado potere sulle ferite | Quando subisci 1 o più ferite, tira un dado potere per ogni ferita; annulla ogni ferita per ogni faccia vuota (inganno) o per ogni onda (nebbie, Elfico) | Mantello dell'inganno, Mantello delle nebbie, Mantello Elfico | ✅ | Reazione automatica (`react` con `auto`, `state/reactions.ts`): quando un attacco sta per togliere N ferite all'eroe si tira un dado potere per ogni ferita (al massimo 8) e se ne annulla una per faccia vuota (inganno) o per onda (nebbie, Elfico). Prima delle reazioni a scelta. |
| Bonus di supporto | +1 danno (+2 per Spada serpente e Lama dell'Ira) | Spada, Spada d'osso, Spada serpente, Lama dell'Ira | ✅ | `offHand` (il campo dei dati) esiste e si mostra come "Bonus di supporto". Regola (manuale, "Brandire due armi"): se l'eroe ha **due armi da mischia a una mano** equipaggiate e attacca con una, l'altra aggiunge il suo bonus di supporto all'attacco. Da applicare con il combattimento. Si sceglie una sola arma con cui tirare i dadi. |

## 2. Onde (Scariche) delle armi

Già in gioco nella finestra dell'attacco (`state/combat.ts`): +N danno, +N gittata e Perforare; le altre voci qui sotto si vedono ma si attivano più avanti.

Il costo è il numero di Scariche da spendere; ogni onda si può usare più volte per attacco, pagando il costo ogni volta (dal manuale).

| Effetto | Costo | Armi | Stato | Note |
|---|---|---|---|---|
| +1 danno | 1–3 | Bastone del mago (2), Balestra (2), Spada (2), Daga (2), Arco (3), Sacrificio (2), Ascia (1), Spada di luce (1), Arco grande (2), Spada d'osso (1), Martello di Dente di Drago (1), Bomba di fuoco dei Nani (1), Placare (2), Bastone del castigo (1) | ✅ | Si somma al danno dell'attacco. |
| +1 gittata | 1–3 | Bastone del mago (2), Balestra (3), Arco (2), Sacrificio (2), Arco grande (1), Bomba di fuoco dei Nani (2), Bastone del castigo (1) | ✅ | Serve la gittata degli attacchi a distanza e di magia. |
| Perforare N | 1–2 | Spada di luce (N=10, costo 2), Cristallizzare (N=2, costo 1) | ✅ | Vedi "Parola chiave: Perforare". |
| Esplosione 1 | 2 | Flagello, Tempesta di ghiaccio, Tempesta di fiamme | ✅ | `areaVictims` in `state/combat.ts`: colpisce chi sta entro N spazi dal bersaglio e lo vede, amici compresi; ogni creatura una sola volta. Non passa per le scale. |
| Raddoppia il danno | 2 | Divoratrice di anime | ✅ | Raddoppia il danno inflitto dall'attacco **dopo** i bonus, Perforare e l'armatura (ogni volta che si paga). |
| Uccisione istantanea | 3 | Tocco della morte | ✅ | Se l'attacco colpisce, il bersaglio muore ignorando "Immortale" (niente dado potere per rialzarsi). |
| Il Signore supremo perde 1 Minaccia | 2 | Bastone della Conoscenza | ✅ | Se l'attacco colpisce, la Minaccia dell'Overlord scende di 1 (mai sotto zero); il contatore e una notifica lo mostrano. |

## 3. Parole chiave

| Parola | Testo | Dove | Stato | Note |
|---|---|---|---|---|
| Perforare N | Il danno ignora N punti di armatura del bersaglio | Arco (1), Arco grande (2), Martello di Dente di Drago (2), Spada di luce (10, a onde), Cristallizzare (2, a onde) | ✅ | Come il Perforare del regolamento di riferimento: riduce l'armatura prima del calcolo del danno. |
| Immortale | Il bersaglio non muore normalmente | Scheletro potenziato | ✅ | Serve per il Tocco della morte. |

## 4. Abilità attive degli oggetti

| Abilità | Testo | Oggetto | Stato | Note |
|---|---|---|---|---|
| Cura minore | Spendi 1 punto movimento e 1 segnalino fatica per curare 1 ferita a te stesso. Si può usare più volte pagando il costo ogni volta | Cura minore (runa) | ✅ | Bottone "Usa" sulla card (1 punto movimento e 1 fatica, ripetibile): cura 1 ferita (i segnalini veleno si tolgono per primi). `state/item-use.ts`. |
| Rigenerazione | Se è equipaggiato all'inizio del tuo turno, scartalo per recuperare 6 ferite e la fatica fino al massimo | Cristallo di Tival | ✅ | `when: turnStart`: solo prima di muoversi e di attaccare; si scarta, cura 6 ferite e la fatica al massimo. |
| Stordire sul bersaglio | Se hai inflitto almeno 1 ferita (dopo l'armatura), piazza 1 segnalino stordito sul bersaglio | Placare, Pietrificare | ✅ | `inflictionsFrom` legge la frase delle regole dell'arma. |
| Amuleto della guarigione | Se è equipaggiato all'inizio del tuo turno, scartalo per recuperare tutti i punti ferita e la fatica | Amuleto della guarigione | ✅ | Come il Cristallo di Tival: cura tutte le ferite e la fatica. |
| Lampada magica | Come sopra, ma cura 8 ferite e la fatica a te e agli eroi adiacenti | Lampada magica | ✅ | Come il Cristallo di Tival, a sé e agli eroi adiacenti: 8 ferite e la fatica al massimo. |
| Cura maggiore | Spendi 1 punto movimento e 1 fatica per curare 2 ferite a te o a un modello adiacente | Cura maggiore (runa) | ✅ | Come la Cura minore, cura 2 ferite a sé o a un eroe adiacente (una dialog chiede chi, se più di uno ne ha bisogno). |
| Flauto del riposo | Scarta al termine del tuo turno per piazzare 1 stordito su ogni mostro entro 6 spazi | Flauto del riposo | ✅ | `state/turn-end-items.ts`: quando l'eroe passa il turno, se ha il Flauto (equipaggiato o nello zaino) una dialog chiede se usarlo; si scarta e stordisce i mostri entro 6 spazi (anche in diagonale, anche non visti), tranne gli immuni e quelli con un nome. |
| Cura a fatica | Spendi 1 fatica per curare 1 ferita a te stesso. Si può usare più volte pagando il costo ogni volta | Armatura fantasma | ✅ | Armatura fantasma: 1 fatica per 1 ferita, ripetibile. |
| Scudo che si esaurisce | Esaurisci questa carta per annullare N ferite appena ricevute (1 Scudo di ferro, 2 Scudo di Cristallo, 3 Scudo di luce, 4 Scudo del Guerriero). Non annulla le ferite che ignorano l'armatura | Scudo di ferro, Scudo di Cristallo, Scudo di luce, Scudo del Guerriero | ✅ | Reazione a scelta con costo `exhaust`: prima che le ferite si tolgano una dialog propone gli scudi (annullano 1, 2, 3 o 4 ferite) e le altre reazioni, in sequenza finché ci sono ferite. Ambidestro ne annulla 1 in più. Esauriti fino al round dopo. Non vale per le ferite che ignorano l'armatura (buche, fiamme, trappole). |

## 5. Stati (effetti sull'eroe o sui mostri)

Le decisioni sono in `docs/cards/stati.md`; le regole in `docs/REGOLE.md`, sezione 2c. Sono attivi tutti: Aura, Bruciare, Contraccolpo, Paura, Presa, Ragnatela, Stordire e Veleno.

| Stato | Note |
|---|---|
| Aura | ✅ Attivo. |
| Bruciare | ✅ Attivo. |
| Contraccolpo | ✅ Attivo (Ogre; sui mostri grandi si sposta di meno, con salto e raggiera all'atterraggio). |
| Paura | ✅ Attivo. |
| Presa | ✅ Attivo. |
| Ragnatela | ✅ Attivo. |
| Stordire | ✅ Attivo (Placare, Pietrificare, Parola di Vaal). |
| Veleno | ✅ Attivo. |

## 6. Abilità degli eroi

Una per eroe, a parole (`ability` nella scheda). Oggi sono testi che ho scritto come segnaposto.

| Eroe | Testo | Stato | Note |
|---|---|---|---|
| Anarien (ranger) | Occhio del cacciatore: se non si è mossa in questo turno, il suo primo attacco a distanza ripete un dado a scelta | ✅ | `effects` nella scheda (`public/heroes/anarien.json`, effetto `reroll`): dopo il tiro, se non si è mossa e non ha ancora attaccato a distanza in questo round, compare un tasto accanto a ogni dado per ripeterne uno a scelta (resta il secondo risultato; un dado multivalente si sceglie di nuovo). Regole in `state/reroll.ts`. |
| Ferdinand (druido) | Pelle di corteccia: quando subisce una ferita, può ridurla di 1 una volta per round | ✅ | `effects` nella scheda dell'eroe (`public/heroes/ferdinand.json`, `Piece.heroEffects`): una reazione a scelta che annulla 1 ferita, una volta per round (si esaurisce). |

## 7. Carte evento dei mazzi

| Carta | Testo | Mazzo | Stato | Note |
|---|---|---|---|---|
| Tesoro nascosto (x5) | Ricevi 50 monete e pesca un'altra carta da questo mazzo | Rame | ✅ | `instant: { coins: 50, draw: 1 }`: non entra nell'inventario, dà le monete a chi la pesca e fa pescare ancora (negli scrigni e nel negozio). |
| Tesoro nascosto (x3) | Ricevi 50 monete e una pozione di cura, poi pesca un'altra carta | Argento | ✅ | `instant` con `potion: 'heal'`. Se l'eroe porta già 3 pozioni, la pozione si perde. |
| Tesoro nascosto (x2) | Ricevi 150 monete e una pozione del vigore, poi pesca un'altra carta | Oro | ✅ | `instant` con `potion: 'vital'`. |

## 8. Cosa manca, per propedeuticità

Ho riletto il codice: parecchie righe segnate ⬜ erano già fatte e le ho corrette. Quello che manca davvero si ordina così: ogni livello sblocca il successivo, e dentro un livello le cose sono indipendenti fra loro. Il combattimento, la fatica, gli stati, le parole chiave dei mostri, le trappole, la Minaccia, il dado potere 3D e le dialog di scelta ci sono già.

### Livello 0 · Fatto
Immunità generica (vedi la riga delle immunità nella sezione 1), `grant` (già funzionavano), Prudente (Minaccia −1 e trappole −1), Talento naturale (1 dado potere in più contro le trappole) e Precisione (ignora anche 1 masso): tutto in gioco.

### Livello 1 · Fatto: oggetti che si usano
Un effetto `use` nei dati dell'oggetto (`public/items/catalog.json`) dice il costo (`fatigue`, `movement`, `discard`, `exhaust`), la condizione (`when: "turnStart"` = prima di muoversi e di attaccare), cosa fa (`do`: `heal` e `recoverFatigue`, con `amount` numero o `"full"` e `who`: `self`, `selfOrAdjacent`, `selfAndAdjacent`) e se si ripete. La card dell'oggetto equipaggiato ha il bottone "Usa" (costo con icone prima del testo, "scarta" dopo; spento con il motivo se non si può, anche se non c'è niente da curare: l'oggetto non si spreca). Le regole sono in `state/item-use.ts`. Il costo `exhaust` (oggetto esaurito fino al round dopo) è pronto e lo useranno gli scudi del livello 2. Fatti: Armatura fantasma, Cura minore e maggiore, Cristallo di Tival, Amuleto della guarigione e Lampada magica.

### Livello 2 · Fatto: il danno ricevuto
Un passo fra "il colpo toglie N ferite" e "le ferite si tolgono" (`reduceWounds` nella scena, regole in `state/reactions.ts`): per un eroe bersaglio (anche nel turno automatico dell'Overlord, che aspetta, e per le vittime di Esplosione e Spazzata) si applicano gli effetti `react` con `on: "wounds"` degli oggetti equipaggiati e dell'abilità dell'eroe. Prima le **automatiche**, i Mantelli (un dado potere per ferita, annullano una per faccia vuota o per onda); poi le **a scelta**, in una dialog: gli Scudi che si esauriscono (annullano 1, 2, 3 o 4; Ambidestro ne annulla 1 in più) e Pelle di corteccia (Ferdinand: −1 una volta per round). Si può usare una reazione dopo l'altra finché ci sono ferite. Non si applica alle ferite che ignorano l'armatura (buche, fiamme, trappole) né all'uccisione istantanea.

### Livello 3 · Fatto: ripetere i dadi scegliendo
Un effetto `reroll` (`on`: i tipi di attacco, `count`, `ifNotMoved`, `firstOnly`, in `state/reroll.ts`) dà all'eroe di ripetere dei dadi a sua scelta dopo il tiro. Nella finestra d'attacco compare un tasto accanto a ogni dado e una riga che dice chi lo permette; il dado ripetuto è tirato di nuovo in 3D e le onde già scelte si azzerano. Fatto: **Occhio del cacciatore** (Anarien). Mira e Schivata useranno lo stesso effetto quando ci saranno i comandi (livello 4).

### Livello 4 · I comandi degli eroi — Fatto
Mira, Schivata e Guardia, come ordini piazzati con l'azione Prepararsi (tasto E; vedi REGOLE.md, sezione 2f). Sblocca **Irremovibile** (la parte "ordine di Guardia", oggi solo l'armatura temporanea) e Stare in guardia.

### Livello 5 · I famigli (in fondo)
**Boggs il Ratto, Mata e Kata** sono pedine alleate controllate dal giocatore, con un turno, ferite e una morte propri: dipendono da regole da decidere (come si muovono, se attaccano, cosa succede se muoiono) e conviene farle dopo il multigiocatore, perché toccano di chi è il turno.

**Ordine suggerito**: i livelli 0, 1, 2 e 3 sono fatti; il 3 è indipendente e si può fare in qualunque momento; 4 e 5 solo quando decidi di aprire quel capitolo.

## 9. Carte abilità (i tre mazzi di addestramento)

Dati: `public/skills/catalog.json` (35 carte, tutte x1). Gli eroi le possiedono già (`skillCards` della pedina: tante per ramo quante dice `skills` della scheda, pescate a caso a inizio partita; altre si comprano al Campo di addestramento per 1000 monete) e la scheda le mostra come card di solo testo, ma i loro effetti sono ancora solo dati: nessuno li legge.
I tre mazzi sono i tre rami già presenti nelle schede degli eroi (`skills`): `combat` (11 carte), `cunning` (12, "Sotterfugio") e `magic` (12). Da decidere: come si ottengono e quanto costano al Campo.

### Il modello di una carta
```json
{ "id": "mighty", "name": "Possente", "school": "combat", "text": "…", "effects": [ { "kind": "attack", "on": ["melee"], "damage": 2 } ] }
```
`text` è il testo da mostrare; `effects` è la stessa cosa in forma che il gioco può leggere. Una carta ha uno o più effetti, ognuno di un `kind`.

### I sei tipi di effetto (il vocabolario)
Sono pochi perché quasi tutte le carte sono la stessa idea con numeri diversi. Gli oggetti del catalogo (sezioni 1–4) useranno gli stessi tipi, così oggetti e abilità passano dallo stesso codice.

| `kind` | Cosa dice | Esempi | Quando si legge |
|---|---|---|---|
| `stat` | Cambia un numero dell'eroe: `wounds`, `fatigue`, `speed`, `armor`. Opzioni: `vs` (solo contro `melee`/`ranged`/`magic`), `when` (condizione, es. `noArmorWorn`), `afterCaps` (si somma dopo i limiti di velocità) | Resistente, Esperto, Veloce, Parare, Deviare frecce, Forza di volontà | Quando il gioco chiede quel valore (`armorOf`, `speedOf`...) |
| `attack` | Bonus a ogni attacco dei tipi `on`: `damage`, `range`, `surges` (onde bonus) | Possente, Maestro d'armi, Fuoco interiore, Tiro preciso, Prodigio | Quando si prepara un attacco |
| `trigger` | "Quando succede `on`, puoi (`optional`) pagare `cost` e fare `do`". Opzioni: `limit` (`trigger` = una volta per evento, `turn`, `round`), `repeatable`, filtri come `action` o `attack` | Implacabile, Abile guerriero, Fendente, Cavaliere, Tiro rapido, Vigilanza, Sangue vampirico, Giustizia divina | Quando l'evento `on` accade |
| `active` | Come `trigger` ma lo avvia l'eroe: compare tra le azioni del bottone contestuale, con costo e motivo | Telecinesi | Quando il giocatore la sceglie |
| `rule` | Un'eccezione a una regola, con un nome (`rule`) e a volte un numero. Il codice controlla se l'eroe ha quella regola nel punto giusto | Supportare, Ambidestro, Precisione, Tiratore scelto, Acrobata, Prudente | Nel punto di regola che la riguarda |
| `grant` / `familiar` | Dà una parola chiave (`aura`, `sorcery` con `level`, `command`) o un famiglio (`ids`) | Aura sacra, Talento naturale, Benedizione, Boggs, Mata e Kata | All'inizio della partita |

**Eventi dei `trigger`** (`on`): `chooseAction` (con `action`: `advance`/`fight`/`run`), `attackDone`, `kill`, `enemyEntersAdjacent`, `death`; in seguito `turnStart`, `woundsReceived`.
**Costi** (`cost`): `fatigue` (segnalini), `movement` (punti), `exhaust` (esaurire la carta: si ricarica a inizio round, da confermare), `discard`.
**Azioni** (`do`, ognuna con `op`): `recoverFatigue` (`who`: `self`/`selfAndAdjacent`), `extraAttack` (`sameWeapon`), `gainMovement`, `tempArmor` (`until`), `guardOrder`, `moveModel`, `attackNow`, `killNearby`.

### Come farlo girare: un solo posto dove si leggono gli effetti
L'idea è una funzione che raccoglie le **fonti attive** di un eroe e restituisce tutti i suoi effetti:
- fonti: la scheda dell'eroe, gli oggetti equipaggiati (`equippedDefs`, già c'è) e le carte abilità che possiede;
- `effectsOf(state, piece)` li mette in un unico elenco; da lì ogni regola chiede quello che le serve.

Tre modi di interrogarla, uno per tipo:
1. **Numeri** (`stat`, `attack`): somma. `statOf(state, piece, 'armor', { vs: 'melee' })` somma l'eroe, gli oggetti e le abilità. Le funzioni di oggi (`armorOf`, `speedOf`, `movementBudget`) diventano casi particolari; il tetto della velocità (`speedCap`) si applica prima del bonus `afterCaps`, come chiede Veloce.
2. **Eventi** (`trigger`): quando succede qualcosa, il gioco chiama `fire(state, piece, evento, contesto)`, che trova i `trigger` giusti. Se sono `optional`, il giocatore sceglie (come per le scelte del bottone contestuale); se costano, controlla che li possa pagare. Così Fendente, Vigilanza, Cavaliere ecc. non hanno codice proprio: cambia solo la tabella.
3. **Eccezioni** (`rule`): `hasRule(state, piece, 'sightIgnore')` nel punto esatto in cui la regola si applica (linea di vista, movimento, danno...). Sono le uniche che richiedono una riga di codice ciascuna, ma sono poche (10 effetti in tutto, 8 nomi diversi).

Le azioni di un'abilità sono le stesse dell'Overlord scriptato: stesse funzioni sullo stato, nessuna logica nella UI (come per le azioni di oggi).

### Cosa ha in comune con gli oggetti
Quasi tutte le abilità di oggetti del catalogo si scrivono con gli stessi mattoni: "Elmo scorpione" e "Fuoco interiore" sono lo stesso `attack`; "Anello della Rapidità" è uno `stat`/`movementBonus`; "Cristallo di Tival" è un `active` con `cost.discard`. Quando si costruirà il motore conviene portare anche i campi degli oggetti (`rules`, `surge`, `speedCap`...) in `effects`, tenendo il testo a parole per la card.

### Le carte, una per una

Stato: ✅ possibile subito (basta che l'eroe possa avere le carte) · ⬜ aspetta una capacità della sezione 8.

| Carta | Ramo | Tipo | Serve | Stato |
|---|---|---|---|---|
| Resistente | Combattimento | `stat` ferite +4 | niente: è un massimo di ferite | ✅ |
| Supportare | Combattimento | `rule` + `stat` armor se senza armatura | niente: l'armatura c'è, il tetto di velocità si salta | ✅ |
| Esperto | Sotterfugio | `stat` fatica +2 | niente | ✅ |
| Veloce | Sotterfugio | `stat` velocità +2 dopo i tetti | niente | ✅ |
| Parare, Deviare frecce, Forza di volontà | Comb./Sott./Magia | `stat` armor `vs` tipo | danno ricevuto con il tipo di attacco | ✅ |
| Possente, Fuoco interiore, Tiro preciso | Comb./Magia/Sott. | `attack` danno/gittata | combattimento (danno, gittata) | ✅ |
| Maestro d'armi, Maestro arciere, Prodigio | Comb./Sott./Magia | `attack` onde bonus | tiro dei dadi e onde | ✅ |
| Implacabile, Grido di battaglia | Combattimento | `trigger` su `chooseAction`, recupera fatica | fatica spendibile e recuperabile | ✅ |
| Abile guerriero, Cavaliere | Combattimento | `trigger` su `chooseAction`, costo fatica, attacchi extra | fatica; il budget di attacchi (`attackBudget`) c'è già | ✅ |
| Irremovibile | Combattimento | `trigger` su `chooseAction` (Combattere) | armatura temporanea e ordine di Guardia | ✅ |
| Fendente, Sangue vampirico | Comb./Magia | `trigger` su `kill` | morte dei mostri, fatica | ✅ |
| Incantesimo veloce, Tiro rapido | Magia/Sotterfugio | `trigger` su `attackDone`, attacco extra con la stessa arma | attacchi, fatica; "esaurire" la carta | ✅ |
| Vigilanza | Sotterfugio | `trigger` su `enemyEntersAdjacent` | turno dell'Overlord con movimento dei mostri; attacco fuori turno | ✅ |
| Giustizia divina | Magia | `trigger` su `death` | morte degli eroi, mostri "senza nome" e Immortale | ✅ |
| Telecinesi | Magia | `active` (1 fatica, ripetibile) | fatica; muovere un mostro entro la vista | ✅ |
| Ambidestro | Sotterfugio | `rule` supportDamage e shieldBlock | bonus di supporto (+1 danno) e scudo che annulla 1 ferita in più (`cancelAmount`) | ✅ |
| Tiratore scelto, Precisione | Sotterfugio | `rule` sulla linea di vista dell'attacco | Tiratore scelto: linea da una casella adiacente libera; Precisione: ignora 1 creatura o 1 masso in mezzo (`canSeeTarget`, `ignoreRocks` in `board/sight.ts`) | ✅ |
| Acrobata | Sotterfugio | `rule` passThrough | movimento: oggi roccia/acqua/buca/creature bloccano; serve una "via libera" per questa abilità | ✅ |
| Prudente | Sotterfugio | `rule` minaccia −1 e ferite delle trappole −1 | `threatPerTurn` (Minaccia a ogni turno, mai sotto 0, mostrata nella notifica del turno) e `hurtByTrap` (−1 ferita, minimo 0) | ✅ |
| Aura sacra, Benedizione, Talento naturale | Magia | `grant` Aura / Comando / Stregoneria 1 | `keywordLevel` legge già i `grant` degli eroi (verificato); Talento naturale ha anche 1 dado potere in più contro le trappole (`trapDice`) | ✅ |
| Boggs il Ratto, Mata e Kata | Magia | `familiar` | famigli (fuori scope) | ⬜ |

**Parole nuove da definire** (compaiono solo qui): Aura, Comando e Stregoneria (parole chiave), Stare in guardia (ordine), carta Trappola, famiglio, modello "senza nome".
**Coincidenze con gli eroi**: l'`ability` di ogni scheda eroe (sezione 6) può diventare una carta con lo stesso formato; le abilità iniziali dei rami (`skills`) diventeranno le carte che l'eroe possiede all'inizio.

### Abilità da usare (`state/skills.ts`)
Le carte con un `trigger` opzionale hanno un bottone "Usa" sulla loro card nella scheda dell'eroe (e un puntino giallo sul tasto della scheda quando ce n'è una da usare). Il bottone dice il costo (fatica, la carta che si esaurisce) e, se non si può, perché.
- **Quando scegli Avanzare/Combattere** (prima di muoverti o attaccare, una volta per turno): Implacabile (+1 fatica), Abile guerriero (2 fatica: 2 attacchi invece di 1), Cavaliere (2 fatica: metà velocità in movimento e 3 attacchi), Grido di battaglia (+1 fatica a sé e agli eroi adiacenti), Irremovibile (+1 armatura fino al turno dopo; l'ordine di Guardia se non ha già un ordine).
- **Dopo un attacco**: Tiro rapido (2 fatica, ripetibile) e Incantesimo veloce (2 fatica e la carta si esaurisce fino al round dopo) danno 1 attacco in più **con la stessa arma**; Fendente (1 fatica, una volta per nemico ucciso in mischia).
- **Automatiche**: Sangue vampirico (+1 fatica quando si uccide un nemico), Giustizia divina (quando l'eroe muore uccide i mostri senza un nome entro 3 spazi, anche gli Immortali).
- **Vigilanza** (`state/vigilance.ts`): nel turno dell'Overlord, dopo ogni passo di un mostro che lo porta in una casella adiacente a un eroe che ha la carta (non lo era prima), il suo movimento si ferma. L'eroe con almeno 2 fatica e un'arma con cui colpirlo (la distanza non va a un adiacente) vede una dialog: "Spendere 2 fatica per attaccarlo subito?" con un bottone per ogni arma e "Rinuncia". Se accetta si apre la finestra normale dell'attacco (l'eroe tira i dadi); la fatica si paga all'applicazione, l'attacco non consuma i suoi attacchi, e se il mostro sopravvive riprende dal punto dove si era fermato. Una volta per ogni volta che un nemico entra accanto a lui.
- **Telecinesi** (`state/telekinesis.ts`): il bottone "Usa" della carta (1 fatica, ripetibile) avvia la scelta: si evidenziano i modelli in vista (amici e nemici, non se stesso) che hanno un posto dove andare; si tocca il modello e poi una delle caselle evidenziate, che sono i suoi passi di 1 spazio con le normali regole del movimento (muri e porte chiuse, una buca fa cadere, i mostri non si fermano su glifi accesi o scrigni; i grandi con la loro sagoma, la Salamandra anche piegandosi). La fatica si paga allo spostamento e il modello non spende i suoi punti movimento. Esc o "Annulla" annullano.
- **Acrobata** (`passThrough`): il movimento dell'eroe attraversa nemici, roccia, acqua e buche come pavimento, senza conseguenze (niente caduta); le caselle intorno sono nell'area raggiungibile ma non ci si può fermare su di esse (né su nemici o amici). Terminando sempre in uno spazio libero, la regola di non attaccare mentre si condivide lo spazio è garantita.
- Non ancora: i famigli (vedi la sezione 8 per l'ordine).

### Già attive (`state/effects.ts`)
`effectsOf` raccoglie gli effetti delle carte abilità e degli oggetti equipaggiati. Sono attivi i `stat` (ferite e fatica massime al momento in cui si prende la carta, velocità con i limiti dell'armatura, armatura anche contro un tipo di attacco), gli `attack` (danno, gittata e onde di potere bonus per tipo di attacco, con i nomi di chi li dà nella finestra dell'attacco) e le `rule` Supportare (`armorNoSpeedPenalty`), Ambidestro (`supportDamage`: +1 danno quando si riceve un bonus di supporto; lo scudo che annulla una ferita in più aspetta gli scudi), Tiratore scelto (`sightFromAdjacent`) e Precisione (`sightIgnore`, per ora solo le creature, non gli ostacoli). Restano in attesa i `trigger`, gli `active` e i `grant`, che dipendono da fatica, stati e parole chiave.

### Prossimo passo suggerito
Resta solo ciò che apre un capitolo nuovo: i famigli (livello 5, sospesi in attesa della UI). Per il resto del gioco le priorità sono nella fase 8 e 9 del README (struttura dell'app ed editor).
