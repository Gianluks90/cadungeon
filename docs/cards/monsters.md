# Mostri (da compilare)

Dodici tipi di mostro. Per ognuno la versione **normale** e quella **potenziato** (la sezione rossa della carta, più forte). I **mostri unici** (boss) non vanno qui: stanno nei dati dell'avventura.
Ogni mostro ha tre scaglioni, uno per ognuna delle carte: **2-3 giocatori**, **4 giocatori** e **5 giocatori** (il Signore Supremo conta come giocatore, quindi 1 eroe = 2 giocatori). Li scrivi come sulla carta; nel gioco userò quello che corrisponde al numero di eroi.

Nel gioco sono già caricati dal catalogo `public/monsters/catalog.json` tutti e dodici i mostri (le immagini mancano per dieci: la pedina usa un segnaposto). Per aggiungere un altro mostro, dopo averlo compilato qui, si aggiunge una voce al catalogo con lo stesso formato (si può chiedere a Claude di farlo da questo file).

Come compilare:
- **Immagine**: il nome della cartella in `public/mobs/` (per esempio `skeleton`: dentro ci sono `skeleton-portrait.webp` e `skeleton-token.webp`).
- **Dimensione**: una tra 1×1 (quasi tutti), 1×2 (2 caselle), 2×2 (4 caselle) e 2×3 (6 caselle). Non ce ne sono di altre. I mostri a forma rettangolare (1×2 e 2×3) si possono ruotare di 90° quando si muovono o appaiono.
- **Attacco**: mischia, distanza o magia (un mostro ne fa uno solo), con i **dadi** (colori: rosso, verde, blu, giallo, bianco; un dado nero se c'è). La **gittata** non è un valore fisso: la decidono i numeri usciti sui dadi (e le abilità tipo +1 Gittata), quindi non c'è un campo.
- **Abilità speciali**: scrivile come sulla carta (Aura, Esplosione 1, Perforare 2, Paura 1...), una per riga, e se c'è un testo scrivi anche quello.
- **Costo in Minaccia**: non è del mostro ma della carta Creazione dell'Overlord che lo evoca (una carta può evocare più creature insieme). Non c'è un campo qui: si definirà insieme alle carte Overlord.
- **Copie** (quante miniature ci sono): per ora ignorate, nessun limite di mostri sulla mappa.

## 1. Scheletro

- Immagine: skeleton
- Dimensione (1×1, 1×2, 2×2 o 2×3): 1x1
- Attacco (mischia / distanza / magia): distanza

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 2 | 3 |
| Ferite (4 giocatori) | 3 | 4 |
| Ferite (5 giocatori) | 4 | 5 |
| Velocità | 5 | 5 |
| Armatura | 0 | 1 |
| Dadi d'attacco | blu, verde | blu, verde, nero |

Abilità speciali (normale):
- Perforare 1
- +1 Gittata

Abilità speciali (potenziato):
- Perforare 2
- +2 Gittata
- Immortale

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

## 2. Ragno velenoso

- Immagine: poison-spider
- Dimensione (1×1, 1×2, 2×2 o 2×3): 2x2
- Attacco (mischia / distanza / magia): magia

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 2 | 3 |
| Ferite (4 giocatori) | 3 | 4 |
| Ferite (5 giocatori) | 4 | 5 |
| Velocità | 5 | 5 |
| Armatura | 1 | 2 |
| Dadi d'attacco | bianco, verde | bianco, verde, nero |

Abilità speciali (normale):
- Veleno

Abilità speciali (potenziato):
- Veleno
- Ragnatela

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

## 3. Pipistrello gigante

- Immagine:
- Dimensione (1×1, 1×2, 2×2 o 2×3): 1x1
- Attacco (mischia / distanza / magia): mischia

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 3 | 4 |
| Ferite (4 giocatori) | 4 | 5 |
| Ferite (5 giocatori) | 5 | 6 |
| Velocità | 6 | 8 |
| Armatura | 3 | 4 |
| Dadi d'attacco | rosso, giallo | rosso, giallo, nero |

Abilità speciali (normale):
- Volare

Abilità speciali (potenziato):
- Volare
- Stordire

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

## 4. Cultista

- Immagine: cultist
- Dimensione (1×1, 1×2, 2×2 o 2×3): 1x1
- Attacco (mischia / distanza / magia): magia

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 3 | 4 |
| Ferite (4 giocatori) | 4 | 5 |
| Ferite (5 giocatori) | 5 | 6 |
| Velocità | 4 | 4 |
| Armatura | 2 | 3 |
| Dadi d'attacco | bianco, giallo | bianco, giallo, nero |

Abilità speciali (normale):
- Stregoneria 3

Abilità speciali (potenziato):
- Stregoneria 4
- Immortale

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

## 5. Goblin

- Immagine:
- Dimensione (1×1, 1×2, 2×2 o 2×3): 1x1
- Attacco (mischia / distanza / magia): mischia

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 2 | 3 |
| Ferite (4 giocatori) | 3 | 4 |
| Ferite (5 giocatori) | 4 | 5 |
| Velocità | 4 | 4 |
| Armatura | 2 | 3 |
| Dadi d'attacco | rosso, verde | rosso, verde, nero |

Abilità speciali (normale):
- +1 Danno

Abilità speciali (potenziato):
- +2 Danno
- Comando

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

## 6. Salamandra di fuoco

- Immagine: mobs/fire-salamander
- Dimensione (1×1, 1×2, 2×2 o 2×3): 1x2
- Attacco (mischia / distanza / magia): distanza

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 3 | 4 |
| Ferite (4 giocatori) | 4 | 5 |
| Ferite (5 giocatori) | 5 | 6 |
| Velocità | 4 | 4 |
| Armatura | 1 | 2 |
| Dadi d'attacco | blu, giallo | blu, giallo, nero |

Abilità speciali (normale):
- Soffio
- Perforare 3

Abilità speciali (potenziato):
- Soffio
- Perforare 4
- Aura

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

## 7. Naga

- Immagine:
- Dimensione (1×1, 1×2, 2×2 o 2×3): 2x2
- Attacco (mischia / distanza / magia): magico

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 5 | 6 |
| Ferite (4 giocatori) | 6 | 7 |
| Ferite (5 giocatori) | 7 | 8 |
| Velocità | 3 | 3 |
| Armatura | 3 | 4 |
| Dadi d'attacco | bianco, verde, giallo | bianco, verde, giallo, nero |

Abilità speciali (normale):
- Presa
- Stregoneria 1

Abilità speciali (potenziato):
- Presa
- Stregoneria 2
- Comando

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

## 8. Gigante

- Immagine: giant
- Dimensione (1×1, 1×2, 2×2 o 2×3): 2x2
- Attacco (mischia / distanza / magia): mischia

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 9 | 10 |
| Ferite (4 giocatori) | 10 | 11 |
| Ferite (5 giocatori) | 11 | 12 |
| Velocità | 3 | 3|
| Armatura | 5 | 6 |
| Dadi d'attacco | rosso, 2 verdi, giallo | rosso, 2 verdi, giallo, nero |

Abilità speciali (normale):
- Raggiungere
- Stordire

Abilità speciali (potenziato):
- Raggiungere
- Stordire
- Spazzata

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

## 9. Ogre

- Immagine: ogre
- Dimensione (1×1, 1×2, 2×2 o 2×3): 2x2
- Attacco (mischia / distanza / magia): mischia

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 5 | 6 |
| Ferite (4 giocatori) | 6 | 7 |
| Ferite (5 giocatori) | 7 | 8 |
| Velocità | 3 | 3 |
| Armatura | 4 | 5 |
| Dadi d'attacco | rosso, 2 verdi | rosso, 2 verdi, nero |

Abilità speciali (normale):
- Contraccolpo

Abilità speciali (potenziato):
- Contraccolpo
- Immortale

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

## 10. Demone

- Immagine:
- Dimensione (1×1, 1×2, 2×2 o 2×3): 2x2
- Attacco (mischia / distanza / magia): magico

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 9 | 10 |
| Ferite (4 giocatori) | 10 | 11 |
| Ferite (5 giocatori) | 11 | 12 |
| Velocità | 3 | 3 |
| Armatura | 4 | 5 |
| Dadi d'attacco | bianco, verde, 2 gialli | bianco, verde, 2 gialli, nero |

Abilità speciali (normale):
- Aura
- Stregoneria 2
- Paura 1

Abilità speciali (potenziato):
- Aura
- Stregoneria 3
- Paura 2

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

## 11. Manticora

- Immagine:
- Dimensione (1×1, 1×2, 2×2 o 2×3): 2x2
- Attacco (mischia / distanza / magia): distanza

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 5 | 6 |
| Ferite (4 giocatori) | 6 | 7 |
| Ferite (5 giocatori) | 7 | 8 |
| Velocità | 4 | 4 |
| Armatura | 2 | 3 |
| Dadi d'attacco | blu, verde, giallo | blu, verde, giallo, nero |

Abilità speciali (normale):
- Attacco veloce
- Perforare 2

Abilità speciali (potenziato):
- Attacco veloce
- Perforare 3
- Veleno

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

## 12. Drago

- Immagine:
- Dimensione (1×1, 1×2, 2×2 o 2×3): 2x3
- Attacco (mischia / distanza / magia): distanza

| | Normale | Potenziato |
|---|---|---|
| Ferite (2-3 giocatori) | 9 | 10|
| Ferite (4 giocatori) | 10 | 11 |
| Ferite (5 giocatori) | 11 | 12 |
| Velocità | 4 | 4 |
| Armatura | 3 | 4 |
| Dadi d'attacco | blu, verde, 2 gialli | blu, 2 verdi, giallo, nero |

Abilità speciali (normale):
- Bruciare
- Soffio
- Perforare 5

Abilità speciali (potenziato):
- Bruciare
- Soffio
- Perforare 5
- Paura 1

Note (per esempio cosa cambia con il numero di giocatori oltre a quanto scritto nella tabella):

