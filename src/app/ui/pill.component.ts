import { ChangeDetectionStrategy, booleanAttribute, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { IconComponent } from './icon.component';

/** Quanto dura il conteggio da un valore al successivo, e il breve lampo della pillola quando si aggiorna, in millisecondi. */
const COUNT_MS = 600;
const FLASH_MS = 900;

/**
 * Una pillola nera con icona, testo e valore: per i contatori in alto (Conquista, Round, ...).
 * Un valore numerico che cambia non salta: scorre dal valore di prima al nuovo, come un contatore, e la pillola si illumina
 * un attimo (bordo e alone ambra). Lo stesso quando un'icona spenta si accende (`dim` che passa a falso).
 */
@Component({
  selector: 'app-pill',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.icon-only]': 'iconOnly()', '[class.dim]': 'dim()', '[class.primary]': 'primary()', '[class.button]': 'button()', '[attr.role]': "button() ? 'button' : null", '[attr.tabindex]': 'button() ? 0 : null' },
  template: `
    <app-icon [name]="icon()" [size]="18" [style.color]="color()" />
    @if (label()) { <span class="caption">{{ label() }}</span> }
    @if (value() !== '') { <span class="value">{{ shown() }}</span> }
  `,
  styles: `
    :host {
      display: inline-flex; align-items: center; gap: 7px; padding: 6px 14px 6px 10px; border-radius: var(--radius-1);
      background: var(--c-surface); color: var(--c-text-dim); border: 1px solid var(--c-line);
      font: 13px/1 var(--font-ui); user-select: none; pointer-events: none;
    }
    /* Una pillola che si tocca (per esempio Obiettivo): riceve i clic e si accende al passaggio. */
    :host(.button) { pointer-events: auto; cursor: pointer; transition: color 0.15s, border-color 0.15s; }
    :host(.button:hover), :host(.button:focus-visible) { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    :host(.primary) { color: var(--c-text); border-color: var(--c-line-strong); }
    .caption { color: var(--c-text-dim); }
    .value { font-family: var(--font-mono); font-weight: 600; font-variant-numeric: tabular-nums; }
    :host(.alert) { color: var(--c-life); }
    :host(.icon-only) { padding: 6px; }
    :host(.dim) { opacity: 0.55; }
    :host(.dim) app-icon { filter: grayscale(1); }
  `,
})
export class PillComponent {
  readonly icon = input.required<string>();
  readonly label = input('');
  readonly value = input<string | number>('');
  /** Il colore dell'icona (un valore CSS, di solito una variabile del tema); se manca, ha il colore del testo. */
  readonly color = input<string | null>(null);
  /** Spenta: l'icona è desaturata e tenue (per ciò che non si ha ancora). */
  readonly dim = input(false);
  /** Pillola principale (Round, Conquista): testo e bordo più chiari delle altre. */
  readonly primary = input(false, { transform: booleanAttribute });
  /** La pillola è un bottone: il clic arriva a chi la usa. */
  readonly button = input(false, { transform: booleanAttribute });
  protected readonly iconOnly = computed(() => !this.label() && this.value() === '');

  /** Il valore mostrato adesso: durante il conteggio sta a metà strada fra il vecchio e il nuovo. */
  protected readonly shown = signal<string | number>('');
  private current = 0;
  private frame = 0;
  private started = false;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private wasDim: boolean | null = null;

  constructor() {
    const reduceMotion = this.reduceMotion;
    effect(() => {
      const target = this.value();
      untracked(() => {
        cancelAnimationFrame(this.frame);
        // Il primo valore compare subito; i testi e chi preferisce meno movimento non si animano.
        if (typeof target !== 'number' || !this.started || reduceMotion || this.current === target) {
          this.started = true;
          if (typeof target === 'number') this.current = target;
          this.shown.set(target);
          return;
        }
        this.count(target);
        this.flash();
      });
    });
    effect(() => {
      const dim = this.dim();
      untracked(() => {
        if (this.wasDim === true && !dim) this.flash();
        this.wasDim = dim;
      });
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(this.frame));
  }

  /** Un lampo breve: il bordo e un alone si accendono nel colore dell'accento e tornano com'erano. */
  private flash() {
    if (this.reduceMotion || typeof this.host.nativeElement.animate !== 'function') return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--c-interact').trim();
    const rest = getComputedStyle(this.host.nativeElement);
    this.host.nativeElement.animate(
      [
        { borderColor: accent, boxShadow: `0 0 12px 1px ${accent}99` },
        { borderColor: rest.borderTopColor, boxShadow: `0 0 0 0 ${accent}00` },
      ],
      { duration: FLASH_MS, easing: 'ease-out' },
    );
  }

  /** Fa scorrere il valore da quello che si vede adesso fino a `target`, con una frenata dolce alla fine. */
  private count(target: number) {
    const from = this.current;
    const start = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / COUNT_MS);
      this.current = k === 1 ? target : from + (target - from) * (1 - Math.pow(1 - k, 3));
      this.shown.set(Math.round(this.current));
      if (k < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }
}
