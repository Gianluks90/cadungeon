import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { AdventureEvent, EventCondition, EventEffect, EventTrigger, THIS_PIECE, targetsOf, triggersOf } from '../game/map/map-data';
import { CheckboxComponent } from '../ui/checkbox.component';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import { IMMUNITY_OPTIONS } from './immunities';
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
  /** I nemici su cui agisce (attiva, rimuovi, modifica, chiudi il ritorno in vita): i loro id, o "$this" per il nemico dell'evento. */
  pieceIds: string[];
  /** Solo per "Togli un'immunità": ll (tutti gli stati) o una voce di Piece.immune. */
  immunity: string;
  doorId: string;
  wounds: string;
  speed: string;
  armor: string;
  turns: string;
  distance: string;
}

/** Un innesco come si digita: 	arget è il nemico, l'oggetto o l'area (a seconda del tipo). */
interface FormTrigger {
  kind: EventTrigger['kind'];
  target: string;
  /** Il costo dell'interazione, come si digita (vuoto = quello di sempre). */
  cost: string;
  /** Solo "interagisce": l'interazione c'è solo finché il nemico è inattivo (poi il "?" sparisce). */
  onlyInactive: boolean;
  /** "Non c'è più nessun nemico": quali nemici (vuoto = qualunque) e dove ('*' = nella mappa intera, altrimenti l'id dell'area). */
  pieceIds: string[];
  whereArea: string;
}

const blankTrigger = (): FormTrigger => ({ kind: 'defeated', target: '', cost: '', onlyInactive: false, pieceIds: [], whereArea: '*' });

function toFormTrigger(t: EventTrigger): FormTrigger {
  const f = blankTrigger();
  f.kind = t.kind;
  if (t.kind === 'defeated' || t.kind === 'interact') f.target = t.pieceId;
  else if (t.kind === 'pickedUp') f.target = t.markerId;
  else if (t.kind === 'cleared') {
    f.pieceIds = [...(t.pieceIds ?? [])];
    f.whereArea = t.area ?? '*';
  } else f.target = t.area;
  if (t.kind === 'interact' && t.cost !== undefined) f.cost = String(t.cost);
  if (t.kind === 'interact') f.onlyInactive = !!t.onlyInactive;
  return f;
}

function toTrigger(f: FormTrigger): EventTrigger {
  const kind = f.kind;
  return kind === 'defeated' ? { kind, pieceId: f.target }
    : kind === 'pickedUp' ? { kind, markerId: f.target }
    : kind === 'interact' ? { kind, pieceId: f.target, ...(f.cost.trim() ? { cost: num(f.cost) } : {}), ...(f.onlyInactive ? { onlyInactive: true } : {}) }
    : kind === 'cleared' ? { kind, ...(f.pieceIds.length ? { pieceIds: [...f.pieceIds] } : {}), ...(f.whereArea !== '*' ? { area: f.whereArea } : {}) }
    : { kind, area: f.target };
}

interface FormCondition {
  variable: string;
  is: 'on' | 'off';
}

const blank = (kind: EffectKind): FormEffect => ({ kind, dice: 'magic', needs: '1', refusable: false, ok: [], ko: [], title: '', text: '', amount: '1', variable: '', on: 'on', pieceIds: [], immunity: 'all', doorId: '', wounds: '', speed: '', armor: '', turns: '2', distance: '8' });

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
    case 'modifyMonster': return { ...f, pieceIds: targetsOf(e), wounds: e.wounds ? String(e.wounds) : '', speed: e.speed ? String(e.speed) : '', armor: e.armor ? String(e.armor) : '' };
    case 'revive': return { ...f, turns: String(e.turns), distance: String(e.distance) };
    case 'finishRevival': return { ...f, pieceIds: targetsOf(e) };
    case 'activate': return { ...f, pieceIds: targetsOf(e) };
    case 'removePiece': return { ...f, pieceIds: targetsOf(e) };
    case 'makeVulnerable': return { ...f, pieceIds: targetsOf(e) };
    case 'removeImmunity': return { ...f, pieceIds: targetsOf(e), immunity: e.immunity };
    case 'openDoor': return { ...f, doorId: e.doorId };
    case 'check': return { ...f, title: e.title ?? '', text: e.text, dice: e.dice, needs: String(e.needs ?? 1), refusable: !!e.refusable, ok: e.onSuccess.map(toForm), ko: e.onFail.map(toForm) };
    case 'win': return f;
  }
}

