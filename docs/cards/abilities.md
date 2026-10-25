# Catalogo delle abilità da costruire

Tutto ciò che oggi è solo testo (`rules`, `surge`, `ability` nelle schede) e che dovrà diventare logica.
Una riga per abilità, con il tipo, il testo originale, chi la usa e cosa serve per costruirla.

**Tipi**
- **Passiva**: vale finché l'oggetto è equipaggiato o l'eroe la possiede, senza azioni.
- **Onda** (nel gioco `surge`): si paga con le Scariche ottenute dai dadi durante un attacco.
- **Attiva**: l'eroe la attiva da solo, pagando un costo (fatica, esaurire la carta...).
- **Parola chiave**: un termine di regola con un numero (Perforare 1, Perforare 10...).
- **Stato**: un effetto sul bersaglio o sull'eroe che dura (Stordire, Veleno...).

**Stato di avanzamento**: ✅ già in gioco · 🟡 parziale · ⬜ da fare. Quasi tutto il resto dipende dal combattimento (docs/REGOLE.md, sezione 5).

## 1. Passive degli oggetti

| Abilità | Testo | Oggetto | Stato | Note |
|---|---|---|---|---|
| Armatura | +N armatura | Armatura di cuoio (+1), Cotta di maglia (+2), Mantello dell'inganno (+1), Cotta a piastre (+3), Corazza runica (+4), Armatura dorata (+2), Mantello delle nebbie (+1), Mantello Elfico (+2), Cotta di Squame di Drago (+4) | ✅ | `armor` dell'oggetto sommata all'armatura dell'eroe (`armorOf`). La riduzione del danno aspetta il combattimento. |
| Movimento ridotto | Movimento ridotto a 4 (3 per le armature pesanti) | Cotta di maglia, Cotta a piastre, Armatura dorata, Cotta di Squame di Drago | ✅ | `speedCap`: limita la velocità "stampata" sulla scheda; i bonus (Anello della Rapidità) si sommano dopo. Vale dal round dopo averla indossata. |
| Divieto di equipaggiamento | Impossibile equipaggiare "Rune" | Cotta di maglia, Cotta a piastre, Armatura dorata, Cotta di Squame di Drago | ✅ | `forbidsTags: ["rune"]`, in tutti e due i sensi. Il tag `rune` dà l'etichetta "Runa". |
| Reliquia | Non si vende, non sta in nessun mazzo | Le quattro reliquie | ✅ | Tag `relic`: si trovano solo come segnalino sulla mappa (`item`) o negli scrigni (`contents`). |
| Immunità | Sei immune a: Aura, Bruciare, Contraccolpo, Paura, Presa, Ragnatela, Stordire e Veleno | Corazza runica; Armatura dorata (Presa, Tramortire), Cotta di Squame di Drago (Sanguinare, Veleno, Bruciare) | ⬜ | Serve l'elenco degli stati (sezione 5) e un campo `immune: [...]` sull'oggetto. Si controlla quando un effetto sta per colpire l'eroe. |
| Movimento extra | Durante il tuo turno disponi di 1 punto movimento in più, anche se non ne hai altri | Anello della Rapidità | ✅ | `movementBonus`: si somma a ogni azione, anche a Combattere (che dà 0 punti). |
| Bonus a distanza | Quando esegui attacchi a distanza, guadagni +1 danno e +2 gittata | Elmo scorpione | ⬜ | Dipende dal combattimento. |
| Bonus in magia | Quando esegui attacchi magici, guadagni +2 gittata e +2 danni | Anello dell'arcano | ⬜ | Dipende dal combattimento. |
| Danno extra in mischia | Quando esegui attacchi corpo a corpo, guadagni +1 danno | Cintura di forza | ⬜ | Si applica al danno di ogni attacco di tipo `melee`. Dipende dal combattimento. |
| Onde bonus | Quando esegui attacchi con quest'arma, guadagni N onde di potere bonus (1 o 2; tipo di attacco dell'arma) | Intreccio di mana (1, magia), Ascia dentata (1), Bastone del fuoco (2), Bastone della Conoscenza (2), Ascia di ghiaccio (2) | ⬜ | Una Scarica in più negli attacchi `magic`. Dipende dal tiro dei dadi. |
| Dado potere sulle ferite | Quando subisci 1 o più ferite, tira un dado potere per ogni ferita; annulla ogni ferita per ogni faccia vuota (inganno) o per ogni onda (nebbie, Elfico) | Mantello dell'inganno, Mantello delle nebbie, Mantello Elfico | ⬜ | Serve il dado potere (facce da definire) e il flusso del danno ricevuto. L'armatura +1 è già attiva. |
| Bonus di supporto (mano libera) | +1 danno | Spada | 🟡 | `offHand` esiste e si mostra. Da applicare: se l'altra mano è libera o ha un'arma a una mano, +1 danno all'attacco. |

