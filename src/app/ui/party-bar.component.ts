import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { HeroAction } from '../game/pieces/piece';
import { HeartsComponent } from './hearts.component';
import { CityEvent, CityPanelComponent } from './city-panel.component';
import { HeroPanelComponent, PanelKind } from './hero-panel.component';
import { HeroDetails, HeroSheetComponent } from './hero-sheet.component';
import { PieceStatus } from '../game/pieces/piece';
import { InventoryPanelComponent } from './inventory-panel.component';
import { MonsterDetails, MonsterSheetComponent } from './monster-sheet.component';
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
  /** Fatica, dalla scheda dell'eroe (per ora non si spende: la fatica è fuori scope). */
  fatigue: number;
  /** Armatura fissa, in bianco, dopo i contatori. */
  armor: number;
  /** Quante pozioni porta. */
  potions: number;
  /** È in città: la sua pedina non è sulla mappa. `cityPanel`: c'è anche il pannello Città (non quando deve tornare). */
  inCity: boolean;
  cityPanel: boolean;
  action: HeroAction;
  /** I segnalini di stato (fiamma, rete, stordimento, veleno). */
  status?: PieceStatus;
  /** Ha almeno un'abilità che si può usare adesso (un puntino sul tasto della scheda). */
  skillsReady?: boolean;
  /** La scheda completa (solo per gli eroi). */
  details?: HeroDetails;
}

const ACTION_LABEL: Record<HeroAction, string> = { advance: '', run: 'Correre', fight: 'Combattere', rest: 'Riposo' };

/**
 * La barra in basso: una striscia di tab attaccati, uno per ogni eroe e uno per l'Overlord, ognuno con lo stile del contenitore
 * a pillola (nero, bordo sottile, angoli alti arrotondati). Alle due estremità la striscia si raccorda al footer con una spalla
 * concava; fra un tab e l'altro, in alto, gli angoli arrotondati lasciano una piega.
 * Chi ha il turno ha il tab espanso (cuori, movimento, fatica, attacchi): quando cambia, il tab di prima si comprime e il nuovo
 * si allarga, insieme.
 */
