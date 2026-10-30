import { tr } from '../i18n/catalog-text';
import { TrPipe } from '../i18n/tr.pipe';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, input, output, signal } from '@angular/core';
import { DieFace } from '../game/dice/faces';
import { DieColor } from '../game/items/item';
import { AttackOutcome } from '../game/state/combat';
import { HeartComponent } from './heart.component';
import { HeartsComponent } from './hearts.component';
import { IconComponent } from './icon.component';
import { PictureComponent } from './picture.component';

/** Una delle due carte laterali: chi attacca e chi è attaccato. Del nemico si vede solo ciò che si vede sulla mappa (nome, ritratto, cuori). */
export interface AttackSide {
  name: string;
  subtitle: string;
  portrait?: string;
  /** Un mostro o un eroe: decide l'icona se manca l'immagine. */
  team: 'hero' | 'monster';
  /** Un mostro potenziato: la carta ha il contorno rosso. */
  enhanced?: boolean;
  wounds: number;
  maxWounds: number;
  /** Solo per chi difende: l'armatura (quella che vale contro questo attacco). Per chi attacca manca. */
  armor?: number | null;
  /** Chi difende è invincibile: nello scudo compare ∞ al posto dell'armatura. */
  invincible?: boolean;
}

/** Un'onda dell'arma che si può comprare con le Scariche. */
export interface AttackEffectView {
  index: number;
  cost: number;
  text: string;
  supported: boolean;
  /** Quante volte è stata attivata in questo attacco. */
  count: number;
  /** Si può attivare adesso: è già in gioco e ci sono abbastanza Scariche libere. */
  usable: boolean;
}

/** Tutto ciò che la finestra dell'attacco mostra. */
export interface AttackView {
  attacker: AttackSide;
  target: AttackSide;
  /** `attackLabel` completa "Attacco …": in mischia, a distanza o magico. */
  /** Lo gioca lo script dell'Overlord: niente tasti per tirare o annullare, e le scelte sono già fatte. */
  auto: boolean;
  weapon: { lead: string; name: string; icon: string; attackLabel: string; dice: DieColor[] };
  distance: number;
  needsRange: boolean;
  /** Fatica che resta all'attaccante e dadi potere già nel tiro (al massimo 5): serve per spenderla in un dado potere in più. */
  fatigue: number;
  blackDice: number;
  /** Stregoneria: il livello e i punti messi sulla gittata e sul danno (se il livello è 0 non si mostra). */
  sorcery: { level: number; range: number; damage: number };
  /** Chi altro viene colpito (Spazzata, Esplosione, Soffio) e quanto danno prende. */
  victims: { name: string; friend: boolean; damage: number }[];
  /** I bonus fissi che valgono per questo attacco, con chi li dà ("Possente: +2 danno"). */
  bonuses: { source: string; text: string }[];
  /** Prima del tiro (anteprima), mentre rotolano i dadi, dopo il tiro (si scelgono onde e valori e si applica). */
  step: 'preview' | 'rolling' | 'rolled';
  /** `choice` è null finché sulla faccia multivalente del dado potere non si è scelto cosa tenere. */
  rolls: { color: DieColor; face: DieFace; choice: 'range' | 'heart' | null }[];
  /** Quanti dadi si possono ancora ripetere scegliendo, e chi lo permette ("Occhio del cacciatore"). */
  rerolls: number;
  rerollSource: string;
  /** L'eroe ha l'ordine Mira e può dichiarare l'attacco mirato (ripetere dei dadi a scelta). */
  aim: boolean;
  effects: AttackEffectView[];
  outcome: AttackOutcome | null;
}

/** Quanto resta aperto l'attacco dell'Overlord dopo il tiro, in millisecondi (la barra si esaurisce in questo tempo). */
export const AUTO_CLOSE_MS = 3000;

const DIE_NAMES: Record<DieColor, string> = { get red() { return tr('dado rosso'); }, get green() { return tr('dado verde'); }, get blue() { return tr('dado blu'); }, get yellow() { return tr('dado giallo'); }, get white() { return tr('dado bianco'); }, get black() { return tr('dado potere'); } };