## 2. Onde (Scariche) delle armi

Il costo è il numero di Scariche da spendere; ogni onda si può usare una volta per attacco (da confermare).

| Effetto | Costo | Armi | Stato | Note |
|---|---|---|---|---|
| +1 danno | 1–3 | Bastone del mago (2), Balestra (2), Spada (2), Daga (2), Arco (3), Sacrificio (2), Ascia (1), Spada di luce (1), Arco grande (2), Spada d'osso (1), Martello di Dente di Drago (1), Bomba di fuoco dei Nani (1), Placare (2), Bastone del castigo (1) | ⬜ | Si somma al danno dell'attacco. |
| +1 gittata | 1–3 | Bastone del mago (2), Balestra (3), Arco (2), Sacrificio (2), Arco grande (1), Bomba di fuoco dei Nani (2), Bastone del castigo (1) | ⬜ | Serve la gittata degli attacchi a distanza e di magia. |
| Perforare N | 1–2 | Spada di luce (N=10, costo 2), Cristallizzare (N=2, costo 1) | ⬜ | Vedi "Parola chiave: Perforare". |
| Esplosione 1 | 2 | Flagello, Tempesta di ghiaccio, Tempesta di fiamme | ⬜ | Il danno si propaga alle caselle adiacenti al bersaglio. Regole da definire. |
| Raddoppia il danno | 2 | Divoratrice di anime | ⬜ | Raddoppia il danno inflitto dall'attacco, dopo i bonus. Ordine con Perforare e armatura da stabilire. |
| Uccisione istantanea | 3 | Tocco della morte | ⬜ | Uccide il bersaglio ignorando l'abilità "Immortale" (da definire fra gli stati dei mostri). |

## 3. Parole chiave

| Parola | Testo | Dove | Stato | Note |
|---|---|---|---|---|
| Perforare N | Il danno ignora N punti di armatura del bersaglio | Arco (1), Arco grande (2), Martello di Dente di Drago (2), Spada di luce (10, a onde), Cristallizzare (2, a onde) | ⬜ | Come il Perforare del regolamento di riferimento: riduce l'armatura prima del calcolo del danno. |
| Immortale | Il bersaglio non muore normalmente | Mostri (non ancora nel gioco) | ⬜ | Serve per il Tocco della morte. |

## 4. Abilità attive degli oggetti

