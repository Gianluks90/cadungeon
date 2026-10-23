import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { HeroAction } from '../game/pieces/piece';
import { HeartsComponent } from './hearts.component';
import { HeroDetails, HeroSheetComponent } from './hero-sheet.component';
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
  /** Fatica, dalla scheda dell'eroe (per ora non si spende: la fatica è fuori scope). */
  fatigue: number;
  /** Armatura fissa (dopo i contatori, in bianco) e valore dell'eroe (un numero sul suo ritratto). */
  armor: number;
  value: number;
  action: HeroAction;
  /** La scheda completa (solo per gli eroi). */
  details?: HeroDetails;
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
  imports: [HeartsComponent, HeroSheetComponent, IconComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="bar" aria-label="Eroi e Overlord">
      <!-- Gli eroi sono un gruppo: la scheda completa sta sopra tutto il gruppo, lunga quanto l'elenco degli eroi (senza l'Overlord). -->
      <div class="heroes">
        @if (sheetMember(); as m) { <app-hero-sheet [hero]="m.details!" (closed)="sheetClosed.emit()" /> }
        @for (m of heroes(); track m.id) {
          <ng-container [ngTemplateOutlet]="tab" [ngTemplateOutletContext]="{ $implicit: m }" />
        }
      </div>
      @for (m of overlords(); track m.id) {
        <ng-container [ngTemplateOutlet]="tab" [ngTemplateOutletContext]="{ $implicit: m }" />
      }
    </nav>
    <ng-template #tab let-m>
      <div class="tab" [class.active]="m.active" [class.done]="m.done" [attr.aria-current]="m.active ? 'true' : null">
        @if (m.kind === 'hero' && !m.active) {
          <!-- Il tab chiuso è tutto un bottone: sceglie l'eroe. -->
          <button type="button" class="select" [attr.aria-label]="'Scegli ' + m.name" [title]="m.name + (m.done ? ' (ha agito)' : '')" (click)="selected.emit(m.id)"></button>
        }
        <span class="portrait">
          <span class="avatar">
            @if (m.portrait) { <img [src]="m.portrait" [alt]="m.name" draggable="false" /> } @else { <app-icon name="skull" [size]="28" /> }
          </span>
          @if (m.kind === 'hero') { <span class="value" title="Valore: il Progresso che si perde se muore">{{ m.value }}</span> }
        </span>
        <span class="details">
          <span class="info"><span class="content">
            <span class="head">
              <span class="name">{{ m.name }}@if (label(m.action)) { <span class="action">{{ label(m.action) }}</span> }</span>
              @if (m.kind === 'hero') {
                <button type="button" class="info-btn" data-sheet-toggle [attr.aria-label]="'Scheda di ' + m.name" title="Scheda completa" (click)="info.emit(m.id)"><app-icon name="info" [size]="18" /></button>
              }
            </span>
            @if (m.kind === 'hero') {
              <app-hearts [wounds]="m.wounds" [max]="m.maxWounds" [size]="16" />
              <span class="stats">
                <span class="stat movement" title="Punti movimento"><app-icon name="footprint" [size]="16" />{{ m.points }}</span>
                <span class="stat fatigue" title="Fatica"><app-icon name="water_drop" [size]="16" />{{ m.fatigue }}</span>
                <span class="stat attack" title="Attacchi"><app-icon name="swords" [size]="16" />{{ m.attacks }}</span>
                <span class="stat" title="Armatura: si sottrae al danno"><app-icon name="shield" [size]="16" />{{ m.armor }}</span>
              </span>
            }
          </span></span>
        </span>
      </div>
    </ng-template>
  `,
  styles: `
    :host { position: absolute; z-index: 10; left: 0; right: 0; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom)); display: flex; justify-content: center; pointer-events: none; }
    /* Tutti i tab sono alti uguale (niente gradini); chiusi, sono un quadrato: il ritratto al centro. */
    .bar { --tab-size: 76px; --avatar-size: 56px; --active-tab-width: 320px; position: relative; display: flex; align-items: flex-end; pointer-events: auto; margin-bottom: -1px; font: 13px/1.2 system-ui, sans-serif; user-select: none; color: var(--cad-ui-text, #d8cfc4); }
    /*
     * Le due spalle, solo agli estremi della striscia: una curva concava che la raccorda alla linea del footer. Sono posizionate
     * perché l'ultima fascia della curva (raggio da 21 a 22 px, il bordo) cada sul bordo verticale del primo e dell'ultimo tab
     * in alto e sulla linea del footer in basso: il contorno è un'unica linea continua.
     */
    .bar::before, .bar::after { content: ''; position: absolute; z-index: 1; bottom: 0; width: 22px; height: 22px; } /* sopra i tab: coprono il tratto dritto del bordo, che deve curvare */
    .bar::before { right: calc(100% - 1px); background: radial-gradient(circle at top left, transparent 20.6px, var(--cad-ui-panel-border, #5a554d) 21.1px 21.9px, var(--cad-ui-panel, #000) 22.4px); }
    .bar::after { left: calc(100% - 1px); background: radial-gradient(circle at top right, transparent 20.6px, var(--cad-ui-panel-border, #5a554d) 21.1px 21.9px, var(--cad-ui-panel, #000) 22.4px); }

    .tab {
      position: relative; display: flex; align-items: center; box-sizing: border-box; height: var(--tab-size); min-width: var(--tab-size); padding: 0 calc((var(--tab-size) - var(--avatar-size) - 2px) / 2); /* 2px = i due bordi: il tab chiuso è esattamente quadrato */ margin: 0; text-align: left;
      background: var(--cad-ui-panel, #000); border: 1px solid var(--cad-ui-panel-border, #5a554d); border-bottom: 0; border-radius: 18px 18px 0 0;
      transition: padding-right 0.35s ease, min-width 0.35s ease;
    }
    /* Il tab attivo è più lungo: c'è posto per i valori e per il tasto della scheda. */
    .tab.active { min-width: var(--active-tab-width); }
    .select { position: absolute; inset: 0; padding: 0; margin: 0; border: 0; border-radius: inherit; background: none; cursor: pointer; }
    .select:focus-visible { outline: 2px solid var(--cad-ui-text, #d8cfc4); outline-offset: -3px; }
    .info-btn {
      display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 50%;
      background: none; color: var(--cad-ui-panel-border, #5a554d); cursor: pointer; margin-right: -6px;
    }
    .info-btn:hover, .info-btn:focus-visible { color: var(--cad-ui-text-muted, #8a8178); outline: none; }
    .heroes { position: relative; display: flex; align-items: flex-end; }
    .tab + .tab, .heroes + .tab { margin-left: -1px; } /* il bordo fra due tab è uno solo */
    .tab.active { padding-right: 18px; }

    /* Il ritratto con il Valore dell'eroe come numero, in basso a sinistra, senza sfondo (il contorno scuro lo tiene leggibile). */
    .portrait { position: relative; display: inline-flex; flex: none; }
    .value {
      position: absolute; left: -4px; bottom: -5px; font: 700 18px/1 system-ui, sans-serif; font-variant-numeric: tabular-nums; color: var(--cad-ui-text, #d8cfc4);
      -webkit-text-stroke: 4px #000; paint-order: stroke fill; pointer-events: none; transition: opacity 0.2s;
    }
    .tab.done:not(.active) .value { opacity: 0.45; }
    .avatar {
      display: inline-flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 50%; flex: none;
      width: var(--avatar-size); height: var(--avatar-size); background: #1d1c1a; box-shadow: 0 0 0 2px var(--cad-ui-border, #3a352f); color: var(--cad-ui-text-muted, #8a8178);
      transition: filter 0.2s, opacity 0.2s, box-shadow 0.2s;
    }
    .tab:not(.active):hover .avatar { box-shadow: 0 0 0 2px var(--cad-ui-text-muted, #8a8178); }
    .tab.done:not(.active) .avatar { filter: grayscale(1); opacity: 0.45; }
    img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }

    /* Le informazioni si aprono e si chiudono con la larghezza: 0fr -> 1fr, così il tab si allarga e si comprime. */
    .details { flex: 1 1 0; min-width: 0; display: grid; grid-template-columns: 0fr; opacity: 0; margin-left: 0; visibility: hidden; transition: grid-template-columns 0.35s ease, opacity 0.25s ease, margin-left 0.35s ease, visibility 0s 0.35s; }
    .tab.active .details { grid-template-columns: 1fr; opacity: 1; margin-left: 12px; visibility: visible; transition-delay: 0s; }
    .info { min-width: 0; overflow: hidden; white-space: nowrap; }
    /* Il contenuto ha sempre la sua larghezza piena: mentre il tab si comprime viene tagliato, non va a capo. */
    .content { display: flex; flex-direction: column; gap: 5px; width: max-content; min-width: 100%; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
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
  /** Un clic sul tasto "i" del tab attivo: apre o chiude la sua scheda. */
  readonly info = output<string>();
  /** L'eroe di cui è aperta la scheda completa (dentro il suo tab), se ce n'è uno. */
  readonly sheetFor = input<string | null>(null);
  /** La scheda va chiusa (tocco fuori, Esc o X). */
  readonly sheetClosed = output<void>();

  protected readonly heroes = computed(() => this.members().filter((m) => m.kind === 'hero'));
  protected readonly overlords = computed(() => this.members().filter((m) => m.kind === 'overlord'));
  /** L'eroe di cui si mostra la scheda completa. */
  protected readonly sheetMember = computed(() => this.heroes().find((m) => m.id === this.sheetFor() && m.details) ?? null);
  protected label(action: HeroAction): string {
    return ACTION_LABEL[action];
  }
}
