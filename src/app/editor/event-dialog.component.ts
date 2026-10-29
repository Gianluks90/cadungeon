import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { AdventureEvent, EventCondition, EventEffect, EventTrigger } from '../game/map/map-data';
import { DialogComponent } from '../ui/dialog.component';
import { SelectComponent, SelectOption } from '../ui/select.component';

type EffectKind = EventEffect['kind'];
type Side = 'then' | 'else';

/** Un effetto come si digita: tutti i campi sono testo e ognuno serve solo a certi tipi di effetto. */
interface FormEffect {
  kind: EffectKind;
  title: string;
  text: string;
  amount: string;
  variable: string;
  on: 'on' | 'off';
  pieceId: string;
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

const blank = (kind: EffectKind): FormEffect => ({ kind, title: '', text: '', amount: '1', variable: '', on: 'on', pieceId: '', wounds: '', speed: '', armor: '', turns: '2', distance: '8' });

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
    case 'win': return { kind: 'win' };
  }
}

const WHEN_OPTIONS: SelectOption[] = [
  { value: 'defeated', label: 'Un nemico è sconfitto' },
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
  imports: [DialogComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [title]="title()" width="min(720px, 100%)" height="min(680px, calc(100vh - 48px))" (closed)="cancel.emit()">
        <label class="field">
          <span>Nome <small>(facoltativo)</small></span>
          <input type="text" autocomplete="off" placeholder="Per esempio: Il cuore di Munkar" [value]="name()" (input)="name.set($any($event.target).value)" />
        </label>

        <section>
          <h3>Quando</h3>
          <div class="pair">
            <app-select class="block" [options]="whenOptions" [value]="whenKind()" label="Quando" (changed)="setWhen($event)" />
            <app-select class="block" [options]="targetOptions()" [value]="target()" [placeholder]="whenKind() === 'defeated' ? 'Scegli un nemico…' : 'Scegli un’area…'" label="Dove o chi" (changed)="target.set($event)" />
          </div>
          @if (!targetOptions().length) { <small class="hint">{{ whenKind() === 'defeated' ? 'Metti prima il nemico in mappa con lo strumento Nemici.' : 'Crea prima un’area con lo strumento Aree.' }}</small> }
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
              <div class="effect">
                <div class="row head">
                  <app-select class="block" [options]="effectOptions()" [value]="e.kind" label="Effetto" (changed)="setKind(side, i, $event)" />
                  <button type="button" class="rm" aria-label="Togli l'effetto" title="Togli l'effetto" (click)="removeEffect(side, i)">×</button>
                </div>
                @switch (e.kind) {
                  @case ('message') {
                    <input type="text" autocomplete="off" placeholder="Titolo (facoltativo)" [value]="e.title" (input)="patch(side, i, { title: $any($event.target).value })" />
                    <textarea rows="4" placeholder="Il testo che i giocatori leggono (markdown), con il tasto Ho letto." [class.bad]="!e.text.trim()" [value]="e.text" (input)="patch(side, i, { text: $any($event.target).value })"></textarea>
                  }
                  @case ('progress') {
                    <label class="inline"><span>Punti Conquista (anche negativi)</span><input type="number" step="1" [class.bad]="!num(e.amount)" [value]="e.amount" (input)="patch(side, i, { amount: $any($event.target).value })" /></label>
                  }
                  @case ('setVariable') {
                    <div class="pair">
                      <app-select class="block" [options]="varOptions()" [value]="e.variable" placeholder="Scegli una variabile…" label="Variabile" (changed)="patch(side, i, { variable: $event })" />
                      <app-select class="block" [options]="stateOptions" [value]="e.on" label="Diventa" (changed)="patch(side, i, { on: $any($event) })" />
                    </div>
                  }
                  @case ('modifyMonster') {
                    <app-select class="block" [options]="monsters()" [value]="e.pieceId" placeholder="Scegli un nemico…" label="Nemico" (changed)="patch(side, i, { pieceId: $event })" />
                    <div class="trio">
                      <label class="inline"><span>Ferite</span><input type="number" step="1" placeholder="0" [value]="e.wounds" (input)="patch(side, i, { wounds: $any($event.target).value })" /></label>
                      <label class="inline"><span>Velocità</span><input type="number" step="1" placeholder="0" [value]="e.speed" (input)="patch(side, i, { speed: $any($event.target).value })" /></label>
                      <label class="inline"><span>Armatura</span><input type="number" step="1" placeholder="0" [value]="e.armor" (input)="patch(side, i, { armor: $any($event.target).value })" /></label>
                    </div>
                    <small class="hint">Si somma ai valori che ha per il resto della partita (negativo per togliere).</small>
                  }
                  @case ('revive') {
                    <div class="pair">
                      <label class="inline"><span>Turni del Signore supremo</span><input type="number" min="1" step="1" [class.bad]="num(e.turns) < 1" [value]="e.turns" (input)="patch(side, i, { turns: $any($event.target).value })" /></label>
                      <label class="inline"><span>Distanza minima dagli eroi (caselle)</span><input type="number" min="0" step="1" [class.bad]="!isInt(e.distance)" [value]="e.distance" (input)="patch(side, i, { distance: $any($event.target).value })" /></label>
                    </div>
                    <small class="hint">Esce dalla mappa senza bottino e torna a piena salute in una casella già scoperta e libera, il più lontano possibile se non ce n'è una abbastanza lontana.</small>
                  }
                  @case ('finishRevival') {
                    <app-select class="block" [options]="monsters()" [value]="e.pieceId" placeholder="Scegli un nemico…" label="Nemico" (changed)="patch(side, i, { pieceId: $event })" />
                    <small class="hint">Se sta aspettando di tornare in vita, la sua sconfitta si ripete adesso con le variabili di adesso. Altrimenti non fa niente.</small>
                  }
                  @case ('activate') {
                    <app-select class="block" [options]="monsters()" [value]="e.pieceId" placeholder="Scegli un nemico…" label="Nemico" (changed)="patch(side, i, { pieceId: $event })" />
                    <small class="hint">Se il nemico è inattivo (si imposta in Personalizza), da ora agisce come un nemico qualunque; l'aspetto di pietra, se c'è, resta. Altrimenti non fa niente.</small>
                  }
                  @case ('removePiece') {
                    <app-select class="block" [options]="monsters()" [value]="e.pieceId" placeholder="Scegli un nemico…" label="Nemico" (changed)="patch(side, i, { pieceId: $event })" />
                    <small class="hint">Il nemico viene tolto dalla mappa senza essere sconfitto: niente bottino e non scattano gli eventi "sconfitto".</small>
                  }
                  @case ('win') {
                    <small class="hint">Gli eroi vincono: compaiono la conclusione e i punti dell'obiettivo (si scrivono in Obiettivi).</small>
                  }
                }
              </div>
            }
            <button type="button" class="dlg-btn small" (click)="addEffect(side)">Aggiungi un effetto</button>
          </section>
        }

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
    .rm { border: 0; background: none; color: var(--c-text-dim); cursor: pointer; padding: 0 6px; font-size: 18px; line-height: 1; }
    .rm:hover { color: var(--c-danger); }
    .small { align-self: flex-start; padding: 4px 10px; font-size: 12px; }
    .hint { color: var(--c-text-dim); font-size: 12px; }
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
  readonly variables = input<string[]>([]);
  readonly confirmed = output<AdventureEvent>();
  readonly cancel = output<void>();
  /** Una variabile nuova scritta dentro la dialog: la mappa la aggiunge subito all'elenco. */
  readonly variableAdded = output<string>();

  protected readonly whenOptions = WHEN_OPTIONS;
  protected readonly stateOptions = STATE_OPTIONS;
  protected readonly num = num;
  protected readonly isInt = isInt;

  protected readonly name = signal('');
  protected readonly whenKind = signal<EventTrigger['kind']>('defeated');
  protected readonly target = signal('');
  protected readonly conditions = signal<FormCondition[]>([]);
  protected readonly effectsThen = signal<FormEffect[]>([]);
  protected readonly effectsElse = signal<FormEffect[]>([]);
  protected readonly newVariable = signal('');

  protected readonly title = computed(() => (this.value() ? 'Modifica evento' : 'Nuovo evento'));
  protected readonly targetOptions = computed(() => (this.whenKind() === 'defeated' ? this.monsters() : this.areas()));
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
      this.target.set(v ? (v.when.kind === 'defeated' ? v.when.pieceId : v.when.area) : '');
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

  protected addEffect(side: Side) {
    this.list(side).update((l) => [...l, blank('message')]);
  }

  protected setKind(side: Side, i: number, kind: string) {
    this.list(side).update((l) => l.map((e, k) => (k === i ? { ...blank(kind as EffectKind) } : e)));
  }

  protected patch(side: Side, i: number, p: Partial<FormEffect>) {
    this.list(side).update((l) => l.map((e, k) => (k === i ? { ...e, ...p } : e)));
  }

  protected removeEffect(side: Side, i: number) {
    this.list(side).update((l) => l.filter((_, k) => k !== i));
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
      case 'removePiece': return e.pieceId ? '' : 'Scegli il nemico che sparisce';
      case 'win': return '';
    }
  }

  /** Cosa manca per confermare (vuoto se tutto va bene). */
  protected readonly problem = computed(() => {
    if (!this.target()) return this.whenKind() === 'defeated' ? 'Scegli il nemico' : "Scegli l'area";
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
    const when: EventTrigger = this.whenKind() === 'defeated' ? { kind: 'defeated', pieceId: this.target() } : { kind: this.whenKind() as 'chestOpened' | 'areaRevealed', area: this.target() };
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