/**
 * La finestra dell'attacco, al centro dello schermo: a sinistra la carta di chi attacca, a destra quella del bersaglio e in mezzo il confronto (arma, dadi,
 * distanza), il tiro, le onde da spendere e il risultato. I dadi 3D rotolano sopra la finestra, nello spazio libero al centro. Prima del tiro si può annullare
 * senza spendere l'attacco; dopo, l'attacco è fatto e si applica. Ai giocatori del bersaglio non si mostrano i parametri (armatura, ferite esatte).
 */
@Component({
  selector: 'app-attack-dialog',
  imports: [TrPipe, HeartComponent, HeartsComponent, IconComponent, NgTemplateOutlet, PictureComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'escape()' },
  template: `
    @if (view(); as v) {
      <div class="backdrop" role="dialog" aria-modal="true" [attr.aria-label]="'Attacco di {a} contro {b}' | tr: { a: v.attacker.name, b: v.target.name }">
        <div class="dialog" [class.paused]="paused()" (pointerenter)="enter($event)" (pointerleave)="leave($event)" (pointerdown)="down($event)">
          <ng-template #side let-s>
            <app-picture [src]="s.portrait" [icon]="s.team === 'monster' ? 'skull' : 'frame_person'" [iconSize]="56" />
            <figcaption>
              <b>{{ s.name }}</b>
              <span>{{ s.subtitle }}</span>
              <app-hearts [wounds]="s.wounds" [max]="s.maxWounds" [size]="16" />
              @if (s.armor !== undefined) {
                <!-- L'armatura di chi difende: dentro uno scudo nero (come il Valore nei pannelli dell'eroe); vale anche per i nemici (le loro carte sono pubbliche). -->
                <i class="armor" [title]="'Armatura: si sottrae al danno' | tr" [attr.aria-label]="s.invincible ? ('Invincibile' | tr) : ('Armatura {n}' | tr: { n: s.armor })">
                  <svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2 36 8v14c0 11-7 19-16 22C11 41 4 33 4 22V8Z" /></svg>
                  <em>{{ s.invincible ? '∞' : s.armor }}</em>
                </i>
              }
            </figcaption>
          </ng-template>
          <!-- Le due carte stanno ai lati, inclinate e infilate sotto il pannello centrale, come l'immagine dei pannelli degli eroi. -->
          <figure class="card left" [class.enhanced]="v.attacker.enhanced"><ng-container [ngTemplateOutlet]="side" [ngTemplateOutletContext]="{ $implicit: v.attacker }" /></figure>
          <figure class="card right" [class.enhanced]="v.target.enhanced"><ng-container [ngTemplateOutlet]="side" [ngTemplateOutletContext]="{ $implicit: v.target }" /></figure>

          <section class="center">
            <header>
              <h2>{{ 'Attacco {kind}' | tr: { kind: v.weapon.attackLabel } }}</h2>
              <span class="dist" [title]="'Caselle fra l\\'attaccante e il bersaglio' | tr">{{ v.distance === 1 ? ('Adiacente' | tr) : ('Distanza {n}' | tr: { n: v.distance }) }}</span>
            </header>
            <p class="sub">{{ v.weapon.lead }}: <b>{{ v.weapon.name }}</b></p>
            <p class="versus">{{ '{a} contro {b}' | tr: { a: v.attacker.name, b: v.target.name } }}</p>

            <div class="body">
              <div class="cubes" [attr.aria-label]="'Dadi dell\\'attacco' | tr">
                @for (d of v.weapon.dice; track $index) { <app-icon name="deployed_code" [size]="26" [style.color]="'var(--cad-die-' + d + ')'" [title]="dieName(d)" /> }
              </div>
              @if (v.bonuses.length) {
                <ul class="bonuses" [attr.aria-label]="'Bonus' | tr">
                  @for (b of v.bonuses; track $index) { <li><b>{{ b.source }}</b> {{ b.text }}</li> }
                </ul>
              }
              @if (v.needsRange && v.step === 'preview') { <p class="hint">{{ 'Serve una gittata di almeno {n}.' | tr: { n: v.distance } }}</p> }
              @if (v.step === 'preview' && !v.auto) {
                <div class="roll"><button type="button" class="btn strong" (click)="roll.emit()">{{ 'Tira i dadi' | tr }}</button></div>
              }

              @if (v.step === 'rolled') {
                @if (v.aim) { <div class="fatigue-row"><button type="button" class="btn" (click)="aim.emit()" [title]="'Usa l\\'ordine Mira: ripeti i dadi che vuoi (anche i mancati)' | tr"><app-icon name="tactic" [size]="16" />{{ 'Attacco mirato: ripeti dei dadi' | tr }}</button></div> }
                @if (v.rerolls > 0) { <p class="hint">{{ (v.rerolls === 1 ? '{source}: puoi ripetere un dado a tua scelta.' : '{source}: puoi ripetere {n} dadi a tua scelta.') | tr: { source: v.rerollSource, n: v.rerolls } }}</p> }
                <ul class="rolls" [class.missed]="v.outcome?.miss">
                  @for (r of v.rolls; track $index) {
                    <li>
                      <app-icon name="deployed_code" [size]="20" [style.color]="'var(--cad-die-' + r.color + ')'" [title]="dieName(r.color)" />
                      @if (v.rerolls > 0) { <button type="button" class="again-die" [title]="'Ripeti questo dado' | tr" [attr.aria-label]="'Ripeti questo dado' | tr" (click)="reroll.emit($index)"><app-icon name="autorenew" [size]="16" /></button> }
                      @if (r.face.miss) { <span class="face miss" [title]="'Mancato' | tr"><app-icon name="close" [size]="18" /> {{ 'Mancato' | tr }}</span> }
                      @else if (r.face.slash && r.choice === null) {
                        <!-- Faccia multivalente non ancora risolta: due quadrati uguali, gittata o cuore. -->
                        <span class="face pick-row">
                          <button type="button" class="pick" (click)="choose.emit({ index: $index, value: 'range' })" [title]="'Tieni la gittata' | tr"><span class="range">{{ r.face.range }}</span></button>
                          <button type="button" class="pick" (click)="choose.emit({ index: $index, value: 'heart' })" [title]="'Tieni il cuore' | tr"><app-heart [points]="4" [size]="20" /></button>
                        </span>
                      } @else if (r.face.slash) {
                        <!-- Scelta fatta: resta solo il valore scelto, come gli altri risultati (un tocco per cambiare). -->
                        <button type="button" class="face again" (click)="v.auto ? null : choose.emit({ index: $index, value: null })" [title]="v.auto ? '' : ('Cambia scelta' | tr)">
                          @if (r.choice === 'range') { <span class="range">{{ r.face.range }}</span> } @else { <app-heart [points]="4" [size]="16" /> }
                        </button>
                      } @else {
                        <!-- Sempre nello stesso ordine: gittata, danno, onde. Il dado potere non ha la gittata. -->
                        <span class="face">
                          @if (r.color !== 'black') { <span class="range" [title]="'Gittata' | tr">{{ r.face.range }}</span> }
                          @for (h of times(r.face.hearts); track h) { <app-heart [points]="4" [size]="16" /> }
                          @for (s of times(r.face.surge); track s) { <app-icon name="bolt" [size]="18" class="surge" [title]="'Scarica' | tr" /> }
                        </span>
                      }
                    </li>
                  }
                </ul>
                @if (!v.auto && !v.outcome?.miss) {
                  <div class="fatigue-row">
                    <button type="button" class="btn" [class.off]="v.fatigue < 1 || v.blackDice >= maxBlack || adding()" [attr.aria-disabled]="v.fatigue < 1 || v.blackDice >= maxBlack || adding()"
                      [title]="(v.blackDice >= maxBlack ? 'Hai già 5 dadi potere' : v.fatigue < 1 ? 'Non hai più fatica' : 'Spendi 1 fatica per tirare un dado potere in più') | tr"
                      (click)="v.fatigue < 1 || v.blackDice >= maxBlack || adding() ? null : addDie.emit()"><app-icon name="water_drop" [size]="16" />{{ '1 +1 dado potere' | tr }}</button>
                    <small>{{ 'Fatica' | tr }} <app-icon name="water_drop" [size]="13" class="fat-icon" />{{ v.fatigue }} · {{ 'dadi potere {a}/{b}' | tr: { a: v.blackDice, b: maxBlack } }}</small>
                  </div>
                }
                @if (v.sorcery.level > 0 && !v.outcome?.miss) {
                  <div class="sorcery">
                    <h3>{{ 'Stregoneria {n}' | tr: { n: v.sorcery.level } }} <small>{{ '{n} punti liberi' | tr: { n: v.sorcery.level - v.sorcery.range - v.sorcery.damage } }}</small></h3>
                    <div class="sorcery-row">
                      <span>{{ 'Gittata' | tr }}</span>
                      <button type="button" class="step" [attr.aria-disabled]="v.auto || v.sorcery.range < 1" (click)="v.auto ? null : sorceryStep.emit({ kind: 'range', delta: -1 })">−</button>
                      <b>{{ v.sorcery.range }}</b>
                      <button type="button" class="step" [attr.aria-disabled]="v.auto || v.sorcery.range + v.sorcery.damage >= v.sorcery.level" (click)="v.auto ? null : sorceryStep.emit({ kind: 'range', delta: 1 })">+</button>
                      <span>{{ 'Danno' | tr }}</span>
                      <button type="button" class="step" [attr.aria-disabled]="v.auto || v.sorcery.damage < 1" (click)="v.auto ? null : sorceryStep.emit({ kind: 'damage', delta: -1 })">−</button>
                      <b>{{ v.sorcery.damage }}</b>
                      <button type="button" class="step" [attr.aria-disabled]="v.auto || v.sorcery.range + v.sorcery.damage >= v.sorcery.level" (click)="v.auto ? null : sorceryStep.emit({ kind: 'damage', delta: 1 })">+</button>
                    </div>
                  </div>
                }
                @if (v.effects.length) {
                  <div class="effects" [class.gone]="v.outcome?.miss">
                    <h3>{{ 'Attiva abilità' | tr }} <small>{{ '{n} Scariche libere' | tr: { n: v.outcome!.surges - v.outcome!.surgesSpent } }}</small>
                      @if (v.outcome!.surgesSpent > 0) { <button type="button" class="link" (click)="reset.emit()">{{ 'Azzera' | tr }}</button> }
                    </h3>
                    <div class="effects-grid">
                      @for (e of v.effects; track e.index) {
                        <button type="button" class="effect" [class.off]="!e.usable" [class.on]="e.count > 0" [attr.aria-disabled]="!e.usable"
                          [title]="(e.supported ? (e.usable ? 'Attiva (puoi farlo più volte, pagando ogni volta)' : 'Non hai abbastanza Scariche') : 'Non ancora in gioco') | tr"
                          (click)="e.usable ? use.emit(e.index) : null">
                          <span class="cost">@for (b of times(e.cost); track b) { <app-icon name="bolt" [size]="14" /> }</span>
                          <span class="what">{{ e.text }}@if (!e.supported) { <small>{{ 'non ancora in gioco' | tr }}</small> }</span>
                          @if (e.count > 0) { <span class="count" [title]="'Volte attivata' | tr">×{{ e.count }}</span> }
                        </button>
                      }
                    </div>
                  </div>
                }
                @if (v.outcome; as o) {
                  <p class="verdict" [class.hit]="o.damage > 0" [class.miss]="o.damage === 0" [class.gone]="o.miss">
                    @if (o.feared) { {{ "Paura: servono {n} Scariche, l'attacco fallisce" | tr: { n: o.fear } }} }
                    @else if (!o.inRange) { {{ 'Fuori portata: {a} su {b}' | tr: { a: o.range, b: v.distance } }} }
                    @else if (o.invincible) { {{ 'Colpito, ma non lo scalfisce' | tr }} }
                    @else if (o.damage === 0) { {{ "Colpito, ma l'armatura assorbe tutto" | tr }} }
                    @else { {{ (o.damage === 1 ? 'Colpito: 1 ferita' : 'Colpito: {n} ferite') | tr: { n: o.damage } }}@if (o.hearts + o.bonusDamage > o.damage) { <small>{{ '(l\\'armatura ne assorbe parte)' | tr }}</small> } }
                    @if (v.victims.length) {
                      <small class="states">{{ 'Colpisce anche:' | tr }} @for (x of v.victims; track $index) { {{ x.name }}{{ x.friend ? (' (amico)' | tr) : '' }} {{ x.damage }}{{ $last ? '' : ',' }} }</small>
                    }
                    @if (statusText(o)) { <small class="states">{{ statusText(o) }}</small> }
                  </p>
                }
              }
            </div>

            <!-- Con anche solo un Mancato l'attacco fallisce: i risultati e le scelte sfumano e il messaggio compare al centro del pannello. -->
            <div class="missed-msg" [class.show]="v.outcome?.miss" aria-live="polite"><span>{{ 'Mancato' | tr }}</span></div>

            <!-- Attacco dell'Overlord: niente tasto, una barra si esaurisce e alla fine il pannello si chiude da solo (ferma con il mouse sopra o con un tocco). -->
            @if (v.auto && v.step === 'rolled') { <span class="time" (animationend)="autoDone.emit()"></span> }

            <footer>
              @if (v.step === 'preview') {
                @if (v.auto) { <span class="wait">{{ 'L\\'Overlord si prepara…' | tr }}</span> } @else { <button type="button" class="btn" (click)="cancel.emit()">{{ 'Annulla' | tr }}</button> }
              } @else if (v.step === 'rolling') {
                <span class="wait">{{ 'I dadi rotolano…' | tr }}</span>
              } @else if (!v.auto) {
                <button type="button" class="btn strong" [class.off]="pending(v)" [attr.aria-disabled]="pending(v)" [title]="pending(v) ? ('Scegli cosa tenere sulle facce del dado potere' | tr) : ''" (click)="pending(v) ? null : apply.emit()">{{ 'Applica' | tr }}</button>
              }
            </footer>
          </section>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; z-index: 900; display: grid; place-items: center; padding: 12px; background: rgba(0, 0, 0, 0.55); animation: fade-in 0.2s ease-out; }
    @keyframes fade-in { from { opacity: 0; } }
    /* Altezza fissa: le carte laterali non si stirano quando il contenuto cresce (il contenuto scorre). La larghezza è quella del pannello centrale. */
    .dialog {
      --art-width: 190px; --art-overlap: 30px;
      position: relative; width: min(520px, calc(100vw - 24px - 2 * (var(--art-width) - var(--art-overlap)))); height: min(500px, calc(100vh - 48px));
      color: var(--c-text); font: 13px/1.35 var(--font-ui); user-select: none;
    }
    .center {
      position: relative; z-index: 1; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; min-width: 0;
      border-radius: var(--radius-1); background: var(--c-surface); border: 1px solid var(--c-line-strong); animation: panel-in 0.24s ease-out both;
    }
    .body { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 2px; }
    /* Le carte, come l'immagine dei pannelli degli eroi: inclinate, infilate sotto il bordo del pannello (che le copre), con un'ombra e il piede con il nome. */
    .card {
      position: absolute; z-index: 0; top: 8px; bottom: 8px; width: var(--art-width); margin: 0; overflow: hidden; border-radius: var(--radius-1);
      border: 1px solid var(--c-line-strong); background: var(--c-tile); box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55);
    }
    .card.enhanced { border-color: var(--c-faction-overlord); }
    .card.left { right: calc(100% - var(--art-overlap)); transform: rotate(-4deg); transform-origin: 70% 100%; animation: art-in-left 0.34s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    .card.right { left: calc(100% - var(--art-overlap)); transform: rotate(4deg); transform-origin: 30% 100%; animation: art-in-right 0.34s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    .card app-picture { position: absolute; inset: 0; }
    figcaption {
      position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 3px; background: var(--c-surface);
      border-top: 1px solid var(--c-line-strong); padding: 8px 12px 10px calc(var(--art-overlap) + 8px);
    }
    .card.left figcaption { padding: 8px calc(var(--art-overlap) + 8px) 10px 12px; }
    .armor { position: absolute; z-index: 1; right: 8px; bottom: calc(100% + 6px); width: 34px; height: 40px; display: inline-flex; align-items: center; justify-content: center; font-style: normal; }
    .armor svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .armor path { fill: var(--c-bg); stroke: var(--c-line-strong); stroke-width: 1; stroke-linejoin: round; }
    .armor em { position: relative; margin-top: -2px; font: 700 14px/1 var(--font-mono); font-style: normal; color: var(--c-text); }
    figcaption b { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.04em; }
    figcaption span { color: var(--c-text-dim); font-size: 11px; font-weight: 600; letter-spacing: var(--label-tracking); text-transform: uppercase; }
    @keyframes panel-in { from { opacity: 0; transform: translateY(10px); } }
    @keyframes art-in-left { from { opacity: 0; transform: translateX(52px) rotate(-1deg); } }
    @keyframes art-in-right { from { opacity: 0; transform: translateX(-52px) rotate(1deg); } }
    header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
    .dist { color: var(--c-text-dim); font: 600 12px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; white-space: nowrap; }
    .sub { margin: -4px 0 0; color: var(--c-text-dim); font-size: 12px; }
    .sub b { color: var(--c-text); font-weight: 600; }
    /* Il tasto del tiro sta al centro dello spazio che resta nel pannello */
    .roll { flex: 1; display: grid; place-items: center; }
    h2 { margin: 0; font: 600 var(--fs-md)/1.2 var(--font-ui); letter-spacing: 0.04em; text-transform: uppercase; }
    small { color: var(--c-text-dim); font-size: 12px; }
    .versus { display: none; margin: 0; color: var(--c-text-dim); font-size: 12px; }
    .hint { color: var(--c-text-dim); font-size: 12px; }
    .cubes { display: flex; gap: 3px; }
    .bonuses { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; color: var(--c-text-dim); font-size: 12px; }
    .bonuses b { color: var(--c-text); font-weight: 600; }
    .rolls { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
    .rolls li { display: flex; align-items: center; justify-content: space-between; gap: 8px; height: 44px; box-sizing: border-box; padding: 0 10px; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); background: var(--c-bg); }
    .face { display: inline-flex; align-items: center; gap: 3px; flex-wrap: nowrap; }
    .face.miss { color: var(--c-danger, #c4472f); font-weight: 600; }
    .face .surge { color: var(--c-interact); }
    /* La gittata è solo il numero, più grande dei simboli */
    .range { min-width: 14px; margin-right: 4px; text-align: center; font: 700 20px/1 var(--font-mono); font-variant-numeric: tabular-nums; }
    /* Le due scelte della faccia multivalente: due quadrati uguali, con il contenuto al centro. */
    .pick-row { gap: 6px; }
    .pick {
      width: 34px; height: 34px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-1);
      background: none; color: var(--c-text); cursor: pointer; border: 1px solid var(--c-line-strong); transition: border-color 0.15s;
    }
    .pick:hover, .pick:focus-visible { border-color: var(--c-interact); outline: none; }
    .pick .range { margin: 0; }
    .again { padding: 0; border: 0; background: none; color: inherit; cursor: pointer; }
    .fatigue-row { display: flex; align-items: center; gap: 10px; }
    .fatigue-row .btn { --tone: var(--c-stamina); display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 6px 14px; }
    .fatigue-row .btn:hover:not(.off), .fatigue-row .btn:focus-visible:not(.off) { border-color: var(--tone); color: var(--c-text); background: color-mix(in srgb, var(--tone) 8%, transparent); }
    .fatigue-row .btn.off:hover { border-color: var(--c-line-strong); }
    .fatigue-row .btn app-icon, .fatigue-row .fat-icon { color: var(--c-stamina); }
    .fatigue-row .fat-icon { vertical-align: -2px; }
    .sorcery-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .sorcery-row b { min-width: 14px; text-align: center; font: 700 16px var(--font-mono); }
    .step { width: 26px; height: 26px; padding: 0; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; border: 1px solid var(--c-line-strong); font: 600 15px/1 var(--font-ui); }
    .step[aria-disabled='true'] { opacity: 0.35; cursor: default; }
    h3 { margin: 0 0 4px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    h3 small { margin-left: 6px; text-transform: none; letter-spacing: 0; font-weight: 400; }
    /* Le abilità attivabili: blocchi in una griglia a due colonne; un tocco sul blocco le accende (bordo acceso). */
    .effects-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    .effect {
      display: flex; align-items: center; gap: 10px; min-height: 44px; box-sizing: border-box; padding: 6px 10px; cursor: pointer;
      border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); background: var(--c-bg); transition: border-color 0.15s;
    }
    .effect { position: relative; text-align: left; color: var(--c-text); font: 13px/1.3 var(--font-ui); }
    .effect:hover:not(.off), .effect:focus-visible:not(.off) { border-color: var(--c-text-dim); outline: none; }
    /* Il contatore: quante volte è stata attivata */
    .count { margin-left: auto; padding: 1px 6px; border-radius: var(--radius-1); background: var(--c-interact); color: var(--c-bg); font: 700 12px/1.4 var(--font-mono); }
    .link { margin-left: 8px; padding: 0; border: 0; background: none; color: var(--c-text-dim); cursor: pointer; font: 11px/1 var(--font-ui); text-decoration: underline; text-transform: none; letter-spacing: 0; }
    .effect.on { border-color: var(--c-interact); }
    .effect.off { opacity: 0.45; cursor: default; }
    .effect .cost { display: inline-flex; flex: none; color: var(--c-interact); min-width: 28px; }
    .effect .what { display: flex; flex-direction: column; min-width: 0; }
    .verdict { margin: 0; padding: 8px 10px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); font: 600 14px/1.3 var(--font-ui); }
    .verdict.hit { border-color: var(--c-life); color: var(--c-text); }
    .verdict.miss { color: var(--c-text-dim); }
    .verdict small { font-weight: 400; margin-left: 6px; }
    .verdict .states { display: block; margin: 4px 0 0; color: var(--c-text-dim); }
    /* Le scelte sfumano e non si toccano più */
    .rolls, .effects, .verdict { transition: opacity 0.3s ease; }
    .rolls.missed, .effects.gone, .verdict.gone { opacity: 0; pointer-events: none; visibility: hidden; transition: opacity 0.3s ease, visibility 0s 0.3s; }
    .missed-msg { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; pointer-events: none; opacity: 0; transition: opacity 0.3s ease 0.15s; }
    .missed-msg.show { opacity: 1; }
    .missed-msg span { padding: 10px 22px; border-radius: var(--radius-1); background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-text); font: 700 26px/1 var(--font-ui); letter-spacing: 0.12em; text-transform: uppercase; }
    footer { flex: none; display: flex; justify-content: center; align-items: center; gap: 8px; }
    .wait { color: var(--c-text-dim); }
    /* La barra del tempo (come quella delle notifiche): si esaurisce in AUTO_CLOSE_MS; ferma, resta più visibile. */
    .time { position: absolute; left: 4px; right: 4px; bottom: 4px; height: 2px; border-radius: 1px; background: var(--c-text-dim); opacity: 0.55; transform-origin: left; animation: auto-time ${AUTO_CLOSE_MS}ms linear forwards; }
    .dialog.paused .time { animation-play-state: paused; opacity: 0.9; }
    @keyframes auto-time { to { transform: scaleX(0); } }
    .again-die { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; border-radius: var(--radius-1); background: none; border: 1px solid var(--c-line-strong); color: var(--c-text-dim); cursor: pointer; }
    .again-die:hover, .again-die:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    .btn {
      padding: 7px 16px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer;
      border: 1px solid var(--c-line-strong); font: 13px/1.2 var(--font-ui); transition: border-color 0.15s, color 0.15s;
    }
    .btn.strong { font-weight: 600; border-color: var(--c-interact); }
    .btn.off { opacity: 0.4; cursor: default; }
    .btn.off:hover { border-color: var(--c-interact); color: var(--c-text); }
    .btn:hover, .btn:focus-visible { border-color: var(--c-interact); color: var(--c-interact); outline: none; }
    /* Su schermi stretti le carte non ci stanno: resta una riga "A contro B" e il pannello a tutta larghezza. */
    @media (max-width: 760px) {
      .dialog { width: 100%; }
      .card { display: none; }
      .versus { display: block; }
    }
    @media (prefers-reduced-motion: reduce) { .backdrop, .center, .card { animation: none !important; } .rolls, .effects, .verdict, .missed-msg { transition: none !important; } }
  `,
})
export class AttackDialogComponent {
  readonly view = input<AttackView | null>(null);
  readonly roll = output<void>();
  /** Si usa l'ordine Mira: si sceglieranno i dadi da ripetere. */
  readonly aim = output<void>();
  /** Si sceglie un dado da ripetere (l'indice). */
  readonly reroll = output<number>();
  readonly apply = output<void>();
  /** La barra dell'attacco dell'Overlord è finita: si applica e il pannello si chiude. */
  readonly autoDone = output<void>();
  /** Spende 1 fatica per un dado potere in più nel tiro. */
  readonly addDie = output<void>();
  /** Stregoneria: un punto in più o in meno alla gittata o al danno. */
  readonly sorceryStep = output<{ kind: 'range' | 'damage'; delta: 1 | -1 }>();
  /** Il dado in più sta rotolando. */
  readonly adding = input(false);
  protected readonly maxBlack = 5;
  readonly cancel = output<void>();
  readonly choose = output<{ index: number; value: 'range' | 'heart' | null }>();
  /** Attiva un'abilità (di nuovo, se è già stata attivata) e la volta che si azzera tutto. */
  readonly use = output<number>();
  readonly reset = output<void>();

