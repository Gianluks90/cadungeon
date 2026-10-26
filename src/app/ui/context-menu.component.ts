import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal } from '@angular/core';
import { ContextAction } from '../game/state/actions';
import { CostTextComponent } from './cost-text.component';
import { IconComponent } from './icon.component';

/**
 * Il bottone contestuale: sopra la pedina dell'eroe compare un bottone tondo con un punto esclamativo quando c'è qualcosa
 * da fare lì vicino. Un clic lo apre in tanti pallini, uno per azione, con il costo; un'azione impossibile resta visibile e
 * dice il motivo. `anchor` è il punto dello schermo (pixel) sopra la pedina.
 * Con il mouse la didascalia compare al passaggio e un clic esegue. Con il tocco (o la penna), dove non c'è il passaggio, il primo tocco su un pallino lo
 * seleziona e mostra la didascalia (nome e costo, o il motivo se non è possibile) e un secondo tocco sullo stesso pallino esegue. Si guarda il tipo di puntatore
 * di ogni tocco, non il dispositivo: un portatile con schermo touch usato con il mouse si comporta come un desktop.
 */
@Component({
  selector: 'app-context-menu',
  imports: [CostTextComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:pointerdown)': 'outside($event)', '(document:keydown.escape)': 'close()' },
  template: `
    @if (visible()) {
      <div class="anchor" [style.left.px]="anchor()!.x" [style.top.px]="anchor()!.y">
        @if (isOpen()) {
          @if (caption()) { <span class="caption"><app-cost-text [text]="caption()" /></span> }
          <div class="dots">
            @for (a of actions(); track a.id) {
              <button type="button" class="dot" [class.off]="!a.enabled" [class.sel]="selectedId() === a.id" [attr.aria-label]="a.label" [attr.aria-disabled]="!a.enabled"
                (pointerdown)="pointerType = $event.pointerType" (click)="pick(a)" (mouseenter)="hoveredId.set(a.id)" (mouseleave)="hoveredId.set(null)" (focus)="hoveredId.set(a.id)" (blur)="hoveredId.set(null)">
                <app-icon [name]="a.icon" [size]="20" />
                @if (a.cost > 0) { <span class="cost"><app-icon name="footprint" [size]="10" />{{ a.cost }}</span> }
              </button>
            }
          </div>
        }
        <button type="button" class="bang action-hint" [class.open]="isOpen()" aria-label="Azioni possibili qui" [attr.aria-expanded]="isOpen()" (click)="open.set(!open())">
          <app-icon [name]="bangIcon()" [size]="20" />
        </button>
      </div>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; z-index: 20; pointer-events: none; }
    .anchor { position: absolute; transform: translate(-50%, calc(-100% - 8px)); display: flex; flex-direction: column; align-items: center; gap: 6px; }
    button { pointer-events: auto; cursor: pointer; padding: 0; border: 0; border-radius: var(--radius-1); position: relative; font: 11px/1 var(--font-ui); }
    .bang {
      border-radius: var(--radius-round);
      width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--c-surface); color: var(--c-interact);
      box-shadow: 0 0 0 2px var(--c-interact); transition: transform 0.15s;
    }
    .bang:hover, .bang.open { transform: scale(1.08); }
    /* Il "!" compare solo se c'è davvero un'azione: l'anello pulsa piano. */
    .action-hint:not(.open) { animation: hint-pulse 2.4s var(--ease-draw) infinite; }
    @keyframes hint-pulse {
      0%, 100% { box-shadow: 0 0 0 2px var(--c-interact), 0 0 0 2px transparent; }
      50% { box-shadow: 0 0 0 2px var(--c-interact), 0 0 0 7px color-mix(in srgb, var(--c-interact) 25%, transparent); }
    }
    @media (prefers-reduced-motion: reduce) { .action-hint { animation: none !important; } }
    .dots { display: flex; gap: 6px; padding: 5px; border-radius: var(--radius-1); background: var(--c-surface); border: 1px solid var(--c-line-strong); }
    .dot {
      width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--c-tile); color: var(--c-text); box-shadow: 0 0 0 1px var(--c-line);
    }
    .dot.sel, .dot:hover, .dot:focus-visible { box-shadow: 0 0 0 2px var(--c-interact); outline: none; }
    .dot.off { opacity: 0.45; }
    /* Il costo in punti movimento: l'icona delle impronte e il valore, in verde. */
    .cost {
      position: absolute; right: -4px; bottom: -4px; display: inline-flex; align-items: center; gap: 1px; height: 16px; padding: 0 4px; border-radius: var(--radius-1); box-sizing: border-box;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-speed); font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .caption {
      position: relative; padding: 5px 12px; border-radius: var(--radius-1); background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-interact);
      font: 14px/1.2 var(--font-ui); white-space: nowrap; pointer-events: none; margin-bottom: 4px;
    }
    /* La freccia punta verso i pallini e la pedina sotto. */
    .caption::after {
      content: ''; position: absolute; left: 50%; bottom: -5px; width: 8px; height: 8px; box-sizing: border-box; transform: translateX(-50%) rotate(45deg);
      background: var(--c-surface); border: solid var(--c-interact); border-width: 0 1px 1px 0;
    }
    @media (pointer: coarse) { .bang { width: 44px; height: 44px; } .dot { width: 44px; height: 44px; } }
  `,
})
export class ContextMenuComponent {
  /** Il punto sullo schermo (pixel) appena sopra la pedina dell'eroe attivo; null = nascosto. */
  readonly anchor = input<{ x: number; y: number } | null>(null);
  readonly actions = input<ContextAction[]>([]);
  /** L'azione scelta (solo se è possibile). */
  readonly chosen = output<string>();
  /** L'azione scelta non è possibile: il motivo, da mostrare al giocatore. */
  readonly denied = output<string>();
  /** Il menu si è chiuso per un tocco fuori, Esc o una scelta: chi lo usa per un bersaglio lo deseleziona. */
  readonly closed = output<void>();
  /** Si apre da solo quando compaiono le azioni (per il menu di un bersaglio da attaccare). */
  readonly autoOpen = input(false);
  /** L'icona del bottone tondo. */
  readonly bangIcon = input('priority_high');

