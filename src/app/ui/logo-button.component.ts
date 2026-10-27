import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { IconComponent } from './icon.component';

/** Una voce del menu dell'app. */
export interface MenuItem {
  id: string;
  label: string;
}

/**
 * Il logo dell'app (public/logo/, usato come maschera: prende il colore del testo) come bottone a pillola: è il primo elemento delle pillole in alto e apre
 * il menu generale dell'app, una tendina sotto di lui (stile mat-menu: una colonna di voci, si chiude con un tocco fuori, Esc o una scelta).
 */
@Component({
  selector: 'app-logo-button',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:pointerdown)': 'outside($event)', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    <button type="button" class="logo" aria-label="Menu" title="Menu" aria-haspopup="menu" [attr.aria-expanded]="open()" [class.open]="open()" (click)="press()">
      <app-icon name="logo/logoipsum-419" [size]="20" />
    </button>
    @if (open()) {
      <div class="menu" role="menu">
        @for (i of items(); track i.id) {
          <button type="button" role="menuitem" class="item" (click)="pick(i)">{{ i.label }}</button>
        }
      </div>
    }
  `,
  styles: `
    :host { position: relative; display: inline-flex; pointer-events: auto; }
    .logo {
      display: inline-flex; align-items: center; justify-content: center; padding: 6px; border-radius: var(--radius-1); cursor: pointer;
      background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-line-strong);
      transition: border-color 0.15s, color 0.15s;
    }
    .logo:hover, .logo:focus-visible, .logo.open { border-color: var(--c-interact); color: var(--c-interact); outline: none; }
    /* La tendina: sotto il logo, una colonna di voci */
    .menu {
      position: absolute; z-index: 40; top: calc(100% + 6px); left: 0; min-width: 210px; display: flex; flex-direction: column; padding: 4px 0;
      border-radius: var(--radius-1); background: var(--c-surface); border: 1px solid var(--c-line-strong); box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
      animation: menu-in 0.14s ease-out;
    }
    .item {
      padding: 10px 16px; border: 0; background: none; color: var(--c-text); text-align: left; cursor: pointer; font: 14px/1.2 var(--font-ui);
    }
    .item:hover, .item:focus-visible { background: color-mix(in srgb, var(--c-text) 8%, transparent); outline: none; }
    @keyframes menu-in { from { opacity: 0; transform: translateY(-4px); } }
    @media (prefers-reduced-motion: reduce) { .menu { animation: none; } }
  `,
})
export class LogoButtonComponent {
  readonly items = input<MenuItem[]>([]);
  /** Senza voci il bottone non apre nessun menu: il clic arriva a chi lo usa (nell'editor, per tornare alla home). */
  readonly pressed = output<void>();
  /** Una voce è stata scelta. */
  readonly chosen = output<string>();

  protected readonly open = signal(false);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected press() {
    if (this.items().length) this.open.set(!this.open());
    else this.pressed.emit();
  }

  protected pick(i: MenuItem) {
    this.open.set(false);
    this.chosen.emit(i.id);
  }

  /** Un tocco fuori dal menu lo chiude. */
  protected outside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
