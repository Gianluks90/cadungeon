# Dadi 3D (dice-box) e temi

Libreria: `@3d-dice/dice-box` 1.1.4 (BabylonJS per la grafica, Ammo per la fisica, tutto in un web worker). Installata, **non ancora collegata al gioco**.

## Cosa c'è nel progetto
- `public/dice/` contiene i file che la libreria carica a runtime (copiati da `node_modules/@3d-dice/dice-box/dist/assets`):
  - `ammo/` la fisica (WebAssembly);
  - `themes/default/` il tema di partenza (dadi con i numeri).
- La libreria non ha tipi TypeScript: quando la colleghiamo serve un piccolo `declare module '@3d-dice/dice-box'`.
- Il percorso dei file va dato rispetto al `<base href>` (l'app sta anche su GitHub Pages in una sottocartella): `new URL('dice/', document.baseURI).pathname`.

## Come si usa (idea di base)
```ts
const box = new DiceBox({ container: '#dice-layer', assetPath: '/dice/', theme: 'default', scale: 5 });
await box.init();
const risultati = await box.roll('2d6', { theme: 'default', themeColor: '#c0392b' });
```
- Il canvas dei dadi è un secondo canvas, **sopra** la scena Pixi (trasparente, `pointer-events: none`): i dadi rotolano sullo schermo, non sulla mappa.
- `roll()` svuota il tavolo e lancia; `add()` aggiunge senza svuotare; `clear()` toglie tutto.
- Il risultato arriva a fine lancio (promessa o `onRollComplete`): per ogni dado `sides`, `value`, `themeColor`, `theme`. **Il risultato lo decide la fisica nel browser**: nel multigiocatore l'host dovrà decidere i valori e farli solo "mostrare" ai client (per quanto ho visto nel codice la libreria non ha un modo per forzare un valore: da verificare con una prova; l'alternativa è usare i dadi come puro effetto e far scegliere il numero al nostro codice).
- Il tema e il colore si possono scegliere **per ogni lancio**: un lancio per colore di dado (rosso, verde, blu, giallo, bianco) e poi si riuniscono i risultati.

## Come si fa un tema
Un tema è una cartella `public/dice/themes/<nome>/` con:

| File | Cosa è |
|---|---|
| `theme.config.json` | la scheda del tema (vedi sotto) |
| `<mesh>.json` | il modello 3D dei dadi (Babylon, uno per tipo: d4, d6, d8... più i `_collider` per la fisica) |
| `diffuse-*.png` | la texture che colora il dado e disegna le facce (numeri, icone) |
| `normal.png` | rilievo: gli incavi dei simboli |
| `specular.jpg` | lucentezza |

`theme.config.json` (quello di default, commentato):
```json
{
  "name": "Default Colors",
  "systemName": "default",          // il nome usato in codice: deve essere uguale al nome della cartella
  "meshFile": "default.json",
  "material": {
    "type": "color",                // "color" oppure "standard" (vedi sotto)
    "diffuseTexture": { "light": "diffuse-light.png", "dark": "diffuse-dark.png" },
    "diffuseLevel": 1,
    "bumpTexture": "normal.png", "bumpLevel": 0.5,
    "specularTexture": "specular.jpg", "specularPower": 1
  },
  "diceAvailable": ["d4","d6","d8","d10","d12","d20","d100"]
}
```

Due tipi di materiale:
- **`color`**: il dado è un colore unico (`themeColor`, esadecimale) e la texture disegna solo i numeri; c'è una versione `light` (numeri chiari, per dadi scuri) e `dark` (numeri scuri, per dadi chiari), scelta in automatico dalla luminosità del colore. **È la strada per i nostri cinque colori**: un solo tema, un `themeColor` diverso per colore di dado.
- **`standard`**: la texture è l'immagine completa del dado (colori, disegni, tutto), senza `themeColor`. Serve per dadi decorati uno per uno.