  protected readonly open = signal(false);
  /** L'azione su cui sta il puntatore: si ricorda solo l'id, così la didascalia legge sempre i dati aggiornati. */
  protected readonly hoveredId = signal<string | null>(null);
  /** Con il tocco: il pallino selezionato dal primo tocco (il secondo lo esegue). */
  protected readonly selectedId = signal<string | null>(null);
  /** Il tipo di puntatore dell'ultimo tocco su un pallino: 'mouse', 'touch' o 'pen'. */
  protected pointerType = 'mouse';
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly visible = computed(() => this.anchor() !== null && this.actions().length > 0);
  protected readonly isOpen = computed(() => this.open() && this.visible());
  protected readonly caption = computed(() => {
    const a = this.actions().find((x) => x.id === (this.selectedId() ?? this.hoveredId()));
    if (!a) return '';
    return a.enabled ? `${a.label}${a.cost ? ` · {mov:${a.cost}}` : ''}` : `${a.label} · ${a.reason ?? 'non è possibile'}`;
  });

  constructor() {
    // Se le azioni cambiano (l'eroe ha agito, si è mosso, è cambiato l'eroe attivo) il menu si richiude: si riapre già aggiornato.
    effect(() => {
      const list = this.actions();
      this.open.set(this.autoOpen() && list.length > 0);
    });
    effect(() => {
      if (!this.isOpen()) {
        this.hoveredId.set(null);
        this.selectedId.set(null);
      }
    });
  }

  /** Un tocco fuori dal menu lo chiude. */
  protected outside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  protected close() {
    if (!this.open()) return;
    this.open.set(false);
    this.closed.emit();
  }

  protected pick(a: ContextAction) {
    const touch = this.pointerType === 'touch' || this.pointerType === 'pen';
    if (touch) {
      // Primo tocco: seleziona e mostra la didascalia (anche il motivo, se non è possibile). Secondo tocco: esegue.
      if (this.selectedId() !== a.id) {
        this.selectedId.set(a.id);
        return;
      }
      if (!a.enabled) return;
    } else if (!a.enabled) {
      this.denied.emit(a.reason ?? 'Non è possibile');
      return;
    }
    this.chosen.emit(a.id);
    this.close();
  }
}
