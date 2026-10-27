import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CostTextComponent } from './cost-text.component';
import { IconComponent } from './icon.component';
import { KeyLabelComponent } from './key-label.component';

/** Una voce della legenda: `id` sceglie il disegno (vedi il template), il testo può avere costi (`{mov:N}`). */
interface LegendEntry {
  id: string;
  title: string;
  text: string;
}

/** Le voci, raggruppate: ciò che si vede sulla mappa, gli oggetti a terra, le pedine e il menu delle azioni. */
const GROUPS: { title: string; entries: LegendEntry[] }[] = [
  {
    title: 'Mappa',
    entries: [
      { id: 'wall', title: 'Muro', text: 'Blocca il movimento e la vista.' },
      { id: 'torch', title: 'Torcia', text: 'Appesa al muro: illumina la zona intorno. Non blocca niente.' },
      { id: 'door-closed', title: 'Porta chiusa', text: 'Blocca movimento, vista e attacchi. Aprirla costa {mov:2}.' },
      { id: 'door-open', title: 'Porta aperta', text: 'Si passa. Si richiude per {mov:2}, a meno che qualcuno stia nel varco.' },
      { id: 'door-key', title: 'Porta a chiave', text: 'Serve la sua chiave, oppure si scassina per {mov:4}.' },
      { id: 'door-rune', title: 'Porta runica', text: 'Si apre solo con la chiave runica del suo colore.' },
      { id: 'rock', title: 'Roccia', text: 'Non si attraversa e blocca la vista.' },
      { id: 'pit', title: 'Buca', text: 'Entrarci è una caduta: 1 ferita e il movimento finisce. Si esce per {mov:2} o si salta per {mov:3} a spazio.' },
      { id: 'water', title: 'Acqua', text: 'Non si attraversa, ma non blocca la vista.' },
      { id: 'stairs', title: 'Scala', text: 'Due scale unite da un filo tratteggiato: passare dall’una all’altra costa {mov:1}.' },
      { id: 'glyph-off', title: 'Glifo spento', text: 'Entraci per accenderlo: dà Conquista.' },
      { id: 'glyph-on', title: 'Glifo acceso', text: 'Da qui si viaggia verso un altro glifo acceso o in città.' },
      { id: 'fog', title: 'Non esplorato', text: 'Velato: nessun eroe l’ha ancora visto.' },
      { id: 'reach', title: 'Dove puoi arrivare', text: 'Il contorno ambra racchiude le caselle raggiungibili dall’eroe attivo.' },
    ],
  },
  {
    title: 'Oggetti',
    entries: [
      { id: 'chest', title: 'Scrigno', text: 'Rame, argento od oro (il colore dice il tipo). Entra nella casella per aprirlo: {mov:2}.' },
      { id: 'chest-open', title: 'Scrigno aperto', text: 'Già vuoto: resta come decorazione.' },
      { id: 'potion-heal', title: 'Pozione curativa', text: 'Si raccoglie passandoci sopra (ogni eroe ne porta 3). Berla costa {mov:1}.' },
      { id: 'potion-vital', title: 'Pozione di vitalità', text: 'Riporta la fatica al massimo.' },
      { id: 'coins', title: 'Denaro', text: 'Un mucchio vale 100 monete per ogni eroe.' },
      { id: 'key', title: 'Chiave', text: 'Apre la porta a chiave che le corrisponde.' },
      { id: 'rune', title: 'Chiave runica', text: 'Sblocca per tutti le porte runiche di quel colore.' },
    ],
  },
  {
    title: 'Pedine e azioni',
    entries: [
      { id: 'hero-active', title: 'Eroe attivo', text: 'Chi sta giocando il turno.' },
      { id: 'hero', title: 'Altro eroe', text: 'Toccalo per sceglierlo.' },
      { id: 'monster', title: 'Mostro', text: 'Tocca un mostro che vedi per attaccarlo.' },
      { id: 'monster-enhanced', title: 'Mostro potenziato', text: 'La versione forte: anello rosso.' },
      { id: 'bang', title: 'Menu delle azioni', text: 'Compare sopra l’eroe vicino a qualcosa di usabile: porte, scrigni, scale, glifi.' },
    ],
  },
];

/**
 * Il mucchio di monete della legenda, come sulla mappa ma piccolo: cerchietti pieni d'oro, più fitti al centro, con quelli in alto
 * (al centro) disegnati sopra gli altri. Fisso (non casuale) così il disegno non cambia a ogni apertura.
 */
