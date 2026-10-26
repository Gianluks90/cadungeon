import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PotionKind } from '../game/board/marker';
import { AttackDice, StartingSkills } from '../game/heroes/hero-sheet';
import { InventoryView } from '../game/state/actions';
import { CityView } from '../game/state/city';
import { SkillDef } from '../game/skills/skill';
import { SkillAction } from '../game/state/skills';
import { AttackDiceComponent } from './attack-dice.component';
import { HeartsComponent } from './hearts.component';
import { IconComponent } from './icon.component';
import { SkillCardComponent } from './skill-card.component';

/** Tutto ciò che la scheda completa di un eroe mostra. */
export interface HeroDetails {
  name: string;
  /** La classe (druido, ranger, ...): il sottotitolo, in maiuscolo. */
  heroClass: string;
  portrait?: string;
  /** L'immagine a figura intera, per la cornice dei pannelli. */
  portraitFull?: string;
  wounds: number;
  maxWounds: number;
  fatigue: number;
  armor: number;
  speed: number;
  value: number;
  /** Le pozioni che porta. */
  potions: PotionKind[];
  /** Le monete dell'eroe, e il suo inventario (oggetti equipaggiati e zaino, con ciò che si può fare): si vedono nel pannello dell'inventario. */
  coins: number;
  inventory: InventoryView;
  /** È in città (la sua pedina non è sulla mappa): allora c'è il pannello Città. */
  inCity: boolean;
  /** C'è il pannello Città: è in città e non deve ancora tornare (dal turno dopo l'arrivo il ritorno parte da solo). */
  cityPanel: boolean;
  city: CityView | null;
  dice: AttackDice;
  /** Gli stati che ha adesso, a parole ("Fiamma ×2"), e i segnalini veleno (i cuori verdi). */
  states: string[];
  poison: number;
  skills: StartingSkills;
  /** Le carte abilità secondarie che possiede (pescate a inizio partita, più quelle comprate al campo di addestramento). */
  skillCards: SkillDef[];
  /** Le abilità che si possono usare con un bottone (e se adesso si può). */
  skillActions: SkillAction[];
  ability: string;
}

/**
 * Il pannello "Informazioni" di un eroe: parametri (cuori e salute, velocità, fatica, armatura, valore), attributi (una sezione ancora vuota:
 * le quattro caratteristiche sono in pausa, docs/REGOLE.md sezione 4), dadi d'attacco, abilità primaria (quella stampata sulla scheda) e abilità secondarie (le carte pescate). È il contenuto della cornice `app-hero-panel`, che gli dà posizione, altezza, immagine ed etichette; l'equipaggiamento sta
 * nel pannello dell'inventario (`app-inventory-panel`).
 */
@Component({
  selector: 'app-hero-sheet',
  imports: [AttackDiceComponent, HeartsComponent, IconComponent, SkillCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hero(); as h) {
      <h3 class="first">Parametri</h3>
      <div class="life">
        <app-hearts [wounds]="h.wounds" [max]="h.maxWounds" [poison]="h.poison" [size]="18" />
        <span class="dots" aria-hidden="true"></span>
        <span class="health" title="Ferite rimaste">{{ h.wounds }}</span>
      </div>
      <div class="row stats">
        <span class="stat speed" title="Velocità: punti movimento a inizio turno"><app-icon name="footprint" [size]="18" />{{ h.speed }}<small>Velocità</small></span>
        <span class="stat fatigue" title="Fatica"><app-icon name="water_drop" [size]="18" />{{ h.fatigue }}<small>Fatica</small></span>
        <span class="stat" title="Armatura: si sottrae al danno"><app-icon name="shield" [size]="18" />{{ h.armor }}<small>Armatura</small></span>
        <span class="stat" title="Valore: la Conquista che si perde se muore"><app-icon name="brightness_empty" [size]="18" />{{ h.value }}<small>Valore</small></span>
      </div>

      @if (h.states.length) {
        <h3>Stati</h3>
        <p class="states">{{ h.states.join(' · ') }}</p>
      }

      <h3>Attributi</h3>
      <p class="soon">Presto disponibile</p>

      <h3>Dadi d'attacco extra</h3>
      <app-attack-dice [dice]="h.dice" />

      @if (h.ability) {
        <h3>Abilità primaria</h3>
        <p class="ability">{{ h.ability }}</p>
      }

      <h3>Abilità secondarie</h3>
      <div class="cards">
        @for (c of h.skillCards; track c.id) { <app-skill-card [skill]="c" [action]="actionOf(h, c.id)" (use)="skillUse.emit(actionOf(h, c.id)!.id)" (denied)="denied.emit($event)" /> }
        @empty { <p class="soon">Nessuna</p> }
      </div>
    }
  `,
  styles: `
    :host { counter-reset: sec; display: block; color: var(--c-text); font: 13px/1.35 var(--font-ui); }
    h3::before { counter-increment: sec; content: counter(sec, decimal-leading-zero) ' — '; color: var(--c-text-faint); }
    h3 { margin: 14px 0 6px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    h3.first { margin-top: 0; }
    /* I cuori a sinistra, il valore della salute a destra, e in mezzo una riga a puntini quasi invisibile: si allunga quanto serve in base ai cuori. */
    .life { display: flex; align-items: center; gap: 10px; }
    .dots { flex: 1; min-width: 12px; border-bottom: 2px dotted color-mix(in srgb, var(--c-text) 12%, transparent); transform: translateY(3px); }
    .health { font: 600 16px/1 var(--font-ui); font-variant-numeric: tabular-nums; }
    .row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; }
    .row.stats { margin-top: 10px; }
    .stat { display: inline-flex; align-items: center; gap: 5px; font-variant-numeric: tabular-nums; font-weight: 600; }
    small { font-weight: 400; color: var(--c-text-dim); }
    .stat.speed { color: var(--c-speed); }
    .stat.fatigue { color: var(--c-stamina); }
    .cards { display: flex; flex-direction: column; gap: 6px; }
    .states { margin: 0; display: flex; flex-wrap: wrap; gap: 4px 12px; font-weight: 600; }
    .soon { margin: 0; color: var(--c-text-dim); font-size: 12px; font-style: italic; }
    .ability { margin: 0; color: var(--c-text); }
  `,
})
export class HeroSheetComponent {
  /** L'eroe da mostrare. */
  readonly hero = input<HeroDetails | null>(null);
  /** Si usa un'abilità (l'id viene da `skillActions`). */
  readonly skillUse = output<string>();
  readonly denied = output<string>();

  protected actionOf(h: HeroDetails, cardId: string): SkillAction | null {
    return h.skillActions.find((a) => a.cardId === cardId) ?? null;
  }
}