  /** Con il mouse sopra il tempo si ferma; con il tocco si ferma al tocco e riparte con un secondo tocco o un tocco altrove. */
  protected readonly paused = signal(false);
  private touchPaused = false;

  protected enter(e: PointerEvent) {
    if (e.pointerType !== 'touch') this.paused.set(true);
  }

  protected leave(e: PointerEvent) {
    if (e.pointerType !== 'touch') this.paused.set(false);
  }

  protected down(e: PointerEvent) {
    if (e.pointerType !== 'touch') return;
    this.touchPaused = !this.touchPaused;
    this.paused.set(this.touchPaused);
  }

  /** Un tocco fuori dal pannello fa ripartire il tempo. */
  @HostListener('document:pointerdown', ['$event'])
  protected outside(e: PointerEvent) {
    if (e.pointerType !== 'touch' || !this.touchPaused) return;
    if (e.composedPath().some((n) => n instanceof HTMLElement && n.classList.contains('dialog'))) return;
    this.touchPaused = false;
    this.paused.set(false);
  }

  /** Gli stati che l'attacco piazza, a parole ("Stordimento ×1, Veleno ×2"). */
  protected statusText(o: AttackOutcome): string {
    const names: Record<string, string> = { burn: tr('Fiamma'), web: tr('Rete'), stun: tr('Stordimento'), poison: tr('Veleno') };
    return [...o.statuses.map((s) => `${names[s.kind]} ×${s.n}`), ...(o.poison ? [`${tr('Veleno')} ×${o.poison}`] : [])].join(', ');
  }

  protected dieName(d: DieColor): string {
    return DIE_NAMES[d];
  }

  /** Ci sono facce multivalenti ancora da risolvere? Finché è così non si può applicare. */
  protected pending(v: AttackView): boolean {
    return !v.outcome?.miss && v.rolls.some((r) => r.face.slash && r.choice === null); // con un Mancato non c'è niente da scegliere
  }

  protected times(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }

  /** Esc annulla, ma solo prima del tiro (dopo, l'attacco è fatto). */
  protected escape() {
    const v = this.view();
    if (v?.step === 'preview' && !v.auto) this.cancel.emit();
  }
}