function makeCoinPile(): { x: number; y: number; r: number }[] {
  let seed = 7;
  const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pile: { x: number; y: number; r: number; d: number }[] = [];
  for (let i = 0; i < 70; i++) {
    const a = rng() * Math.PI * 2;
    const d = 11 * Math.pow(rng(), 0.7) * (0.85 + 0.15 * Math.sin(a * 3 + 1));
    pile.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 1.5 + rng() * 0.8, d });
  }
  return pile.sort((p, q) => q.d - p.d);
}

/**
 * Il pallino "?" in fondo ai comandi della camera, sul lato destro: apre la Legenda, un pannello con un piccolo disegno e una riga di spiegazione per ogni
 * cosa che si vede sulla mappa. I disegni sono SVG semplici nei colori del tema (`--cad-*` e `--c-*`), non la scena vera.
 * Si chiude con un tocco fuori o con Esc.
 */
@Component({
  selector: 'app-legend',
  imports: [CostTextComponent, IconComponent, KeyLabelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="dot" aria-label="Legenda" title="Legenda" [attr.aria-expanded]="open()" (click)="open.set(!open())">?<app-key-label>Legenda</app-key-label></button>
    @if (open()) {
      <section class="box corners" role="dialog" aria-label="Legenda della mappa">
        @for (g of groups; track g.title) {
          <h3>{{ g.title }}</h3>
          @for (e of g.entries; track e.id) {
            <div class="row">
              <span class="sample" [attr.data-id]="e.id" aria-hidden="true">
                @switch (e.id) {
                  @case ('wall') {
                    <svg viewBox="0 0 48 48"><rect x="0" y="18" width="48" height="12" class="gap" /><path d="M0 18H48M0 30H48" class="wall" /></svg>
                  }
                  @case ('torch') {
                    <svg viewBox="0 0 48 48">
                      <defs><radialGradient id="legend-torch" cx="50%" cy="50%" r="50%"><stop offset="0" style="stop-color: var(--cad-torch-glow); stop-opacity: 0.55" /><stop offset="1" style="stop-color: var(--cad-torch-glow); stop-opacity: 0" /></radialGradient></defs>
                      <circle cx="24" cy="29" r="20" fill="url(#legend-torch)" />
                      <rect x="0" y="4" width="48" height="10" class="gap" /><path d="M0 4H48M0 14H48" class="wall" />
                      <path d="M24 15V22" class="bracket" /><circle cx="24" cy="31" r="6" class="cup" /><polygon points="30.5,31.0 31.7,33.9 30.1,36.2 27.6,36.8 25.8,37.6 24.0,38.2 22.2,37.6 20.4,36.8 17.9,36.2 16.3,33.9 17.5,31.0 19.4,29.5 19.6,27.8 20.0,25.4 21.8,24.2 24.0,24.2 26.2,24.2 28.0,25.4 28.4,27.8 28.6,29.5" class="fire outer" /><polygon points="30.1,31.0 29.2,33.0 27.7,34.2 26.7,35.3 25.4,36.1 24.0,35.9 22.6,36.2 20.5,36.7 19.1,35.2 19.7,32.7 20.4,31.0 19.9,29.7 19.8,28.0 21.0,26.8 22.4,26.1 24.0,25.4 25.6,26.2 26.2,27.9 27.0,28.9 28.9,29.4" class="fire mid" /><polygon points="27.5,31.0 26.9,32.1 26.5,33.2 25.7,33.8 24.8,33.9 24.0,34.8 22.7,35.7 21.7,34.8 21.7,33.0 21.7,31.9 21.0,31.0 20.8,30.0 21.3,29.0 21.9,28.1 22.8,27.3 24.0,27.7 24.7,28.8 25.5,29.0 26.9,28.9 27.9,29.7" class="fire core" /><polygon points="25.7,31.0 25.6,31.6 25.2,32.0 24.8,32.3 24.6,33.0 24.0,33.6 23.4,33.2 23.1,32.4 22.9,32.0 22.4,31.6 22.3,31.0 22.4,30.5 22.4,29.9 22.8,29.3 23.5,29.5 24.0,29.8 24.4,29.6 25.2,29.4 25.7,29.8 25.7,30.4" class="fire hot" />
                    </svg>
                  }
                  @case ('door-closed') {
                    <svg viewBox="0 0 48 48"><defs><pattern id="legend-hatch" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V3.5" class="hatch" /></pattern></defs><rect x="0" y="18" width="12" height="12" class="gap" /><rect x="36" y="18" width="12" height="12" class="gap" /><path d="M0 18H12M0 30H12M36 18H48M36 30H48" class="wall" /><rect x="14" y="21" width="20" height="6" fill="url(#legend-hatch)" class="leaf" /></svg>
                  }
                  @case ('door-open') {
                    <svg viewBox="0 0 48 48"><defs><pattern id="legend-hatch-open" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V3.5" class="hatch" /></pattern></defs><rect x="0" y="18" width="12" height="12" class="gap" /><rect x="36" y="18" width="12" height="12" class="gap" /><path d="M0 18H12M0 30H12M36 18H48M36 30H48" class="wall" /><rect x="14" y="24" width="6" height="20" fill="url(#legend-hatch-open)" class="leaf" /><path d="M34 24A20 20 0 0 1 14 44" class="arc" /></svg>
                  }
                  @case ('door-key') {
                    <svg viewBox="0 0 48 48"><defs><pattern id="legend-hatch-cross" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V3.5M0 0H3.5" class="hatch" /></pattern></defs><rect x="0" y="18" width="12" height="12" class="gap" /><rect x="36" y="18" width="12" height="12" class="gap" /><path d="M0 18H12M0 30H12M36 18H48M36 30H48" class="wall" /><rect x="14" y="21" width="20" height="6" fill="url(#legend-hatch-cross)" class="leaf" /></svg>
                    <span class="badge" style="--tone: var(--c-loot)"><app-icon name="tokens/padlock" [size]="11" /></span>
                  }
                  @case ('door-rune') {
                    <svg viewBox="0 0 48 48"><defs><pattern id="legend-hatch-cross" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V3.5M0 0H3.5" class="hatch" /></pattern></defs><rect x="0" y="18" width="12" height="12" class="gap" /><rect x="36" y="18" width="12" height="12" class="gap" /><path d="M0 18H12M0 30H12M36 18H48M36 30H48" class="wall" /><rect x="14" y="21" width="20" height="6" fill="url(#legend-hatch-cross)" class="leaf" /></svg>
                    <span class="badge" style="--tone: var(--cad-rune-red)"><app-icon name="diamond" [size]="11" /></span>
                  }
                  @case ('rock') {
                    <svg viewBox="0 0 48 48"><polygon points="10,28 14,14 27,9 38,17 37,32 26,38 14,36" class="stone" /><path d="M8 40h2M40 10h2M41 38h2" class="debris" /></svg>
                  }
                  @case ('pit') {
                    <svg viewBox="0 0 48 48">
                      <defs><radialGradient id="legend-pit" cx="50%" cy="50%" r="70%"><stop offset="0" style="stop-color: #000" /><stop offset="1" style="stop-color: var(--cad-floor)" /></radialGradient></defs>
                      <rect x="8" y="8" width="32" height="32" fill="url(#legend-pit)" class="pit" /><path d="M8 8l8 8M40 8l-8 8M8 40l8-8M40 40l-8-8" class="ray" />
                    </svg>
                  }
                  @case ('water') {
                    <svg viewBox="0 0 48 48"><rect x="6" y="6" width="36" height="36" rx="6" class="water" /><path d="M8 16q4-4 8 0t8 0t8 0t8 0M8 24q4-4 8 0t8 0t8 0t8 0M8 32q4-4 8 0t8 0t8 0t8 0" class="waves" /></svg>
                  }
                  @case ('stairs') {
                    <svg viewBox="0 0 48 48"><path d="M9 42V8H39V42" class="wall thick" /><path d="M13 15H35M13 22H35M13 29H35M13 36H35" class="step" /></svg>
                  }
                  @case ('glyph-off') {
                    <svg viewBox="0 0 48 48" class="glyph off"><circle cx="24" cy="24" r="17" /><circle cx="24" cy="24" r="14" /><path d="M24 8Q26 22 40 24Q26 26 24 40Q22 26 8 24Q22 22 24 8Z" /><g class="dots"><circle cx="35" cy="13" r="2.2" /><circle cx="13" cy="13" r="2.2" /><circle cx="35" cy="35" r="2.2" /><circle cx="13" cy="35" r="2.2" /></g></svg>
                  }
                  @case ('glyph-on') {
                    <svg viewBox="0 0 48 48" class="glyph on"><circle cx="24" cy="24" r="17" /><circle cx="24" cy="24" r="14" /><path d="M24 8Q26 22 40 24Q26 26 24 40Q22 26 8 24Q22 22 24 8Z" /><g class="dots"><circle cx="35" cy="13" r="2.2" /><circle cx="13" cy="13" r="2.2" /><circle cx="35" cy="35" r="2.2" /><circle cx="13" cy="35" r="2.2" /></g></svg>
                  }
                  @case ('fog') {
                    <svg viewBox="0 0 48 48"><path d="M24 0V48M0 24H48" class="grid" /><rect x="24" y="0" width="24" height="48" class="veil" /></svg>
                  }
                  @case ('reach') {
                    <svg viewBox="0 0 48 48"><path d="M16 0V48M32 0V48M0 16H48M0 32H48" class="grid" /><rect x="16" y="16" width="16" height="16" class="path-cell" /><rect x="6" y="6" width="36" height="36" class="reach" /></svg>
                  }
                  @case ('chest') {
                    <svg viewBox="0 0 48 48" class="chest"><rect x="10" y="12" width="28" height="22" rx="4" class="body" /><path d="M13 17H35M12 20H36M12 24H36M12 28H36M13 31H35" class="lid" /><rect x="21" y="32" width="6" height="5" rx="1" class="clasp" /></svg>
                  }
                  @case ('chest-open') {
                    <svg viewBox="0 0 48 48" class="chest"><rect x="10" y="12" width="28" height="22" rx="4" class="body" /><rect x="14" y="16" width="20" height="14" rx="2" class="inside" /></svg>
                  }
                  @case ('potion-heal') { <app-icon name="tokens/potion" [size]="30" style="color: var(--cad-potion-heal)" /> }
                  @case ('potion-vital') { <app-icon name="tokens/potion" [size]="30" style="color: var(--cad-potion-vital)" /> }
                  @case ('coins') {
                    <svg viewBox="-24 -24 48 48"><g class="coin">@for (c of coinPile; track $index) { <circle [attr.cx]="c.x" [attr.cy]="c.y" [attr.r]="c.r" /> }</g></svg>
                  }
                  @case ('key') { <app-icon name="tokens/little_key" [size]="30" style="color: var(--c-loot)" /> }
                  @case ('rune') { <app-icon name="tokens/rune_key" [size]="32" style="color: var(--cad-rune-red)" /> }
                  @case ('hero-active') { <span class="pawn" style="--ring: var(--c-interact)"><app-icon name="frame_person" [size]="18" /></span> }
                  @case ('hero') { <span class="pawn" style="--ring: var(--c-faction-ally)"><app-icon name="frame_person" [size]="18" /></span> }
                  @case ('monster') { <span class="pawn" style="--ring: var(--c-faction-ally)"><app-icon name="skull" [size]="18" /></span> }
                  @case ('monster-enhanced') { <span class="pawn" style="--ring: var(--c-faction-overlord)"><app-icon name="skull" [size]="18" /></span> }
                  @case ('bang') { <span class="bang"><app-icon name="priority_high" [size]="16" /></span> }
                }
              </span>
              <span class="what"><b>{{ e.title }}</b><span><app-cost-text [text]="e.text" /></span></span>
            </div>
          }
        }
      </section>
    }
  `,
  styles: `
    :host { position: relative; display: inline-flex; pointer-events: auto; user-select: none; }
    .dot {
      box-sizing: border-box; width: 34px; height: 34px; padding: 0; border-radius: var(--radius-1); cursor: pointer;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-text);
      font: 600 15px/1 var(--font-ui); transition: color 0.15s, border-color 0.15s;
    }
    .dot:hover, .dot:focus-visible, .dot[aria-expanded='true'] { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    /* Il pannello si apre a destra, accanto ai comandi della camera, sotto il blocco del Signore supremo, e scorre se non ci sta. */
    .box {
      position: fixed; z-index: 30; right: 56px; top: calc(env(safe-area-inset-top) + 100px); width: 360px; max-width: calc(100vw - 68px); max-height: calc(100dvh - 100px - 24px - env(safe-area-inset-top));
      overflow-y: auto; box-sizing: border-box; padding: 4px 16px 12px;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); color: var(--c-text); font: 13px/1.4 var(--font-ui);
    }
    h3 { margin: 14px 0 6px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .row { display: flex; align-items: center; gap: 12px; padding: 5px 0; }
    .what { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
    .what b { font-weight: 600; }
    .what span { color: var(--c-text-dim); font-size: 12px; }
    /* Il disegno: una casella di pavimento con sopra l'elemento. */
    .sample {
      position: relative; flex: none; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 48px; height: 48px;
      overflow: hidden; border-radius: var(--radius-1); background: var(--cad-floor); border: 1px solid var(--c-line);
    }
    svg { display: block; width: 100%; height: 100%; }
    .gap { fill: var(--cad-wall-gap); }
    .wall { fill: none; stroke: var(--cad-wall); stroke-width: 2; }
    .wall.thick { stroke-width: 3; }
    .grid { stroke: var(--cad-grid); stroke-width: 1; fill: none; opacity: 0.55; }
    /* La porta come nella scena: contorno sottile con tratteggio diagonale (incrociato se ha una serratura); aperta, l'anta sta in piedi accanto al cardine e un arco tratteggiato mostra il suo percorso. */
    .leaf { stroke: var(--cad-door); stroke-width: 1; stroke-opacity: 0.8; }
    .hatch { stroke: var(--cad-door); stroke-width: 1; opacity: 0.4; }
    .arc { fill: none; stroke: var(--cad-door); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.4; }
    .badge { position: absolute; left: 50%; top: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-round); background: var(--cad-floor); border: 1px solid var(--tone); color: var(--tone); }
    .coin circle { fill: var(--cad-coin); stroke: var(--cad-coin-edge); stroke-width: 0.5; }
    .bracket { stroke: var(--cad-wall); stroke-width: 2; stroke-linecap: round; fill: none; }
    .cup { fill: none; stroke: var(--cad-wall); stroke-width: 1.6; }
    .fire.outer { fill: var(--cad-torch-outer); opacity: 0.9; }
    .fire.mid { fill: var(--cad-torch-flame); }
    .fire.core { fill: var(--cad-torch-core); }
    .fire.hot { fill: var(--cad-torch-hot); }
    .stone { fill: var(--cad-stone-fill); stroke: var(--cad-stone-line); stroke-width: 1.5; stroke-linejoin: round; }
    .debris { stroke: var(--cad-stone-line); stroke-width: 2; stroke-linecap: round; opacity: 0.55; }
    .pit { stroke: var(--cad-pit-line); stroke-width: 1; stroke-opacity: 0.5; }
    .ray { stroke: var(--cad-pit-ray); stroke-width: 1; opacity: 0.5; fill: none; }
    .water { fill: color-mix(in srgb, var(--cad-water) 7%, transparent); stroke: var(--cad-water); stroke-width: 1.2; }
    .waves { fill: none; stroke: var(--cad-water); stroke-width: 1; opacity: 0.4; }
    .step { fill: none; stroke: var(--cad-grid); stroke-width: 1.5; stroke-linecap: round; }
    .glyph { fill: none; stroke-width: 1; }
    .glyph.off { stroke: var(--cad-crack); opacity: 0.9; }
    .glyph.off .dots circle { fill: var(--cad-floor); }
    .glyph.on { stroke: var(--cad-glyph-on); filter: drop-shadow(0 0 3px var(--cad-glyph-on)); }
    .glyph.on .dots circle { fill: var(--cad-floor); }
    .veil { fill: var(--c-bg); opacity: 0.7; }
    .path-cell { fill: #f0d060; opacity: 0.15; }
    .reach { fill: none; stroke: var(--c-interact); stroke-width: 1.5; }
    .chest .body { fill: var(--cad-floor); stroke: var(--cad-chest-copper); stroke-width: 1.5; }
    .chest .lid { stroke: var(--cad-chest-copper); stroke-width: 1; opacity: 0.6; }
    .chest .clasp { fill: var(--cad-chest-copper); }
    .chest .inside { fill: #000; opacity: 0.55; stroke: var(--cad-chest-copper); stroke-width: 0.8; }
    .pawn { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 34px; height: 34px; border-radius: var(--radius-round); background: var(--c-surface); border: 2px solid var(--ring); color: var(--c-text-dim); }
    .bang { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 26px; height: 26px; border-radius: var(--radius-round); background: var(--c-surface); border: 1.5px solid var(--c-interact); color: var(--c-interact); }
    @media (pointer: coarse) { .dot { width: 44px; height: 44px; } .box { right: 66px; } }
  `,
})
export class LegendComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly open = signal(false);
  protected readonly groups = GROUPS;
  protected readonly coinPile = makeCoinPile();

  @HostListener('document:keydown.escape') onEscape() { this.open.set(false); }
  @HostListener('document:pointerdown', ['$event']) onOutside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
