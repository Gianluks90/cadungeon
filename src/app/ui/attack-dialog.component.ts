import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, input, output, signal } from '@angular/core';
import { DieFace } from '../game/dice/faces';
import { DieColor } from '../game/items/item';
import { AttackOutcome } from '../game/state/combat';
import { HeartComponent } from './heart.component';
import { HeartsComponent } from './hearts.component';
import { IconComponent } from './icon.component';

/** Una delle due carte laterali: chi attacca e chi è attaccato. Del nemico si vede solo ciò che si vede sulla mappa (nome, ritratto, cuori). */
export interface AttackSide {
  name: string;
  subtitle: string;
  portrait?: string;
  wounds: number;
  maxWounds: number;
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
  /** Prima del tiro (anteprima), mentre rotolano i dadi, dopo il tiro (si scelgono onde e valori e si applica). */
  step: 'preview' | 'rolling' | 'rolled';
  /** `choice` è null finché sulla faccia multivalente del dado potere non si è scelto cosa tenere. */
  rolls: { color: DieColor; face: DieFace; choice: 'range' | 'heart' | null }[];
  effects: AttackEffectView[];
  outcome: AttackOutcome | null;
}

/** Quanto resta aperto l'attacco dell'Overlord dopo il tiro, in millisecondi (la barra si esaurisce in questo tempo). */
export const AUTO_CLOSE_MS = 5000;

const DIE_NAMES: Record<DieColor, string> = { red: 'dado rosso', green: 'dado verde', blue: 'dado blu', yellow: 'dado giallo', white: 'dado bianco', black: 'dado potere' };

/**
 * La finestra dell'attacco, al centro dello schermo: a sinistra la carta di chi attacca, a destra quella del bersaglio e in mezzo il confronto (arma, dadi,
 * distanza), il tiro, le onde da spendere e il risultato. I dadi 3D rotolano sopra la finestra, nello spazio libero al centro. Prima del tiro si può annullare
 * senza spendere l'attacco; dopo, l'attacco è fatto e si applica. Ai giocatori del bersaglio non si mostrano i parametri (armatura, ferite esatte).
 */
