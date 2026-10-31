# Abilità dei personaggi di descent

L'elenco qui sotto è quello originale. Dopo l'elenco c'è l'analisi (per difficoltà di realizzazione), le assegnazioni decise e l'ordine di lavoro.
- quando esegue attacchi magici ottiene +2 danni.
- il costo di punti minaccia per giocare carte del Signore supremo aumenta di 1.
- ottieni il famiglio x.
- all'inizio del turno ripristina 1 punto fatica.
- ottieni +2 danni contro un nemico che non aveva linea di vista all'inzio del turno.
- costringi chi attacca a rilanciare 1 dado verde, 1 giallo o 1 nero di tua scelta. Non puoi usare questa abilità se stavi schivando o se sei soggetto ad un attacco mirato.
- attivi i glifi fino a 6 caselle di distanza da loro.
- ottieni 2 onde di potere per ogni tiro.
- puoi rilanciare 1 dado verde, 1 giallo o 1 nero di tua scelta quando attacchi. Non puoi fare questo se stavi mirando o se il bersaglio sta schivando.
- all'inizio del turno puoi spendere 1 fatica per ricaricare 1 ferita o viceversa.
- quando esegui attacchi magici ottieni Perforare 2.
- puoi equipaggiare delle rune anche con un'armatura che ti impedirebbe di farlo.
- hai una mano in meno. Puoi eseguire un attacco in mischia bonus lanciando 1 dado rosso e 1 verde in aggiunta alla normale azione.
- puoi effetturare un singolo attacco in mischia quando usi l'azione di correre. La corsa deve essere in linea retta e l'attacco deve essere effettuato alla fine della corsa.
- all'inzio del tuo turno recuperi 1 ferita. Sei inoltre immune al veleno.
- ripristini 1 punto fatica ogni volta che vieni ferito.
- quando spendi fatica per aggiungere dadi potere ad un attacco aggiungi 2 dadi ogni volta, con il limite di 5 per attacco.
- dopo aver scelto di prepararsi e ricevuto un ordine, in qualsiasi momento si possono spendere 2 fatiche per cambiare l'ordine con uno diverso.

---

# Analisi per complessità

Come si leggono i livelli: una scheda eroe può già portare degli `effects` (come Anarien con il rilancio). "Gratis" vuol dire che bastano i dati nella scheda, senza codice nuovo.

## Livello 0 — gratis, solo dati nella scheda
| Abilità | Perché è gratis |
|---|---|
| +2 danni negli attacchi magici | Effetto `attack` con `on: magic` e `damage: 2`, come l'Anello dell'arcano. |
| 2 onde di potere per ogni tiro | Effetto `attack` con `surges: 2`, come le onde bonus del Bastone del fuoco. |
| Immune al veleno (metà di "recuperi 1 ferita a inizio turno") | Esiste già la regola `immune`, come la Corazza runica. |

