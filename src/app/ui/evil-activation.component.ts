import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CatalogTextPipe } from '../i18n/catalog-text.pipe';
import { TrPipe } from '../i18n/tr.pipe';
import { HeartsComponent } from './hearts.component';
import { IconComponent } from './icon.component';

/** Il mostro che il Maligno sta attivando a mano. */
export interface ActivationView {
  name: string;
  /** L'immagine del segnalino (percorso in public/). */
  portrait?: string;
  wounds: number;
  maxWounds: number;
  /** Punti movimento e attacchi che gli restano. */
  points: number;
  attacks: number;
  /** Le sue abilità in questo momento (quelle della carta, più o meno ciò che hanno aggiunto o tolto l'avventura e gli eventi). */
  abilities: string[];
}

/**
 * Il mostro in attivazione (vista del Maligno), sotto la barra degli eroi a un piccolo gap, larga e alta uguale al suo box. Da sinistra: il segnalino quadrato, il nome con
 * i punti vita sotto (il valore e i cuori), i punti movimento e gli attacchi che restano, e "Termina", un pezzo del box (quadrato) che chiude l'attivazione.
 * Sopra movimento e attacchi, in verticale come nome e vita, le abilità del mostro come pillole.
 */
@Component({
  selector: 'app-evil-activation',
  host: { '[style.width]': "'min(calc(320px + ' + (slots() - 1) * 76 + 'px), calc(100vw - 24px))'" }, // come la barra degli eroi: il tab aperto da 320 px e 76 px per ogni altro
  imports: [CatalogTextPipe, TrPipe, HeartsComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card">
      <span class="token">@if (monster().portrait) { <img [src]="monster().portrait" alt="" draggable="false" /> }</span>
      <span class="info">
        <span class="name">{{ monster().name }}</span>
        <span class="life"><span class="v">{{ monster().wounds }}</span><app-hearts [wounds]="monster().wounds" [max]="monster().maxWounds" [size]="14" [outline]="true" /></span>
      </span>
      <span class="side">
        @if (monster().abilities.length) {
          <ul class="abilities" [attr.aria-label]="'Abilità' | tr">
            @for (a of monster().abilities; track $index) { <li class="pill">{{ a | ct }}</li> }
          </ul>
        }
        <span class="stats">
          <span class="stat move" [title]="'Punti movimento' | tr"><app-icon name="footprint" [size]="18" />{{ monster().points }}</span>
          <span class="stat" [title]="'Attacchi' | tr"><app-icon name="swords" [size]="18" />{{ monster().attacks }}</span>
        </span>
      </span>
      <button type="button" class="end" [attr.aria-label]="'Termina' | tr" [title]="'Termina' | tr" (click)="done.emit()"><app-icon name="skip_next" [size]="28" /><span>{{ 'Termina' | tr }}</span></button>
    </div>
  `,
  styles: `
    @keyframes act-in { from { transform: translateX(-50%) translateY(-60%); opacity: 0; } }
    :host { animation: act-in 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
    :host {
      /* Sotto la barra degli eroi (12 px dal bordo, 76 px di altezza) e il suo piccolo footer (26 px) con un piccolo gap. */
      position: absolute; z-index: 24; left: 50%; transform: translateX(-50%); top: calc(12px + env(safe-area-inset-top) + 76px + 26px + 8px);
      font: 13px/1.2 var(--font-ui); color: var(--c-text);
    }
    .card {
      box-sizing: border-box; display: flex; align-items: center; gap: 12px; height: 76px; padding: 0 0 0 9px; overflow: hidden; /* alto come i tab degli eroi */
      background: var(--c-surface); border: 1px solid var(--c-faction-evil); border-radius: var(--radius-1);
    }
    .token { flex: none; width: 56px; height: 56px; overflow: hidden; border-radius: var(--radius-1); background: var(--c-tile); box-shadow: 0 0 0 2px var(--c-line); }
    img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .info { display: flex; flex-direction: column; gap: 5px; min-width: 0; flex: 1 1 auto; }
    .name { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .life { display: inline-flex; align-items: center; gap: 6px; }
    .v { min-width: 1.4em; color: var(--c-text); font: 600 13px/1 var(--font-mono); font-variant-numeric: tabular-nums; }
    /* A destra, in verticale come nome e vita: le abilità come pillole sopra, movimento e attacchi sotto. */
    .side { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex: 0 1 auto; min-width: 0; max-width: 60%; }
    .stats { display: flex; align-items: center; gap: 12px; flex: none; }
    .stat { display: inline-flex; align-items: center; gap: 4px; color: var(--c-text); font: 600 14px/1 var(--font-mono); font-variant-numeric: tabular-nums; }
    .stat.move { color: var(--c-move); }
    /* Il tasto Termina è un pezzo del box: alto quanto lui, quindi quadrato (76 px meno i due bordi), diviso dal resto da una linea rossa (come Passa nel footer). */
    .end {
      align-self: stretch; flex: none; box-sizing: border-box; width: 74px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 0; cursor: pointer;
      background: none; border: 0; border-left: 1px solid var(--c-faction-evil); border-radius: 0; color: var(--c-faction-evil);
      font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; transition: background 0.15s;
    }
    .end:hover, .end:focus-visible { background: color-mix(in srgb, var(--c-faction-evil) 12%, transparent); outline: none; }
    .abilities { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; margin: 0; padding: 0; list-style: none; }
    .pill { padding: 2px 8px; border-radius: 999px; border: 1px solid var(--c-line-strong); color: var(--c-text-dim); font: 11px/1.2 var(--font-ui); white-space: nowrap; }
    /* Schermi stretti: tutto un po' più piccolo e le pillole delle abilità in una riga che scorre di lato, perché il box resta alto 76 px. */
    /* Telefono: sotto l'intestazione (44 px), la barra degli eroi (56 px) e il piccolo footer della Conquista (26 px). */
    @media (max-width: 760px) { :host { top: calc(12px + env(safe-area-inset-top) + 44px + 8px + 56px + 26px + 8px); } }
    @media (max-width: 480px) {
      .card { gap: 8px; padding-left: 6px; }
      .token { width: 48px; height: 48px; }
      .end { width: 64px; }
      .side { max-width: 52%; }
      .abilities { flex-wrap: nowrap; justify-content: flex-start; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
    }
  `,
})
export class EvilActivationComponent {
  readonly monster = input.required<ActivationView>();
  /** Quanti eroi ci sono: la box è larga quanto la barra degli eroi. */
  readonly slots = input(2);
  readonly done = output<void>();
}
