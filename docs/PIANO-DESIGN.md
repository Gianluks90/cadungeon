# CADungeon — Piano di design e fix UI

Obiettivo: dare al gioco un'identità riconoscibile ("tavola tecnica da dungeon CAD") e renderlo coerente.
Principi del progetto da rispettare: **un colore = un solo significato**, stile lineare con contorni sottili, **niente campiture piene**, UI minimale e contestuale.

Token e componenti base: `src/styles/tokens.css` (importato per primo in angular.json).

---

## Fase 0 — Fondamenta (1 sessione)

- [x] Copiare `tokens.css` in `src/styles/` e importarlo globalmente
- [x] Sostituire TUTTI i colori hardcoded con variabili `--c-*` (cerca `#`, `rgb(`, `hsl(` nei CSS/SVG/Pixi)
- [x] Per PixiJS: esporre i token a runtime (`getComputedStyle(document.documentElement).getPropertyValue('--c-wall')`) e convertirli in numeri esadecimali in un unico modulo `theme.ts`
- [x] Caricare i font: display serif (Cinzel o simile), Inter, JetBrains Mono
- [x] Aggiungere `data-theme` su `<html>` (per ora solo dark)

## Fase 1 — Colore e significato

| Significato | Token | Dove |
|---|---|---|
| Interagibile / attivo | `--c-interact` | token "!", eroe attivo, glow torce, angoli pannello |
| Vita | `--c-life` | cuori, dado mischia |
| Velocità | `--c-speed` | icona velocità, dado distanza |
| Fatica | `--c-stamina` | icona fatica |
| Armatura | `--c-armor` | icona scudo |
| Magia | `--c-magic` | pozioni magiche, dado magia |
| Acqua | `--c-water` | solo tile acqua |
| Tesori | `--c-loot` | monete, chiavi (sabbia spenta, non più oro) |

- [x] Monete, chiave, lucchetto, pozione arancione: togliere l'oro e usare `--c-loot` / colore semantico
- [x] Bordo muro (era il perimetro di movimento: ok così) stanze esplorate: da oro a `--c-wall` / `--c-line-strong` (l'oro resta solo per l'interazione)
- [x] Blu: usarlo SOLO per l'acqua; l'icona attiva in alto passa a `--c-interact`
- [x] Dadi: stesso colore = stesso tipo ovunque (spada, extra, tiri). Neutri grigi solo se "non assegnati"
- [x] Aggiungere una piccola legenda colori nel pannello aiuto

## Fase 2 — Leggibilità e gerarchia

- [x] Alzare il contrasto: testi secondari `--c-text-dim` (≥ 4.5:1), ripulire i grigi quasi invisibili (icone HUD a destra, "Distanza", "Astuzia 0")
- [x] HUD in alto: `Round` e `Conquista` come `.pill--primary`, le altre `.pill` secondarie
- [x] Barra comandi in basso: classe `.keyboard-hints`, nascosta sui dispositivi touch; su desktop spostata in un pannello "?" 
- [x] Zoom iniziale: mappa intera (scelta rivista); pulsanti "mostra tutta la mappa" e "centra sull'eroe"
- [x] Pannello inventario: aggiungere padding finale in fondo, niente testo tagliato ("Zaino vuoto")

## Fase 3 — Stile coerente (forme e icone)

- [x] Raggi: pannelli, pill e bottoni a `--radius-1` (2px); tondi solo token/pedine
- [ ] Icone: tutte outline, stroke 1.5px, 18px (cuore, goccia, scudo, moneta, chiave, zaino, pozione): rifare le piene/dettagliate
- [x] Tipografia: nomi e titoli in `--font-display`; etichette in `.label` (maiuscolo spaziato); numeri HUD in `.num`
- [ ] Carta personaggio: sovrapposizione col pannello deliberata (ombra + z-index), nome e classe non schiacciati; valutare rotazione solo in hover
- [x] Slot pozioni: stato vuoto con bordo tratteggiato e icona tenue, stato pieno col colore semantico

## Fase 4 — Mappa

- [x] Fog of war: tile non esplorati con `.fog` (tratteggio diagonale), esplorati con linea piena; niente riempimento colorato
- [x] Il "!" appare solo quando esiste un'azione reale, con `.action-hint`
- [x] Token per fazione: anello oro eroe attivo, grigio alleati, rosso brace Overlord; ordine di turno in basso con lo stesso anello
- [x] Tooltip trasferimento oggetto ("Dai a Anarien: spada"): freccia verso il token, font più grande, bordo `--c-interact`
- [ ] Porte: campitura diagonale come da stile (rifacimento già pianificato)

## Fase 5 — Identità (signature)

- [x] Angoli "quota CAD" (`.panel::before/::after`) su tutti i pannelli
- [x] Etichette in stile tavola tecnica, con numerazione opzionale (es. "01 — PARAMETRI")
- [ ] Animazione `.draw-in`: le linee dei muri si disegnano quando si rivela una stanza
- [x] ~~Tema blueprint (bianco/blu) come toggle nelle impostazioni~~ (provato e rimosso: c'è un solo tema)
- [x] Rispetto di `prefers-reduced-motion`

## Fase 6 — Verifica

- [ ] Screenshot prima/dopo su iPad e desktop
- [ ] Controllo contrasti (Lighthouse o axe)
- [x] Test su touch: tap target ≥ 44px, nessuna dipendenza da tastiera
- [x] Sostituire il Lorem ipsum delle abilità con testi reali

---

## Ordine consigliato
Fase 0 → 1 → 2 (si vede già un salto enorme) → 3 → 4 → 5 → 6.
Ogni fase = un commit, così si può tornare indietro facilmente.

## Nota per Claude Code / Cowork
Prima di toccare qualsiasi file: leggere `CLAUDE.md` e `docs/REGOLE.md`, poi applicare una fase alla volta e fare screenshot di verifica a fine fase.
