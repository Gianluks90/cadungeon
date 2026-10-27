import { ChangeDetectionStrategy, Component, HostListener, input, output, signal } from '@angular/core';
import { CostTextComponent } from './cost-text.component';
import { IconComponent } from './icon.component';

/** Chi parla in una notifica: un eroe (con il ritratto), l'Overlord o il gioco stesso (senza ritratto). */
export interface ToastAuthor {
  name: string;
  /** Percorso del ritratto in public/ (es. characters/ferdinand.webp). Senza, si vede l'icona della notifica. */
  portrait?: string;
}

/** Una notifica: chi la manda, un titolo (la categoria), un'icona e il testo, che compare dopo. */
export interface Toast {
  id: number;
  icon: string;
  title: string;
  author: ToastAuthor;
  text: string;
  /** Sta per sparire: parte la dissolvenza. */
  leaving?: boolean;
}

/** Il titolo di una notifica: la sua categoria, dedotta dall'icona. */
export function noticeTitle(icon: string): string {
  const titles: Record<string, string> = {
    warning: 'Attenzione', skull: 'Pericolo', lock: 'Serratura', lock_open: 'Serratura', inventory_2: 'Inventario', castle: 'Città',
    'tokens/potion': 'Pozioni', deployed_code: 'Dadi', autorenew: 'Round', info: 'Informazione', brightness_empty: 'Glifo', stairs: 'Scale',
    'tokens/gold_pile': 'Denaro', 'tokens/little_key': 'Chiavi', 'tokens/rune_key': 'Chiavi',
  };
  return titles[icon] ?? (icon.startsWith('tokens/items/') ? 'Equipaggiamento' : 'Notizia');
}

/** Quanto resta una notifica prima di sparire (la barra si esaurisce in questo tempo), e il ritardo dopo cui si espande. */
export const TOAST_MS = 4600;
const TOAST_EXPAND_DELAY_MS = 380;

/**
 * Le notifiche, in pila in alto a destra. Ognuna entra da destra con il ritratto dell'autore e il titolo, poi si espande e mostra il testo;
 * una barra sottile in fondo si esaurisce per dire quanto manca alla dissolvenza. Con il mouse il tempo si ferma finché il puntatore è sopra;
 * con il tocco si ferma al tocco e riparte con un secondo tocco sulla notifica o un tocco altrove.
 */
