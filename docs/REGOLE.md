# Regolamento di CADungeon (v1)

Questo file è la **fonte vincolante delle regole di gioco**.
Il PDF in `docs/riferimenti/` è solo ispirazione: dove i due non coincidono, vale questo file.
I numeri segnati *(da bilanciare)* sono valori di partenza, non decisioni definitive.

## 0. Principi

- **Ispirato** alla 1ª edizione di Descent, con elementi della 2ª e meccaniche nostre. Non è una copia: nomi, testi, mostri e avventure sono del mondo di Duels.
- **Poca aleatorietà**: l'armatura è fissa e il caso non deve mai dominare la tattica.
- **Due sistemi, due momenti**:
  - ⚔️ **combattimento** = pool di dadi a simboli;
  - 🧭 **esplorazione e ambiente** = d20 + caratteristica.
- L'**Overlord è un ruolo**, non una persona: le stesse regole valgono se lo gioca un umano o lo script.
- **Il risultato di ogni tiro lo decide l'host**; il dado 3D (dice-box) mostra soltanto il risultato.

## 0b. Inizio della partita

Ogni avventura si presenta con lo stesso iter (`state/setup.ts`), prima del primo round e con la mappa ancora vuota (senza eroi, mostri e oggetti rivelati):
1. **Introduzione** (`title` e `intro` nel file della mappa): una dialog con un testo anche lungo. Non si chiude finché non confermano la lettura **tutti i giocatori** e il **Signore supremo se è umano** (oggi, con un solo schermo, basta una conferma).
2. **Obiettivo** (`objective.description`, o il testo breve `objective.text`): stessa dialog, stessa conferma. Dopo si rilegge sempre dal tasto "Obiettivo" in alto (con più obiettivi, in futuro, mostrerà anche i progressi).
3. **Area di partenza**: si illuminano le caselle di `start` (senza, quelle sopra e accanto al glifo iniziale acceso) e ogni eroe ne sceglie una. Se due eroi scelgono la stessa, chi arriva dopo viene messo a caso in una casella libera vicina (preferendo quelle dell'area di partenza). Fatto, comincia il primo round.
Un'avventura senza `intro` e senza `start` (le mappe di prova) parte subito, come prima.

## 1. Round

1. **Turno degli eroi**: gli eroi agiscono in un ordine scelto liberamente a ogni round. Ogni eroe esegue **una sola azione** (sezione 2) e poi passa.
2. **Turno dell'Overlord** (sezione 9).
3. **Fine round**: punti movimento ripristinati, effetti di fine round risolti.

## 2. Azioni degli eroi

| Azione | Effetto |
|---|---|
| 🏃 **Correre** | Movimento fino al **doppio** della velocità. Nessun attacco |
| ⚔️ **Combattere** | **Due attacchi**, nessun movimento |
| 🚶 **Avanzare** | Movimento fino alla velocità **e** un attacco, in qualunque ordine |

**Come funzionano.** Ogni eroe ha due scorte per turno: punti movimento e attacchi. Si ricaricano tutte a ogni turno.

| Comando | Punti movimento | Attacchi |
|---|---|---|
| **Avanzare** (default, nessun comando) | velocità | 1 |
| **Correre** | velocità × 2 | 0 |
| **Combattere** | 0 | 2 |

- Correre e Combattere sono comandi espliciti dell'interfaccia: ciascuno annulla l'altro. Rifare lo stesso comando riporta ad Avanzare.
- Il cambio è permesso solo se la risorsa che verrebbe azzerata non è stata toccata: non si corre dopo aver attaccato, non si combatte dopo aver speso punti movimento. Altrimenti il comando è negato, con il motivo.
- L'eroe ha finito quando ha esaurito sia punti movimento sia attacchi, oppure passa.

- **Riposo** (tasto Q, un comando come Correre e Combattere): si sceglie prima di muoversi e attaccare e toglie ogni movimento e ogni attacco; **all'inizio del round dopo** la fatica torna al massimo, a meno che l'eroe non abbia subìto ferite nel frattempo. Rifare il comando riporta ad Avanzare.
- Aprire porte e scrigni, scassinare e saltare consumano punti movimento come già implementato.

## 2b. Fatica

Ogni eroe ha **segnalini fatica** (il valore della scheda più i bonus delle abilità, come Esperto: +2); si parte dal massimo. Si spendono in due modi:
- **Per il movimento**: 1 fatica = **1 punto movimento in più**, in qualunque momento del turno, anche scegliendo Combattere, quante volte si vuole (si tocca il valore della fatica nel tab dell'eroe attivo).
- **Per gli attacchi**: dopo il tiro, 1 fatica = **un dado potere in più** (uno alla volta, anche più volte), fino a **5 dadi potere** in un attacco. La fatica si spende subito e il dado non si può annullare.

Si recupera con il **Riposo** (vedi sopra) e con la **pozione di vitalità**; quando un eroe muore riparte con la fatica al massimo. Altre carte (Cristallo di Tival, Lampada magica, Amuleto della guarigione) e abilità (Implacabile, Grido di battaglia, Sangue vampirico) la recuperano quando saranno attive.

## 2c. Stati e parole chiave

Gli stati (`docs/cards/stati.md`, le decisioni sono lì) sono conti di segnalini sulla pedina: **Fiamma**, **Rete** (Ragnatela), **Stordimento** e **Veleno**. Si piazzano con un attacco che ha l'abilità, se il bersaglio non è immune; i segnalini si sommano senza limite.
- **Fiamma** (Bruciare): se l'attacco infligge almeno 1 danno prima dell'armatura. All'inizio del turno della creatura si tira un dado potere per segnalino, ogni **Scarica** ne toglie uno; per ogni segnalino rimasto 1 ferita che l'armatura non riduce.
- **Rete** (Ragnatela): stesso piazzamento; stesso tiro a inizio turno; se ne restano la creatura **non ha punti movimento** in quel turno (può attaccare).
- **Stordimento** (Stordire): se l'attacco infligge almeno 1 ferita dopo l'armatura (come Placare e Pietrificare); a inizio turno si toglie **un** segnalino e la creatura è **stordita**: un eroe può solo muoversi o attaccare (non fare entrambe), un mostro normale perde il turno, uno potenziato può muoversi oppure attaccare. I mostri unici (con un nome) sono immuni.
- **Veleno**: le ferite perse per un attacco velenoso diventano altrettanti segnalini veleno, mostrati come **cuori verdi** accanto a quelli delle ferite (ogni quarto è un segnalino). Chi guarisce toglie prima il veleno (1 per ferita curata) e poi recupera ferite. Non fa danni.
- **Aura**: chi entra in una casella adiacente a una creatura con Aura subisce 1 ferita che l'armatura non riduce, ogni volta (anche passando).
- **Paura N**: chi attacca una creatura con Paura paga N Scariche (perse); se non ne ha abbastanza, l'attacco fallisce.
- **Presa**: una creatura adiacente a un nemico con Presa non può spendere punti movimento.
- **Immortale**: quando un mostro Immortale sta per morire si tira un dado potere: con una Scarica si rialza a salute massima (meno i danni in più del colpo).
- **Immunità**: una creatura immune non riceve lo stato (ma subisce il danno). L'immunità si scrive nel testo di un oggetto, di una carta o di un mostro ("Sei immune a Presa e Tramortire", "Immune a Veleno"): il gioco la legge da solo (`immunitiesIn`). Per gli eroi viene da oggetti e carte (la Corazza runica è immune a tutto); per i mostri dal campo `immune`.
- **Morte e città**: alla morte gli stati si tolgono; in città restano.
- Gli stati si risolvono all'inizio del turno: per gli eroi all'inizio del round, uno alla volta con i dadi potere; per i mostri quando vengono attivati.
Parole chiave dei mostri e delle armi (come il manuale, finché non diciamo altro):
- **Volo**: si muove attraverso i personaggi nemici (non può fermarsi su una creatura).
- **Raggiungimento**: la mischia arriva anche a distanza 2 (con la vista).
- **Colpo veloce** (Attacco veloce): un mostro attacca fino a 2 volte quando è attivato.
- **Spazzata**: l'attacco in mischia colpisce anche tutti gli altri nemici adiacenti a chi attacca, con lo stesso tiro e danno pieno (l'armatura di ognuno si sottrae a parte).
- **Esplosione N**: l'attacco colpisce anche tutto ciò che sta entro N spazi dal bersaglio e lo vede (le creature non bloccano), amici e chi attacca compresi; le onde "Esplosione 1" ne aggiungono.
- **Soffio**: un cono di 3 caselle davanti a chi attacca (1, 3 e 5 caselle per un mostro di una casella; si allarga di una per lato) colpisce tutti, amici compresi; ignora la gittata e fallisce solo con un Mancato. Lo script sceglie la direzione che colpisce più eroi e meno mostri. (La sagoma del manuale non è nel PDF: la forma del cono è una nostra scelta.)
- **Stregoneria N**: dopo il tiro si aggiungono N punti alla gittata o al danno (a scelta, ripartibili); lo script porta la gittata fino alla distanza e mette il resto sul danno.
- **Comando**: ogni creatura amica con Comando entro 3 spazi (anche l'attaccante) dà +1 danno e +1 gittata a un attacco; si sommano.
Contraccolpo è attivo (sezione 2d).

## 2d. Abilità da usare e Contraccolpo

- Le carte abilità con un effetto opzionale si usano dal bottone sulla loro card nella scheda dell'eroe (vedi `docs/cards/abilities.md`, "Abilità da usare"): "quando scegli Avanzare/Combattere" valgono prima di muoversi e attaccare e una volta per turno; "dopo un attacco" servono un attacco appena fatto e danno un attacco in più con la stessa arma; costano fatica e a volte esauriscono la carta fino al round dopo.
- **Contraccolpo**: se un attacco con questa abilità infligge almeno 1 danno prima dell'armatura, chi attacca può spostare il bersaglio fino a **3 spazi** (meno uno per ogni casella oltre la prima che occupa: la Salamandra di fuoco di 2 spazi, l'Ogre e il Drago per niente; la sagoma si sposta intera), in una casella libera, ignorando creature e ostacoli lungo il percorso ma non muri e porte chiuse. L'Aura e la buca valgono solo dove arriva. Un eroe sceglie la casella (evidenziata) oppure resta fermo; lo script dell'Overlord sceglie la più lontana da sé.

- **Ripetere dadi a scelta** (`state/reroll.ts`): alcune abilità permettono, dopo il tiro, di ripetere dei dadi a scelta (resta il secondo risultato). **Occhio del cacciatore** (Anarien): se non ha speso punti movimento in questo turno, il suo primo attacco a distanza del round ripete un dado a scelta. Il tasto compare accanto a ogni dado nella finestra d'attacco.
- **Reazioni alle ferite** (docs/cards/abilities.md, livello 2): quando un attacco sta per togliere ferite a un eroe, prima possono annullarne alcune: i **Mantelli** (un dado potere per ogni ferita, una annullata per faccia vuota o per onda), gli **Scudi** (si esauriscono: annullano 1, 2, 3 o 4 ferite, Ambidestro 1 in più) e abilità come Pelle di corteccia (−1 una volta per round). Gli scudi e le abilità si propongono al giocatore, anche nel turno dell'Overlord. Non valgono per le ferite che ignorano l'armatura (buche, fiamme, trappole) né per l'uccisione istantanea.

## 2e. Obiettivo, bottino e fine della partita

- Ogni avventura ha un **obiettivo** (`objective` nel file della mappa): per ora **sconfiggere una pedina**, di solito il boss. Quando non c'è più sulla mappa (in qualunque modo sia uscita) gli eroi **vincono**; se la Conquista arriva a zero **perdono**. A fine partita compare una schermata con "Ricomincia" e "Guarda la mappa" e i comandi si bloccano.
- Un mostro può avere un **bottino** (`drop` nella pedina, come il contenuto di uno scrigno). Quando esce dalla mappa lo lascia: chiavi, chiavi runiche, Conquista e denaro al gruppo come negli scrigni; un **oggetto** a chi ha dato il colpo fatale se ha posto (equipaggiato o nello zaino), altrimenti, o se il mostro è morto per altre cause (Aura, fiamma...), **cade a terra**: nella sua casella e, se sono più d'uno, nelle caselle libere intorno.
- **Tabella dei ritrovamenti** (`chestTable` nella mappa, come nel gioco originale): per ogni tipo di baule (rame, argento, oro) l'avventura ha fino a 3 ricompense (2 per l'oro), almeno una per ogni baule di quel tipo. Aprendo un baule senza contenuto suo se ne gira il segnalino e si pesca a caso una ricompensa fra quelle non ancora uscite per quel tipo ("Rame 2"): punti Conquista, carte tesoro del mazzo per ogni eroe, denaro e maledizioni. La ricompensa resta fissa per quel baule.
- **Eventi** (`events` e `variables` nella mappa, `state/events.ts`; nati dall'avventura 2 del manuale, I Fratelli Durnog, e pensati come strumento generico per ogni avventura): "quando succede X, se vale Y, fai Z".
  - **Variabili**: interruttori acceso/spento con un nome scelto dall'autore, tutti spenti all'inizio ("Cuore di Munkar trovato", "Munkar è morto"). Gli eventi le accendono e le leggono, e la partita se le ricorda (stanno nel salvataggio).
  - **Quando**: una pedina è sconfitta (scatta prima del bottino e della vittoria), uno scrigno si apre in un'area, gli eroi vedono un'area per la prima volta, **un eroe interagisce con un nemico**, **non c'è più nessun nemico** (di un gruppo scelto, o in un'area) e **un eroe raccoglie un oggetto** a terra.
  - **Più inneschi, una sola volta**: un evento può avere più inneschi ("quando… oppure quando…": basta che ne succeda uno) e la casella "Scatta una sola volta" (dopo il primo scatto non parte più; se le condizioni non valgono, o se l'eroe rinuncia a una Prova rifiutabile, non conta come scatto).
  - **Bersagli degli effetti**: attiva, rimuovi, modifica e chiudi-il-ritorno-in-vita agiscono su uno o più nemici, e su "il nemico dell'evento" (quello sconfitto o con cui si interagisce, anche dentro una Prova). Un effetto senza bersaglio vivo non fa niente (attivare conta solo un nemico ancora inattivo). Un evento fatto solo di messaggi ed effetti con bersaglio, a cui non è rimasto nessun bersaglio, si conclude da solo, senza nemmeno il messaggio: per esempio "Al ladro!" quando le statue sono già tutte sparite. Se l'evento ha anche altri effetti (Conquista, variabili, porte, prove, vittoria) va avanti.
  - **Segnalino Incontro** (`encounter`): un punto della mappa con un'azione e un costo scelti dall'autore ("Suona la campana", costo 0). L'eroe si ferma sulla sua casella e la sceglie dal menu del "!"; il segnalino si vede quando la casella è nella linea di vista e, usato, sparisce. Due "Quando": **un eroe usa un incontro** e **gli incontri scelti non sono più in mappa** (lista e area facoltative; senza, tutti): scatta quando l'ultimo viene usato. Un incontro che nessun evento usa è un errore della Verifica. I mostri possono attraversare la casella ma non fermarsi.
  - **Interagire** (`interact`): sul nemico compare un "?" e l'eroe che gli è adiacente trova la voce "Interagisci" nel menu del "!", al costo scelto dall'autore (di base 1 punto movimento). È monouso: dopo che gli eventi sono scattati il "?" sparisce. Con "solo finché il nemico è inattivo" sparisce anche quando il nemico si attiva. Prende il posto del segnalino Incontro del gioco da tavolo.
  - **Non c'è più nessun nemico** (`cleared`): scatta nel passaggio da "ce n'era almeno uno" a "non ce n'è più" (sconfitti, rimossi da un evento o usciti dall'area), una volta per volta, e mai se all'inizio non ce n'era nessuno. I nemici inattivi e non ancora scoperti contano come presenti.
  - **Raccogliere** (`pickedUp`): gli oggetti a terra (pozioni, denaro, chiavi, chiavi runiche, oggetti del catalogo) non si raccolgono passandoci sopra: l'eroe si ferma nella casella e sceglie "Raccogli" nel menu del "!", a costo zero. Può quindi lasciarli lì, e l'avventura può legarci un evento. Ogni oggetto ha un id (`oggetto-1`…) che l'evento usa per riconoscerlo.
  - **Se**: un elenco di condizioni sulle variabili (acceso / spento), tutte da rispettare. Senza condizioni scatta sempre. Gli effetti sono "allora" e, se le condizioni non valgono, "altrimenti". Gli eventi dello stesso tipo scattano nell'ordine in cui sono scritti e ognuno vede le variabili com'erano dopo quelli prima.
  - **Effetti**: un messaggio (dialog in markdown con "Ho letto", in coda uno alla volta; durante il turno del Signore supremo il turno aspetta), cambiare la Conquista, accendere o spegnere una variabile, modificare una pedina (ferite, velocità, armatura, per il resto della partita; vale anche per chi aspetta di tornare in vita), **fare tornare in vita** la pedina sconfitta, **chiudere un ritorno in vita**, **attivare** un nemico inattivo, **rimuovere** un nemico dalla mappa (senza bottino né eventi "sconfitto"), **aprire una porta evento**, una **Prova con i dadi potere** e vincere l'avventura.
  - **Nemici inattivi** (`inactive`): occupano le loro caselle e bloccano movimento e vista come un ostacolo, ma non giocano il turno del Signore supremo e non si attaccano, finché un evento li attiva. L'**aspetto di pietra** (`stone`) è solo grafica e vale anche per un nemico attivo.
  - **Invincibile e immunità**: un nemico può partire invincibile (`invincible`): ogni ferita che dovrebbe subire è 0, da qualunque fonte, finché un evento lo rende vulnerabile (l'attacco si tira e consuma gli attacchi come sempre, preso o mancato; nello scudo dell'armatura compare ∞). È una cosa diversa dalle immunità agli stati, che sono un elenco (fiamma, rete, stordimento, veleno, aura, paura, presa, contraccolpo e "tutti gli stati"): accendere l'invincibilità aggiunge "tutti gli stati", ma spegnerla non lo toglie. Gli eventi possono togliere l'invincibilità e, a parte, una voce dell'elenco (di solito "tutti gli stati": le immunità specifiche della carta restano).
  - **Porta evento** (`lock: {kind: 'event'}`): nessuno la apre a mano, né eroi né mostri; si apre solo con l'effetto "apri una porta evento".
  - **Prova con i dadi potere** (`check`): l'eroe che ha causato l'evento legge un testo e tira tanti dadi potere quanti sono i suoi dadi in più dell'attacco scelto (mischia, distanza o magia; massimo 8; senza dadi la prova fallisce da sola; la fatica non si spende). Se le onde (la somma dei surge) raggiungono il numero richiesto valgono gli effetti "superata", altrimenti "fallita". Se l'autore l'ha permesso (`refusable`) l'eroe può annullare: non succede niente e l'eventuale costo dell'interazione torna indietro.
  - **Tornare in vita** (`revive`: turni e distanza scelti dall'autore, per Durnog 2 e 8): la pedina esce dalla mappa senza lasciare bottino e senza dare la ricompensa dell'uccisione di un potenziato, e non conta né come viva né come morta (l'obiettivo "sconfiggi" non scatta). Alla fine di ognuno dei turni del Signore supremo successivi (non quello in cui è caduta, se è caduta nel suo turno) perde un turno; a zero riappare a piena salute e senza stati in una casella già scoperta, libera e senza glifo, scrigno o scala, a distanza minima dagli eroi (la sceglie a caso lo script fra quelle valide; se nessuna è abbastanza lontana, una delle più lontane; se non c'è posto riprova al turno dopo).
  - **Chiudere un ritorno in vita** (`finishRevival`): se la pedina sta aspettando, la sua sconfitta si ripete subito con le variabili di adesso (di solito prendendo l'altro ramo, "il cuore è trovato: muore per sempre", con bottino e vittoria); se non aspetta non fa niente.
  - **Vittoria da un evento**: l'obiettivo `{kind: 'event'}` non ha una condizione propria; vince l'effetto `win`, che mostra la conclusione e somma i punti dell'obiettivo.
- **Maledizioni** (manuale): all'apertura di un baule si risolvono per prime. Per ogni Maledizione il Signore supremo guadagna tanti segnalini Minaccia quanti sono gli eroi (anche morti o in città). Può spenderli subito: lo script arma, se può pagarla, una trappola da scrigno (la carta della mano più cara) su quel baule, che scatta all'istante (Mimic compreso: il baule resta chiuso e il resto del contenuto è il suo bottino). Solo dopo gli eroi ricevono il resto del contenuto. Le Maledizioni si risolvono una volta sola (vengono tolte dal contenuto) e valgono anche per il bottino di un mostro (`drop`), dove danno solo la Minaccia.
- Un mostro **unico** (`unique`, con un nome) non si stordisce e Giustizia divina non lo uccide.
- Un nemico dell'avventura può essere più (o meno) forte della sua carta (`bonus` sulla pedina: ferite, velocità, armatura e dadi d'attacco in più, che si **sommano** ai valori della carta per il numero di giocatori) e avere abilità in più (`traits`). Gli oggetti del suo bottino che cadono a terra occupano la casella del mostro e poi le caselle libere intorno (su un tile, senza ostacoli, altri oggetti o creature), una per oggetto.

## 2f. Prepararsi e ordini
- Prepararsi è un'azione (tasto E) che si sceglie al posto di Avanzare o Combattere: l'eroe non attacca, può muoversi solo prima di piazzare l'ordine (o-muovi-o-attacca come le altre) e sceglie un ordine: **Mira**, **Schivata** o **Guardia**. Piazzato l'ordine non si cambia più azione. Un eroe ha un solo ordine alla volta.
- **Mira**: nel suo attacco, dopo il tiro, l'eroe ripete i dadi che vuole (anche i mancati) e tiene il secondo risultato. È l'unica ripetizione di quell'attacco (vale anche con Occhio del cacciatore). L'ordine si usa.
- **Schivata**: contro un attacco di un mostro l'eroe sceglie quali dadi dell'attacco far ripetere (una volta per attacco, l'ordine resta fino al suo prossimo turno). Se il mostro fa un attacco mirato, Schivata e Mirare si annullano.
- **Guardia**: nel turno dell'Overlord l'eroe può interrompere un mostro che può colpire con un attacco gratuito (che non consuma i suoi attacchi): dopo un passo del mostro e quando dichiara l'attacco. Se rifiuta non ripensa per quell'attivazione; l'ordine si perde dopo l'uso; se il mostro cade l'attacco dichiarato salta.
- Mira e Guardia si perdono se l'eroe subisce ferite (anche cadendo), si muove spendendo punti o cambia equipaggiamento; Schivata resta. Schivata e Guardia finiscono a inizio round.

## 3. Movimento

Resta com'è nel codice:
- un passo, anche in diagonale, costa 1;
- si passa attraverso gli alleati, i nemici bloccano;
- il movimento si interrompe quando un mostro diventa visibile.

## 3b. Pozioni e inventario

Ogni eroe ha il **suo** set di pozioni (non sono del gruppo). Le chiavi, le chiavi runiche e il denaro restano invece del gruppo.

- Un eroe porta **fino a 3 pozioni** (curative o di vitalità), tutte pronte all'uso: nella v1 non c'è la distinzione fra equipaggiate e zaino del regolamento originale.
- **Raccogliere** una pozione costa **0 punti movimento**: un eroe fermo nella sua casella la prende con l'azione "Raccogli" (passandoci sopra non basta). Se ne porta già 3, la pozione **resta a terra**.
- **Bere** costa **1 punto movimento** (azione contestuale). La curativa ridà **4 ferite** (un cuore intero), senza superare il massimo, e non si beve in piena salute. La pozione di vitalità riporta la **fatica al massimo** (non si beve se è già al massimo).
- **Dare** una pozione a un eroe adiacente (anche in diagonale, senza un muro in mezzo) costa **1 punto movimento** a chi la dà (azione contestuale). Chi riceve deve avere posto: se porta già 3 pozioni, non si può.
- **Pozioni di partenza**: non sono regalate. Nel regolamento originale si comprano in città con le 300 monete iniziali (curativa 50, vitalità 25). Nella v1, senza città, una scheda dice cosa l'eroe ha comprato prima di partire (`potions`, per ora nessuna) e il prezzo si toglie dalle sue monete.
- I mostri non raccolgono pozioni.

## 3c. Equipaggiamento, oggetti e denaro

**Denaro** (personale, non del gruppo)
- Ogni eroe parte con **300 monete** (setup del regolamento) e le usa per comprare l'equipaggiamento iniziale dal negozio della città: il prezzo di ciò che compra si toglie. Nella v1, senza città, gli acquisti sono scritti nella scheda (`items`, `potions`). Esempio: la **Spada** costa 75, quindi si parte con 225 monete.
- Un segnalino Denaro dà **100 monete a ogni eroe**.

**Equipaggiamento** (cosa si può usare)
- **Mani**: oggetti con al massimo **2 simboli mano** in totale (armi e scudi); **1 armatura**; **2 oggetti vari** (né mani né armatura); **3 pozioni** (sezione 3b).
- **Zaino**: fino a **3 oggetti** non equipaggiati. Un oggetto nello zaino non si può usare finché non si equipaggia.

**Azioni sugli oggetti** (costi in punti movimento)
- **Prendere** un oggetto (da uno scrigno o da un compagno): si equipaggia da solo se c'è posto, altrimenti va nello zaino se c'è posto, altrimenti non si può.
- **Ri-equipaggiarsi**: equipaggiare un oggetto dello zaino, o metterne uno equipaggiato nello zaino, costa **2**. Equipaggiando un oggetto senza posto, chi lo occupa va nello zaino (ci deve essere posto per tutti).
- **Scartare** un oggetto (equipaggiato o nello zaino) costa **0** e l'oggetto è perso.
- **Dare** un oggetto a un eroe adiacente costa **1**; chi lo riceve lo equipaggia se ha posto o lo mette nello zaino, e se non ha posto non si può.

**Carta oggetto** (un elemento di `public/items/catalog.json`, che li contiene tutti; con `"hide": true` l'oggetto resta nel file ma non viene caricato, come se non esistesse): nome, tipo (arma, scudo, armatura, altro), etichette (`tags`, per esempio `rune`), tipo di attacco per le armi, mani, armatura, prezzo, dadi (per colore: rosso, verde, blu, giallo, bianco), effetti a Scariche ("onde" nelle carte), bonus della mano secondaria, `rules` (regole a parole: parole chiave come "Perforare 1", limiti, abilità da attivare; per ora solo testo) e, se è un tesoro, il mazzo (rame, argento, oro). Il negozio è un file a parte (`public/shops/<id>.json`, `stock`: le copie di ogni oggetto in vendita). Dadi ed effetti restano dati finché non c'è il combattimento: la **Spada** è un'arma a una mano per la mischia, 75 monete, con un dado rosso e uno verde e due abilità: "2 Scariche: +1 danno" e "Bonus di supporto: +1 danno". Il campo `text` non c'è più: le descrizioni stanno in `rules`.

**Reliquie**: oggetti del catalogo con l'etichetta `relic` (sottotitolo "Reliquia"), senza prezzo e senza mazzo: ci sono solo nelle avventure che le prevedono, a terra (segnalino `item`) o dentro uno scrigno (`contents` con `kind: "item"`). Non si vendono. Un dado che compare più volte nella carta ("2 verdi") si scrive ripetuto in `dice` e si mostra ripetuto.

**Effetti passivi degli oggetti** (già in gioco, senza combattimento): un oggetto equipaggiato somma la sua `armor` a quella dell'eroe; `speedCap` limita la velocità (la cotta di maglia la porta a 4, e vale dal round dopo che la si indossa); `forbidsTags` impedisce di equipaggiare insieme oggetti con certe etichette, in tutti e due i sensi (la cotta di maglia vieta `rune`: con la cotta indosso non si equipaggia una Runa, e con una Runa indosso non si equipaggia la cotta; nello zaino si può portare). Gli oggetti con l'etichetta `rune` mostrano "Runa" nel sottotitolo. Il testo in `rules` resta solo per la card.

**Scrigni e tesori**
- Aprire uno scrigno dà, oltre ai premi scritti dall'avventura (`contents`), un **tesoro casuale**: **ogni eroe pesca una carta** dal mazzo del tipo dello scrigno (rame, argento, oro). Una carta pescata non torna e un mazzo finito non si rimescola.
- Chi pesca la riceve come in "Prendere"; se non ha posto la **scarta subito per monete**: 250 (rame), 500 (argento), 750 (oro).
- Chi crea l'avventura può togliere il tesoro casuale di uno scrigno (`random: false`).
- I tre mazzi sono formati dalle carte del catalogo con `deck` (rame, argento, oro), ognuna ripetuta per le sue `copies`. Oggi ci sono tutti e tre: rame (17 carte diverse, 23 in tutto), argento (15 carte diverse, 17 in tutto) e oro (14 carte diverse, 15 in tutto: ne ho nascoste due, Armatura dorata e Cotta di Squame di Drago, con il campo `hide`, perché citano effetti delle espansioni). L'estrazione la decide lo stato (l'host). Una carta evento (`instant`, come "Tesoro nascosto": monete, a volte una pozione, e si pesca ancora) non si tiene: ha effetto subito, anche se comprata nel negozio.

## 3d. La città

**Andare in città**
- Un eroe che si trova su un **glifo acceso** può **viaggiare in città**: spende **tutto il suo movimento** (minimo 1). Nel regolamento originale costa 1 punto e gli acquisti altri 3 (il minimo di movimento di un eroe è 4): la nostra regola equivale a spendere tutto.
- In città la pedina **non è sulla mappa**: il suo tab dice "In città", non vede (non conta per la linea di vista né per la rivelazione), non blocca e non è adiacente a nessuno sulla mappa. Non combatte.

**Il turno in città**
- Nel turno dell'arrivo l'eroe può scegliere **un solo servizio** (negozio, campo di addestramento o tempio) e farci ciò che vuole (a pagamento); poi **passa il turno** e aspetta che tocchi di nuovo a lui, come se fosse sulla mappa. Se non sceglie nessun servizio, passa lo stesso.
- L'avventura non aspetta i comodi degli eroi: **al turno successivo deve tornare nel dungeon**, anche se non ha visitato niente. I servizi esistono solo nel turno dell'arrivo.

**Tornare**
- Dal turno **successivo** a quello dell'arrivo (si va e si torna una volta per turno) la scelta del glifo parte da sola: l'eroe sceglie un glifo **acceso, già scoperto e senza nessuna pedina sopra**, tra quelli che può pagare. Non si può rimandare: finché non ha scelto non fa altro (se nessun glifo è libero, può solo passare il turno). Tornare sul glifo da cui è partito è **gratis**; scegliere un altro glifo costa **25 monete** (il teletrasporto). Il ritorno non costa movimento: l'eroe riprende il suo turno sulla mappa con tutto il movimento.

**I servizi** (si pagano in monete)
- **Negozio:** pozioni (curativa 50, vitalità 25), **tesori** pescati dai mazzi (si comprano solo dopo che il gruppo ha aperto almeno uno scrigno di quel tipo; rame 250, argento 500, oro 750; se non c'è posto la carta si scarta per le monete del mazzo), **oggetti** del negozio (le scorte sono limitate e comuni a tutti gli eroi) e la **vendita** degli oggetti a metà prezzo, arrotondato per difetto a un multiplo di 25 monete, ma mai meno di 25 (75 → 25, 150 → 75, 25 → 25; l'oggetto torna in vendita).
- **Campo di addestramento:** una **nuova carta abilità** (1000 monete: l'eroe sceglie il ramo, la carta è pescata a caso dal mazzo di quel ramo) oppure **un dado in più** a uno dei tre attacchi (mischia, distanza, magia; 500 monete, fino a **5 dadi**). Le carte abilità sono in `public/skills/catalog.json` (35 carte, una copia ciascuna, tre mazzi: combattimento, sotterfugio, magia); a inizio partita ogni eroe pesca dai mazzi tante carte per ramo quante dice `skills` della sua scheda (le **abilità secondarie**; l'**abilità primaria** è quella stampata sulla scheda). I loro effetti sono ancora solo dati (docs/cards/abilities.md, sezione 9).
- **Tempio:** ripristina la salute (le ferite al massimo) per **100 monete**. Il tempio non c'è nel regolamento: lo abbiamo inventato noi (nel regolamento gli eroi morti tornano in città e sono resuscitati nel tempio).

**Eroe morto**: vedi la sezione 8. Va in città (perde metà del denaro, ferite al massimo) e rientra senza pagare dal round dopo. La fatica al massimo si aggiungerà con la fatica.

## 4. Caratteristiche e prove

> **In pausa.** Le quattro caratteristiche vengono dalla 2ª edizione e per ora non sono nella scheda degli eroi (sezione 10). Le prove d20 qui sotto restano da definire; gli attuali "riesce sempre" (scassinare una porta, saltare una buca) restano finché non si riprende.

Ogni eroe ha **4 caratteristiche**, con valore da **1 a 5**:

| Caratteristica | Copre |
|---|---|
| 💪 **Forza** | sforzo fisico: saltare, spingere, sfondare, arrampicarsi |
| 📚 **Conoscenza** | sapere: rune, glifi, lingue, enigmi, mostri |
| 🔥 **Volontà** | mente: paura, magia ostile, tentazioni |
| 👁️ **Percezione** | sensi e destrezza fine: trappole, scassinare, cercare, nascondersi |

### Parole chiave

Ogni azione dell'ambiente usa una **parola chiave**, collegata a **una** caratteristica.
Nuove parole chiave si aggiungono a questa tabella e restano legate alle 4 caratteristiche.

| Parola chiave | Caratteristica |
|---|---|
| Saltare | Forza |
| Spingere | Forza |
| Sfondare | Forza |
| Scassinare | Percezione |
| Notare trappole | Percezione |
| Cercare | Percezione |
| Leggere rune | Conoscenza |
| Resistere alla paura | Volontà |

### Il tiro

**d20 + caratteristica + specialità ≥ soglia**

- **Specialità**: bonus dell'eroe su una parola chiave precisa (es. il furfante ha *Scassinare +2*). Valore da +1 a +3.
- **Soglie**: 10 facile · 15 media · 20 difficile.
- **20 naturale** riesce sempre, **1 naturale** fallisce sempre.

### Prime prove nel gioco (sostituiscono gli hack attuali)

| Situazione | Costo | Prova | Se fallisce |
|---|---|---|---|
| 🔓 Scassinare una porta | 4 punti movimento | Scassinare, soglia 15 | punti spesi, porta chiusa |
| 🕳️ Saltare una buca | 3 punti movimento | Saltare, soglia 10 | cade nella buca (1 ferita, l'armatura non riduce) |
| 🪤 Notare una trappola | gratuita, quando entra nella vista | Notare trappole, soglia dall'avventura | la trappola resta nascosta |

## 5. Dadi d'attacco

Simboli nostri (i temi dice-box li disegna Gian):

| Simbolo | Significato |
|---|---|
| **Numero** | gittata |
| ❤️ **Cuore** | danno |
| ⚡ **Surge** | attiva un effetto dell'arma |
| ✖️ **Mancato** | l'attacco fallisce del tutto |

- Ogni attacco tira il **dado base** (l'unico con la faccia *Mancato*) più i **dadi extra dell'arma**.
- **Mischia**: il bersaglio deve essere adiacente, la gittata è ignorata.
- **Distanza**: serve linea di vista e **somma delle gittate ≥ distanza** in caselle, altrimenti l'attacco manca.
- **Danno** = cuori totali − armatura del bersaglio (minimo 0).
- Le facce di ogni dado (rosso, blu, bianco, verde, giallo e il nero dei dadi potere) stanno in `docs/dadi-facce.md` e in `public/dice/faces.json` *(da bilanciare)*. Il Mancato c'è solo sui dadi base (rosso, blu, bianco); il dado nero ha una faccia vuota ("nessun bonus"), onde ⚡ e cuori.
- I **dadi extra dell'eroe** (quelli della scheda e del campo di addestramento: per ogni tipo di attacco, fino a 5) sono **dadi potere neri**: si tirano quanti ne indica la scheda per il tipo di attacco che si fa.
- Il **dado potere** (nero) è lo stesso per tutti i partecipanti, eroi e mostri. Sulle facce multivalenti (gittata 1 in basso a sinistra e cuore in alto a destra, divisi da una diagonale) **sceglie chi lo tira** quale dei due valori accettare.
- Non c'è un dado difesa.
- **Ricompensa del colpo fatale** (dal manuale): l'eroe che dà il colpo fatale a un mostro **potenziato** riceve subito **50 monete**, sue (il denaro è personale). Gli altri mostri non danno monete. Il bottino di un mostro (un oggetto che porta, per le avventure) non c'è ancora: i mostri speciali potranno avere un `drop` scritto nell'avventura.
- **Niente attacco a distanza su un adiacente**: un attacco a distanza non si può fare a una creatura adiacente (tendere un arco a chi è vicinissimo non ha senso); vale per eroi e mostri. La magia invece sì, perché ha un'altra natura. L'opzione resta nel menu, spenta, con il motivo "Troppo vicino per un attacco a distanza".
- **Attacchi attraverso le scale** (dal manuale, "Scalinate"; `stairsRoute` in `state/combat.ts`): le scale accorciano la distanza come se i due capi fossero adiacenti. Chi sta su un capo vede e colpisce l'altro capo (distanza **1**) e le caselle accanto a esso (distanza **2**); chi è accanto a un capo (e lo vede) colpisce l'altro capo (distanza **2**). Per la mischia, scelta nostra, solo fra chi sta sui due capi (distanza 1); vale la regola generale che un attacco a distanza non si fa a un adiacente, quindi l'arco fra i due capi non va, la magia sì. La gittata si conta passo per passo (somma di quelle caselle). Vale per eroi e mostri (i mostri non salgono le scale, ma attaccano attraverso). Se si vedono direttamente, l'attacco è quello normale. Per mostrarlo, la camera segue l'attaccante e poi il bersaglio e la linea di tiro ha due tratti. Esplosione, Spazzata e Soffio non passano per le scale.
- **Come si risolve un attacco** (implementato in `src/app/game/state/combat.ts`): l'eroe tocca un nemico e sceglie l'arma (o i pugni); tira i dadi dell'arma più un **dado potere nero** per ogni dado extra della sua scheda per quel tipo di attacco. Se esce un **Mancato** (solo sui dadi base) l'attacco fallisce. Mischia: il nemico deve essere adiacente. Distanza e magia: serve linea di vista e la **somma delle gittate** (dadi e onde) deve arrivare alla distanza in caselle (le diagonali contano 1). **Danno = cuori + bonus (onde, bonus di supporto) − (armatura del bersaglio − Perforare)**, minimo 0. Le **Scariche** ottenute (dai dadi e dalle regole dell'arma come "guadagni N onde bonus") si spendono per le **onde** dell'arma, ognuna una volta; oggi sono attive +N danno, +N gittata e Perforare, le altre (Esplosione, stordimento, bruciare...) si vedono ma non si usano ancora. Il bonus di supporto vale solo con due armi da mischia a una mano. Il nemico a zero ferite esce dalla mappa. Un attacco consuma uno degli attacchi dell'azione (1 Avanzare, 2 Combattere); finché non si tira si può annullare senza spenderlo. Le carte dei mostri sono pubbliche (il manuale le mette scoperte vicino al tavolo): armatura, ferite e parametri dei nemici si vedono nella finestra dell'attacco e nella loro scheda (voce Scheda del menu). Segreta è solo la mano del Signore supremo.

- **Brandire due armi** (bonus di supporto): un eroe con **due armi da mischia a una mano** equipaggiate attacca con **una sola** (tira i suoi dadi); l'altra arma non attacca ma aggiunge il suo **bonus di supporto** al risultato (per esempio spada e daga: se attacca con la spada, il risultato guadagna il bonus di supporto della daga). Vale solo per armi da mischia a una mano (come dice il manuale: "due armi da corpo a corpo a mano singola"); le carte con il bonus oggi sono Spada, Spada d'osso, Spada serpente e Lama dell'Ira.
## 6. Difesa

- **Armatura fissa**: valore sempre attivo, sottratto al danno.
- **Dado difesa**: solo con scudi, armature speciali o poteri. Ogni scudo uscito riduce di 1 il danno, in aggiunta all'armatura.

## 7. Surge

- Ogni arma ha **1 o 2 effetti surge**, con un costo in ⚡ (es. ⚡: +1 danno; ⚡⚡: +2 gittata).
- Ogni effetto si può attivare **più volte** per attacco, pagando le sue Scariche ogni volta (dal manuale); nella finestra dell'attacco un contatore dice quante volte è stato attivato.
- I **dadi potere** sono rimandati: si pagano con la fatica, fuori scope nella v1.

## 8. Ferite, morte e Conquista

- **Ferite**: eroe 12 (3 cuori da 4 quarti), mostro 8 di default; l'avventura o la scheda possono cambiarle.
- **Conquista**: risorsa condivisa dagli eroi.
  - valore iniziale fissato dall'avventura *(da bilanciare)*;
  - **+3** accendendo un glifo; scrigni +2 o +4 secondo il tipo;
  - se arriva a **0**, gli eroi perdono.
- **Morte di un eroe**:
  - il gruppo perde Conquista pari al **valore dell'eroe** (campo `value` della scheda, da 2 a 4: più è robusto, più costa perderlo; *da bilanciare*);
  - perde **metà del denaro** (per difetto);
  - la sua pedina **sparisce dalla mappa** (sfuma e diventa rossa) e l'eroe va **in città**, a ferite piene, e il suo turno finisce subito; non visita servizi in quel round;
  - dal round successivo rientra, come ogni eroe in città, su un **glifo acceso, scoperto e libero**, **senza pagare** il teletrasporto (a differenza di chi va in città per scelta);
  - oggi si muore solo cadendo in una buca a 1 ferita; il resto aspetta il combattimento.

## 9. Overlord (IA scriptata v1)

- **Minaccia**: guadagna **1 per eroe** a ogni round *(da bilanciare)*.
- **Apparizioni**: spende Minaccia per far apparire mostri **solo in spazi che nessun eroe vede**. Gli angoli e le porte chiuse diventano pericolosi.
- **Mostri attivi**:
  - si avvicinano all'eroe più vicino;
  - attaccano preferendo il più ferito, con un po' di caso nella scelta del bersaglio.
- **Catalogo dei mostri** (`public/monsters/catalog.json`, schede in `docs/cards/monsters.md`): ogni mostro ha una scheda sola con due versioni, normale e potenziata; le ferite dipendono dal numero di giocatori (eroi + Signore Supremo: 2-3, 4 o 5). Oggi ci sono tutti e dodici (Scheletro, Ragno velenoso, Pipistrello gigante, Cultista, Goblin, Salamandra di fuoco, Naga, Gigante, Ogre, Demone, Manticora, Drago); nuovi mostri si aggiungono al file senza toccare il codice. Velocità, armatura, dadi e abilità speciali sono già letti; gli attacchi e le abilità aspettano il combattimento.
- **Movimento dei mostri grandi** (`board/movement-big.ts`; dal manuale, "Mostri grandi"; un passo costa 1 punto più le porte che apre): ogni casella della sagoma deve esistere, senza roccia, acqua o scale, e non può sovrapporsi a un nemico (gli amici si attraversano ma non ci si ferma sopra; né su un glifo acceso o uno scrigno). Ogni passaggio fra caselle deve essere libero da muri, e una porta chiusa si apre se un mostro può aprirla.
  - **Mostri da quattro caselle** (2×2: Ragno velenoso, Naga, Gigante, Ogre, Demone, Manticora): si muovono come un personaggio normale, interi di una casella in una delle otto direzioni, sempre su quattro caselle valide.
  - **Salamandra di fuoco** (due caselle, 2×1 o 1×2): muove metà del corpo in una casella adiacente non diagonale (una qualunque delle due metà, in una delle tre direzioni libere) e l'altra metà occupa la casella appena lasciata: così si piega e può ruotare (da orizzontale a verticale e viceversa). Oppure il movimento laterale: entrambe le metà di una casella nella stessa direzione obliqua.
  - **Drago** (sei caselle, 2×3 o 3×2): come la Salamandra, ma con le metà da tre caselle. Lungo il suo asse lungo si sposta intero di una casella (la metà dietro segue quella davanti); di lato **gira di 90°**: tiene fermo un blocco 2×2 a una delle due estremità (a scelta del Signore supremo, "in alto a destra" o "in alto a sinistra" nell'esempio del manuale) e il corpo si allunga dalla parte dove va, quindi un 3×2 che va in su diventa un 2×3 (e viceversa). Oppure il movimento laterale: intero di una casella in obliquo. Ogni passo costa 1 punto.
  - **Buche e vista**: la buca li tocca solo se la sagoma ci finisce interamente dentro; la linea di vista parte dal centro di una qualunque delle loro caselle.
- **Dimensioni dei mostri**: 1×1 (1 casella), 1×2 (2), 2×2 (4) e 2×3 (6); non ce ne sono altre. Le forme rettangolari (1×2 e 2×3) **si possono ruotare di 90°** quando si muovono o appaiono (2×1, 3×2). I mostri grandi occupano interamente le loro caselle, la vista si traccia dal centro di una qualsiasi, subiscono la buca solo se ci finiscono interamente dentro, non usano le scale e sono bersaglio di un solo attacco anche se un'Esplosione copre più caselle (dal manuale, "Mostri grandi").
- **Turno dell'Overlord oggi** (`state/overlord.ts` e la scena): dopo l'ultimo eroe, ogni mostro in ordine di lista si muove e attacca. Se può già attaccare qualcuno resta fermo; altrimenti va verso la casella più vicina (in punti movimento) da cui può attaccare, o se non ce n'è si avvicina all'eroe più vicino. Non si ferma in una buca, su un glifo acceso o su uno scrigno, e non passa attraverso gli eroi. Attacca fra gli eroi che può colpire: il più ferito il 70% delle volte, uno a caso altrimenti. La mischia richiede l'adiacenza; distanza e magia la linea di vista, con la gittata data dai dadi e da "+N Gittata". Perforare e "+N danno" dei mostri valgono sempre; le altre abilità non ancora. Sul dado potere lo script sceglie la gittata solo se serve per arrivare. I **mostri grandi** si muovono con la sagoma intera (vedi sotto): attaccano da dove arrivano con le stesse regole degli altri. **Tiratori** (mostri con un attacco a distanza o magico): non attaccano da una distanza che i loro dadi non possono coprire (oltre la somma delle gittate migliori non c'è tiro) e si tengono a distanza: cercano la casella con linea di vista più lontana dagli eroi entro la loro gittata di solito (la media dei dadi arrotondata per eccesso, da 2 a 5 caselle: lo scheletro 3, il Ragno velenoso 2, il Cultista 4, i più forti 5), e per l'arco non adiacente; se già stanno nel posto migliore restano fermi e sparano. Se non c'è nessuna casella buona si avvicinano come gli altri. **Porte**: un mostro che ha una porta chiusa davanti la apre spendendo 2 punti movimento come un eroe (il costo si somma al passo), ma solo se non è chiusa a chiave né runica e se le due aree che collega sono già rivelate (manuale, "Esplorazione"): chiudere una porta fa quindi spendere punti al mostro che deve riaprirla. Una porta aperta non si può richiudere se una creatura sta in mezzo, cioè occupa caselle da una parte e dall'altra del varco (un mostro grande). Un attacco mostra la finestra con i ruoli invertiti: tira l'Overlord (i dadi 3D), si vedono le facce, e dopo 5 secondi (una barra in basso, che si ferma con il mouse sopra o con un tocco) l'attacco si applica e la finestra si chiude da sola. Un eroe a zero ferite muore come per la caduta (Conquista, metà del denaro, città, dissolvenza in rosso). Mancano la Minaccia e la creazione di mostri.
- **Mazzo dell'Overlord** (36 carte in `docs/cards/overlord.md`, catalogo in `public/overlord/catalog.json`, regole in `state/overlord-deck.ts`). **Oggi funzionano** il mazzo, la mano, gli scarti, la Minaccia e le 9 carte Evocazione: all'inizio del suo turno l'Overlord prende 1 Minaccia per eroe, pesca 2 carte (mano massima 8, oltre si scartano le più care per la loro Minaccia, mano iniziale 3; costanti da bilanciare in `constants.ts`) e lo script gioca la Evocazione più cara che può pagare, con i mostri su caselle già esplorate che nessun eroe vede, le più vicine agli eroi. Nel mazzo entrano solo le carte con `"ready": true`: le altre si attivano man mano che si implementano. Finito il mazzo, -3 Conquista e gli scarti si rimescolano. Pillole: "Mazzo" (carte rimaste) per tutti, "Minaccia" solo nella vista Overlord. **Trappole (funzionano)**: Fossa con punte, Blocco di pietra, Porta esplosiva, Gas paralizzante e Runa esplosiva (`state/traps.ts`, risoluzione nella scena). Lo script arma una trappola per turno (la più cara che può pagare, al massimo 2 armate per categoria, costante `TRAP_LIMIT_PER_TARGET`), la carta esce dalla mano e resta nascosta; scatta quando un eroe entra nella casella o apre la porta o lo scrigno, il movimento si ferma, si tirano i dadi potere e la carta va negli scarti. Fossa e macerie diventano un ostacolo 1×1 (buca e roccia) sulla mappa; l'eroe spostato dal Blocco di pietra o dalla fossa schivata va nella casella libera adiacente più vicina (scelta automatica). **Mimic** (Mostro mimetico): è un mostro del catalogo (stesse caratteristiche del Goblin). Quando un eroe apre lo scrigno armato, paga i punti ma lo scrigno non si apre: sparisce dal suo posto e diventa un Mimic accanto all'eroe, che agisce subito. Il suo bottino è il contenuto dello scrigno (`drop`) più, se non è disattivato, il tesoro casuale per ogni eroe (`chestTier`); arrivano quando muore. **Rospo**: l'eroe tira 1 dado potere; se non è vuoto diventa un rospo (velocità 5, armatura 0, niente attacchi, abilità né oggetti o pozioni, né Correre o Combattere), il turno finisce, ha 2 segnalini e a fine di ogni suo turno (non quello della trasformazione) ne scarta uno. Sulla pedina compare un cerchietto "T" con i segnalini; l'immagine alternativa arriverà. **Seduzione oscura**: all'inizio del turno, se qualche eroe ha un altro eroe da colpire, un eroe a caso tira 1 dado potere e, se non è vuoto, attacca (con l'arma che ha più dadi) l'eroe più ferito che può colpire; non si colpisce da solo (per ora).
  **Carte Potere** (una per turno, restano in gioco): Distruzione (+1 dado potere ai mostri), Genio del Male (+1 carta a turno), Signore delle trappole (-1 costo, +2 ferite). **Eventi** giocati dallo script: Mirare (80% se può pagare, ripete i dadi mancati o vuoti), Schivare (70% se l'eroe fa almeno 2 cuori e il tiro non è già fallito, cioè senza Mancato e con gittata sufficiente: l'eroe ripete i dadi migliori), Carica (60% se il mostro non ha bersagli: velocità doppia), Furore (70% se ha un bersaglio: 2 attacchi, 4 con Colpo veloce), Raffica di vento (50%: gli eroi vedono e mirano solo fino a 5 spazi fino al turno dell'Overlord dopo). **Aree** (`area` su ogni tile della mappa, id a scelta dell'autore; facoltativo `areas` con nome e testo): un'area è un gruppo di tile con lo stesso id (una stanza, o i corridoi fra un gruppo di porte); i tile senza `area` non ne fanno parte. Si rivela la prima volta che gli eroi vedono una sua casella. I mostri in un'area non rivelata dormono e non agiscono; alla rivelazione si svegliano e l'Overlord li muove anche se gli eroi non li vedono ancora (la visibilità resta casella per casella; i mostri senza area agiscono sempre). Alla rivelazione scattano le carte Potere in gioco: **Orda di Creature** (2 mostri in più, di un tipo a caso fra Goblin, Scheletro e Ragno velenoso, accanto a un mostro dell'area) e **Abile comandante** (un mostro non unico dell'area diventa potenziato). Decisioni prese:
  - **Trappole come trigger**: l'Overlord le gioca *in anticipo* su un bersaglio preciso (una casella, una porta o uno scrigno) pagando subito la Minaccia; restano nascoste ai giocatori e scattano da sole quando un eroe entra in quella casella o apre quella porta o quello scrigno. Niente reazioni in tempo reale. Una trappola per bersaglio; un tetto per categoria da provare in partita (costante da regolare).
  - **Aree** (dal manuale delle avventure): una nuova area si rivela quando un eroe ottiene la linea di vista verso di essa; i suoi mostri, già nascosti lì, compaiono (anche dentro la vista degli eroi) e **non si attivano fino al prossimo turno dell'Overlord** (salvo carte con attivazione immediata); poi il gioco riprende con l'eroe che l'ha rivelata. Nel nostro file un'area è un tile (o più, con un `areas` opzionale e un testo da leggere alla rivelazione).
  - **Evocazione**: lo script mette i mostri fuori dalla vista degli eroi, nelle caselle valide più vicine a loro.
  - **Informazioni**: gli eroi non vedono la mano né la Minaccia dell'Overlord; vedono invece **quante carte restano nel mazzo**, perché quando finisce gli eroi perdono 3 Conquista e gli scarti si rimescolano.
  - **Rospo** (Maledizione del Rospo): identico alla Maledizione del Dio delle Scimmie del manuale, cambia solo il nome (e a suo tempo l'immagine della pedina trasformata). L'eroe tira 1 dado potere: se non è vuoto diventa un rospo e il suo turno finisce subito. Il rospo non attacca e non usa oggetti (pozioni comprese); si muove fino a 5 spazi nel turno dell'eroe senza azioni di movimento; mantiene ferite e fatica dell'eroe ma ha armatura 0. Ha 2 segnalini: ne scarta uno alla fine di ogni suo turno (escluso quello della trasformazione); scartato l'ultimo torna normale. Anche la morte toglie la trasformazione.
  - **Trappole**: mai reazioni; vanno armate in anticipo (vedi sopra).
  - **Mirare** e **Schivare** (manuale p. 12): sono gli stessi effetti dei comandi Mira e Schivata degli eroi, ma attivati dalla carta. Mirare: chi attacca ripete a scelta un qualsiasi numero di dadi (anche i mancati) e tiene il secondo risultato. Schivare: il mostro obbliga chi lo attacca a ripetere a scelta un qualsiasi numero di dadi, una sola volta per attacco, tenendo il secondo risultato. Un attacco mirato contro chi schiva annulla entrambi.
- Lo script usa la **stessa interfaccia di azioni** dei giocatori: un umano potrà sostituirlo senza cambiare le regole.

## 10. Scheda di un eroe

Gli eroi sono **archetipi pronti** (nessun creatore di personaggi nella v1). Le schede stanno in `public/heroes/<id>.json`; la mappa le richiama con il campo `hero` di una pedina, e ciò che la mappa scrive sulla pedina sostituisce la scheda.

```json
{
  "id": "ferdinand",
  "name": "Ferdinand",
  "class": "druido",
  "archetype": "ibrido forza-magia",
  "portrait": "characters/ferdinand.webp",
  "wounds": 12,
  "fatigue": 4,
  "armor": 1,
  "speed": 4,
  "value": 3,
  "coins": 300,
  "items": ["sword"],
  "potions": [],
  "skills": { "combat": 2, "cunning": 0, "magic": 1 },
  "dice": { "melee": 2, "ranged": 0, "magic": 1 },
  "ability": "Testo dell'abilità (per ora un segnaposto)"
}
```

- **class**: la classe, il sottotitolo dell'eroe nell'interfaccia (in maiuscolo); **archetype** serve a chi costruisce la scheda e non si mostra.
- **ferite**: multipli di 4 (8, 12, 16); **fatica** (3–5) per ora è solo un dato; **armatura** 0–2; **velocità** 3–5.
- **valore** (2–4): la Conquista che il gruppo perde se l'eroe muore. Più l'eroe è robusto, più vale.
- **skills**: punti di abilità iniziali nei tre rami (combattimento, astuzia, magia), sempre **3 in tutto**.
- **dice**: i dadi extra dell'eroe per ognuno dei tre tipi di attacco (mischia, distanza, magia), sempre **3 in tutto**. Di solito coincidono con le abilità iniziali, a meno di un punto spostato. Nel regolamento originale sono i dadi Energia che l'eroe aggiunge al tiro dell'arma per quel tipo di attacco; **0 vuol dire nessun dado extra, ma l'eroe può comunque attaccare con quel tipo** usando i dadi della sua arma.
- **coins**, **items**, **potions**: le monete con cui parte (300) e ciò che ha comprato prima di partire; il prezzo si toglie dalle monete (sezione 3c). Per ora ogni eroe ha una Spada: 225 monete.
- **ability**: una per eroe, a parole; l'effetto si implementa solo per le più semplici.
- **L'arma** si aggiunge con il combattimento.
- Le quattro caratteristiche e le specialità della sezione 4 sono **in pausa** e non fanno parte della scheda.

### Come si costruisce un archetipo (dalle schede della 1ª edizione, solo come riferimento)

| Archetipo | Ferite | Armatura | Velocità | Dadi (M/D/Ma) |
|---|---|---|---|---|
| Guerriero | 16 | 1–2 | 3–4 | 3/0/0 (o 2/0/1, 2/1/0) |
| Arciere, furfante | 12 | 0–1 | 5 | 0/3/0, 1/2/0 |
| Mago | 8–12 | 0–1 | 4–5 | 0/0/3, 1/0/2, 0/1/2 |
| Ibrido | 12–16 | 1–2 | 4 | 1/1/1, 2/0/1 |

Più un eroe è robusto, più è lento e più vale (valore 4 con 16 ferite e armatura 2; 2 con 8 ferite).

## 11. Fuori scope (v1)

Carte, città, mercato, fatica, dadi potere, comandi, *Prepararsi*, mostri grandi, famigli, effetti durevoli (fiamma, veleno, rete).

## 12. Punti aperti

- **Da controllare sul manuale cartaceo**: negli scrigni, chi riceve il tesoro? Oggi ogni eroe pesca una carta dal mazzo (come dice il PDF di riferimento e come è implementato); Gian ricorda che riceva solo chi apre. Se il manuale cartaceo dice così, cambiare `drawTreasures` in `actions.ts` e la sezione 3c.
- Valori iniziali di Conquista e Minaccia per avventura.
- Costo in Minaccia: non è del singolo mostro ma della **carta Creazione** dell'Overlord, che può evocare più creature insieme (come nel manuale). Servono le carte Overlord (Creazione, Evento, Trappola, Energia) per definirlo; per la v1 lo script ne userà di nostre. Nelle schede mostro (docs/cards/monsters.md) non c'è un costo.
- Numero di miniature di ogni mostro (limite sulla mappa): per ora ignorato.
- Scambio di posto tra eroi: sì o no.
