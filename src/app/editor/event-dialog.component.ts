import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { AdventureEvent, EventCondition, EventEffect, EventTrigger } from '../game/map/map-data';
import { DialogComponent } from '../ui/dialog.component';
import { SelectComponent, SelectOption } from '../ui/select.component';

type EffectKind = EventEffect['kind'];
type Side = 'then' | 'else';
type CheckDice = 'melee' | 'ranged' | 'magic';

/** Dove sta una lista di effetti: in "Allora" o "Altrimenti" e, se è dentro una Prova, in quale effetto e in quale dei suoi due rami (`ok` superata, `ko` fallita). */
interface Loc {
  side: Side;
  parent: { i: number; branch: 'ok' | 'ko' } | null;
}

/** Un effetto come si digita: tutti i campi sono testo e ognuno serve solo a certi tipi di effetto. */
interface FormEffect {
  kind: EffectKind;
  /** Solo per la Prova: quali dadi, quante onde servono, se si può rifiutare e gli effetti dei due rami. */
  dice: CheckDice;
  needs: string;
  refusable: boolean;
  ok: FormEffect[];
  ko: FormEffect[];
  title: string;
  text: string;
  amount: string;
  variable: string;
  on: 'on' | 'off';
  pieceId: string;
  doorId: string;
  wounds: string;
  speed: string;
  armor: string;
  turns: string;
  distance: string;
}

interface FormCondition {
  variable: string;
  is: 'on' | 'off';
}

const blank = (kind: EffectKind): FormEffect => ({ kind, dice: 'magic', needs: '1', refusable: false, ok: [], ko: [], title: '', text: '', amount: '1', variable: '', on: 'on', pieceId: '', doorId: '', wounds: '', speed: '', armor: '', turns: '2', distance: '8' });

const num = (s: string): number => {
  const n = Number(s.trim());
  return s.trim() !== '' && Number.isInteger(n) ? n : 0;
};
const isInt = (s: string) => s.trim() === '' || Number.isInteger(Number(s.trim()));

function toForm(e: EventEffect): FormEffect {
  const f = blank(e.kind);
  switch (e.kind) {
    case 'message': return { ...f, title: e.title ?? '', text: e.text };
    case 'progress': return { ...f, amount: String(e.amount) };
    case 'setVariable': return { ...f, variable: e.variable, on: e.value ? 'on' : 'off' };
    case 'modifyMonster': return { ...f, pieceId: e.pieceId, wounds: e.wounds ? String(e.wounds) : '', speed: e.speed ? String(e.speed) : '', armor: e.armor ? String(e.armor) : '' };
    case 'revive': return { ...f, turns: String(e.turns), distance: String(e.distance) };
    case 'finishRevival': return { ...f, pieceId: e.pieceId };
    case 'activate': return { ...f, pieceId: e.pieceId };
    case 'removePiece': return { ...f, pieceId: e.pieceId };
    case 'openDoor': return { ...f, doorId: e.doorId };
    case 'check': return { ...f, title: e.title ?? '', text: e.text, dice: e.dice, needs: String(e.needs ?? 1), refusable: !!e.refusable, ok: e.onSuccess.map(toForm), ko: e.onFail.map(toForm) };
    case 'win': return f;
  }
}

function toEffect(f: FormEffect): EventEffect {
  switch (f.kind) {
    case 'message': return { kind: 'message', ...(f.title.trim() ? { title: f.title.trim() } : {}), text: f.text.trim() };
    case 'progress': return { kind: 'progress', amount: num(f.amount) };
    case 'setVariable': return { kind: 'setVariable', variable: f.variable, value: f.on === 'on' };
    case 'modifyMonster': return { kind: 'modifyMonster', pieceId: f.pieceId, ...(num(f.wounds) ? { wounds: num(f.wounds) } : {}), ...(num(f.speed) ? { speed: num(f.speed) } : {}), ...(num(f.armor) ? { armor: num(f.armor) } : {}) };
    case 'revive': return { kind: 'revive', turns: Math.max(1, num(f.turns)), distance: Math.max(0, num(f.distance)) };
    case 'finishRevival': return { kind: 'finishRevival', pieceId: f.pieceId };
    case 'activate': return { kind: 'activate', pieceId: f.pieceId };
    case 'removePiece': return { kind: 'removePiece', pieceId: f.pieceId };
    case 'openDoor': return { kind: 'openDoor', doorId: f.doorId };
    case 'check': return { kind: 'check', ...(f.title.trim() ? { title: f.title.trim() } : {}), text: f.text.trim(), dice: f.dice, needs: Math.max(1, num(f.needs)), ...(f.refusable ? { refusable: true } : {}), onSuccess: f.ok.map(toEffect), onFail: f.ko.map(toEffect) };
    case 'win': return { kind: 'win' };
  }
}

