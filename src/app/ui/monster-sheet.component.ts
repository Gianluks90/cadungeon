import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DieColor } from '../game/items/item';
import { HeartsComponent } from './hearts.component';
import { IconComponent } from './icon.component';

/** Tutto ciò che la scheda di un mostro mostra (solo al Signore Supremo: i giocatori non conoscono i parametri dei nemici). */
export interface MonsterDetails {
  id: string;
  name: string;
  /** Il sottotitolo sotto il nome (in maiuscolo): "Mostro" o "Mostro potenziato". */
  heroClass: string;
  /** Potenziato: la carta con l'immagine ha il contorno rosso. */
  enhanced: boolean;
  portrait?: string;
  portraitFull?: string;
  wounds: number;
  maxWounds: number;
  speed: number;
  armor: number;
  /** Invincibile: al posto dell'armatura compare ∞. */
  invincible?: boolean;
  /** Il tipo di attacco a parole (Mischia, Distanza, Magia) e i dadi che tira. */
  attack: string;
  dice: DieColor[];
  /** Le abilità speciali, a parole. */
  abilities: string[];
  /** Le caselle che occupa, per esempio "2×2". */
  size: string;
  /** Gli stati che ha adesso, a parole, e i segnalini veleno. */
  states: string[];
  poison: number;
}

const DIE_NAMES: Record<DieColor, string> = { red: 'dado rosso', green: 'dado verde', blue: 'dado blu', yellow: 'dado giallo', white: 'dado bianco', black: 'dado potere' };

/**
 * La scheda di un mostro: parametri (cuori e ferite, velocità, armatura, dimensione), attacco (tipo e dadi) e abilità speciali.
 * È il contenuto della cornice `app-hero-panel` aperta a destra, partendo dal tab dell'Overlord.
 */
@Component({
  selector: 'app-monster-sheet',
  imports: [HeartsComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (monster(); as m) {
      <h3 class="first">Parametri</h3>
      <div class="life">
        <app-hearts [wounds]="m.wounds" [max]="m.maxWounds" [poison]="m.poison" [size]="18" />
        <span class="dots" aria-hidden="true"></span>
        <span class="health" title="Ferite rimaste">{{ m.wounds }}</span>
      </div>
      <div class="row stats">
        <span class="stat speed" title="Velocità: punti movimento a ogni attivazione"><app-icon name="footprint" [size]="18" />{{ m.speed }}<small>Velocità</small></span>
        <span class="stat" title="Armatura: si sottrae al danno"><app-icon name="shield" [size]="18" />{{ m.invincible ? '∞' : m.armor }}<small>Armatura</small></span>
        <span class="stat" title="Caselle che occupa"><app-icon name="fit_screen" [size]="18" />{{ m.size }}<small>Dimensione</small></span>
      </div>

      @if (m.states.length) {
        <h3>Stati</h3>
        <ul><li>{{ m.states.join(' · ') }}</li></ul>
      }

      <h3>Attacco</h3>
      <div class="row">
        <span class="attack">{{ m.attack }}</span>
        <span class="cubes">
          @for (d of m.dice; track $index) { <app-icon name="deployed_code" [size]="22" [style.color]="'var(--cad-die-' + d + ')'" [title]="dieName(d)" /> }
        </span>
      </div>

      <h3>Abilità speciali</h3>
      <ul>
        @for (a of m.abilities; track $index) { <li>{{ a }}</li> } @empty { <li class="none">Nessuna</li> }
      </ul>
    }
  `,
  styles: `
    :host { counter-reset: sec; display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    h3::before { counter-increment: sec; content: counter(sec, decimal-leading-zero) ' — '; color: var(--c-text-faint); }
    h3 { margin: 14px 0 6px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    h3.first { margin-top: 0; }
    .life { display: flex; align-items: center; gap: 10px; }
    .dots { flex: 1; min-width: 12px; border-bottom: 2px dotted color-mix(in srgb, var(--c-text) 12%, transparent); transform: translateY(3px); }
    .health { font: 600 16px/1 var(--font-ui); font-variant-numeric: tabular-nums; }
    .row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; }
    .row.stats { margin-top: 10px; }
    .stat { display: inline-flex; align-items: center; gap: 5px; font-variant-numeric: tabular-nums; font-weight: 600; }
    small { font-weight: 400; color: var(--c-text-dim); }
    .stat.speed { color: var(--c-speed); }
    .attack { font-weight: 600; }
    .cubes { display: inline-flex; align-items: center; gap: 2px; }
    ul { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
    .none { color: var(--c-text-dim); font-style: italic; }
  `,
})
export class MonsterSheetComponent {
  readonly monster = input<MonsterDetails | null>(null);

  protected dieName(d: DieColor): string {
    return DIE_NAMES[d];
  }
}
