import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HeroAction } from '../game/pieces/piece';
import { HeartsComponent } from './hearts.component';
import { IconComponent } from './icon.component';

/** Chi compare nella barra: un eroe oppure il segnaposto dell'Overlord. */
export interface BarMember {
  id: string;
  name: string;
  kind: 'hero' | 'overlord';
  /** Percorso dell'immagine del ritratto (in public/). Senza, il pallino mostra un'icona. */
  portrait?: string;
  /** È il suo turno: il pallino si espande in scheda. */
  active: boolean;
  /** Ha già agito in questo round: il pallino si desatura. */
  done: boolean;
  wounds: number;
  maxWounds: number;
  points: number;
  attacks: number;
  /** Fatica: per ora un segnaposto fisso (la fatica è fuori scope). */
  fatigue: number;
  action: HeroAction;
}

const ACTION_LABEL: Record<HeroAction, string> = { advance: '', run: 'Correre', fight: 'Combattere' };

/**
 * La barra in basso: una striscia di tab attaccati, uno per ogni eroe e uno per l'Overlord, ognuno con lo stile del contenitore
 * a pillola (nero, bordo sottile, angoli alti arrotondati). Alle due estremità la striscia si raccorda al footer con una spalla
 * concava; fra un tab e l'altro, in alto, gli angoli arrotondati lasciano una piega.
 * Chi ha il turno ha il tab espanso (cuori, movimento, fatica, attacchi): quando cambia, il tab di prima si comprime e il nuovo
 * si allarga, insieme.
 */
