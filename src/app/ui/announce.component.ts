import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from './icon.component';

/** Un messaggio al centro dello schermo: una carta giocata dall'Overlord, una trappola scattata. */
export interface Announcement {
  id: number;
  /** Chi parla (per esempio "Overlord"). */
  by: string;
  icon: string;
  /** Il titolo: il nome della carta. */
  title: string;
  /** Una riga che dice cosa succede. */
  text: string;
}

/**
 * Il messaggio al centro: compare con una piccola salita, resta e poi svanisce da solo (`durationMs`). Non blocca i tocchi.
 * Le notifiche in alto a destra restano per ciò che non richiede attenzione piena.
 */
@Component({
  selector: 'app-announce',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (m of list(); track m.id) {
      <div class="box" role="status" [style.--ms.ms]="durationMs()">
        <app-icon [name]="m.icon" [size]="26" />
        <span class="by">{{ m.by }}</span>
        <strong class="title">{{ m.title }}</strong>
        <span class="text">{{ m.text }}</span>
      </div>
    }
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 950; display: grid; place-items: center; pointer-events: none; }
    .box {
      display: flex; flex-direction: column; align-items: center; gap: 6px; max-width: min(440px, calc(100vw - 32px)); padding: 18px 28px; text-align: center;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); color: var(--c-text);
      box-shadow: 0 0 0 1px #000, 0 12px 40px rgba(0, 0, 0, 0.55); animation: announce var(--ms) ease-in-out forwards;
    }
    app-icon { color: var(--c-faction-overlord); }
    .by { font: 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .title { font: 600 20px/1.2 var(--font-display); letter-spacing: 0.04em; }
    .text { font: 13px/1.4 var(--font-ui); color: var(--c-text-dim); }
    @keyframes announce {
      0% { opacity: 0; transform: translateY(12px); }
      6% { opacity: 1; transform: translateY(0); }
      88% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-6px); }
    }
    @media (prefers-reduced-motion: reduce) { .box { animation-name: none; } }
  `,
})
export class AnnounceComponent {
  readonly message = input<Announcement | null>(null);
  readonly durationMs = input(5000);
  protected list() {
    const m = this.message();
    return m ? [m] : [];
  }
}
