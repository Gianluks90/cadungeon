import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { PotionKind } from '../game/board/marker';
import { AttackDice, StartingSkills } from '../game/heroes/hero-sheet';
import { InventoryView } from '../game/state/actions';
import { AttackDiceComponent } from './attack-dice.component';
import { HeartsComponent } from './hearts.component';
import { IconComponent } from './icon.component';

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
  dice: AttackDice;
  skills: StartingSkills;
  ability: string;
}

/**
 * Il pannello "Informazioni" di un eroe: parametri (cuori e salute, velocità, fatica, armatura, valore), attributi (una sezione ancora vuota:
 * le quattro caratteristiche sono in pausa, docs/REGOLE.md sezione 4), dadi d'attacco, abilità iniziali e
 * abilità. È il contenuto della cornice `app-hero-panel`, che gli dà posizione, altezza, immagine ed etichette; l'equipaggiamento sta
 * nel pannello dell'inventario (`app-inventory-panel`).
 */
@Component({
  selector: 'app-hero-sheet',
  imports: [AttackDiceComponent, HeartsComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hero(); as h) {
      <h3 class="first">Parametri</h3>
      <div class="life">
        <app-hearts [wounds]="h.wounds" [max]="h.maxWounds" [size]="18" />
        <span class="dots" aria-hidden="true"></span>
        <span class="health" title="Ferite rimaste">{{ h.wounds }}</span>
      </div>
      <div class="row stats">
        <span class="stat speed" title="Velocità: punti movimento a inizio turno"><app-icon name="footprint" [size]="18" />{{ h.speed }}<small>Velocità</small></span>
        <span class="stat fatigue" title="Fatica"><app-icon name="water_drop" [size]="18" />{{ h.fatigue }}<small>Fatica</small></span>
        <span class="stat" title="Armatura: si sottrae al danno"><app-icon name="shield" [size]="18" />{{ h.armor }}<small>Armatura</small></span>
        <span class="stat" title="Valore: il Progresso che si perde se muore"><app-icon name="brightness_empty" [size]="18" />{{ h.value }}<small>Valore</small></span>
      </div>

      <h3>Attributi</h3>
      <p class="soon">Presto disponibile</p>

      <h3>Dadi d'attacco extra</h3>
      <app-attack-dice [dice]="h.dice" />

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
    }
  `,
  styles: `
    :host { display: block; color: var(--cad-ui-text, #d8cfc4); font: 13px/1.35 system-ui, sans-serif; }
    h3 { margin: 14px 0 6px; font: 600 11px/1 system-ui, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cad-ui-text-muted, #8a8178); }
    h3.first { margin-top: 0; }
    /* I cuori a sinistra, il valore della salute a destra, e in mezzo una riga a puntini quasi invisibile: si allunga quanto serve in base ai cuori. */
    .life { display: flex; align-items: center; gap: 10px; }
    .dots { flex: 1; min-width: 12px; border-bottom: 2px dotted rgba(255, 255, 255, 0.12); transform: translateY(3px); }
    .health { font: 600 16px/1 system-ui, sans-serif; font-variant-numeric: tabular-nums; }
    .row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px; }
    .row.stats { margin-top: 10px; }
    .stat { display: inline-flex; align-items: center; gap: 5px; font-variant-numeric: tabular-nums; font-weight: 600; }
    small { font-weight: 400; color: var(--cad-ui-text-muted, #8a8178); }
    .stat.speed { color: var(--cad-stat-movement, #6cc070); }
    .stat.fatigue { color: var(--cad-stat-fatigue, #f0a030); }
    .skill.none { opacity: 0.4; }
    .skill b { font-weight: 600; }
    .soon { margin: 0; color: var(--cad-ui-text-muted, #8a8178); font-size: 12px; font-style: italic; }
    .ability { margin: 0; color: var(--cad-ui-text, #d8cfc4); }
  `,
})
export class HeroSheetComponent {
  /** L'eroe da mostrare. */
  readonly hero = input<HeroDetails | null>(null);
}