@Component({
  selector: 'app-attack-dialog',
  imports: [HeartComponent, HeartsComponent, IconComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'escape()' },
  template: `
    @if (view(); as v) {
      <div class="backdrop" role="dialog" aria-modal="true" [attr.aria-label]="'Attacco di ' + v.attacker.name + ' contro ' + v.target.name">
        <div class="dialog" [class.paused]="paused()" (pointerenter)="enter($event)" (pointerleave)="leave($event)" (pointerdown)="down($event)">
          <ng-template #side let-s>
            @if (s.portrait) { <img [src]="s.portrait" [alt]="s.name" draggable="false" /> }
            <figcaption>
              <b>{{ s.name }}</b>
              <span>{{ s.subtitle }}</span>
              <app-hearts [wounds]="s.wounds" [max]="s.maxWounds" [size]="16" />
            </figcaption>
          </ng-template>
          <!-- Le due carte stanno ai lati, inclinate e infilate sotto il pannello centrale, come l'immagine dei pannelli degli eroi. -->
          <figure class="card left"><ng-container [ngTemplateOutlet]="side" [ngTemplateOutletContext]="{ $implicit: v.attacker }" /></figure>
          <figure class="card right"><ng-container [ngTemplateOutlet]="side" [ngTemplateOutletContext]="{ $implicit: v.target }" /></figure>

          <section class="center">
            <header>
              <h2>Attacco {{ v.weapon.attackLabel }}</h2>
              <span class="dist" title="Caselle fra l'attaccante e il bersaglio">{{ v.distance === 1 ? 'Adiacente' : 'Distanza ' + v.distance }}</span>
            </header>
            <p class="sub">{{ v.weapon.lead }}: <b>{{ v.weapon.name }}</b></p>
            <p class="versus">{{ v.attacker.name }} contro {{ v.target.name }}</p>

            <div class="body">
              <div class="cubes" aria-label="Dadi dell'attacco">
                @for (d of v.weapon.dice; track $index) { <app-icon name="deployed_code" [size]="26" [style.color]="'var(--cad-die-' + d + ')'" [title]="dieName(d)" /> }
              </div>
              @if (v.needsRange && v.step === 'preview') { <p class="hint">Serve una gittata di almeno {{ v.distance }}.</p> }
              @if (v.step === 'preview' && !v.auto) {
                <div class="roll"><button type="button" class="btn strong" (click)="roll.emit()">Tira i dadi</button></div>
              }

              @if (v.step === 'rolled') {
                <ul class="rolls" [class.missed]="v.outcome?.miss">
                  @for (r of v.rolls; track $index) {
                    <li>
                      <app-icon name="deployed_code" [size]="20" [style.color]="'var(--cad-die-' + r.color + ')'" [title]="dieName(r.color)" />
                      @if (r.face.miss) { <span class="face miss" title="Mancato"><app-icon name="close" [size]="18" /> Mancato</span> }
                      @else if (r.face.slash && r.choice === null) {
                        <!-- Faccia multivalente non ancora risolta: due quadrati uguali, gittata o cuore. -->
                        <span class="face pick-row">
                          <button type="button" class="pick" (click)="choose.emit({ index: $index, value: 'range' })" title="Tieni la gittata"><span class="range">{{ r.face.range }}</span></button>
                          <button type="button" class="pick" (click)="choose.emit({ index: $index, value: 'heart' })" title="Tieni il cuore"><app-heart [points]="4" [size]="20" /></button>
                        </span>
                      } @else if (r.face.slash) {
                        <!-- Scelta fatta: resta solo il valore scelto, come gli altri risultati (un tocco per cambiare). -->
                        <button type="button" class="face again" (click)="v.auto ? null : choose.emit({ index: $index, value: null })" [title]="v.auto ? '' : 'Cambia scelta'">
                          @if (r.choice === 'range') { <span class="range">{{ r.face.range }}</span> } @else { <app-heart [points]="4" [size]="16" /> }
                        </button>
                      } @else {
                        <!-- Sempre nello stesso ordine: gittata, danno, onde. Il dado potere non ha la gittata. -->
                        <span class="face">
                          @if (r.color !== 'black') { <span class="range" title="Gittata">{{ r.face.range }}</span> }
                          @for (h of times(r.face.hearts); track h) { <app-heart [points]="4" [size]="16" /> }
                          @for (s of times(r.face.surge); track s) { <app-icon name="bolt" [size]="18" class="surge" title="Scarica" /> }
                        </span>
                      }
                    </li>
                  }
                </ul>
                @if (v.effects.length) {
                  <div class="effects" [class.gone]="v.outcome?.miss">
                    <h3>Attiva abilità <small>{{ v.outcome!.surges - v.outcome!.surgesSpent }} Scariche libere</small>
                      @if (v.outcome!.surgesSpent > 0) { <button type="button" class="link" (click)="reset.emit()">Azzera</button> }
                    </h3>
                    <div class="effects-grid">
                      @for (e of v.effects; track e.index) {
                        <button type="button" class="effect" [class.off]="!e.usable" [class.on]="e.count > 0" [attr.aria-disabled]="!e.usable"
                          [title]="e.supported ? (e.usable ? 'Attiva (puoi farlo più volte, pagando ogni volta)' : 'Non hai abbastanza Scariche') : 'Non ancora in gioco'"
                          (click)="e.usable ? use.emit(e.index) : null">
                          <span class="cost">@for (b of times(e.cost); track b) { <app-icon name="bolt" [size]="14" /> }</span>
                          <span class="what">{{ e.text }}@if (!e.supported) { <small>non ancora in gioco</small> }</span>
                          @if (e.count > 0) { <span class="count" title="Volte attivata">×{{ e.count }}</span> }
                        </button>
                      }
                    </div>
                  </div>
                }
                @if (v.outcome; as o) {
                  <p class="verdict" [class.hit]="o.damage > 0" [class.miss]="o.damage === 0" [class.gone]="o.miss">
                    @if (!o.inRange) { Fuori gittata: {{ o.range }} su {{ v.distance }} }
                    @else if (o.damage === 0) { Colpito, ma l'armatura assorbe tutto }
                    @else { Colpito: {{ o.damage }} {{ o.damage === 1 ? 'ferita' : 'ferite' }}@if (o.hearts + o.bonusDamage > o.damage) { <small>(l'armatura ne assorbe parte)</small> } }
                  </p>
                }
              }
            </div>

            <!-- Con anche solo un Mancato l'attacco fallisce: i risultati e le scelte sfumano e il messaggio compare al centro del pannello. -->
            <div class="missed-msg" [class.show]="v.outcome?.miss" aria-live="polite"><span>Mancato</span></div>

            <!-- Attacco dell'Overlord: niente tasto, una barra si esaurisce e alla fine il pannello si chiude da solo (ferma con il mouse sopra o con un tocco). -->
            @if (v.auto && v.step === 'rolled') { <span class="time" (animationend)="autoDone.emit()"></span> }

            <footer>
              @if (v.step === 'preview') {
                @if (v.auto) { <span class="wait">L'Overlord si prepara…</span> } @else { <button type="button" class="btn" (click)="cancel.emit()">Annulla</button> }
              } @else if (v.step === 'rolling') {
                <span class="wait">I dadi rotolano…</span>
              } @else if (!v.auto) {
                <button type="button" class="btn strong" [class.off]="pending(v)" [attr.aria-disabled]="pending(v)" [title]="pending(v) ? 'Scegli cosa tenere sulle facce del dado potere' : ''" (click)="pending(v) ? null : apply.emit()">Applica</button>
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
    .card.left { right: calc(100% - var(--art-overlap)); transform: rotate(-4deg); transform-origin: 70% 100%; animation: art-in-left 0.34s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    .card.right { left: calc(100% - var(--art-overlap)); transform: rotate(4deg); transform-origin: 30% 100%; animation: art-in-right 0.34s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    .card img { width: 100%; height: 100%; object-fit: cover; object-position: center top; display: block; pointer-events: none; }
    figcaption {
      position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 3px; background: var(--c-surface);
      border-top: 1px solid var(--c-line-strong); padding: 8px 12px 10px calc(var(--art-overlap) + 8px);
    }
    .card.left figcaption { padding: 8px calc(var(--art-overlap) + 8px) 10px 12px; }
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
  readonly apply = output<void>();
  /** La barra dell'attacco dell'Overlord è finita: si applica e il pannello si chiude. */
  readonly autoDone = output<void>();
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