const WHEN_OPTIONS: SelectOption[] = [
  { value: 'defeated', label: 'Un nemico è sconfitto' },
  { value: 'interact', label: 'Un eroe interagisce con un nemico' },
  { value: 'cleared', label: 'Non c’è più nessun nemico…' },
  { value: 'pickedUp', label: 'Un eroe raccoglie un oggetto' },
  { value: 'chestOpened', label: "Si apre un baule in un'area" },
  { value: 'areaRevealed', label: "Gli eroi rivelano un'area" },
];

const EFFECT_OPTIONS: SelectOption[] = [
  { value: 'message', label: 'Mostra un messaggio' },
  { value: 'progress', label: 'Cambia i punti Conquista' },
  { value: 'setVariable', label: 'Cambia una variabile' },
  { value: 'modifyMonster', label: 'Modifica un nemico' },
  { value: 'revive', label: 'Il nemico sconfitto torna in vita' },
  { value: 'finishRevival', label: 'Chiudi il ritorno in vita di un nemico' },
  { value: 'activate', label: 'Attiva un nemico inattivo' },
  { value: 'removePiece', label: 'Rimuovi un nemico dalla mappa' },
  { value: 'openDoor', label: 'Apri una porta evento' },
  { value: 'check', label: 'Prova con i dadi potere' },
  { value: 'win', label: "Vinci l'avventura" },
];

const STATE_OPTIONS: SelectOption[] = [
  { value: 'on', label: 'è accesa' },
  { value: 'off', label: 'è spenta' },
];

/**
 * La dialog di un evento: **Quando** scatta (un nemico sconfitto, un baule aperto in un'area, un'area rivelata), **Se** valgono certe condizioni sulle variabili (facoltativo), e **Allora**
 * (e, se ci sono condizioni, **Altrimenti**) gli effetti, una lista di cui ogni voce ha i suoi campi. "Conferma" resta spento finché qualcosa manca; il messaggio sotto dice cosa.
 */