## Livello 1 — poche righe di codice
| Abilità | Cosa serve |
|---|---|
| +1 fatica a inizio turno | Una riga in `startRound` (`state/actions.ts`), in una regola nuova. |
| +1 ferita a inizio turno (con l'immunità al veleno) | Lo stesso punto di `startRound`. |
| 2 dadi potere per ogni fatica (massimo 5) | Cambiare `addPowerDie`, che oggi ne aggiunge 1 per volta; il limite di 5 c'è già. |
| Perforare 2 sugli attacchi magici | Oggi il Perforare viene solo dalle armi: va aggiunto un campo `pierce` agli effetti `attack` e letto in `combat.ts`. |
| Rune anche con un'armatura che le vieta | Una regola in `conflictsWith` (`items/item.ts`), che oggi blocca sempre l'etichetta "runa". |

## Livello 2 — piccolo o medio, un'estensione di ciò che esiste
| Abilità | Cosa serve |
|---|---|
| +1 fatica quando vieni ferito | Un evento "ferito" (c'è un modello simile: Sangue vampirico dà fatica quando si uccide; e le reazioni alle ferite in `state/reactions.ts`). |
| Cambiare l'ordine di Prepararsi pagando 2 fatica, in qualsiasi momento | `placeOrder` esiste. Serve un'azione "cambia ordine" (costo 2 fatica, ordine diverso da quello attuale) con il suo bottone; la parte difficile è "in qualsiasi momento" (vedi sotto). |
| Rilanciare 1 dado verde, giallo o nero quando attacchi | Estendere il rilancio (`state/reroll.ts`) con un filtro per colore e le due eccezioni (se stavi mirando, se il bersaglio schiva). |
| Costo in Minaccia +1 per le carte del Signore supremo | Una regola che somma 1 al costo in tre punti di `state/overlord-deck.ts`, più l'indicazione nell'interfaccia. |
| A inizio turno: 1 fatica per 1 ferita, o viceversa | Il tasto "Usa" a inizio turno c'è per gli oggetti (`state/item-use.ts`); va esteso alle schede degli eroi, e "pagare con una ferita" è un costo nuovo. |

## Livello 3 — medio-alto, serve stato o regole nuove
| Abilità | Cosa serve |
|---|---|
| +2 danni contro chi non vedevi a inizio turno | Ricordare chi era visibile a inizio turno (e salvarlo nel salvataggio); i bonus d'attacco oggi non sanno chi è il bersaglio (`attackBonus`). |
| Chi ti attacca deve rilanciare 1 dado | Si appoggia al selettore dei dadi della Schivata (`app-dice-picker`), con i colori e le due eccezioni. |
| Attivi i glifi fino a 6 caselle | Cambiare l'attivazione dei glifi, che oggi scatta solo passandoci sopra: vanno decisi visibilità, onda di accensione e Conquista. |
| Una mano in meno + attacco bonus in mischia (1 dado rosso e 1 verde) | Le mani sono una costante (2) uguale per tutti: dovrebbero dipendere dall'eroe, anche nel negozio. L'attacco bonus ha dadi fissi e non è legato a un'arma. |
| Attacco in mischia dopo una corsa in linea retta | Correre oggi dà 0 attacchi: bisogna tenere il percorso e controllare che sia dritto. |

## Livello 4 — grande
| Abilità | Cosa serve |
|---|---|
| Ottieni il famiglio x | I famigli non esistono ancora (livello 5 di `abilities.md`): una pedina sulla mappa, regole e interfaccia. |

---

# Assegnazioni decise

Non si inserisce un'abilità se non c'è un PG a cui darla: quelle senza padrone restano parcheggiate più sotto.

| Eroe | Abilità primaria | Livello | Note |
|---|---|---|---|
| **Najim** (guerriero) | All'inizio del turno ripristina 1 punto fatica | 1 | La più semplice. Il Riposo già riporta la fatica al massimo: i due effetti non si pestano i piedi. |
| **Krag** (barbaro) | Ripristini 1 punto fatica ogni volta che vieni ferito | 2 | Serve l'evento "ferito". Da decidere: una volta per attacco subito (consigliato) o una per ferita; e se vale per ogni fonte (attacchi, fiamma, buche). Mai oltre il massimo. |
| **Anarien** (ranger) | Dopo aver scelto di prepararsi e ricevuto un ordine, spendi 2 fatica per cambiarlo con uno diverso, in qualsiasi momento | 2–3 | Sostituisce Occhio del cacciatore. "In qualsiasi momento" va definito (vedi sotto). |
| **Gjöffrid** (ladro) | +2 danni contro un nemico che non aveva linea di vista all'inizio del turno | 3 | Da decidere: la vista è la sua (consigliato) o quella di tutti gli eroi; e quando comincia "il suo turno", visto che gli eroi giocano in ordine libero (consigliato: la vista di Gjöffrid a inizio round). Vale per tutti gli attacchi (mischia, distanza, magia)? |
| **Emeraldine** (druida draconide) | Ottieni il famiglio x | 4 | Si fa per ultima: i famigli non esistono ancora e non è stato scelto quale. Intanto resta "Pelle di corteccia" (copia di Ferdinand) per non lasciarla senza. |

**Scheda di Emeraldine da cambiare**: dadi di attacco 1 mischia, 0 distanza, 2 magia (la somma è 3); abilità iniziali 1 Combattimento, 2 Magia (somma 3); armatura 2 (draconide dalla pelle dura). Ferite, fatica, velocità e Valore restano come sono per ora.

**"In qualsiasi momento" per Anarien**: tre livelli di ambizione.
1. *Nel suo turno*: il cambio è un tasto vicino all'ordine. Facile.
2. *Anche nel turno del Signore supremo, prima che un mostro agisca*: serve un tasto sempre disponibile (non solo nel turno degli eroi).
3. *Anche dentro l'attacco di un mostro, prima del tiro*: è il caso utile (passare a Schivata quando sta per essere colpita) ma tocca la finestra dell'attacco, che oggi non lascia scelte al difensore.
Consigliato: cominciare dal livello 2 e valutare il 3 dopo averla provata.

---

# Ordine di lavoro
1. **Scheda di Emeraldine** (dadi, abilità, armatura): solo dati.
2. **Najim**: +1 fatica a inizio turno (livello 1).
3. **Krag**: l'evento "ferito" (livello 2). Una volta fatto serve anche ad altre abilità.
4. **Anarien**: cambio dell'ordine (livello 2–3).
5. **Gjöffrid**: vista a inizio turno e bonus contro chi non si vedeva (livello 3).
6. **Emeraldine**: i famigli, un progetto a parte. Prima va deciso chi è il famiglio x.

Per ogni abilità vanno aggiunti anche: il testo `ability` (in italiano) nella scheda, gli `effects` se servono, le traduzioni del testo in `it.json` ed `en.json` (la chiave la dà `catalogKey`, come per le altre abilità) e una riga in `abilities.md`, sezione 6.

# Parcheggiate (nessun PG per ora)
Restano nel file, da riservare ai prossimi eroi:
- Livello 0: +2 danni magici, 2 onde di potere per ogni tiro.
- Livello 1: 2 dadi potere per fatica, Perforare 2 in magia, rune con armatura, +1 ferita a inizio turno con immunità al veleno.
- Livello 2: rilancio di un dado colorato, costo Minaccia +1, scambio fatica/ferita a inizio turno.
- Livello 3: l'attaccante rilancia, glifi a 6 caselle, una mano in meno con attacco bonus, attacco dopo la corsa.
Per gli eroi di magia (Perforare, rune, glifi) manca ancora un eroe con dadi di magia.


---

# Stato (decisioni prese e fatto)
- Krag: una volta per attacco subito che toglie ferite, di qualunque tipo; non vale per fiamma, buche o trappole. ✅
- Anarien: il cambio d'ordine vale anche durante il combattimento (si propone prima di ogni attacco di un mostro contro di lei, e dal tab); da rivedere provandolo. ✅
- Gjöffrid: conta la sua linea di vista a inizio round, per ogni tipo di attacco. ✅
- Najim: +1 fatica a inizio round. ✅
- Emeraldine: famiglio Francor (sistema dei famigli fatto, vedi REGOLE.md 2g; restano velocità e abilità definitive, immagine); scheda cambiata (dadi 1-0-2, abilità 1 Combattimento e 2 Magia, armatura 2); il Valore resta 3, giustificato dal famiglio. ✅ (il famiglio resta da fare)
