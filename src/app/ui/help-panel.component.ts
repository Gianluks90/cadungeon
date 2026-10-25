import { setTokenTheme } from '../game/theme';
import { ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, signal } from '@angular/core';

/** Un significato dei colori: il token CSS e la spiegazione. Un colore = un significato. */
const LEGEND: { token: string; text: string }[] = [
  { token: '--c-interact', text: 'Eroe attivo e ciò che puoi fare ora' },
  { token: '--c-life', text: 'Vita e danno' },
  { token: '--c-speed', text: 'Movimento' },
  { token: '--c-stamina', text: 'Fatica' },
  { token: '--c-armor', text: 'Armatura' },
  { token: '--c-magic', text: 'Magia' },
  { token: '--c-water', text: 'Acqua' },
  { token: '--c-loot', text: 'Monete, chiavi e tesori' },
  { token: '--c-danger', text: 'Pericolo' },
];

/** I comandi da tastiera (nascosti sui dispositivi touch). */
const KEYS: [string, string][] = [
  ['Clic', 'muovi'],
  ['!', 'azioni vicino all\'eroe'],
  ['R', 'correre'],
  ['C', 'combattere'],
  ['Invio', 'passa'],
  ['P · D · O', 'strumenti: tile, porte, ostacoli'],
];

/**
 * Il pallino "?" in basso a sinistra (accanto al nord): apre un piccolo pannello con i comandi da tastiera
 * (solo dove c'è una tastiera) e la legenda dei colori. Si chiude con un tocco fuori o con Esc.
 */
@Component({
  selector: 'app-help-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="dot" aria-label="Aiuto" title="Aiuto" [attr.aria-expanded]="open()" (click)="open.set(!open())">?</button>
    @if (open()) {
      <section class="box corners" role="dialog" aria-label="Aiuto">
        <div class="keyboard-hints">
          <h3>Comandi</h3>
          @for (k of keys; track k[0]) { <p><kbd>{{ k[0] }}</kbd> {{ k[1] }}</p> }
        </div>
        <h3>Colori</h3>
        @for (l of legend; track l.token) {
          <p><i class="sw" [style.background]="'var(' + l.token + ')'"></i> {{ l.text }}</p>
        }
        <h3>Tema</h3>
        <button type="button" class="theme" (click)="toggleTheme()">{{ blueprint() ? 'Torna al tema scuro' : 'Tema blueprint' }}</button>
      </section>
    }
  `,
  styles: `
    .box { position: absolute; }
    :host { position: absolute; z-index: 10; left: 54px; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 12px); user-select: none; }
    .dot {
      box-sizing: border-box; width: 34px; height: 34px; padding: 0; border-radius: var(--radius-1); cursor: pointer;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-text);
      font: 600 15px/1 var(--font-ui); transition: color 0.15s, border-color 0.15s;
    }
    .dot:hover, .dot:focus-visible, .dot[aria-expanded='true'] { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    .box {
      position: absolute; left: 0; bottom: 44px; width: max-content; max-width: calc(100vw - 24px); box-sizing: border-box; padding: 6px 16px 12px;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); color: var(--c-text); font: 13px/1.6 var(--font-ui);
    }
    h3 { margin: 10px 0 4px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    p { margin: 0; display: flex; align-items: center; gap: 8px; }
    kbd { min-width: 46px; font: 600 12px var(--font-mono); color: var(--c-text-dim); }
    .theme { margin-top: 2px; padding: 6px 12px; min-height: 32px; border-radius: var(--radius-1); background: none; color: var(--c-text); border: 1px solid var(--c-line-strong); font: 12px var(--font-ui); cursor: pointer; }
    .theme:hover, .theme:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    .sw { flex: none; width: 16px; height: 3px; border-radius: var(--radius-1); }
    @media (pointer: coarse) { .dot { width: 44px; height: 44px; } .box { bottom: 54px; } .theme { min-height: 44px; } }
  `,
})
export class HelpPanelComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly open = signal(false);
  protected readonly blueprint = signal(document.documentElement.dataset['theme'] === 'blueprint');

  protected toggleTheme() {
    const next = this.blueprint() ? 'dark' : 'blueprint';
    setTokenTheme(next);
    this.blueprint.set(next === 'blueprint');
  }
  protected readonly keys = KEYS;
  protected readonly legend = LEGEND;

  @HostListener('document:keydown.escape') onEscape() { this.open.set(false); }
  @HostListener('document:pointerdown', ['$event']) onOutside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
