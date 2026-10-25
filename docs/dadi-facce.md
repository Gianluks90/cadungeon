# Facce dei dadi (da compilare)

Sei dadi a sei facce (d6), uno per colore. Per ogni faccia scrivi cosa c'è sopra, usando i simboli qui sotto; poi la codifichiamo in una tabella (`public/dice/` per i temi, `src/app/game/` per le regole) e disegniamo le texture.
Il numero 1–6 è quello che esce dal dado 3D: la tabella lo traduce nella faccia. Se due facce sono uguali, scrivile uguali (è normale).

## Simboli
Da REGOLE.md, sezione 5. Scrivi quantità + simbolo, per esempio `2 ❤️`, `1 ⚡ + 1 ❤️ + 3 gittata`.

| Simbolo | Significato |
|---|---|
| **N** (numero) | gittata |
| ❤️ | danno (cuori) |
| ⚡ | Scarica (attiva un effetto dell'arma) |
| ✖️ | Mancato (l'attacco fallisce del tutto; solo sul dado base) |

Per il dado potere (nero): ⚡ è l'onda di potere e "vuota" è la faccia senza niente (vedi `abilities.md`: i mantelli annullano ferite per ogni onda, o per ogni faccia vuota). Se ha altri simboli, aggiungili in fondo alla sua tabella.

## Come leggere le tabelle
- **Usato da**: già scritto da me da come sono oggi le carte (`public/items/catalog.json`): rosso nelle armi da mischia, blu nelle armi a distanza, bianco nelle armi magiche; verde e giallo come dadi extra. Correggimi se è diverso.
- **Faccia**: il numero che esce dal dado 3D, da 1 a 6. L'ordine non conta, scegli tu cosa metti dove.
- Se un dado ha più facce con lo stesso contenuto, mettile pure uguali.

## Rosso
Usato da: armi da mischia (dado base).

| Faccia | Gittata | ❤️ | ⚡ | ✖️ | Note |
|---|---|---|---|---|---|
| 1 | | | | 1 | |
| 2 | 1 | 3 | | | |
| 3 | 2 | 2| | | |
| 4 | 1 | 3 | 1 | | |
| 5 | 2 | 1 | 1 | | |
| 6 | 0 | 4| | | |

## Blu
Usato da: armi a distanza (dado base).

| Faccia | Gittata | ❤️ | ⚡ | ✖️ | Note |
|---|---|---|---|---|---|
| 1 | | | | 1 | |
| 2 | 4 | | 1 | | |
| 3 | 1 | 2 | | | |
| 4 | 3 | 1 | 1 | | |
| 5 | 2 | 2 | | | |
| 6 | 3 | 1 | 1 | | |

## Bianco
Usato da: armi magiche (dado base).

| Faccia | Gittata | ❤️ | ⚡ | ✖️ | Note |
|---|---|---|---|---|---|
| 1 | | | | 1 | |
| 2 | 3 | 1 | 1 | | |
| 3 | 2 | 2 | | | |
| 4 | 1 | 3 | 1 | | |
| 5 | 1 | 3 | 1 | | |
| 6 | 3 | 1 | 1 | | |

## Verde
Usato da: dado extra di quasi tutte le armi.

| Faccia | Gittata | ❤️ | ⚡ | ✖️ | Note |
|---|---|---|---|---|---|
| 1 | 0 | 2 | 1 | | |
| 2 | 1 | 1 | | | |
| 3 | 0 | 2 | 1 | | |
| 4 | 1 | 2 | | | |
| 5 | 0 | 3 | | | |
| 6 | 0 | 3 | | | |

## Giallo
Usato da: dado extra di molte armi.

| Faccia | Gittata | ❤️ | ⚡ | ✖️ | Note |
|---|---|---|---|---|---|
| 1 | 3 | | | | |
| 2 | 2 | | 1 | | |
| 3 | 3 | | | | |
| 4 | 2 | | 1 | | |
| 5 | 2 | 1 | | | |
| 6 | 1 | 1 | | | |

## Nero (dado potere)
Usato da: mantelli (annullano ferite), Talento naturale (trappole), carte dei mazzi con "dado potere". In REGOLE.md i dadi potere sono rimandati (si pagano con la fatica): qui servono comunque le facce.

| Faccia | ⚡ (onda) | Vuota | Altro | Note |
|---|---|---|---|---|
| 1 | | 1 | | |
| 2 | 1 | | | |
| 3 | | | 1/♥︎ | |
| 4 | 1 | | | |
| 5 | | | 1/♥︎| |
| 6 | | | 1/♥︎| |

## Domande aperte
- I dadi extra dell'eroe (quelli che compra al campo di addestramento: mischia, distanza, magia, fino a 5) sono dadi a sé, con facce proprie, o sono i verdi/gialli/neri? Nel regolamento originale è un dado nero.
- Il dado difesa (scudi) esiste nel gioco? Per ora non è tra i sei.
- Dove va il simbolo di "Mancato" nei dadi che non sono base (se va): di norma solo sul dado base.

1. I dadi extra sono i dadi potere (nero). Quando un eroe attacca, in base al tipo di attacco che fa tira il numero di dadi potere equivalenti al quel tipo indicati nella scheda PG.
2. No, per ora no.
3. Il simbolo mancato X va solo sui dadi base, sui dadi potere c'è una faccia vuota che rappresenza il "nessun bonus".