@Component({
  selector: 'app-party-bar',
  imports: [HeartsComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="bar" aria-label="Eroi e Overlord">
      @for (m of members(); track m.id) {
        <button type="button" class="tab" [class.active]="m.active" [class.done]="m.done" [disabled]="m.kind === 'overlord' || m.active"
          [attr.aria-current]="m.active ? 'true' : null" [attr.aria-label]="m.name" [title]="m.name + (m.done ? ' (ha agito)' : '')" (click)="selected.emit(m.id)">
          <span class="avatar">
            @if (m.portrait) { <img [src]="m.portrait" [alt]="m.name" draggable="false" /> } @else { <app-icon name="skull" [size]="28" /> }
          </span>
          <span class="details">
            <span class="info"><span class="content">
              <span class="name">{{ m.name }}@if (label(m.action)) { <span class="action">{{ label(m.action) }}</span> }</span>
              @if (m.kind === 'hero') {
                <app-hearts [wounds]="m.wounds" [max]="m.maxWounds" [size]="16" />
                <span class="stats">
                  <span class="stat movement" title="Punti movimento"><app-icon name="footprint" [size]="16" />{{ m.points }}</span>
                  <span class="stat fatigue" title="Fatica"><app-icon name="water_drop" [size]="16" />{{ m.fatigue }}</span>
                  <span class="stat attack" title="Attacchi"><app-icon name="swords" [size]="16" />{{ m.attacks }}</span>
                </span>
              }
            </span></span>
          </span>
        </button>
      }
    </nav>
  `,
  styles: `
    :host { position: absolute; z-index: 10; left: 0; right: 0; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom)); display: flex; justify-content: center; pointer-events: none; }
    /* Tutti i tab sono alti uguale (niente gradini); chiusi, sono un quadrato: il ritratto al centro. */
    .bar { --tab-size: 76px; --avatar-size: 56px; position: relative; display: flex; align-items: flex-end; pointer-events: auto; margin-bottom: -1px; font: 13px/1.2 system-ui, sans-serif; user-select: none; color: var(--cad-ui-text, #d8cfc4); }
    /*
     * Le due spalle, solo agli estremi della striscia: una curva concava che la raccorda alla linea del footer. Sono posizionate
     * perché l'ultima fascia della curva (raggio da 21 a 22 px, il bordo) cada sul bordo verticale del primo e dell'ultimo tab
     * in alto e sulla linea del footer in basso: il contorno è un'unica linea continua.
     */
    .bar::before, .bar::after { content: ''; position: absolute; bottom: 0; width: 22px; height: 22px; }
    .bar::before { right: calc(100% - 1px); background: radial-gradient(circle at top left, transparent 20.6px, var(--cad-ui-panel-border, #5a554d) 21.1px 21.9px, var(--cad-ui-panel, #000) 22.4px); }
    .bar::after { left: calc(100% - 1px); background: radial-gradient(circle at top right, transparent 20.6px, var(--cad-ui-panel-border, #5a554d) 21.1px 21.9px, var(--cad-ui-panel, #000) 22.4px); }

    .tab {
      display: flex; align-items: center; box-sizing: border-box; height: var(--tab-size); padding: 0 calc((var(--tab-size) - var(--avatar-size) - 2px) / 2); /* 2px = i due bordi: il tab chiuso è esattamente quadrato */ margin: 0; font: inherit; color: inherit; text-align: left;
      background: var(--cad-ui-panel, #000); border: 1px solid var(--cad-ui-panel-border, #5a554d); border-bottom: 0; border-radius: 18px 18px 0 0;
      cursor: pointer; transition: padding-right 0.35s ease;
    }
    .tab + .tab { margin-left: -1px; } /* il bordo fra due tab è uno solo */
    .tab:disabled { cursor: default; }
    .tab:focus-visible { outline: 2px solid var(--cad-ui-text, #d8cfc4); outline-offset: -3px; }
    .tab.active { padding-right: 18px; }

    .avatar {
      display: inline-flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 50%; flex: none;
      width: var(--avatar-size); height: var(--avatar-size); background: #1d1c1a; box-shadow: 0 0 0 2px var(--cad-ui-border, #3a352f); color: var(--cad-ui-text-muted, #8a8178);
      transition: filter 0.2s, opacity 0.2s, box-shadow 0.2s;
    }
    .tab.active .avatar { box-shadow: 0 0 0 3px var(--cad-accent-active, #e0a040); }
    .tab:not(.active):not(:disabled):hover .avatar { box-shadow: 0 0 0 2px var(--cad-ui-text-muted, #8a8178); }
    .tab.done:not(.active) .avatar { filter: grayscale(1); opacity: 0.45; }
    img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }

    /* Le informazioni si aprono e si chiudono con la larghezza: 0fr -> 1fr, così il tab si allarga e si comprime. */
    .details { display: grid; grid-template-columns: 0fr; opacity: 0; margin-left: 0; transition: grid-template-columns 0.35s ease, opacity 0.25s ease, margin-left 0.35s ease; }
    .tab.active .details { grid-template-columns: 1fr; opacity: 1; margin-left: 12px; }
    .info { min-width: 0; overflow: hidden; white-space: nowrap; }
    /* Il contenuto ha sempre la sua larghezza piena: mentre il tab si comprime viene tagliato, non va a capo. */
    .content { display: flex; flex-direction: column; gap: 5px; width: max-content; }
    .name { font-weight: 600; }
    .action { margin-left: 8px; font-weight: 400; color: var(--cad-notice, #e0a040); }
    .stats { display: flex; gap: 12px; }
    .stat { display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
    .stat.movement { color: var(--cad-stat-movement, #6cc070); }
    .stat.fatigue { color: var(--cad-stat-fatigue, #f0a030); }
    .stat.attack { color: var(--cad-stat-attack, #d2504a); }
    @media (prefers-reduced-motion: reduce) { .tab, .avatar, .details { transition: none; } }
  `,
})
export class PartyBarComponent {
  readonly members = input.required<BarMember[]>();
  /** Un clic sul tab di un eroe: lo sceglie. */
  readonly selected = output<string>();
  protected label(action: HeroAction): string {
    return ACTION_LABEL[action];
  }
}