@Component({
  selector: 'app-party-bar',
  imports: [CityPanelComponent, HeartsComponent, HeroPanelComponent, HeroSheetComponent, IconComponent, InventoryPanelComponent, MonsterSheetComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="bar" aria-label="Eroi">
      <!-- Gli eroi sono un gruppo: la scheda completa (o quella di un mostro) sta sopra tutto il gruppo, lunga quanto l'elenco degli eroi. -->
      <div class="heroes">
        @if (panelMember(); as m) {
          <app-hero-panel [hero]="m.details!" [active]="panel()!.kind" (closed)="sheetClosed.emit()" (switch)="panelSwitch.emit($event)">
            @if (panel()!.kind === 'info') { <app-hero-sheet [hero]="m.details!" (skillUse)="skillUse.emit($event)" (denied)="denied.emit($event)" /> }
            @else if (panel()!.kind === 'inventory') { <app-inventory-panel [hero]="m.details!" (itemAction)="itemAction.emit($event)" (denied)="denied.emit($event)" /> }
            @else { <app-city-panel [hero]="m.details!" (cityAction)="cityAction.emit($event)" (denied)="denied.emit($event)" /> }
          </app-hero-panel>
        }
        <!-- La scheda di un mostro (solo nella vista Overlord): stessa cornice di quella di un eroe, sopra l'elenco degli eroi; mai insieme alla loro. -->
        @if (monster(); as mon) {
          <app-hero-panel [hero]="mon" active="info" [kinds]="['info']" (closed)="monsterClosed.emit()">
            <app-monster-sheet [monster]="mon" />
          </app-hero-panel>
        }
        @for (m of heroes(); track m.id) {
          <ng-container [ngTemplateOutlet]="tab" [ngTemplateOutletContext]="{ $implicit: m }" />
        }
      </div>
      <!-- Passa: un tab quadrato in fondo alla striscia, fuori dal flusso così non sposta il centro della barra né i pannelli. -->
      <button type="button" class="pass" [class.off]="passBusy()" [attr.aria-disabled]="passBusy()" aria-label="Passa il turno" title="Passa il turno (Invio)" (click)="pass.emit()"><app-icon name="skip_next" [size]="28" /><span>Passa</span></button>
    </nav>
    <ng-template #tab let-m>
      <div class="tab" [class.active]="m.active" [class.done]="m.done" [class.in-town]="m.inCity" [attr.aria-current]="m.active ? 'true' : null">
        @if (m.kind === 'hero' && !m.active) {
          <!-- Il tab chiuso è tutto un bottone: sceglie l'eroe. -->
          <button type="button" class="select" [attr.aria-label]="'Scegli ' + m.name" [title]="m.name + (m.done ? ' (ha agito)' : '')" (click)="selected.emit(m.id)"></button>
        }
        <span class="portrait">
          <span class="avatar">
            @if (m.portrait) { <img [src]="m.portrait" [alt]="m.name" draggable="false" /> } @else { <app-icon name="skull" [size]="28" /> }
          </span>
        </span>
        <span class="details">
          <span class="info"><span class="content">
            <span class="head">
              <span class="name">{{ m.name }}@if (m.inCity) { <span class="in-city">In città</span> } @else if (label(m.action)) { <span class="action">{{ label(m.action) }}</span> }</span>
              @if (m.kind === 'hero') {
                <span class="head-btns">
                  @if (m.cityPanel) { <button type="button" class="info-btn" data-sheet-toggle [attr.aria-label]="'Città di ' + m.name" title="Città" (click)="city.emit(m.id)"><app-icon name="castle" [size]="18" /></button> }
                  <span class="potion-count" title="Pozioni"><app-icon name="tokens/potion" [size]="20" />{{ m.potions }}</span>
                  <button type="button" class="info-btn" data-sheet-toggle [attr.aria-label]="'Inventario di ' + m.name" title="Inventario" (click)="inventory.emit(m.id)"><app-icon name="tokens/items/backpack" [size]="20" /></button>
                </span>
              }
            </span>
            @if (m.kind === 'hero') {
              <app-hearts [wounds]="m.wounds" [max]="m.maxWounds" [poison]="m.status?.poison ?? 0" [size]="16" />
              <span class="stats">
                <span class="stat movement" title="Punti movimento"><app-icon name="footprint" [size]="16" />{{ m.points }}</span>
                @if (m.active && m.fatigue > 0) {
                  <!-- Nel tab dell'eroe attivo la fatica è un tasto: 1 fatica = 1 punto movimento in più. -->
                  <button type="button" class="stat fatigue spend" title="Fatica: tocca per spendere 1 fatica e avere 1 punto movimento in più" (click)="spendFatigue.emit()"><app-icon name="water_drop" [size]="16" />{{ m.fatigue }}</button>
                } @else {
                  <span class="stat fatigue" title="Fatica"><app-icon name="water_drop" [size]="16" />{{ m.fatigue }}</span>
                }
                <span class="stat" title="Armatura: si sottrae al danno"><app-icon name="shield" [size]="16" />{{ m.armor }}</span>
                <!-- Gli stati che durano (fiamma, rete, stordimento): un'icona con il numero, dopo l'armatura; se sono troppe, le prime e un "+". Il veleno sono i cuori verdi. -->
                @for (s of statusIcons(m).shown; track s.kind) {
                  <span class="stat state" [style.color]="s.color" [title]="s.label"><app-icon [name]="s.icon" [size]="16" />{{ s.n }}</span>
                }
                @if (statusIcons(m).more.length) { <span class="stat state" [title]="statusIcons(m).more.join(', ')">+{{ statusIcons(m).more.length }}</span> }
                <button type="button" class="info-btn info-stat" data-sheet-toggle [attr.aria-label]="'Scheda di ' + m.name" title="Scheda completa" (click)="info.emit(m.id)"><app-icon name="info" [size]="20" />@if (m.skillsReady) { <span class="ready" title="Hai abilità da usare"></span> }</button>
              </span>
            }
          </span></span>
        </span>
      </div>
    </ng-template>
  `,
  styles: `
    /* Sopra il bottone contestuale (z-index 20), così i pannelli aperti non finiscono dietro il suo punto esclamativo. */
    :host { position: absolute; z-index: 25; left: 0; right: 0; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom)); display: flex; justify-content: flex-start; padding-left: 12px; box-sizing: border-box; pointer-events: none; }
    /* Tutti i tab sono alti uguale (niente gradini); chiusi, sono un quadrato: il ritratto al centro. */
    .bar { --tab-size: 76px; /* il blocco del Signore supremo (app-overlord-panel) ha le stesse misure del tab espanso */ --avatar-size: 56px; --avatar-radius: var(--radius-1); /* quadrato a spigoli secchi, come il resto dell'interfaccia */ --active-tab-width: 320px; position: relative; display: flex; align-items: flex-end; pointer-events: auto; font: 13px/1.2 var(--font-ui); user-select: none; color: var(--c-text); }
    .tab {
      position: relative; display: flex; align-items: center; box-sizing: border-box; height: var(--tab-size); min-width: var(--tab-size); padding: 0 calc((var(--tab-size) - var(--avatar-size) - 2px) / 2); /* 2px = i due bordi: il tab chiuso è esattamente quadrato */ margin: 0; text-align: left;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1);
      transition: padding-right 0.35s ease, min-width 0.35s ease;
    }
    /* Il tab attivo è più lungo: c'è posto per i valori e per il tasto della scheda. */
    .tab.active { min-width: var(--active-tab-width); }
    .select { position: absolute; inset: 0; padding: 0; margin: 0; border: 0; border-radius: inherit; background: none; cursor: pointer; }
    .select:focus-visible { outline: 2px solid var(--c-text); outline-offset: -3px; }
    .info-btn {
      display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: var(--radius-1);
      background: none; color: var(--c-line-strong); cursor: pointer; margin-right: -6px;
    }
    .head-btns { display: inline-flex; align-items: center; gap: 4px; margin-block: -3px; } /* i tasti sono alti 24 px: il margine negativo evita che gonfino la riga */ /* niente margine negativo: il clip di .info taglierebbe l'ultima icona */
    .head-btns .info-btn { margin-right: 0; }
    .info-btn { position: relative; }
    .ready { position: absolute; top: 0; right: 0; width: 7px; height: 7px; border-radius: var(--radius-round); background: var(--c-interact); }
    .info-btn:hover, .info-btn:focus-visible { color: var(--c-text-dim); outline: none; }
    .pass {
      position: absolute; left: 100%; bottom: 0; margin-left: -1px; box-sizing: border-box; width: var(--tab-size); height: var(--tab-size);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 0; cursor: pointer;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); color: var(--c-text);
      font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; transition: color 0.15s, border-color 0.15s, opacity 0.15s;
    }
    .pass:hover, .pass:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    .pass.off { opacity: 0.45; }
    .heroes { position: relative; display: flex; align-items: flex-end; }
    .tab + .tab, .heroes + .tab { margin-left: -1px; } /* il bordo fra due tab è uno solo */
    .tab.active { padding-right: 7px; } /* + 2-3 px di margine interno dei tasti = lo stesso respiro del ritratto a sinistra (9 px) */

    .portrait { display: inline-flex; flex: none; }
    .avatar {
      display: inline-flex; align-items: center; justify-content: center; overflow: hidden; border-radius: var(--avatar-radius); flex: none;
      width: var(--avatar-size); height: var(--avatar-size); background: var(--c-tile); box-shadow: 0 0 0 2px var(--c-line); color: var(--c-text-dim);
      transition: filter 0.2s, opacity 0.2s, box-shadow 0.2s;
    }
    .tab:not(.active):hover .avatar { box-shadow: 0 0 0 2px var(--c-text-dim); }
    .tab.done:not(.active) .avatar { filter: grayscale(1); opacity: 0.45; }
    img { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }

    /* Le informazioni si aprono e si chiudono con la larghezza: 0fr -> 1fr, così il tab si allarga e si comprime. */
    .details { flex: 1 1 0; min-width: 0; display: grid; grid-template-columns: 0fr; opacity: 0; margin-left: 0; visibility: hidden; transition: grid-template-columns 0.35s ease, opacity 0.25s ease, margin-left 0.35s ease, visibility 0s 0.35s; }
    .tab.active .details { grid-template-columns: 1fr; opacity: 1; margin-left: 12px; visibility: visible; transition-delay: 0s; }
    .info { min-width: 0; overflow: hidden; white-space: nowrap; }
    /* Il contenuto ha sempre la sua larghezza piena: mentre il tab si comprime viene tagliato, non va a capo. */
    .content { display: flex; flex-direction: column; gap: 5px; width: max-content; min-width: 100%; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
    .name { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.02em; }
    .action { margin-left: 8px; font-weight: 400; color: var(--c-interact); }
    .in-city { margin-left: 8px; font-weight: 400; font-size: 12px; color: var(--c-text-dim); }
    .tab.in-town:not(.active) .avatar { opacity: 0.5; }
    .stats { display: flex; gap: 12px; }
    /* La scheda (i) sta a destra, staccata dalle statistiche. */
    .info-stat { margin-left: auto; margin-right: 0; margin-block: -4px; }
    /* Il numero di pozioni ha lo stesso grigio dei tasti accanto (zaino, città) */
    .potion-count { display: inline-flex; align-items: center; gap: 4px; color: var(--c-line-strong); font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .stat { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .stat.movement { color: var(--c-speed); }
    .stat.fatigue { color: var(--c-stamina); }
    .stat.spend { padding: 0; border: 0; background: none; font: inherit; cursor: pointer; }
    .stat.spend:hover, .stat.spend:focus-visible { outline: none; text-decoration: underline; text-underline-offset: 3px; }
    @media (prefers-reduced-motion: reduce) { .tab, .avatar, .details { transition: none; } }
    /* Tocco: l'area sensibile dei tasti piccoli arriva a 44 px senza cambiare il disegno */
    @media (pointer: coarse) { .info-btn { position: relative; } .info-btn::after { content: ''; position: absolute; inset: -10px; } }
  `,
})
export class PartyBarComponent {
  readonly members = input.required<BarMember[]>();
  /** Un clic sul tab di un eroe: lo sceglie. */
  readonly selected = output<string>();
  /** Un clic sul tasto "i" del tab attivo: apre o chiude la sua scheda. */
  readonly info = output<string>();
  /** Il pannello aperto (la scheda con le informazioni o l'inventario) e di quale eroe, se ce n'è uno. */
  readonly panel = input<{ id: string; kind: PanelKind } | null>(null);
  /** Un clic sul tasto della città del tab attivo (solo se è in città). */
  readonly city = output<string>();
  /** Un'azione in città, dal pannello Città. */
  readonly cityAction = output<CityEvent>();
  /** Un bottone spento è stato toccato: il motivo da mostrare. */
  readonly denied = output<string>();
  /** Un clic sul tasto con la cassa del tab attivo: apre o chiude il suo inventario. */
  readonly inventory = output<string>();
  /** La scheda va chiusa (tocco fuori, Esc o X). */
  readonly sheetClosed = output<void>();
  /** Il bottone Passa in fondo ai tab. `passBusy`: ora non si può (turno dell'Overlord, finestra aperta). */
  readonly pass = output<void>();
  readonly passBusy = input(false);
  /** Si tocca la fatica dell'eroe attivo: spende 1 fatica per 1 punto movimento. */
  readonly spendFatigue = output<void>();
  /** Si usa un'abilità dalla scheda. */
  readonly skillUse = output<string>();
  /** La scheda del mostro aperta (solo nella vista Overlord). */
  readonly monster = input<MonsterDetails | null>(null);
  readonly monsterClosed = output<void>();
  /** Dai titoli in cima a un pannello: si passa all'altro. */
  readonly panelSwitch = output<PanelKind>();
  /** Un'azione su un oggetto, dalla scheda completa. */
  readonly itemAction = output<{ action: 'equip' | 'stow' | 'drop'; itemId: string }>();

  protected readonly heroes = computed(() => this.members().filter((m) => m.kind === 'hero'));
  /** L'eroe di cui si mostra la scheda completa. */
  protected readonly panelMember = computed(() => this.heroes().find((m) => m.id === this.panel()?.id && m.details) ?? null);
  /** Le icone degli stati sotto forma di elenco (le prime tre) e quelle che non ci stanno. */
  protected statusIcons(m: BarMember): { shown: { kind: string; icon: string; color: string; n: number; label: string }[]; more: string[] } {
    const s = m.status;
    if (!s) return { shown: [], more: [] };
    const all = ([['burn', 'burn', 'Fiamma'], ['web', 'web', 'Rete'], ['stun', 'stun', 'Stordimento']] as const)
      .filter(([k]) => s[k] > 0)
      .map(([k, icon, name]) => ({ kind: k, icon, color: `var(--c-${k})`, n: s[k], label: `${name} ×${s[k]}` }));
    return { shown: all.slice(0, 3), more: all.slice(3).map((x) => x.label) };
  }

  protected label(action: HeroAction): string {
    return ACTION_LABEL[action];
  }
}
