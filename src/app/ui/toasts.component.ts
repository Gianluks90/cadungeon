import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

/** Una notifica: un'icona e un breve testo. */
export interface Toast {
  id: number;
  icon: string;
  text: string;
  /** Sta per sparire: parte la dissolvenza. */
  leaving?: boolean;
}

/** Le notifiche, in pila in alto a destra: compaiono con una breve animazione e spariscono da sole. */
@Component({
  selector: 'app-toasts',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (t of toasts(); track t.id) {
      <div class="toast" [class.leaving]="t.leaving" role="status">
        <app-icon [name]="t.icon" [size]="18" />
        <span>{{ t.text }}</span>
      </div>
    }
  `,
  styles: `
    :host { position: absolute; z-index: 30; top: calc(12px + env(safe-area-inset-top)); right: 12px; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; width: min(320px, calc(100vw - 24px)); pointer-events: none; }
    .toast {
      display: flex; align-items: center; gap: 9px; box-sizing: border-box; width: 100%; padding: 8px 14px 8px 11px; border-radius: 20px;
      background: var(--cad-ui-panel, #000); color: var(--cad-ui-text, #d8cfc4); font: 13px/1.25 system-ui, sans-serif;
      border: 1px solid var(--cad-ui-panel-border, #5a554d);
      animation: toast-in 0.22s ease-out; transition: opacity 0.25s, transform 0.25s;
    }
    app-icon { color: var(--cad-notice, #e0a040); }
    .toast.leaving { opacity: 0; transform: translateX(12px); }
    @keyframes toast-in { from { opacity: 0; transform: translateX(16px); } }
    @media (prefers-reduced-motion: reduce) { .toast { animation: none; transition: none; } }
  `,
})
export class ToastsComponent {
  readonly toasts = input.required<Toast[]>();
}