### Le facce nostre (cuori, gittata, Scarica, mancato)
Le facce dei dadi d'attacco non sono numeri: sono simboli. Strada consigliata:
1. Usiamo **un d6** con il tema `default` e il numero 1–6 che esce è la faccia: una **tabella nostra** (per colore) traduce il numero in simbolo (le facce di ogni colore si decideranno con il combattimento). Costa zero lavoro grafico, e le facce reali si decidono con il combattimento.
2. Poi, per far vedere il simbolo sul dado, si copia `themes/default` in `themes/cadungeon`, si tiene lo stesso `d6` e si **sostituisce la texture** (`diffuse-*.png`) disegnando i simboli al posto dei numeri **nelle stesse posizioni** (la texture è 1024×1024 e le facce stanno alle coordinate del modello; non ho ancora guardato com'è disposta: si parte dalla texture esistente e si ridisegnano i numeri). Il valore 1–6 resta quello della faccia, quindi la tabella del punto 1 continua a valere.
3. Un tema con un modello 3D diverso (dadi con altre forme) richiede di esportare i mesh da Blender in formato Babylon con i collider: non serve.

Altre cose utili: `extends` per ereditare da un altro tema, `diceExtended` per usare un tema diverso per un tipo di dado, `externalThemes` per caricare un tema da un altro indirizzo, `preloadThemes` per caricarli in anticipo. Il repository di temi liberi (CC0) è https://github.com/3d-dice/dice-themes.

## I nostri temi (generati)
Le facce sono in `docs/dadi-facce.md` (la compila Gian). Lo script `tools/dice/make_dice_themes.py` legge quel file e genera:
- `public/dice/faces.json`: per ogni colore `theme`, `themeColor` e le sei facce (`range`, `hearts`, `surge`, `miss`); la faccia N è `faces[N-1]` ed è il numero che esce dal d6;
- `public/dice/themes/<colore>/`: un tema per colore (rosso, blu, bianco, verde, giallo, nero) con il d6, le texture con i simboli al posto dei numeri (diffuse chiara e scura, normal, specular) e `theme.config.json`.
Il colore del corpo si passa al lancio: `box.roll('2d6', { theme: 'red', themeColor: '#d2504a' })`. Per cambiare una faccia: modifica il file, rilancia lo script (serve Python con Pillow e numpy: le istruzioni sono in cima allo script) e ricarica la pagina.

**Dove stanno i simboli sulla faccia** (fisso, stabilito da Gian; vale per tutti i dadi con cuori):
- **Gittata**: sempre in basso a sinistra, e va scritta anche se è 0.
- **Scarica**: 1, in basso a destra, sulla stessa riga della gittata.
- **Cuori** nella parte alta: 1 al centro; 2 in diagonale (posti 1 e 4 di una griglia 2×2 letta da sinistra a destra e poi a capo); 3 = due nella prima riga e uno centrato sotto; 4 = tutti e quattro i posti.
- **Mancato** (✖️): da solo, al centro.
- **Dado nero**: faccia vuota = niente; solo Scarica = una grande al centro; "1/♥" = gittata in basso a sinistra, cuore in alto a destra e una diagonale a 45° tra i due.
Le facce multivalenti (`slash` in `faces.json`) per ora non contano nei totali: in combattimento deciderà chi tira il dado quale dei due valori accettare (il dado potere è lo stesso per eroi e mostri).
Le posizioni sono nelle costanti in cima alla sezione "Posizioni fisse" di `tools/dice/make_dice_themes.py`.

## Da fare per collegarlo (non ancora fatto)
1. `declare module` per i tipi e un servizio (`DiceService`) che crea il canvas sopra la scena, carica i temi con `init()` e offre `roll(colore, quantità)`.
2. Tabella delle facce per colore (docs/REGOLE.md, sezione dadi d'attacco) e funzione che traduce i valori in simboli.
3. Decisione sul multigiocatore (chi decide il valore): vedi sopra.
4. Test di peso: Babylon + Ammo pesano alcune centinaia di KB; si carica solo al primo attacco.
