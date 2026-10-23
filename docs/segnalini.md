# Segnalini: cosa sviluppare

Elenco costruito sui componenti del regolamento di riferimento (solo ispirazione) e sul perimetro di CLAUDE.md.

## Già fatti
- **Ostacoli** (roccia, buca, acqua): dati, regole, aspetto.
- **Porte**, con serrature a chiave e a runa (rossa, blu, verde).
- **Glifi**: segnalino sulla mappa, impresso nel pavimento: spento come le crepe, acceso bianco pulsante con un'onda alla prima accensione; un eroe li accende entrando nella casella. Da un glifo acceso si viaggia verso un altro glifo acceso e libero spendendo tutti i punti movimento rimasti (minimo 1).
- **Scrigni**: segnalino 1x1 in tre tipi (rame, argento, oro) con colore proprio; non è un ostacolo. Un eroe entra nella casella e spende 2 punti movimento per aprirlo (clic sulla casella); restituisce il Progresso indicato dall'avventura (il contatore esiste nello stato). Aperto resta una cassa vuota (scelta nostra). Niente serrature per ora.
- **Oggetti a terra**: pozione curativa e di vitalità (per ora svaniscono), denaro (100 monete a ognuno degli eroi: `party.coins`) e chiave runica (sblocca le porte di quel colore). Raccolta automatica passandoci sopra, a 0 punti movimento. Le chiavi runiche e il denaro possono anche stare negli scrigni (`contents`).
- **Scale**: coppie con la stessa etichetta nei dati (3 coppie nella scatola); i tre lati chiusi sono muri veri; 1 punto movimento da un capo all'altro, solo eroi; si vedono a vicenda l'altro capo; filo tratteggiato fra i capi. Mappa di prova: `public/maps/scale.json` (`?mappa=scale`).
- **Ferite**: esiste il conteggio, manca l'aspetto a cuori.

## Da sviluppare nel perimetro della versione 1
| Segnalino | Cosa serve | Dipende da |
|---|---|---|
| **Scrigni** (restano) | Contenuti oltre al Progresso: denaro e maledizione (la maledizione dà Minaccia all'Overlord); serrature. Tesori, pozioni e reliquie sono fuori scope. | Minaccia, tesori |
| **Pozioni** (inventario) | Equipaggiare (max 3) o mettere nello zaino (max 3 oggetti), bere per 1 punto movimento (curativa: +3 ferite; vitalità: fatica al massimo, dopo la fatica), darle a un eroe adiacente per 1 punto. | Inventario, cuori, fatica |
| **Denaro** (uso) | Contatore a schermo, perdita di metà alla morte, spesa in città. | Città, UI |
| **Bottino dei nemici** | Chiavi runiche e altro dai nemici uccisi. | Combattimento |
| **Incontri** | Segnalino evento: quando un eroe finisce il movimento lì scatta un testo dell'avventura. Serve un piccolo formato per scrivere eventi. | Formato degli eventi |
| **Minaccia** | Riserva dell'Overlord: +1 per ogni eroe a inizio turno; è il budget per far apparire mostri. | Creazione mostri fuori vista |
| **Turno degli eroi** | Segnalino a due lati che dice chi ha già agito, con ordine libero. | Round |

## Non sono segnalini: UI da fare
- **Progresso**: contatore comunitario degli eroi, non un segnalino. Si guadagna con glifi (+3) e scrigni, si perde quando un eroe muore, a zero gli eroi perdono. Il valore iniziale viene dall'avventura.
- **Cuori** per le ferite, divisi in quarti.
- **Rosa dei venti** e rotazione della mappa a scatti di 90 gradi.

## Fuori scope per ora
Città (e il viaggio glifo-città per 1 punto movimento, una volta per turno), fatica, comandi (mira, schivata, guardia, riposo), addestramento, effetti durevoli (fiamma, veleno, stordimento, rete), famigli, sagoma del soffio, tesori (pozioni, reliquie, denaro da spendere), città e viaggio dai glifi.

## Come si costruiscono
- I segnalini sulla mappa sono dati dell'avventura (`markers` nel file della mappa): tipo, casella, stato. Stanno sotto ostacoli e porte, e si rivelano come gli altri elementi.
- Icone: Google Material Symbols come SVG in `public/icons/` (l'elenco si dà quando si arriva al disegno).