| Abilità | Testo | Oggetto | Stato | Note |
|---|---|---|---|---|
| Cura minore | Spendi 1 punto movimento e 1 segnalino fatica per curare 1 ferita a te stesso. Si può usare più volte pagando il costo ogni volta | Cura minore (runa) | ⬜ | Come la cura a fatica qui sotto, ma costa anche 1 punto movimento. Azione del bottone contestuale. |
| Rigenerazione | Se è equipaggiato all'inizio del tuo turno, scartalo per recuperare 6 ferite e la fatica fino al massimo | Cristallo di Tival | ⬜ | L'oggetto si scarta all'uso. Si può usare solo con `pointsUsed = 0` (inizio turno). Non richiede il combattimento: può essere la prima attiva da costruire. |
| Stordire sul bersaglio | Se hai inflitto almeno 1 ferita (dopo l'armatura), piazza 1 segnalino stordito sul bersaglio | Placare | ⬜ | Dipende dagli stati (sezione 5) e dal danno. |
| Amuleto della guarigione | Se è equipaggiato all'inizio del tuo turno, scartalo per recuperare tutti i punti ferita e la fatica | Amuleto della guarigione | ⬜ | Come il Cristallo di Tival, ma cura tutto. |
| Lampada magica | Come sopra, ma cura 8 ferite e la fatica a te e agli eroi adiacenti | Lampada magica | ⬜ | Come il Cristallo di Tival, esteso agli adiacenti. |
| Cura maggiore | Spendi 1 punto movimento e 1 fatica per curare 2 ferite a te o a un modello adiacente | Cura maggiore (runa) | ⬜ | Come la Cura minore, ma anche su un adiacente. |
| Flauto del riposo | Scarta al termine del tuo turno per piazzare 1 stordito su ogni mostro entro 6 spazi | Flauto del riposo | ⬜ | Dipende dagli stati e dai mostri. |
| Cura a fatica | Spendi 1 fatica per curare 1 ferita a te stesso. Si può usare più volte pagando il costo ogni volta | Armatura fantasma | ⬜ | Azione del bottone contestuale. Serve la fatica (oggi fuori scope: i punti fatica esistono ma non si spendono). |
| Scudo che si esaurisce | Esaurisci questa carta per annullare N ferite appena ricevute (1 Scudo di ferro, 2 Scudo di Cristallo, 3 Scudo di luce, 4 Scudo del Guerriero). Non annulla le ferite che ignorano l'armatura | Scudo di ferro, Scudo di Cristallo, Scudo di luce, Scudo del Guerriero | ⬜ | Carta con stato "esaurita" (si ricarica a inizio round, da confermare). Serve il flusso del danno ricevuto per poterla usare in risposta. |

## 5. Stati (effetti sull'eroe o sui mostri)

Tutti da definire insieme ai mostri e al combattimento. Compaiono per ora solo nell'immunità della Corazza runica.

| Stato | Note |
|---|---|
| Aura | Da definire. |
| Bruciare | Danno nel tempo? Da definire. |
| Contraccolpo | Da definire. |
| Paura | Da definire. |
| Presa | Da definire. |
| Ragnatela | Da definire. |
| Stordire | Da definire. Segnalino stordito piazzato dal Placare. |
| Veleno | Da definire. |

## 6. Abilità degli eroi

Una per eroe, a parole (`ability` nella scheda). Oggi sono testi che ho scritto come segnaposto.

| Eroe | Testo | Stato | Note |
|---|---|---|---|
| Anarien (ranger) | Occhio del cacciatore: se non si è mossa in questo turno, il suo primo attacco a distanza ripete un dado a scelta | ⬜ | Serve sapere se si è mossa (`pointsUsed`) e il tiro dei dadi con possibilità di ripetere. |
| Ferdinand (druido) | Pelle di corteccia: quando subisce una ferita, può ridurla di 1 una volta per round | ⬜ | Serve il flusso del danno ricevuto e un contatore "usata in questo round". |

## 7. Carte evento dei mazzi

| Carta | Testo | Mazzo | Stato | Note |
|---|---|---|---|---|
| Tesoro nascosto (x5) | Ricevi 50 monete e pesca un'altra carta da questo mazzo | Rame | ✅ | `instant: { coins: 50, draw: 1 }`: non entra nell'inventario, dà le monete a chi la pesca e fa pescare ancora (negli scrigni e nel negozio). |
| Tesoro nascosto (x3) | Ricevi 50 monete e una pozione di cura, poi pesca un'altra carta | Argento | ✅ | `instant` con `potion: 'heal'`. Se l'eroe porta già 3 pozioni, la pozione si perde. |
| Tesoro nascosto (x2) | Ricevi 150 monete e una pozione di vitalità, poi pesca un'altra carta | Oro | ✅ | `instant` con `potion: 'vital'`. |

## 8. Capacità da costruire prima delle abilità

Mattoni comuni a quasi tutto quanto sopra, in ordine consigliato:
1. Tiro dei dadi d'attacco e delle facce (colori: rosso, verde, blu, giallo, bianco) e Scariche.
2. Danno ricevuto: armatura, ferite che la ignorano, riduzioni.
3. Gittata e linea di vista degli attacchi (la visuale esiste già in `board/sight.ts`).
4. Stati sul bersaglio e sull'eroe, con durata.
5. Fatica spendibile.
6. Carte che si esauriscono e si ricaricano.

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
| Parare, Deviare frecce, Forza di volontà | Comb./Sott./Magia | `stat` armor `vs` tipo | danno ricevuto con il tipo di attacco | ⬜ |
| Possente, Fuoco interiore, Tiro preciso | Comb./Magia/Sott. | `attack` danno/gittata | combattimento (danno, gittata) | ⬜ |
| Maestro d'armi, Maestro arciere, Prodigio | Comb./Sott./Magia | `attack` onde bonus | tiro dei dadi e onde | ⬜ |
| Implacabile, Grido di battaglia | Combattimento | `trigger` su `chooseAction`, recupera fatica | fatica spendibile e recuperabile | ⬜ |
| Abile guerriero, Cavaliere | Combattimento | `trigger` su `chooseAction`, costo fatica, attacchi extra | fatica; il budget di attacchi (`attackBudget`) c'è già | ⬜ |
| Irremovibile | Combattimento | `trigger` su `chooseAction` (Combattere) | ordine di Stare in guardia (fuori scope) e armatura temporanea | ⬜ |
| Fendente, Sangue vampirico | Comb./Magia | `trigger` su `kill` | morte dei mostri, fatica | ⬜ |
| Incantesimo veloce, Tiro rapido | Magia/Sotterfugio | `trigger` su `attackDone`, attacco extra con la stessa arma | attacchi, fatica; "esaurire" la carta | ⬜ |
| Vigilanza | Sotterfugio | `trigger` su `enemyEntersAdjacent` | turno dell'Overlord con movimento dei mostri; attacco fuori turno | ⬜ |
| Giustizia divina | Magia | `trigger` su `death` | morte degli eroi, mostri "senza nome" e Immortale | ⬜ |
| Telecinesi | Magia | `active` (1 fatica, ripetibile) | fatica; muovere un mostro entro la vista | ⬜ |
| Ambidestro | Sotterfugio | `rule` supportDamage e shieldBlock | bonus di supporto (🟡 sezione 1) e scudi (sezione 4) | ⬜ |
| Tiratore scelto, Precisione | Sotterfugio | `rule` sulla linea di vista dell'attacco | attacchi a distanza (la vista c'è, `board/sight.ts`) | ⬜ |
| Acrobata | Sotterfugio | `rule` passThrough | movimento: oggi roccia/acqua/buca/creature bloccano; serve una "via libera" per questa abilità | ⬜ |
| Prudente | Sotterfugio | `rule` minaccia −1 e ferite delle trappole −1 | Minaccia dell'Overlord e carte Trappola (fuori scope) | ⬜ |
| Aura sacra, Benedizione, Talento naturale | Magia | `grant` Aura / Comando / Stregoneria 1 | le tre parole chiave sono da definire (sezione 5) | ⬜ |
| Boggs il Ratto, Mata e Kata | Magia | `familiar` | famigli (fuori scope) | ⬜ |

**Parole nuove da definire** (compaiono solo qui): Aura, Comando e Stregoneria (parole chiave), Stare in guardia (ordine), carta Trappola, famiglio, modello "senza nome".
**Coincidenze con gli eroi**: l'`ability` di ogni scheda eroe (sezione 6) può diventare una carta con lo stesso formato; le abilità iniziali dei rami (`skills`) diventeranno le carte che l'eroe possiede all'inizio.

### Prossimo passo suggerito
Le carte sono già nella pedina (`skillCards`) e il catalogo è caricato in `state.skills`. Resta da costruire `effectsOf` con i soli `stat`: le quattro carte ✅ (Resistente, Supportare, Esperto, Veloce) si attiverebbero subito, e il resto del motore c'è già.
