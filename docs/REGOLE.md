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

- *Prepararsi* è rimandata (dipende da fatica e comandi, fuori scope).
- Aprire porte e scrigni, scassinare e saltare consumano punti movimento come già implementato.

## 3. Movimento

Resta com'è nel codice:
- un passo, anche in diagonale, costa 1;
- si passa attraverso gli alleati, i nemici bloccano;
- il movimento si interrompe quando un mostro diventa visibile.

## 3b. Pozioni e inventario

Ogni eroe ha il **suo** set di pozioni (non sono del gruppo). Le chiavi, le chiavi runiche e il denaro restano invece del gruppo.

- Un eroe porta **fino a 3 pozioni** (curative o di vitalità), tutte pronte all'uso: nella v1 non c'è la distinzione fra equipaggiate e zaino del regolamento originale.
- **Raccogliere** una pozione costa **0 punti movimento**: un eroe che entra nella sua casella, anche solo passandoci sopra, la prende. Se ne porta già 3, la pozione **resta a terra**.
- **Bere** costa **1 punto movimento** (azione contestuale). La curativa ridà **3 ferite**, senza superare il massimo, e non si beve in piena salute. La pozione di vitalità si può portare e dare, ma **non si beve** finché la fatica è fuori scope.
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

**Carta oggetto** (un elemento di `public/items/catalog.json`, che li contiene tutti): nome, tipo (arma, scudo, armatura, altro), etichette (`tags`, per esempio `rune`), tipo di attacco per le armi, mani, armatura, prezzo, dadi (per colore: rosso, verde, blu, giallo, bianco), effetti a Scariche ("onde" nelle carte), bonus della mano secondaria, `rules` (regole a parole: parole chiave come "Perforare 1", limiti, abilità da attivare; per ora solo testo) e, se è un tesoro, il mazzo (rame, argento, oro). Il negozio è un file a parte (`public/shops/<id>.json`, `stock`: le copie di ogni oggetto in vendita). Dadi ed effetti restano dati finché non c'è il combattimento: la **Spada** è un'arma a una mano per la mischia, 75 monete, con un dado rosso e uno verde e due abilità: "2 Scariche: +1 danno" e "Mano libera: +1 danno". Il campo `text` non c'è più: le descrizioni stanno in `rules`.

**Reliquie**: oggetti del catalogo con l'etichetta `relic` (sottotitolo "Reliquia"), senza prezzo e senza mazzo: ci sono solo nelle avventure che le prevedono, a terra (segnalino `item`) o dentro uno scrigno (`contents` con `kind: "item"`). Non si vendono. Un dado che compare più volte nella carta ("2 verdi") si scrive ripetuto in `dice` e si mostra ripetuto.

**Effetti passivi degli oggetti** (già in gioco, senza combattimento): un oggetto equipaggiato somma la sua `armor` a quella dell'eroe; `speedCap` limita la velocità (la cotta di maglia la porta a 4, e vale dal round dopo che la si indossa); `forbidsTags` impedisce di equipaggiare insieme oggetti con certe etichette, in tutti e due i sensi (la cotta di maglia vieta `rune`: con la cotta indosso non si equipaggia una Runa, e con una Runa indosso non si equipaggia la cotta; nello zaino si può portare). Gli oggetti con l'etichetta `rune` mostrano "Runa" nel sottotitolo. Il testo in `rules` resta solo per la card.

**Scrigni e tesori**
- Aprire uno scrigno dà, oltre ai premi scritti dall'avventura (`contents`), un **tesoro casuale**: **ogni eroe pesca una carta** dal mazzo del tipo dello scrigno (rame, argento, oro). Una carta pescata non torna e un mazzo finito non si rimescola.
- Chi pesca la riceve come in "Prendere"; se non ha posto la **scarta subito per monete**: 250 (rame), 500 (argento), 750 (oro).
- Chi crea l'avventura può togliere il tesoro casuale di uno scrigno (`random: false`).
- I tre mazzi sono formati dalle carte del catalogo con `deck` (rame, argento, oro), ognuna ripetuta per le sue `copies`. Oggi ci sono tutti e tre: rame (17 carte diverse, 23 in tutto), argento (16 carte diverse, 18 in tutto) e oro (15 carte diverse, 16 in tutto). L'estrazione la decide lo stato (l'host). Una carta evento (`instant`, come "Tesoro nascosto": monete, a volte una pozione, e si pesca ancora) non si tiene: ha effetto subito, anche se comprata nel negozio.

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
- La composizione esatta delle facce si definisce insieme ai temi *(da bilanciare)*.

## 6. Difesa

- **Armatura fissa**: valore sempre attivo, sottratto al danno.
- **Dado difesa**: solo con scudi, armature speciali o poteri. Ogni scudo uscito riduce di 1 il danno, in aggiunta all'armatura.

## 7. Surge

- Ogni arma ha **1 o 2 effetti surge**, con un costo in ⚡ (es. ⚡: +1 danno; ⚡⚡: +2 gittata).
- Ogni effetto si usa al massimo una volta per attacco.
- I **dadi potere** sono rimandati: si pagano con la fatica, fuori scope nella v1.

## 8. Ferite, morte e Progresso

- **Ferite**: eroe 12 (3 cuori da 4 quarti), mostro 8 di default; l'avventura o la scheda possono cambiarle.
- **Progresso**: risorsa condivisa dagli eroi.
  - valore iniziale fissato dall'avventura *(da bilanciare)*;
  - **+3** accendendo un glifo; scrigni +2 o +4 secondo il tipo;
  - se arriva a **0**, gli eroi perdono.
- **Morte di un eroe**:
  - il gruppo perde Progresso pari al **valore dell'eroe** (campo `value` della scheda, da 2 a 4: più è robusto, più costa perderlo; *da bilanciare*);
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
- **valore** (2–4): il Progresso che il gruppo perde se l'eroe muore. Più l'eroe è robusto, più vale.
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

- Facce esatte di dado base, dadi extra e dado difesa.
- Valori iniziali di Progresso e Minaccia per avventura.
- Costo in Minaccia di ciascun mostro.
- Scambio di posto tra eroi: sì o no.
- Come i dadi extra dell'eroe (per tipo di attacco) si combinano con il dado base e con i dadi dell'arma, e se hanno facce proprie (nel regolamento originale: un dado nero con l'incremento di Energia, e un massimo di 5 per attacco).