/** Il primo nemico in pieceId e gli altri in pieceIds (il formato salvato). */
const targetFields = (f: FormEffect): { pieceId: string; pieceIds?: string[] } => ({ pieceId: f.pieceIds[0] ?? '', ...(f.pieceIds.length > 1 ? { pieceIds: f.pieceIds.slice(1) } : {}) });

function toEffect(f: FormEffect): EventEffect {
  switch (f.kind) {
    case 'message': return { kind: 'message', ...(f.title.trim() ? { title: f.title.trim() } : {}), text: f.text.trim() };
    case 'progress': return { kind: 'progress', amount: num(f.amount) };
    case 'setVariable': return { kind: 'setVariable', variable: f.variable, value: f.on === 'on' };
    case 'modifyMonster': return { kind: 'modifyMonster', ...targetFields(f), ...(num(f.wounds) ? { wounds: num(f.wounds) } : {}), ...(num(f.speed) ? { speed: num(f.speed) } : {}), ...(num(f.armor) ? { armor: num(f.armor) } : {}) };
    case 'revive': return { kind: 'revive', turns: Math.max(1, num(f.turns)), distance: Math.max(0, num(f.distance)) };
    case 'finishRevival': return { kind: 'finishRevival', ...targetFields(f) };
    case 'activate': return { kind: 'activate', ...targetFields(f) };
    case 'removePiece': return { kind: 'removePiece', ...targetFields(f) };
    case 'makeVulnerable': return { kind: 'makeVulnerable', ...targetFields(f) };
    case 'removeImmunity': return { kind: 'removeImmunity', ...targetFields(f), immunity: f.immunity };
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
  { value: 'makeVulnerable', label: 'Rendi vulnerabile un nemico invincibile' },
  { value: 'removeImmunity', label: "Togli un'immunità a un nemico" },
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
  imports: [NgTemplateOutlet, CheckboxComponent, DialogComponent, FieldComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="title()" width="min(1120px, 100%)" height="min(680px, calc(100vh - 48px))" [flush]="true" (closed)="cancel.emit()">
        <div class="cols">
        <div class="col">
        <app-field label="Nome" note="(facoltativo)">
          <input type="text" autocomplete="off" placeholder="Per esempio: Il cuore di Munkar" [value]="name()" (input)="name.set($any($event.target).value)" />
        </app-field>

        <section>
          <h3>Quando <small>(se ce n'è più di uno, basta che ne succeda uno)</small></h3>
          @for (t of triggers(); track $index; let ti = $index) {
            <div class="trigger">
              @if (ti > 0) { <span class="or">oppure</span> }
              <div class="row">
                <div class="dlg-cols">
                  <app-select class="block" [options]="whenOptions" [value]="t.kind" label="Quando" (changed)="setTriggerKind(ti, $event)" />
                  @if (t.kind !== 'cleared') {
                    <app-select class="block" [options]="targetOptionsOf(t)" [value]="t.target" [placeholder]="placeholderOf(t)" label="Dove o chi" (changed)="patchTrigger(ti, { target: $event })" />
                  } @else {
                    <app-select class="block" [options]="whereOptions()" [value]="t.whereArea" label="Dove" (changed)="patchTrigger(ti, { whereArea: $event })" />
                  }
                </div>
                @if (triggers().length > 1) { <button type="button" class="dlg-rm" aria-label="Togli questo innesco" title="Togli questo innesco" (click)="removeTrigger(ti)">×</button> }
              </div>
              @if (t.kind === 'cleared') {
                <div class="dlg-chips">
                  @for (id of t.pieceIds; track id) {
                    <span class="dlg-chip">{{ monsterName(id) }}<button type="button" [attr.aria-label]="'Togli ' + monsterName(id)" (click)="removePieceId(ti, id)">×</button></span>
                  } @empty { <small class="dlg-hint">Qualunque nemico</small> }
                </div>
                <app-select class="block" [options]="freeMonstersOf(t)" value="" placeholder="Aggiungi un nemico alla lista…" label="Nemici" (changed)="addPieceId(ti, $event)" />
                <small class="dlg-hint">Scatta quando l'ultimo dei nemici scelti (o di tutti, se la lista è vuota) non è più nella mappa o nell'area: sconfitto, rimosso o uscito camminando. Non scatta se all'inizio non ce n'era nessuno.</small>
              }
              @if (t.kind === 'interact') {
                <app-field label="Costo dell'interazione (punti movimento)"><input type="number" min="0" step="1" [class.bad]="!isInt(t.cost)" [value]="t.cost" (input)="patchTrigger(ti, { cost: $any($event.target).value })" /></app-field>
                <app-checkbox [checked]="t.onlyInactive" (changed)="patchTrigger(ti, { onlyInactive: $event })">Solo finché il nemico è inattivo</app-checkbox>
                <small class="dlg-hint">Sul nemico compare un "?" e l'eroe adiacente trova la stessa voce nel menu del "!". Si può fare una volta sola: poi il "?" sparisce.</small>
              }
              @if (t.kind !== 'cleared' && !targetOptionsOf(t).length) { <small class="dlg-hint">{{ emptyHintOf(t) }}</small> }
            </div>
          }
          <button type="button" class="dlg-btn small" (click)="addTrigger()">Aggiungi un altro innesco (oppure…)</button>
          <app-checkbox [checked]="once()" (changed)="once.set($event)">Scatta una sola volta</app-checkbox>
          <small class="dlg-hint">Dopo il primo scatto l'evento non parte più, anche se un altro innesco succede. Un evento le cui condizioni non valgono non conta come scattato.</small>
        </section>

        <section>
          <h3>Se <small>(facoltativo: tutte le condizioni devono valere)</small></h3>
          @for (c of conditions(); track $index; let i = $index) {
            <div class="row cond">
              <app-select class="block" [options]="varOptions()" [value]="c.variable" placeholder="Scegli una variabile…" label="Variabile" (changed)="patchCondition(i, { variable: $event })" />
              <app-select class="block" [options]="stateOptions" [value]="c.is" label="Stato" (changed)="patchCondition(i, { is: $any($event) })" />
              <button type="button" class="dlg-rm" aria-label="Togli la condizione" title="Togli la condizione" (click)="removeCondition(i)">×</button>
            </div>
          }
          <button type="button" class="dlg-btn small" (click)="addCondition()">Aggiungi una condizione</button>
        </section>

        <section>
          <h3>Nuova variabile</h3>
          <div class="dlg-add">
            <input type="text" autocomplete="off" maxlength="40" placeholder="Per esempio: Cuore di Munkar trovato" [value]="newVariable()" (input)="newVariable.set($any($event.target).value)" (keydown.enter)="addVariable()" />
            <button type="button" class="dlg-btn small" [class.off]="!canAddVariable()" [attr.aria-disabled]="!canAddVariable()" (click)="addVariable()">Aggiungi</button>
          </div>
        </section>
        </div>
        <div class="col">
        @for (side of sides(); track side) {
          <section>
            <h3>{{ side === 'then' ? 'Allora' : 'Altrimenti' }}</h3>
            @for (e of list(side)(); track $index; let i = $index) {
              <ng-container *ngTemplateOutlet="fx; context: { $implicit: e, loc: { side: side, parent: null }, i: i }" />
            }
            <button type="button" class="dlg-btn small" (click)="addEffect({ side: side, parent: null })">Aggiungi un effetto</button>
          </section>
        }

        </div>
      </div>

        <!-- I nemici su cui agisce un effetto: un elenco a chip (anche "il nemico dell'evento" se l'innesco è "sconfitto" o "interagisce"). -->
        <ng-template #targets let-e let-loc="loc" let-i="i">
          <div class="dlg-chips">
            @for (id of e.pieceIds; track id) {
              <span class="dlg-chip">{{ targetName(id) }}<button type="button" [attr.aria-label]="'Togli ' + targetName(id)" (click)="removeTarget(loc, i, id)">×</button></span>
            } @empty { <small class="dlg-hint">Nessun nemico scelto</small> }
          </div>
          <app-select class="block" [options]="targetChoices(e)" value="" placeholder="Aggiungi un nemico…" label="Nemico" (changed)="addTarget(loc, i, $event)" />
        </ng-template>

        <!-- Un effetto con i suoi campi. È un modello perché la Prova contiene altre due liste di effetti (superata e fallita) che si scrivono allo stesso modo. -->
        <ng-template #fx let-e let-loc="loc" let-i="i">
              <div class="effect">
                <div class="row head">
                  <app-select class="block" [options]="effectOptionsFor(loc)" [value]="e.kind" label="Effetto" (changed)="setKind(loc, i, $event)" />
                  <button type="button" class="dlg-rm" aria-label="Togli l'effetto" title="Togli l'effetto" (click)="removeEffect(loc, i)">×</button>
                </div>
                @switch (e.kind) {
                  @case ('message') {
                    <input type="text" autocomplete="off" placeholder="Titolo (facoltativo)" [value]="e.title" (input)="patch(loc, i, { title: $any($event.target).value })" />
                    <textarea rows="4" placeholder="Il testo che i giocatori leggono (markdown), con il tasto Ho letto." [class.bad]="!e.text.trim()" [value]="e.text" (input)="patch(loc, i, { text: $any($event.target).value })"></textarea>
                  }
                  @case ('progress') {
                    <app-field label="Punti Conquista (anche negativi)"><input type="number" step="1" [class.bad]="!num(e.amount)" [value]="e.amount" (input)="patch(loc, i, { amount: $any($event.target).value })" /></app-field>
                  }
                  @case ('setVariable') {
                    <div class="dlg-cols">
                      <app-select class="block" [options]="varOptions()" [value]="e.variable" placeholder="Scegli una variabile…" label="Variabile" (changed)="patch(loc, i, { variable: $event })" />
                      <app-select class="block" [options]="stateOptions" [value]="e.on" label="Diventa" (changed)="patch(loc, i, { on: $any($event) })" />
                    </div>
                  }
                  @case ('modifyMonster') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <div class="dlg-cols three">
                      <app-field label="Ferite"><input type="number" step="1" placeholder="0" [value]="e.wounds" (input)="patch(loc, i, { wounds: $any($event.target).value })" /></app-field>
                      <app-field label="Velocità"><input type="number" step="1" placeholder="0" [value]="e.speed" (input)="patch(loc, i, { speed: $any($event.target).value })" /></app-field>
                      <app-field label="Armatura"><input type="number" step="1" placeholder="0" [value]="e.armor" (input)="patch(loc, i, { armor: $any($event.target).value })" /></app-field>
                    </div>
                    <small class="dlg-hint">Si somma ai valori che ha per il resto della partita (negativo per togliere).</small>
                  }
                  @case ('revive') {
                    <div class="dlg-cols">
                      <app-field label="Turni del Signore supremo"><input type="number" min="1" step="1" [class.bad]="num(e.turns) < 1" [value]="e.turns" (input)="patch(loc, i, { turns: $any($event.target).value })" /></app-field>
                      <app-field label="Distanza minima dagli eroi (caselle)"><input type="number" min="0" step="1" [class.bad]="!isInt(e.distance)" [value]="e.distance" (input)="patch(loc, i, { distance: $any($event.target).value })" /></app-field>
                    </div>
                    <small class="dlg-hint">Esce dalla mappa senza bottino e torna a piena salute in una casella già scoperta e libera, il più lontano possibile se non ce n'è una abbastanza lontana.</small>
                  }
                  @case ('finishRevival') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <small class="dlg-hint">Se sta aspettando di tornare in vita, la sua sconfitta si ripete adesso con le variabili di adesso. Altrimenti non fa niente.</small>
                  }
                  @case ('activate') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <small class="dlg-hint">Se il nemico è inattivo (si imposta in Personalizza), da ora agisce come un nemico qualunque; l'aspetto di pietra, se c'è, resta. Altrimenti non fa niente.</small>
                  }
                  @case ('removePiece') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <small class="dlg-hint">Il nemico viene tolto dalla mappa senza essere sconfitto: niente bottino e non scattano gli eventi "sconfitto".</small>
                  }
                  @case ('makeVulnerable') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <small class="dlg-hint">Da ora le ferite contano: l'armatura mostra di nuovo il suo numero. Se il nemico non è invincibile non fa niente.</small>
                  }
                  @case ('removeImmunity') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <app-field label="Immunità da togliere"><app-select class="block" [options]="immunityOptions" [value]="e.immunity" label="Immunità" (changed)="patch(loc, i, { immunity: $event })" /></app-field>
                    <small class="dlg-hint">Toglie solo questa voce: le altre immunità del nemico restano. "Tutti gli stati" non tocca per esempio un'immunità alla sola Fiamma che il nemico aveva già.</small>
                  }
                  @case ('openDoor') {
                    <app-select class="block" [options]="doors()" [value]="e.doorId" placeholder="Scegli una porta evento…" label="Porta" (changed)="patch(loc, i, { doorId: $event })" />
                    <small class="dlg-hint">{{ doors().length ? 'La porta si apre e da ora è libera come le altre.' : 'Metti prima una Porta evento con lo strumento Porte.' }}</small>
                  }
                  @case ('check') {
                    <input type="text" autocomplete="off" placeholder="Titolo (facoltativo)" [value]="e.title" (input)="patch(loc, i, { title: $any($event.target).value })" />
                    <textarea rows="4" placeholder="L'indovinello o la situazione che l'eroe legge prima di tirare (markdown)." [class.bad]="!e.text.trim()" [value]="e.text" (input)="patch(loc, i, { text: $any($event.target).value })"></textarea>
                    <div class="dlg-cols three">
                      <app-field label="Dadi"><app-select class="block" [options]="diceOptions" [value]="e.dice" label="Dadi" (changed)="patch(loc, i, { dice: $any($event) })" /></app-field>
                      <app-field label="Onde necessarie"><input type="number" min="1" step="1" [class.bad]="num(e.needs) < 1" [value]="e.needs" (input)="patch(loc, i, { needs: $any($event.target).value })" /></app-field>
                      <app-checkbox class="row-end" [checked]="e.refusable" (changed)="patch(loc, i, { refusable: $event })">Si può rifiutare</app-checkbox>
                    </div>
                    <small class="dlg-hint">L'eroe tira tanti dadi potere quanti sono i dadi in più del suo attacco scelto (senza dadi la prova fallisce da sola) e non può spendere fatica. Con "Si può rifiutare" compare anche Annulla: non succede niente, il costo dell'interazione torna indietro e il "?" resta.</small>
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
                    <small class="dlg-hint">Gli eroi vincono: compaiono la conclusione e i punti dell'obiettivo (si scrivono in Obiettivi).</small>
                  }
                }
              </div>
        </ng-template>


        <ng-container dialogFooter>
          @if (problem()) { <span class="problem">{{ problem() }}</span> }
          <button type="button" class="dlg-btn primary" [class.off]="!!problem()" [attr.aria-disabled]="!!problem()" (click)="confirm()">Conferma</button>
        </ng-container>
      </app-dialog>
    }
  `,
  styles: `
    /* Schermo largo: a sinistra cosa fa scattare l'evento (nome, quando, se), a destra cosa fa (allora, altrimenti); ogni colonna scorre per conto suo. Stretto: una colonna sola. */
    .cols { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
    .col { min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 16px 20px; }
    .col + .col { border-left: 1px solid var(--c-line-strong); }
    @media (max-width: 899px) {
      .cols { display: flex; flex-direction: column; overflow-y: auto; }
      .col { overflow: visible; flex: none; }
      .col + .col { border-left: 0; border-top: 1px solid var(--c-line-strong); }
    }
    section { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--c-line-strong); }
    section:last-of-type { border-bottom: 0; }
    h3 { margin: 0; font: 600 12px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-interact); }
    h3 small { color: var(--c-text-dim); text-transform: none; letter-spacing: 0; font-weight: 400; }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
    .row.cond { grid-template-columns: minmax(0, 1fr) 140px auto; }
    .trigger { display: flex; flex-direction: column; gap: 8px; }
    .trigger + .trigger { padding-top: 8px; border-top: 1px dashed var(--c-line-strong); }
    .or { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .effect { display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--c-line-strong); border-left: 3px solid var(--c-interact); border-radius: var(--radius-1); }
    /* Telefono: la condizione ha variabile e stato uno sotto l'altro, con la X accanto alla variabile. */
    @media (max-width: 600px) {
      .row.cond { grid-template-columns: minmax(0, 1fr) auto; }
      .row.cond > :nth-child(2) { grid-column: 1; grid-row: 2; }
      .row.cond > :nth-child(3) { grid-column: 2; grid-row: 1; }
    }
    .branch { display: flex; flex-direction: column; gap: 8px; padding-left: 10px; border-left: 1px solid var(--c-line-strong); }
    .branch h4 { margin: 0; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    /* La casella senza etichetta sopra sta in linea con i campi vicini, che ne hanno una. */
    .row-end { align-self: end; display: flex; align-items: center; min-height: 36px; }
    .small { align-self: flex-start; padding: 4px 10px; font-size: 12px; }
    .problem { margin-right: auto; color: var(--c-danger); font-size: 12px; }
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
  protected readonly immunityOptions = IMMUNITY_OPTIONS;
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
  /** Gli inneschi: il primo e gli altri ("oppure"). */
  protected readonly triggers = signal<FormTrigger[]>([blankTrigger()]);
  protected readonly once = signal(false);
  protected readonly whereOptions = computed<SelectOption[]>(() => [{ value: '*', label: 'Nella mappa intera' }, ...this.areas()]);
  protected readonly freeMonstersOf = (t: FormTrigger) => this.monsters().filter((m) => !t.pieceIds.includes(m.value));
  protected readonly monsterName = (id: string) => this.monsters().find((m) => m.value === id)?.label ?? '?';
  /** C'è un nemico dell'evento (sconfitto, o con cui si interagisce): gli effetti possono indicarlo con "il nemico dell'evento". */
  protected readonly hasThis = computed(() => this.triggers().some((t) => t.kind === 'defeated' || t.kind === 'interact'));
  protected readonly hasDefeated = computed(() => this.triggers().some((t) => t.kind === 'defeated'));
  /** I nemici fra cui scegliere in un effetto: quelli in mappa e, se c'è un nemico dell'evento, anche lui. */
  private readonly effectMonsters = computed<SelectOption[]>(() => (this.hasThis() ? [{ value: THIS_PIECE, label: "Il nemico dell'evento" }, ...this.monsters()] : this.monsters()));
  protected readonly targetName = (id: string) => (id === THIS_PIECE ? "Il nemico dell'evento" : this.monsterName(id));
  protected readonly targetChoices = (e: FormEffect) => this.effectMonsters().filter((m) => !e.pieceIds.includes(m.value));
  protected readonly conditions = signal<FormCondition[]>([]);
  protected readonly effectsThen = signal<FormEffect[]>([]);
  protected readonly effectsElse = signal<FormEffect[]>([]);
  protected readonly newVariable = signal('');

  protected readonly title = computed(() => (this.value() ? 'Modifica evento' : 'Nuovo evento'));
  /** Un innesco riguarda un nemico (sconfitto, o con cui si interagisce) e non un'area o un oggetto. */
  private readonly onPiece = (t: FormTrigger) => t.kind === 'defeated' || t.kind === 'interact';
  protected readonly targetOptionsOf = (t: FormTrigger) => (t.kind === 'pickedUp' ? this.pickups() : this.onPiece(t) ? this.monsters() : this.areas());
  protected readonly placeholderOf = (t: FormTrigger) => (t.kind === 'pickedUp' ? 'Scegli un oggetto…' : this.onPiece(t) ? 'Scegli un nemico…' : 'Scegli un’area…');
  protected readonly emptyHintOf = (t: FormTrigger) =>
    t.kind === 'pickedUp' ? 'Metti prima un oggetto a terra con lo strumento Oggetti (pozione, denaro o chiave).' : this.onPiece(t) ? 'Metti prima il nemico in mappa con lo strumento Nemici.' : 'Crea prima un’area con lo strumento Aree.';
  protected readonly varOptions = computed<SelectOption[]>(() => this.variables().map((v) => ({ value: v, label: v })));
  protected readonly sides = computed<Side[]>(() => (this.conditions().length ? ['then', 'else'] : ['then']));
  /** I tipi di effetto: "torna in vita" ha senso solo per un nemico sconfitto. */
  protected readonly effectOptions = computed(() => EFFECT_OPTIONS.filter((o) => o.value !== 'revive' || this.hasDefeated()));
  protected readonly canAddVariable = computed(() => {
    const n = this.newVariable().trim();
    return !!n && !this.variables().includes(n);
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const v = this.value();
      this.name.set(v?.name ?? '');
      this.triggers.set(v ? triggersOf(v).map(toFormTrigger) : [blankTrigger()]);
      this.once.set(!!v?.once);
      this.conditions.set((v?.if ?? []).map((c) => ({ variable: c.variable, is: c.is ? 'on' : 'off' })));
      this.effectsThen.set((v?.then ?? []).map(toForm));
      this.effectsElse.set((v?.else ?? []).map(toForm));
      this.newVariable.set('');
    });
  }

  protected list(side: Side) {
    return side === 'then' ? this.effectsThen : this.effectsElse;
  }

  protected patchTrigger(i: number, p: Partial<FormTrigger>) {
    this.triggers.update((l) => l.map((t, k) => (k === i ? { ...t, ...p } : t)));
  }

  protected setTriggerKind(i: number, kind: string) {
    this.triggers.update((l) => l.map((t, k) => (k === i ? { ...blankTrigger(), kind: kind as EventTrigger['kind'] } : t)));
    this.dropRevive();
  }

  protected addTrigger() {
    this.triggers.update((l) => [...l, blankTrigger()]);
  }

  protected removeTrigger(i: number) {
    this.triggers.update((l) => l.filter((_, k) => k !== i));
    this.dropRevive();
  }

  /** "Torna in vita" non ha senso senza un innesco "nemico sconfitto": se non ce n'è più, gli effetti si tolgono. */
  private dropRevive() {
    if (!this.hasDefeated()) for (const l of [this.effectsThen, this.effectsElse]) l.update((fx) => fx.filter((e) => e.kind !== 'revive'));
  }

  protected addPieceId(i: number, id: string) {
    if (id && !this.triggers()[i].pieceIds.includes(id)) this.patchTrigger(i, { pieceIds: [...this.triggers()[i].pieceIds, id] });
  }

  protected removePieceId(i: number, id: string) {
    this.patchTrigger(i, { pieceIds: this.triggers()[i].pieceIds.filter((x) => x !== id) });
  }

  protected addTarget(loc: Loc, i: number, id: string) {
    if (!id) return;
    this.updateList(loc, (l) => l.map((e, k) => (k === i && !e.pieceIds.includes(id) ? { ...e, pieceIds: [...e.pieceIds, id] } : e)));
  }

  protected removeTarget(loc: Loc, i: number, id: string) {
    this.updateList(loc, (l) => l.map((e, k) => (k === i ? { ...e, pieceIds: e.pieceIds.filter((x) => x !== id) } : e)));
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
    if (e.pieceIds.includes(THIS_PIECE) && !this.hasThis()) return '"Il nemico dell\'evento" si può usare solo con gli inneschi "sconfitto" o "interagisce"';
    switch (e.kind) {
      case 'message': return e.text.trim() ? '' : 'Un messaggio ha bisogno del testo';
      case 'progress': return num(e.amount) ? '' : 'I punti Conquista devono essere un intero diverso da zero';
      case 'setVariable': return e.variable ? '' : 'Scegli la variabile da cambiare';
      case 'modifyMonster': return !e.pieceIds.length ? 'Scegli il nemico da modificare' : ![e.wounds, e.speed, e.armor].every(isInt) || !(num(e.wounds) || num(e.speed) || num(e.armor)) ? 'Scrivi di quanto cambiano ferite, velocità o armatura (numeri interi)' : '';
      case 'revive': return num(e.turns) >= 1 && isInt(e.distance) && num(e.distance) >= 0 ? '' : 'Il ritorno in vita vuole almeno 1 turno e una distanza di 0 o più';
      case 'finishRevival': return e.pieceIds.length ? '' : 'Scegli il nemico di cui chiudere il ritorno in vita';
      case 'activate': return e.pieceIds.length ? '' : 'Scegli il nemico da attivare';
      case 'removePiece': return e.pieceIds.length ? '' : 'Scegli il nemico da rimuovere';
      case 'makeVulnerable': return e.pieceIds.length ? '' : 'Scegli il nemico da rendere vulnerabile';
      case 'removeImmunity': return e.pieceIds.length ? '' : "Scegli il nemico a cui togliere l'immunità";
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
    for (const t of this.triggers()) {
      if (t.kind !== 'cleared' && !t.target) return t.kind === 'pickedUp' ? "Scegli l'oggetto" : this.onPiece(t) ? 'Scegli il nemico' : "Scegli l'area";
      if (t.kind === 'interact' && (!isInt(t.cost) || num(t.cost) < 0)) return "Il costo dell'interazione è un intero da zero in su";
    }
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
    const [when, ...orWhen] = this.triggers().map(toTrigger);
    const conditions: EventCondition[] = this.conditions().map((c) => ({ variable: c.variable, is: c.is === 'on' }));
    const old = this.value();
    this.confirmed.emit({
      id: old?.id ?? '',
      ...(this.name().trim() ? { name: this.name().trim() } : {}),
      when,
      ...(orWhen.length ? { orWhen } : {}),
      ...(this.once() ? { once: true } : {}),
      ...(conditions.length ? { if: conditions } : {}),
      then: this.effectsThen().map(toEffect),
      ...(conditions.length && this.effectsElse().length ? { else: this.effectsElse().map(toEffect) } : {}),
    });
  }
}