@Component({
  selector: 'app-toasts',
  imports: [CostTextComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (t of toasts(); track t.id) {
      <div class="toast" [class.leaving]="t.leaving" [class.paused]="isPaused(t.id)" role="status"
           (pointerenter)="enter($event, t.id)" (pointerleave)="leave($event, t.id)" (pointerdown)="down($event, t.id)">
        <div class="head">
          <span class="avatar">
            @if (t.author.portrait) { <img [src]="t.author.portrait" [alt]="t.author.name" draggable="false" /> } @else { <app-icon [name]="t.icon" [size]="16" /> }
          </span>
          <span class="who"><b>{{ t.title }}</b><small>{{ t.author.name }}</small></span>
          <app-icon class="mark" [name]="t.icon" [size]="16" />
        </div>
        <div class="body"><div class="inner"><app-cost-text [text]="t.text" /></div></div>
        <span class="time" (animationend)="expired.emit(t.id)"></span>
      </div>
    }
  `,
  styles: `
    /* Al centro dello schermo, in alto; entrano scendendo dall'alto. Su schermi stretti scendono sotto il blocco del Signore supremo, che occupa l'angolo. */
    :host { position: absolute; z-index: 30; top: calc(12px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; width: min(320px, calc(100vw - 24px)); pointer-events: none; }
    @media (max-width: 720px) { :host { top: calc(12px + env(safe-area-inset-top) + 76px + 8px); } }
    .toast {
      position: relative; overflow: hidden; box-sizing: border-box; width: 100%; border-radius: var(--radius-1); pointer-events: auto;
      background: var(--c-surface); color: var(--c-text); font: 13px/1.3 var(--font-ui);
      border: 1px solid var(--c-line-strong);
      animation: toast-in 0.26s ease-out; transition: opacity 0.25s, transform 0.25s;
    }
    .toast.leaving { opacity: 0; transform: translateY(-12px); pointer-events: none; }
    .head { display: flex; align-items: center; gap: 9px; padding: 7px 11px 7px 8px; }
    .avatar { flex: none; width: 26px; height: 26px; border-radius: var(--radius-1); overflow: hidden; display: inline-flex; align-items: center; justify-content: center; background: var(--c-tile); box-shadow: 0 0 0 1px var(--c-line); color: var(--c-text-dim); }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .who b { font: 600 12px/1.1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; }
    .who small { color: var(--c-text-dim); font-size: 11px; }
    .mark { color: var(--c-interact); }
    /* Il testo compare dopo l'ingresso: la riga si apre da 0 a tutta la sua altezza */
    .body { display: grid; grid-template-rows: 0fr; opacity: 0; animation: toast-open 0.26s ease-out ${TOAST_EXPAND_DELAY_MS}ms forwards; }
    .inner { overflow: hidden; min-height: 0; padding: 0 11px; }
    .body .inner > * { display: block; padding: 0 0 9px 35px; }
    /* La barra del tempo: si esaurisce da destra a sinistra; in pausa si ferma */
    .time { position: absolute; left: 4px; right: 4px; bottom: 4px; height: 2px; border-radius: 1px; background: var(--c-text-dim); opacity: 0.55; transform-origin: left; animation: toast-time ${TOAST_MS}ms linear ${TOAST_EXPAND_DELAY_MS}ms forwards; }
    .toast.paused .time { animation-play-state: paused; opacity: 0.9; }
    @keyframes toast-in { from { opacity: 0; transform: translateY(-24px); } }
    @keyframes toast-open { to { grid-template-rows: 1fr; opacity: 1; } }
    @keyframes toast-time { to { transform: scaleX(0); } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; transition: none; } .body { animation: none; grid-template-rows: 1fr; opacity: 1; } }
  `,
})
export class ToastsComponent {
  readonly toasts = input.required<Toast[]>();
  /** La barra è finita: la notifica deve sparire. */
  readonly expired = output<number>();

  /** Notifiche ferme: per il mouse finché il puntatore è sopra, per il tocco fino a un altro tocco. */
  private readonly paused = signal<ReadonlySet<number>>(new Set());
  private readonly touchPaused = new Set<number>();

  protected isPaused(id: number): boolean {
    return this.paused().has(id);
  }

  private set(id: number, on: boolean) {
    this.paused.update((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  /** Il mouse entra: tempo fermo (il tipo di puntatore si guarda a ogni evento, non il dispositivo). */
  protected enter(e: PointerEvent, id: number) {
    if (e.pointerType !== 'touch') this.set(id, true);
  }

  protected leave(e: PointerEvent, id: number) {
    if (e.pointerType !== 'touch') this.set(id, false);
  }

  /** Tocco: ferma il tempo; un secondo tocco sulla stessa notifica lo fa ripartire. */
  protected down(e: PointerEvent, id: number) {
    if (e.pointerType !== 'touch') return;
    if (this.touchPaused.has(id)) {
      this.touchPaused.delete(id);
      this.set(id, false);
    } else {
      this.touchPaused.add(id);
      this.set(id, true);
    }
  }

  /** Un tocco altrove fa ripartire le notifiche ferme dal tocco. */
  @HostListener('document:pointerdown', ['$event'])
  protected outside(e: PointerEvent) {
    if (e.pointerType !== 'touch' || !this.touchPaused.size) return;
    const inside = e.composedPath().some((n) => n instanceof HTMLElement && n.classList.contains('toast'));
    if (inside) return; // lo gestisce `down`, che sa quale notifica è
    for (const id of this.touchPaused) this.set(id, false);
    this.touchPaused.clear();
  }
}
