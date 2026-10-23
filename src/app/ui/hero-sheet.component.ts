import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output } from '@angular/core';
import { AttackDice, StartingSkills } from '../game/heroes/hero-sheet';
import { HeartsComponent } from './hearts.component';
import { IconComponent } from './icon.component';

/** Tutto ciò che la scheda completa di un eroe mostra. */
export interface HeroDetails {
  name: string;
  /** La classe (druido, ranger, ...): il sottotitolo, in maiuscolo. */
  heroClass: string;
  portrait?: string;
  wounds: number;
  maxWounds: number;
  fatigue: number;
  armor: number;
  speed: number;
  value: number;
  dice: AttackDice;
  skills: StartingSkills;
  ability: string;
}

/**
 * La scheda completa di un eroe: un pannello a pillola appena sopra il gruppo dei tab degli eroi (senza l'Overlord), lungo quanto
 * l'elenco (su schermi stretti, a tutta larghezza). Aperto dal tasto "i" del tab; si chiude con un tocco fuori, con Esc o con la X.
 * (Le armi e gli oggetti si aggiungeranno qui.)
 */
@Component({
  selector: 'app-hero-sheet',
  imports: [HeartsComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:pointerdown)': 'outside($event)', '(document:keydown.escape)': 'closed.emit()' },
  template: `
    @if (hero(); as h) {
      <section class="sheet" [attr.aria-label]="'Scheda di ' + h.name">
        <button type="button" class="close" aria-label="Chiudi la scheda" (click)="closed.emit()"><app-icon name="close" [size]="18" /></button>
        <header>
          <span class="avatar">@if (h.portrait) { <img [src]="h.portrait" [alt]="h.name" draggable="false" /> }</span>
          <div class="who">
            <h2>{{ h.name }}</h2>
            @if (h.heroClass) { <span class="subtitle">{{ h.heroClass }}</span> }
          </div>
        </header>

        <div class="row"><app-hearts [wounds]="h.wounds" [max]="h.maxWounds" [size]="18" /></div>
        <div class="row stats">
          <span class="stat speed" title="Velocità: punti movimento a inizio turno"><app-icon name="footprint" [size]="18" />{{ h.speed }}<small>Velocità</small></span>
          <span class="stat fatigue" title="Fatica"><app-icon name="water_drop" [size]="18" />{{ h.fatigue }}<small>Fatica</small></span>
          <span class="stat" title="Armatura: si sottrae al danno"><app-icon name="shield" [size]="18" />{{ h.armor }}<small>Armatura</small></span>
          <span class="stat" title="Valore: il Progresso che si perde se muore"><app-icon name="brightness_empty" [size]="18" />{{ h.value }}<small>Valore</small></span>
        </div>

        <h3>Dadi d'attacco extra</h3>
        <div class="row dice">
          @for (d of diceRows(h); track d.label) {
            <span class="die" [class.none]="!d.count" [title]="d.label + ': ' + d.count + (d.count === 1 ? ' dado' : ' dadi')">
              <small>{{ d.label }}</small>
              <span class="cubes">
                @for (n of cubes(d.count); track n) { <app-icon name="deployed_code" [size]="20" /> }
                @if (!d.count) { <span class="zero">–</span> }
              </span>
            </span>
          }
        </div>

        <h3>Abilità iniziali</h3>
        <div class="row skills">
          <span class="skill" [class.none]="!h.skills.combat">Combattimento <b>{{ h.skills.combat }}</b></span>
          <span class="skill" [class.none]="!h.skills.cunning">Astuzia <b>{{ h.skills.cunning }}</b></span>
          <span class="skill" [class.none]="!h.skills.magic">Magia <b>{{ h.skills.magic }}</b></span>
        </div>

        @if (h.ability) {
          <h3>Abilità</h3>
          <p class="ability">{{ h.ability }}</p>
        }
      </section>
    }
  `,
  styles: `
    /* Dentro il gruppo degli eroi: appena sopra, lunga quanto l'elenco (i -1px coprono il bordo). */
    :host { position: absolute; z-index: 15; left: -1px; right: -1px; bottom: calc(100% + 14px); }
    /* Su schermi stretti sta a tutta larghezza, sopra la barra. */
    @media (max-width: 640px) {
      :host { position: fixed; left: 12px; right: 12px; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 76px + 14px); }
    }
    .sheet {
      position: relative; box-sizing: border-box; width: 100%; max-height: calc(100vh - var(--footer-height, 0px) - 76px - 60px); overflow: auto;
      padding: 16px 18px 18px; border-radius: 22px; background: var(--cad-ui-panel, #000); border: 1px solid var(--cad-ui-panel-border, #5a554d);
      color: var(--cad-ui-text, #d8cfc4); font: 13px/1.35 system-ui, sans-serif; user-select: none;
    }
    .close { position: absolute; top: 10px; right: 10px; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: none; color: var(--cad-ui-text-muted, #8a8178); cursor: pointer; }
    .close:hover, .close:focus-visible { color: var(--cad-ui-text, #d8cfc4); outline: none; }
    header { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; padding-right: 28px; }
    .avatar { width: 64px; height: 64px; flex: none; overflow: hidden; border-radius: 50%; background: #1d1c1a; box-shadow: 0 0 0 2px var(--cad-ui-border, #3a352f); }
    img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
    h2 { margin: 0; font: 600 18px/1.15 system-ui, sans-serif; }
    .subtitle { color: var(--cad-ui-text-muted, #8a8178); font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
    h3 { margin: 14px 0 6px; font: 600 11px/1 system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cad-ui-text-muted, #8a8178); }
    .row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; }
    .row.stats { margin-top: 10px; }
    .stat { display: inline-flex; align-items: center; gap: 5px; font-variant-numeric: tabular-nums; font-weight: 600; }
    small { font-weight: 400; color: var(--cad-ui-text-muted, #8a8178); }
    .stat.speed { color: var(--cad-stat-movement, #6cc070); }
    .stat.fatigue { color: var(--cad-stat-fatigue, #f0a030); }
    /* Ogni tipo di attacco: il nome e un cubo per ogni dado extra. */
    .die { display: inline-flex; flex-direction: column; gap: 3px; min-width: 76px; }
    .cubes { display: inline-flex; align-items: center; gap: 2px; min-height: 20px; }
    .zero { color: var(--cad-ui-text-muted, #8a8178); }
    .die.none, .skill.none { opacity: 0.4; }
    .skill b { font-weight: 600; }
    .ability { margin: 0; color: var(--cad-ui-text, #d8cfc4); }
  `,
})
export class HeroSheetComponent {
  /** L'eroe da mostrare; null = la scheda è chiusa. */
  readonly hero = input<HeroDetails | null>(null);
  readonly closed = output<void>();

  /** Le tre righe dei dadi d'attacco, con il nome e quanti dadi extra. */
  protected diceRows(h: HeroDetails): { label: string; count: number }[] {
    return [
      { label: 'Mischia', count: h.dice.melee },
      { label: 'Distanza', count: h.dice.ranged },
      { label: 'Magia', count: h.dice.magic },
    ];
  }

  /** Un elenco lungo `n`, per ripetere un'icona n volte. */
  protected cubes(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }

  /** Un tocco fuori dalla scheda la chiude (non se è sul tasto "i", che la apre e la chiude da sé). */
  protected outside(e: Event) {
    const target = e.target as Element | null;
    if (!this.hero() || target?.closest('[data-sheet-toggle]')) return;
    if (!(this.hostEl.contains(target as Node))) this.closed.emit();
  }

  private readonly hostEl = inject(ElementRef).nativeElement as HTMLElement;
}
