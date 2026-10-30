# Segnalini: cosa sviluppare

Elenco costruito sui componenti del regolamento di riferimento (solo ispirazione) e sul perimetro di CLAUDE.md.

## Già fatti
- **Ostacoli** (roccia, buca, acqua): dati, regole, aspetto.
- **Porte**, con serrature a chiave e a runa (rossa, blu, verde).
- **Glifi**: segnalino sulla mappa, impresso nel pavimento: spento come le crepe, acceso bianco pulsante con un'onda alla prima accensione; un eroe li accende entrando nella casella. Da un glifo acceso si viaggia verso un altro glifo acceso e libero spendendo tutti i punti movimento rimasti (minimo 1).
- **Scrigni**: segnalino 1x1 in tre tipi (rame, argento, oro) con colore proprio; non è un ostacolo. Un eroe entra nella casella e spende 2 punti movimento per aprirlo (clic sulla casella); restituisce la Conquista indicato dall'avventura (il contatore esiste nello stato). Aperto resta una cassa vuota (scelta nostra). Niente serrature per ora.
- **Oggetti a terra**: pozione curativa e del vigore (per ora svaniscono), denaro (100 monete a ognuno degli eroi, personali: `coins` di ogni pedina) e chiave runica (sblocca le porte di quel colore). Si raccolgono fermandosi nella casella e scegliendo "Raccogli" nel menu, a 0 punti movimento. Le chiavi runiche e il denaro possono anche stare negli scrigni (`contents`).
- **Scale**: coppie con la stessa etichetta nei dati (3 coppie nella scatola); i tre lati chiusi sono muri veri; 1 punto movimento da un capo all'altro, solo eroi; si vedono a vicenda l'altro capo; filo tratteggiato fra i capi. Mappa di prova: `public/maps/stairs.json` (`/play/stairs`).
- **Ferite**: i cuori a quarti ci sono (nel tab dell'eroe e nella scheda).

## Da sviluppare nel perimetro della versione 1
| Segnalino | Cosa serve | Dipende da |
|---|---|---|
| **Scrigni** (restano) | Contenuti oltre alla Conquista: denaro e maledizione (la maledizione dà Minaccia all'Overlord); serrature. Tesori, pozioni e reliquie sono fuori scope. | Minaccia, tesori |
| **Pozioni** (il vigore) | Fatte: set di 3 per eroe, raccolta con l'azione "Raccogli" a 0, bere (curativa +4 ferite, vigore: fatica al massimo) e dare a un eroe adiacente, 1 punto ciascuno. | — |
| **Denaro** (uso) | Contatore a schermo, perdita di metà alla morte, spesa in città. | Città, UI |
| **Bottino dei nemici** | Chiavi runiche e altro dai nemici uccisi. | Combattimento |
| ~~Incontri~~ | Fatto in altro modo: il segnalino non esiste, ciò che succede in un punto si scrive con gli eventi (per i nemici, "Interagisci"; per gli oggetti, "Raccogli"). Vedi docs/REGOLE.md, sezione 2e. | — |
| **Minaccia** | Riserva dell'Overlord: +1 per ogni eroe a inizio turno; è il budget per far apparire mostri. | Creazione mostri fuori vista |
| **Turno degli eroi** | Segnalino a due lati che dice chi ha già agito, con ordine libero. | Round |

## Non sono segnalini: UI da fare
- **Conquista**: contatore comunitario degli eroi, non un segnalino. Si guadagna con glifi (+3) e scrigni, si perde quando un eroe muore, a zero gli eroi perdono. Il valore iniziale viene dall'avventura.

## Fuori scope per ora
Città (e il viaggio glifo-città per 1 punto movimento, una volta per turno), fatica, comandi (mira, schivata, guardia, riposo), addestramento, effetti durevoli (fiamma, veleno, stordimento, rete), famigli, sagoma del soffio, tesori (pozioni, reliquie, denaro da spendere), città e viaggio dai glifi.

## Come si costruiscono
- I segnalini sulla mappa sono dati dell'avventura (`markers` nel file della mappa): tipo, casella, stato. Stanno sotto ostacoli e porte, e si rivelano come gli altri elementi.
- Icone: Google Material Symbols come SVG in `public/icons/` (l'elenco si dà quando si arriva al disegno).