@Component({
  selector: 'app-event-dialog',
  imports: [NgTemplateOutlet, DialogComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="title()" width="min(720px, 100%)" height="min(680px, calc(100vh - 48px))" (closed)="cancel.emit()">
        <label class="field">
          <span>Nome <small>(facoltativo)</small></span>
          <input type="text" autocomplete="off" placeholder="Per esempio: Il cuore di Munkar" [value]="name()" (input)="name.set($any($event.target).value)" />
        </label>

        <section>
          <h3>Quando</h3>
          <div class="pair">
            <app-select class="block" [options]="whenOptions" [value]="whenKind()" label="Quando" (changed)="setWhen($event)" />
            @if (whenKind() !== 'cleared') {
              <app-select class="block" [options]="targetOptions()" [value]="target()" [placeholder]="placeholder()" label="Dove o chi" (changed)="target.set($event)" />
            } @else {
              <app-select class="block" [options]="whereOptions()" [value]="whereArea()" label="Dove" (changed)="whereArea.set($event)" />
            }
          </div>
          @if (whenKind() === 'cleared') {
            <div class="chips">
              @for (id of pieceIds(); track id) {
                <span class="chip">{{ monsterName(id) }}<button type="button" [attr.aria-label]="'Togli ' + monsterName(id)" (click)="removePieceId(id)">×</button></span>
              } @empty { <small class="hint">Qualunque nemico</small> }
            </div>
            <app-select class="block" [options]="freeMonsters()" value="" placeholder="Aggiungi un nemico alla lista…" label="Nemici" (changed)="addPieceId($event)" />
            <small class="hint">Scatta quando l'ultimo dei nemici scelti (o di tutti, se la lista è vuota) non è più nella mappa o nell'area: sconfitto, rimosso o uscito camminando. Non scatta se all'inizio non ce n'era nessuno.</small>
          }
          @if (whenKind() === 'interact') {
            <label class="inline"><span>Costo dell'interazione (punti movimento)</span><input type="number" min="0" step="1" [class.bad]="!isInt(cost())" [value]="cost()" (input)="cost.set($any($event.target).value)" /></label>
            <small class="hint">Sul nemico compare un "?" e l'eroe adiacente trova la stessa voce nel menu del "!". Si può fare una volta sola: poi il "?" sparisce.</small>
          }
          @if (!targetOptions().length) { <small class="hint">{{ emptyHint() }}</small> }
        </section>

        <section>
          <h3>Se <small>(facoltativo: tutte le condizioni devono valere)</small></h3>
          @for (c of conditions(); track $index; let i = $index) {
            <div class="row cond">
              <app-select class="block" [options]="varOptions()" [value]="c.variable" placeholder="Scegli una variabile…" label="Variabile" (changed)="patchCondition(i, { variable: $event })" />
              <app-select class="block" [options]="stateOptions" [value]="c.is" label="Stato" (changed)="patchCondition(i, { is: $any($event) })" />
              <button type="button" class="rm" aria-label="Togli la condizione" title="Togli la condizione" (click)="removeCondition(i)">×</button>
            </div>
          }
          <button type="button" class="dlg-btn small" (click)="addCondition()">Aggiungi una condizione</button>
        </section>

        @for (side of sides(); track side) {
          <section>
            <h3>{{ side === 'then' ? 'Allora' : 'Altrimenti' }}</h3>
            @for (e of list(side)(); track $index; let i = $index) {
              <ng-container *ngTemplateOutlet="fx; context: { $implicit: e, loc: { side: side, parent: null }, i: i }" />
            }
            <button type="button" class="dlg-btn small" (click)="addEffect({ side: side, parent: null })">Aggiungi un effetto</button>
          </section>
        }

        <!-- Un effetto con i suoi campi. È un modello perché la Prova contiene altre due liste di effetti (superata e fallita) che si scrivono allo stesso modo. -->
        <ng-template #fx let-e let-loc="loc" let-i="i">
              <div class="effect">
                <div class="row head">
                  <app-select class="block" [options]="effectOptionsFor(loc)" [value]="e.kind" label="Effetto" (changed)="setKind(loc, i, $event)" />
                  <button type="button" class="rm" aria-label="Togli l'effetto" title="Togli l'effetto" (click)="removeEffect(loc, i)">×</button>
                </div>
                @switch (e.kind) {
                  @case ('message') {
                    <input type="text" autocomplete="off" placeholder="Titolo (facoltativo)" [value]="e.title" (input)="patch(loc, i, { title: $any($event.target).value })" />
                    <textarea rows="4" placeholder="Il testo che i giocatori leggono (markdown), con il tasto Ho letto." [class.bad]="!e.text.trim()" [value]="e.text" (input)="patch(loc, i, { text: $any($event.target).value })"></textarea>
                  }
                  @case ('progress') {
                    <label class="inline"><span>Punti Conquista (anche negativi)</span><input type="number" step="1" [class.bad]="!num(e.amount)" [value]="e.amount" (input)="patch(loc, i, { amount: $any($event.target).value })" /></label>
                  }
                  @case ('setVariable') {
                    <div class="pair">
                      <app-select class="block" [options]="varOptions()" [value]="e.variable" placeholder="Scegli una variabile…" label="Variabile" (changed)="patch(loc, i, { variable: $event })" />
                      <app-select class="block" [options]="stateOptions" [value]="e.on" label="Diventa" (changed)="patch(loc, i, { on: $any($event) })" />
                    </div>
                  }
                  @case ('modifyMonster') {
                    <app-select class="block" [options]="monsters()" [value]="e.pieceId" placeholder="Scegli un nemico…" label="Nemico" (changed)="patch(loc, i, { pieceId: $event })" />
                    <div class="trio">
                      <label class="inline"><span>Ferite</span><input type="number" step="1" placeholder="0" [value]="e.wounds" (input)="patch(loc, i, { wounds: $any($event.target).value })" /></label>
                      <label class="inline"><span>Velocità</span><input type="number" step="1" placeholder="0" [value]="e.speed" (input)="patch(loc, i, { speed: $any($event.target).value })" /></label>
                      <label class="inline"><span>Armatura</span><input type="number" step="1" placeholder="0" [value]="e.armor" (input)="patch(loc, i, { armor: $any($event.target).value })" /></label>
                    </div>
                    <small class="hint">Si somma ai valori che ha per il resto della partita (negativo per togliere).</small>
                  }
                  @case ('revive') {
                    <div class="pair">
                      <label class="inline"><span>Turni del Signore supremo</span><input type="number" min="1" step="1" [class.bad]="num(e.turns) < 1" [value]="e.turns" (input)="patch(loc, i, { turns: $any($event.target).value })" /></label>
                      <label class="inline"><span>Distanza minima dagli eroi (caselle)</span><input type="number" min="0" step="1" [class.bad]="!isInt(e.distance)" [value]="e.distance" (input)="patch(loc, i, { distance: $any($event.target).value })" /></label>
                    </div>
                    <small class="hint">Esce dalla mappa senza bottino e torna a piena salute in una casella già scoperta e libera, il più lontano possibile se non ce n'è una abbastanza lontana.</small>
                  }
                  @case ('finishRevival') {
                    <app-select class="block" [options]="monsters()" [value]="e.pieceId" placeholder="Scegli un nemico…" label="Nemico" (changed)="patch(loc, i, { pieceId: $event })" />
                    <small class="hint">Se sta aspettando di tornare in vita, la sua sconfitta si ripete adesso con le variabili di adesso. Altrimenti non fa niente.</small>
                  }
                  @case ('activate') {
                    <app-select class="block" [options]="monsters()" [value]="e.pieceId" placeholder="Scegli un nemico…" label="Nemico" (changed)="patch(loc, i, { pieceId: $event })" />
                    <small class="hint">Se il nemico è inattivo (si imposta in Personalizza), da ora agisce come un nemico qualunque; l'aspetto di pietra, se c'è, resta. Altrimenti non fa niente.</small>
                  }
                  @case ('removePiece') {
                    <app-select class="block" [options]="monsters()" [value]="e.pieceId" placeholder="Scegli un nemico…" label="Nemico" (changed)="patch(loc, i, { pieceId: $event })" />
                    <small class="hint">Il nemico viene tolto dalla mappa senza essere sconfitto: niente bottino e non scattano gli eventi "sconfitto".</small>
                  }
                  @case ('openDoor') {
                    <app-select class="block" [options]="doors()" [value]="e.doorId" placeholder="Scegli una porta evento…" label="Porta" (changed)="patch(loc, i, { doorId: $event })" />
                    <small class="hint">{{ doors().length ? 'La porta si apre e da ora è libera come le altre.' : 'Metti prima una Porta evento con lo strumento Porte.' }}</small>
                  }
                  @case ('check') {
                    <input type="text" autocomplete="off" placeholder="Titolo (facoltativo)" [value]="e.title" (input)="patch(loc, i, { title: $any($event.target).value })" />
                    <textarea rows="4" placeholder="L'indovinello o la situazione che l'eroe legge prima di tirare (markdown)." [class.bad]="!e.text.trim()" [value]="e.text" (input)="patch(loc, i, { text: $any($event.target).value })"></textarea>
                    <div class="trio check">
                      <app-select class="block" [options]="diceOptions" [value]="e.dice" label="Dadi" (changed)="patch(loc, i, { dice: $any($event) })" />
                      <label class="inline"><span>Onde necessarie</span><input type="number" min="1" step="1" [class.bad]="num(e.needs) < 1" [value]="e.needs" (input)="patch(loc, i, { needs: $any($event.target).value })" /></label>
                      <label class="inline checkbox"><span>Si può rifiutare</span><input type="checkbox" [checked]="e.refusable" (change)="patch(loc, i, { refusable: $any($event.target).checked })" /></label>
                    </div>
                    <small class="hint">L'eroe tira tanti dadi potere quanti sono i dadi in più del suo attacco scelto (senza dadi la prova fallisce da sola) e non può spendere fatica. Con "Si può rifiutare" compare anche Annulla: non succede niente, il costo dell'interazione torna indietro e il "?" resta.</small>
                    @for (branch of branches; track branch.id) {
                      <div class="branch">
                        <h4>{{ branch.label }}</h4>
                        @for (c of (branch.id === 'ok' ? e.ok : e.ko); track $index; let j = $index) {
                          <ng-container *ngTemplateOutlet="fx; context: { $implicit: c, loc: { side: loc.side, parent: { i: i, branch: branch.id } }, i: j }" />
                        }
                        <button type="button" class="dlg-btn small" (click)="addEffect({ side: loc.side, parent: { i: i, branch: branch.id } })">Aggiungi un effetto</button>
                      </div>
                    }
                  }
                  @case ('win') {
                    <small class="hint">Gli eroi vincono: compaiono la conclusione e i punti dell'obiettivo (si scrivono in Obiettivi).</small>
                  }
                }
              </div>
        </ng-template>

        <section>
          <h3>Nuova variabile</h3>
          <div class="row">
            <input type="text" autocomplete="off" maxlength="40" placeholder="Per esempio: Cuore di Munkar trovato" [value]="newVariable()" (input)="newVariable.set($any($event.target).value)" (keydown.enter)="addVariable()" />
            <button type="button" class="dlg-btn small" [class.off]="!canAddVariable()" [attr.aria-disabled]="!canAddVariable()" (click)="addVariable()">Aggiungi</button>
          </div>
        </section>

        <ng-container dialogFooter>
          @if (problem()) { <span class="problem">{{ problem() }}</span> }
          <button type="button" class="dlg-btn primary" [class.off]="!!problem()" [attr.aria-disabled]="!!problem()" (click)="confirm()">Conferma</button>
        </ng-container>
      </app-dialog>
    }
  `,
  styles: `
    section { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--c-line-strong); }
    section:last-of-type { border-bottom: 0; }
    h3 { margin: 0; font: 600 12px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-interact); }
    h3 small, .field span small { color: var(--c-text-dim); text-transform: none; letter-spacing: 0; font-weight: 400; }
    .field, .inline { display: flex; flex-direction: column; gap: 6px; }
    .field > span, .inline > span { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    input, textarea { box-sizing: border-box; width: 100%; min-width: 0; padding: 8px 10px; border-radius: var(--radius-1); background: var(--c-bg); color: var(--c-text); border: 1px solid var(--c-line-strong); font: 13px/1.4 var(--font-ui); resize: vertical; }
    input[type='number'] { font-family: var(--font-mono); }
    input:focus, textarea:focus { border-color: var(--c-interact); outline: none; }
    .bad { border-color: var(--c-danger); }
    .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .trio { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; }
    .row.cond { grid-template-columns: 1fr 140px auto; }
    .effect { display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--c-line-strong); border-left: 3px solid var(--c-interact); border-radius: var(--radius-1); }
    .trio > * { min-width: 0; }
    /* Sui telefoni i tre campi della Prova (dadi, onde, rifiutabile) stanno in colonna: affiancati allargherebbero la finestra. */
    @media (max-width: 600px) { .trio.check { grid-template-columns: 1fr; } }
    .branch { display: flex; flex-direction: column; gap: 8px; padding-left: 10px; border-left: 1px solid var(--c-line-strong); }
    .branch h4 { margin: 0; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .inline.checkbox { flex-direction: row; align-items: center; justify-content: space-between; gap: 8px; }
    .inline.checkbox input { width: auto; margin: 0; accent-color: var(--c-interact); }
    .rm { border: 0; background: none; color: var(--c-text-dim); cursor: pointer; padding: 0 6px; font-size: 18px; line-height: 1; }
    .rm:hover { color: var(--c-danger); }
    .small { align-self: flex-start; padding: 4px 10px; font-size: 12px; }
    .hint { color: var(--c-text-dim); font-size: 12px; }
    .chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 4px 3px 9px; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); font-size: 12px; }
    .chip button { border: 0; background: none; color: var(--c-text-dim); cursor: pointer; font-size: 15px; line-height: 1; padding: 0 4px; }
    .chip button:hover { color: var(--c-danger); }
    .problem { margin-right: auto; color: var(--c-danger); font-size: 12px; }
    .dlg-btn.off { opacity: 0.45; cursor: default; }
    ::placeholder { color: var(--c-text-dim); opacity: 0.7; }
  `,
})
export class EventDialogComponent {
  readonly open = input(false);
  /** L'evento da modificare; null per uno nuovo. */
  readonly value = input<AdventureEvent | null>(null);
  /** I nemici in mappa, le aree e le variabili fra cui scegliere. */
  readonly monsters = input<SelectOption[]>([]);
  readonly areas = input<SelectOption[]>([]);
  /** Le porte evento in mappa (l'id della serratura e dove stanno). */
  readonly doors = input<SelectOption[]>([]);
  /** Gli oggetti a terra in mappa che si possono raccogliere (l'id del segnalino e dove sta). */
  readonly pickups = input<SelectOption[]>([]);
  readonly variables = input<string[]>([]);
  readonly confirmed = output<AdventureEvent>();
  readonly cancel = output<void>();
  /** Una variabile nuova scritta dentro la dialog: la mappa la aggiunge subito all'elenco. */
  readonly variableAdded = output<string>();

  protected readonly whenOptions = WHEN_OPTIONS;
  protected readonly stateOptions = STATE_OPTIONS;
  protected readonly diceOptions: SelectOption[] = [
    { value: 'magic', label: 'Attacco magico' },
    { value: 'melee', label: 'Attacco in mischia' },
    { value: 'ranged', label: 'Attacco a distanza' },
  ];
  /** I due rami di una Prova. */
  protected readonly branches = [{ id: 'ok' as const, label: 'Se la prova è superata' }, { id: 'ko' as const, label: 'Se la prova fallisce' }];
  protected readonly num = num;
  protected readonly isInt = isInt;

  protected readonly name = signal('');
  protected readonly whenKind = signal<EventTrigger['kind']>('defeated');
  protected readonly target = signal('');
  /** Il costo dell'interazione, come si digita (vuoto = quello di sempre). */
  protected readonly cost = signal('');
  /** "Non c'è più nessun nemico": quali nemici (vuoto = qualunque) e dove ('*' = nella mappa intera, altrimenti l'id dell'area). */
  protected readonly pieceIds = signal<string[]>([]);
  protected readonly whereArea = signal('*');
  protected readonly whereOptions = computed<SelectOption[]>(() => [{ value: '*', label: 'Nella mappa intera' }, ...this.areas()]);
  protected readonly freeMonsters = computed(() => this.monsters().filter((m) => !this.pieceIds().includes(m.value)));
  protected readonly monsterName = (id: string) => this.monsters().find((m) => m.value === id)?.label ?? '?';
  protected readonly conditions = signal<FormCondition[]>([]);
  protected readonly effectsThen = signal<FormEffect[]>([]);
  protected readonly effectsElse = signal<FormEffect[]>([]);
  protected readonly newVariable = signal('');

  protected readonly title = computed(() => (this.value() ? 'Modifica evento' : 'Nuovo evento'));
  /** Il "Quando" riguarda un nemico (sconfitto, o con cui si interagisce) e non un'area. */
  protected readonly onPiece = computed(() => this.whenKind() === 'defeated' || this.whenKind() === 'interact');
  protected readonly targetOptions = computed(() => (this.whenKind() === 'pickedUp' ? this.pickups() : this.onPiece() ? this.monsters() : this.areas()));
  protected readonly placeholder = computed(() => (this.whenKind() === 'pickedUp' ? 'Scegli un oggetto…' : this.onPiece() ? 'Scegli un nemico…' : 'Scegli un’area…'));
  protected readonly emptyHint = computed(() =>
    this.whenKind() === 'pickedUp' ? 'Metti prima un oggetto a terra con lo strumento Oggetti (pozione, denaro o chiave).' : this.onPiece() ? 'Metti prima il nemico in mappa con lo strumento Nemici.' : 'Crea prima un’area con lo strumento Aree.',
  );
  protected readonly varOptions = computed<SelectOption[]>(() => this.variables().map((v) => ({ value: v, label: v })));
  protected readonly sides = computed<Side[]>(() => (this.conditions().length ? ['then', 'else'] : ['then']));
  /** I tipi di effetto: "torna in vita" ha senso solo per un nemico sconfitto. */
  protected readonly effectOptions = computed(() => EFFECT_OPTIONS.filter((o) => o.value !== 'revive' || this.whenKind() === 'defeated'));
  protected readonly canAddVariable = computed(() => {
    const n = this.newVariable().trim();
    return !!n && !this.variables().includes(n);
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.value();
      this.name.set(v?.name ?? '');
      this.whenKind.set(v?.when.kind ?? 'defeated');
      this.target.set(v ? (v.when.kind === 'defeated' || v.when.kind === 'interact' ? v.when.pieceId : v.when.kind === 'pickedUp' ? v.when.markerId : (v.when.area ?? '')) : '');
      this.cost.set(v?.when.kind === 'interact' && v.when.cost !== undefined ? String(v.when.cost) : '');
      this.pieceIds.set(v?.when.kind === 'cleared' ? [...(v.when.pieceIds ?? [])] : []);
      this.whereArea.set(v?.when.kind === 'cleared' ? (v.when.area ?? '*') : '*');
      this.conditions.set((v?.if ?? []).map((c) => ({ variable: c.variable, is: c.is ? 'on' : 'off' })));
      this.effectsThen.set((v?.then ?? []).map(toForm));
      this.effectsElse.set((v?.else ?? []).map(toForm));
      this.newVariable.set('');
    });
  }

  protected list(side: Side) {
    return side === 'then' ? this.effectsThen : this.effectsElse;
  }

  protected setWhen(kind: string) {
    this.whenKind.set(kind as EventTrigger['kind']);
    this.target.set('');
    if (kind !== 'defeated') for (const l of [this.effectsThen, this.effectsElse]) l.update((fx) => fx.filter((e) => e.kind !== 'revive')); // "torna in vita" non ha senso senza un nemico sconfitto
  }

  protected addPieceId(id: string) {
    if (id && !this.pieceIds().includes(id)) this.pieceIds.update((l) => [...l, id]);
  }

  protected removePieceId(id: string) {
    this.pieceIds.update((l) => l.filter((x) => x !== id));
  }

  protected addCondition() {
    this.conditions.update((c) => [...c, { variable: '', is: 'on' }]);
  }

  protected patchCondition(i: number, p: Partial<FormCondition>) {
    this.conditions.update((c) => c.map((x, k) => (k === i ? { ...x, ...p } : x)));
  }

  protected removeCondition(i: number) {
    this.conditions.update((c) => c.filter((_, k) => k !== i));
    if (!this.conditions().length) this.effectsElse.set([]); // senza condizioni non c'è "altrimenti"
  }

  /** Cambia la lista di effetti che sta in `loc` (in "Allora", in "Altrimenti" o dentro uno dei due rami di una Prova). */
  private updateList(loc: Loc, change: (l: FormEffect[]) => FormEffect[]) {
    const list = this.list(loc.side);
    if (!loc.parent) {
      list.update(change);
      return;
    }
    const { i, branch } = loc.parent;
    list.update((l) => l.map((e, k) => (k === i ? { ...e, [branch]: change(e[branch]) } : e)));
  }

  protected addEffect(loc: Loc) {
    this.updateList(loc, (l) => [...l, blank('message')]);
  }

  protected setKind(loc: Loc, i: number, kind: string) {
    this.updateList(loc, (l) => l.map((e, k) => (k === i ? { ...blank(kind as EffectKind) } : e)));
  }

  protected patch(loc: Loc, i: number, p: Partial<FormEffect>) {
    this.updateList(loc, (l) => l.map((e, k) => (k === i ? { ...e, ...p } : e)));
  }

  protected removeEffect(loc: Loc, i: number) {
    this.updateList(loc, (l) => l.filter((_, k) => k !== i));
  }

  /** I tipi di effetto offerti in una lista: dentro una Prova non ci sono un'altra Prova né "torna in vita" (nessuna pedina sconfitta a cui riferirsi). */
  protected effectOptionsFor(loc: Loc): SelectOption[] {
    return loc.parent ? EFFECT_OPTIONS.filter((o) => o.value !== 'check' && o.value !== 'revive') : this.effectOptions();
  }

  protected addVariable() {
    if (!this.canAddVariable()) return;
    this.variableAdded.emit(this.newVariable().trim());
    this.newVariable.set('');
  }

  private effectProblem(e: FormEffect): string {
    switch (e.kind) {
      case 'message': return e.text.trim() ? '' : 'Un messaggio ha bisogno del testo';
      case 'progress': return num(e.amount) ? '' : 'I punti Conquista devono essere un intero diverso da zero';
      case 'setVariable': return e.variable ? '' : 'Scegli la variabile da cambiare';
      case 'modifyMonster': return !e.pieceId ? 'Scegli il nemico da modificare' : ![e.wounds, e.speed, e.armor].every(isInt) || !(num(e.wounds) || num(e.speed) || num(e.armor)) ? 'Scrivi di quanto cambiano ferite, velocità o armatura (numeri interi)' : '';
      case 'revive': return num(e.turns) >= 1 && isInt(e.distance) && num(e.distance) >= 0 ? '' : 'Il ritorno in vita vuole almeno 1 turno e una distanza di 0 o più';
      case 'finishRevival': return e.pieceId ? '' : 'Scegli il nemico di cui chiudere il ritorno in vita';
      case 'activate': return e.pieceId ? '' : 'Scegli il nemico da attivare';
      case 'removePiece': return e.pieceId ? '' : 'Scegli il nemico da rimuovere';
      case 'openDoor': return e.doorId ? '' : 'Scegli la porta da aprire';
      case 'check': {
        if (!e.text.trim()) return 'Una prova ha bisogno del testo che l’eroe legge';
        if (num(e.needs) < 1 || !isInt(e.needs)) return 'Le onde necessarie sono un intero da 1 in su';
        for (const c of [...e.ok, ...e.ko]) {
          const p = this.effectProblem(c);
          if (p) return p;
        }
        return '';
      }
      case 'win': return '';
    }
  }

  /** Cosa manca per confermare (vuoto se tutto va bene). */
  protected readonly problem = computed(() => {
    if (this.whenKind() !== 'cleared' && !this.target()) return this.whenKind() === 'pickedUp' ? "Scegli l'oggetto" : this.onPiece() ? 'Scegli il nemico' : "Scegli l'area";
    if (this.whenKind() === 'interact' && (!isInt(this.cost()) || num(this.cost()) < 0)) return "Il costo dell'interazione è un intero da zero in su";
    if (this.conditions().some((c) => !c.variable)) return 'Una condizione non ha la variabile';
    if (!this.effectsThen().length) return 'Aggiungi almeno un effetto in "Allora"';
    for (const e of [...this.effectsThen(), ...this.effectsElse()]) {
      const p = this.effectProblem(e);
      if (p) return p;
    }
    return '';
  });

  protected confirm() {
    if (this.problem()) return;
    const kind = this.whenKind();
    const when: EventTrigger =
      kind === 'defeated' ? { kind, pieceId: this.target() }
      : kind === 'pickedUp' ? { kind, markerId: this.target() }
      : kind === 'interact' ? { kind, pieceId: this.target(), ...(this.cost().trim() ? { cost: num(this.cost()) } : {}) }
      : kind === 'cleared' ? { kind, ...(this.pieceIds().length ? { pieceIds: [...this.pieceIds()] } : {}), ...(this.whereArea() !== '*' ? { area: this.whereArea() } : {}) }
      : { kind, area: this.target() };
    const conditions: EventCondition[] = this.conditions().map((c) => ({ variable: c.variable, is: c.is === 'on' }));
    const old = this.value();
    this.confirmed.emit({
      id: old?.id ?? '',
      ...(this.name().trim() ? { name: this.name().trim() } : {}),
      when,
      ...(conditions.length ? { if: conditions } : {}),
      then: this.effectsThen().map(toEffect),
      ...(conditions.length && this.effectsElse().length ? { else: this.effectsElse().map(toEffect) } : {}),
    });
  }
}
