import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { AdventureEvent, EventCondition, EventEffect, EventTrigger, THIS_PIECE, isItemCondition, targetsOf, triggersOf } from '../game/map/map-data';
import { CheckboxComponent } from '../ui/checkbox.component';
import { DialogComponent } from '../ui/dialog.component';
import { FieldComponent } from '../ui/field.component';
import type { RuneColor } from '../game/board/door';
import { BEHAVIOR_OPTIONS, behaviorFrom, behaviorItem, behaviorKind, behaviorTarget, type BehaviorKind } from '../game/pieces/pawn-behavior';
import { PAWN_LOOKS, type PawnLook } from '../game/pieces/pawn-look';
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
type RewardKind = 'rune' | 'key' | 'item' | 'coins' | 'progress';

interface FormEffect {
  kind: EffectKind;
  /** Solo per "Cambia l'aspetto": il nuovo aspetto ('' = normale). */
  look: PawnLook | '';
  /** Solo per "Cambia il comportamento": il tipo ('' = normale) e, per `endNear`, l'ostacolo scelto ("x,y"). */
  behavior: BehaviorKind | '';
  behaviorTarget: string;
  behaviorItem: string;
  /** Solo per "Consegna un premio": il tipo ('rune', 'key', 'item', 'coins', 'progress') e i suoi dati (colore, id della chiave, oggetto, quantità). */
  reward: RewardKind;
  rewardColor: RuneColor;
  rewardKeyId: string;
  rewardItem: string;
  rewardAmount: string;
  /** Solo per la Prova: quali dadi, quante onde servono, se si può rifiutare e gli effetti dei due rami. */
  dice: CheckDice;
  needs: string;
  refusable: boolean;
  /** Solo per la Prova: l'eroe non può comprare dadi potere con la fatica. */
  noFatigue: boolean;
  /** Solo per "Aggiungi al finale": il testo (markdown) e il modificatore dei punti Conquista (anche negativo). */
  endText: string;
  endPoints: string;
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
  else if (t.kind === 'encounterUsed') f.target = t.markerId;
  else if (t.kind === 'cleared' || t.kind === 'encountersGone') {
    f.pieceIds = [...((t.kind === 'cleared' ? t.pieceIds : t.markerIds) ?? [])];
    f.whereArea = t.area ?? '*';
  } else if (t.kind !== 'overlordTurnEnd') f.target = t.area;
  if (t.kind === 'interact' && t.cost !== undefined) f.cost = String(t.cost);
  if (t.kind === 'interact') f.onlyInactive = !!t.onlyInactive;
  return f;
}

function toTrigger(f: FormTrigger): EventTrigger {
  const kind = f.kind;
  return kind === 'defeated' ? { kind, pieceId: f.target }
    : kind === 'pickedUp' ? { kind, markerId: f.target }
    : kind === 'interact' ? { kind, pieceId: f.target, ...(f.cost.trim() ? { cost: num(f.cost) } : {}), ...(f.onlyInactive ? { onlyInactive: true } : {}) }
    : kind === 'encounterUsed' ? { kind, markerId: f.target }
    : kind === 'encountersGone' ? { kind, ...(f.pieceIds.length ? { markerIds: [...f.pieceIds] } : {}), ...(f.whereArea !== '*' ? { area: f.whereArea } : {}) }
    : kind === 'cleared' ? { kind, ...(f.pieceIds.length ? { pieceIds: [...f.pieceIds] } : {}), ...(f.whereArea !== '*' ? { area: f.whereArea } : {}) }
    : kind === 'overlordTurnEnd' ? { kind }
    : { kind, area: f.target };
}

interface FormCondition {
  /** Una condizione su una variabile (acceso/spento) o su un oggetto (dove si trova). */
  kind: 'variable' | 'item';
  variable: string;
  is: 'on' | 'off';
  item: string;
  at: 'hero' | 'ground' | 'monster';
  /** Vale se l'oggetto NON sta nel posto `at`. */
  not: boolean;
}

const blank = (kind: EffectKind): FormEffect => ({ kind, dice: 'magic', needs: '1', refusable: false, noFatigue: false, endText: '', endPoints: '', ok: [], ko: [], title: '', text: '', amount: '1', variable: '', on: 'on', pieceIds: [], immunity: 'all', look: '', behavior: '', behaviorTarget: '', behaviorItem: '', reward: 'rune', rewardColor: 'red', rewardKeyId: '', rewardItem: '', rewardAmount: '1', doorId: '', wounds: '', speed: '', armor: '', turns: '2', distance: '8' });

const num = (s: string): number => {
  const n = Number(s.trim());
  return s.trim() !== '' && Number.isInteger(n) ? n : 0;
};
const isInt = (s: string) => s.trim() === '' || Number.isInteger(Number(s.trim()));

function toForm(e: EventEffect): FormEffect {
  if ((e.kind as string) === 'clearLook') e = { ...e, kind: 'setLook' } as EventEffect; // versione intermedia dell'effetto: "torna normale" è "Cambia l'aspetto" senza aspetto
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
    case 'setLook': return { ...f, pieceIds: targetsOf(e), look: e.look ?? '' };
    case 'placeItem': return { ...f, rewardItem: e.itemId };
    case 'moveItem': return { ...f, rewardItem: e.markerId };
    case 'give': {
      const r = e.reward;
      return { ...f, reward: r.kind as RewardKind, rewardColor: r.kind === 'rune' ? r.color : 'red', rewardKeyId: r.kind === 'key' ? r.keyId : '', rewardItem: r.kind === 'item' ? r.itemId : '', rewardAmount: r.kind === 'coins' ? String(r.amount ?? 100) : r.kind === 'progress' ? String(r.amount) : '1' };
    }
    case 'setBehavior': return { ...f, pieceIds: targetsOf(e), behavior: behaviorKind(e.behavior), behaviorTarget: behaviorTarget(e.behavior), behaviorItem: behaviorItem(e.behavior) };
    case 'removeImmunity': return { ...f, pieceIds: targetsOf(e), immunity: e.immunity };
    case 'openDoor': return { ...f, doorId: e.doorId };
    case 'check': return { ...f, title: e.title ?? '', text: e.text, dice: e.dice, needs: String(e.needs ?? 1), refusable: !!e.refusable, noFatigue: !!e.noFatigue, ok: e.onSuccess.map(toForm), ko: e.onFail.map(toForm) };
    case 'threat': return { ...f, amount: String(e.amount) };
    case 'drawCard': return { ...f, amount: String(e.count ?? 1) };
    case 'addEnding': return { ...f, endText: e.text ?? '', endPoints: e.points ? String(e.points) : '' };
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
    case 'setLook': return { kind: 'setLook', ...targetFields(f), ...(f.look ? { look: f.look } : {}) };
    case 'placeItem': return { kind: 'placeItem', itemId: f.rewardItem, where: 'nearStart' };
    case 'moveItem': return { kind: 'moveItem', markerId: f.rewardItem, where: 'nearStart' };
    case 'give': return { kind: 'give', reward: f.reward === 'rune' ? { kind: 'rune', color: f.rewardColor } : f.reward === 'key' ? { kind: 'key', keyId: f.rewardKeyId.trim() } : f.reward === 'item' ? { kind: 'item', itemId: f.rewardItem } : f.reward === 'coins' ? { kind: 'coins', amount: num(f.rewardAmount) } : { kind: 'progress', amount: num(f.rewardAmount) } };
    case 'setBehavior': return { kind: 'setBehavior', ...targetFields(f), ...(behaviorFrom(f.behavior, f.behaviorTarget, f.behaviorItem) ? { behavior: behaviorFrom(f.behavior, f.behaviorTarget, f.behaviorItem) } : {}) };
    case 'removeImmunity': return { kind: 'removeImmunity', ...targetFields(f), immunity: f.immunity };
    case 'openDoor': return { kind: 'openDoor', doorId: f.doorId };
    case 'check': return { kind: 'check', ...(f.title.trim() ? { title: f.title.trim() } : {}), text: f.text.trim(), dice: f.dice, needs: Math.max(1, num(f.needs)), ...(f.refusable ? { refusable: true } : {}), ...(f.noFatigue ? { noFatigue: true } : {}), onSuccess: f.ok.map(toEffect), onFail: f.ko.map(toEffect) };
    case 'threat': return { kind: 'threat', amount: num(f.amount) };
    case 'drawCard': return { kind: 'drawCard', ...(num(f.amount) > 1 ? { count: num(f.amount) } : {}) };
    case 'addEnding': return { kind: 'addEnding', ...(f.endText.trim() ? { text: f.endText.trim() } : {}), ...(num(f.endPoints) !== 0 ? { points: num(f.endPoints) } : {}) };
    case 'win': return { kind: 'win' };
  }
}

const WHEN_OPTIONS: SelectOption[] = [
  { value: 'defeated', label: 'Un nemico è sconfitto' },
  { value: 'interact', label: 'Un eroe interagisce con un nemico' },
  { value: 'cleared', label: 'Non c’è più nessun nemico…' },
  { value: 'pickedUp', label: 'Un eroe raccoglie un oggetto' },
  { value: 'encounterUsed', label: 'Un eroe usa un incontro' },
  { value: 'encountersGone', label: 'Gli incontri scelti non sono più in mappa…' },
  { value: 'overlordTurnEnd', label: 'Finisce il turno del Signore supremo' },
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
  { value: 'setLook', label: "Cambia l'aspetto di un nemico" },
  { value: 'setBehavior', label: 'Cambia il comportamento di un nemico' },
  { value: 'give', label: "Consegna un premio all'eroe" },
  { value: 'moveItem', label: 'Sposta un oggetto a terra accanto alla partenza' },
  { value: 'placeItem', label: 'Crea un oggetto a terra accanto alla partenza' },
  { value: 'removeImmunity', label: "Togli un'immunità a un nemico" },
  { value: 'openDoor', label: 'Apri una porta evento' },
  { value: 'check', label: 'Prova con i dadi potere' },
  { value: 'threat', label: 'Cambia la Minaccia del Signore supremo' },
  { value: 'drawCard', label: 'Il Signore supremo pesca delle carte' },
  { value: 'addEnding', label: 'Aggiungi al finale (testo e punti)' },
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
                  @if (t.kind !== 'cleared' && t.kind !== 'encountersGone' && t.kind !== 'overlordTurnEnd') {
                    <app-select class="block" [options]="targetOptionsOf(t)" [value]="t.target" [placeholder]="placeholderOf(t)" label="Dove o chi" (changed)="patchTrigger(ti, { target: $event })" />
                  } @else {
                    <app-select class="block" [options]="whereOptions()" [value]="t.whereArea" label="Dove" (changed)="patchTrigger(ti, { whereArea: $event })" />
                  }
                </div>
                @if (triggers().length > 1) { <button type="button" class="dlg-rm" aria-label="Togli questo innesco" title="Togli questo innesco" (click)="removeTrigger(ti)">×</button> }
              </div>
              @if (t.kind === 'cleared' || t.kind === 'encountersGone') {
                <div class="dlg-chips">
                  @for (id of t.pieceIds; track id) {
                    <span class="dlg-chip">{{ chipName(t, id) }}<button type="button" [attr.aria-label]="'Togli ' + chipName(t, id)" (click)="removePieceId(ti, id)">×</button></span>
                  } @empty { <small class="dlg-hint">{{ t.kind === 'cleared' ? 'Qualunque nemico' : 'Tutti i segnalini incontro' }}</small> }
                </div>
                <app-select class="block" [options]="freeChoicesOf(t)" value="" [placeholder]="t.kind === 'cleared' ? 'Aggiungi un nemico alla lista…' : 'Aggiungi un incontro alla lista…'" label="Elenco" (changed)="addPieceId(ti, $event)" />
                @if (t.kind === 'cleared') {
                  <small class="dlg-hint">Scatta quando l'ultimo dei nemici scelti (o di tutti, se la lista è vuota) non è più nella mappa o nell'area: sconfitto, rimosso o uscito camminando. Non scatta se all'inizio non ce n'era nessuno.</small>
                } @else {
                  <small class="dlg-hint">Scatta quando l'ultimo dei segnalini incontro scelti (o di tutti, se la lista è vuota) non è più nella mappa o nell'area, perché usato. Non scatta se all'inizio non ce n'era nessuno.</small>
                }
              }
              @if (t.kind === 'interact') {
                <app-field label="Costo dell'interazione (punti movimento)"><input type="number" min="0" step="1" [class.bad]="!isInt(t.cost)" [value]="t.cost" (input)="patchTrigger(ti, { cost: $any($event.target).value })" /></app-field>
                <app-checkbox [checked]="t.onlyInactive" (changed)="patchTrigger(ti, { onlyInactive: $event })">Solo finché il nemico è inattivo</app-checkbox>
                <small class="dlg-hint">Sul nemico compare un "?" e l'eroe adiacente trova la stessa voce nel menu del "!". Si può fare una volta sola: poi il "?" sparisce.</small>
              }
              @if (t.kind === 'overlordTurnEnd') { <small class="dlg-hint">Scatta alla fine del turno del Signore supremo, dopo che i mostri hanno giocato e prima che cominci il round dopo. Di solito si usa con una condizione ("Se"), per ricompense e penalità a fine turno.</small> }
              @if (t.kind !== 'cleared' && t.kind !== 'encountersGone' && t.kind !== 'overlordTurnEnd' && !targetOptionsOf(t).length) { <small class="dlg-hint">{{ emptyHintOf(t) }}</small> }
            </div>
          }
          <button type="button" class="dlg-btn small" (click)="addTrigger()">Aggiungi un altro innesco (oppure…)</button>
          <app-checkbox [checked]="once()" [disabled]="!canOnce()" (changed)="once.set($event)">Scatta una sola volta</app-checkbox>
          @if (canOnce()) {
            <small class="dlg-hint">Dopo il primo scatto l'evento non parte più, anche se un altro innesco succede. Un evento le cui condizioni non valgono non conta come scattato.</small>
          } @else {
            <small class="dlg-hint">Con un solo innesco l'evento scatta già una volta sola. Si può scegliere fra "una volta sola" e "ogni volta" quando ci sono più inneschi ("oppure…") o l'innesco può ripetersi, come "si apre un baule in un'area".</small>
          }
        </section>

        <section>
          <h3>Se <small>(facoltativo: tutte le condizioni devono valere)</small></h3>
          @for (c of conditions(); track $index; let i = $index) {
            <div class="row cond">
              @if (c.kind === 'item') {
                <app-select class="block" [options]="itemOptions()" [value]="c.item" placeholder="Scegli un oggetto…" label="Oggetto" (changed)="patchCondition(i, { item: $event })" />
                <app-select class="block" [options]="itemAtOptions" [value]="(c.not ? '!' : '') + c.at" label="Dove" (changed)="patchCondition(i, { at: $any($event).replace('!', ''), not: $any($event).startsWith('!') })" />
              } @else {
                <app-select class="block" [options]="varOptions()" [value]="c.variable" placeholder="Scegli una variabile…" label="Variabile" (changed)="patchCondition(i, { variable: $event })" />
                <app-select class="block" [options]="stateOptions" [value]="c.is" label="Stato" (changed)="patchCondition(i, { is: $any($event) })" />
              }
              <button type="button" class="dlg-rm" aria-label="Togli la condizione" title="Togli la condizione" (click)="removeCondition(i)">×</button>
            </div>
          }
          <button type="button" class="dlg-btn small" (click)="addCondition('variable')">Aggiungi una condizione su una variabile</button>
          <button type="button" class="dlg-btn small" (click)="addCondition('item')">Aggiungi una condizione su un oggetto</button>
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
                  @case ('setLook') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <app-field label="Nuovo aspetto"><app-select class="block" [options]="lookOptions" [value]="e.look" label="Aspetto" (changed)="patch(loc, i, { look: $any($event) })" /></app-field>
                    <small class="dlg-hint">Il vecchio stile svanisce con una dissolvenza e compare il nuovo; «Normale» toglie l'aspetto. Il resto (inattivo, invincibile, immunità) non cambia.</small>
                  }
                  @case ('moveItem') {
                    <app-field label="Oggetto"><app-select class="block" [options]="itemMarkers()" [value]="e.rewardItem" placeholder="Scegli un oggetto a terra…" label="Oggetto" (changed)="patch(loc, i, { rewardItem: $event })" /></app-field>
                    @if (!itemMarkers().length) { <small class="dlg-hint">Metti prima un oggetto del catalogo in mappa con lo strumento Oggetti (scheda "Oggetto del catalogo").</small> }
                    <small class="dlg-hint">Il gettone, già piazzato e personalizzato in mappa, si sposta in una casella libera a caso accanto alle caselle di partenza (non sulle caselle di partenza). Se l'evento non scatta resta dove l'hai messo. Di solito si usa con "Gli eroi rivelano un'area" sull'area di partenza.</small>
                  }
                  @case ('placeItem') {
                    <app-field label="Oggetto"><app-select class="block" [options]="itemOptions()" [value]="e.rewardItem" placeholder="Scegli un oggetto…" label="Oggetto" (changed)="patch(loc, i, { rewardItem: $event })" /></app-field>
                    <small class="dlg-hint">L'oggetto compare a terra in una casella libera accanto alle caselle di partenza, scelta a caso (non sulle caselle di partenza). Di solito si usa con "Gli eroi rivelano un'area" sull'area di partenza. Chi lo raggiunge lo raccoglie con "Raccogli" nel menu del "!".</small>
                  }
                  @case ('give') {
                    <app-field label="Premio"><app-select class="block" [options]="rewardOptions" [value]="e.reward" label="Premio" (changed)="patch(loc, i, { reward: $any($event) })" /></app-field>
                    @switch (e.reward) {
                      @case ('rune') { <app-field label="Colore"><app-select class="block" [options]="runeColorOptions" [value]="e.rewardColor" label="Colore" (changed)="patch(loc, i, { rewardColor: $any($event) })" /></app-field> }
                      @case ('key') { <app-field label="Chiave"><input type="text" autocomplete="off" placeholder="Il nome della chiave, per esempio chiave-1" [class.bad]="!e.rewardKeyId.trim()" [value]="e.rewardKeyId" (input)="patch(loc, i, { rewardKeyId: $any($event.target).value })" /></app-field> }
                      @case ('item') { <app-field label="Oggetto"><app-select class="block" [options]="itemOptions()" [value]="e.rewardItem" placeholder="Scegli un oggetto…" label="Oggetto" (changed)="patch(loc, i, { rewardItem: $event })" /></app-field> }
                      @default { <app-field [label]="e.reward === 'coins' ? 'Monete (a ogni eroe)' : 'Punti Conquista'"><input type="number" min="1" step="1" [class.bad]="num(e.rewardAmount) < 1" [value]="e.rewardAmount" (input)="patch(loc, i, { rewardAmount: $any($event.target).value })" /></app-field> }
                    }
                    <small class="dlg-hint">Lo riceve l'eroe che ha fatto scattare l'evento. Una chiave runica (o una chiave) sblocca le porte per tutto il gruppo, e la Verifica la conta per le porte runiche. Un oggetto va a lui (se non ha posto, cade a terra nella sua casella); il denaro va a ogni eroe, come nei bauli.</small>
                  }
                  @case ('setBehavior') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <app-field label="Nuovo comportamento"><app-select class="block" [options]="behaviorOptions" [value]="e.behavior" label="Comportamento" (changed)="patch(loc, i, { behavior: $any($event) })" /></app-field>
                    @if (e.behavior === 'endNear') {
                      <app-field label="Accanto a"><app-select class="block" [options]="obstacles()" [value]="e.behaviorTarget" placeholder="Scegli un ostacolo…" label="Ostacolo" (changed)="patch(loc, i, { behaviorTarget: $event })" /></app-field>
                      @if (!obstacles().length) { <small class="dlg-hint">Metti prima un ostacolo con lo strumento Ostacoli.</small> }
                    }
                    @if (e.behavior === 'carry') {
                      <app-field label="Oggetto" note="(facoltativo)"><app-select class="block" [options]="carriedOptions()" [value]="e.behaviorItem" label="Oggetto" (changed)="patch(loc, i, { behaviorItem: $event })" /></app-field>
                    }
                    <small class="dlg-hint">Il vincolo vale dal prossimo turno del Signore supremo, per lo script e per chi lo gioca. «Normale» toglie il comportamento.</small>
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
                    <div class="dlg-cols">
                      <app-field label="Tipo di prova"><app-select class="block" [options]="diceOptions" [value]="e.dice" label="Tipo di prova" (changed)="patch(loc, i, { dice: $any($event) })" /></app-field>
                      <app-field label="Difficoltà"><input type="number" min="1" step="1" [class.bad]="num(e.needs) < 1" [value]="e.needs" (input)="patch(loc, i, { needs: $any($event.target).value })" /></app-field>
                    </div>
                    <div class="check-opts">
                      <app-checkbox [checked]="e.refusable" (changed)="patch(loc, i, { refusable: $event })">Si può rifiutare</app-checkbox>
                      <app-checkbox [checked]="e.noFatigue" (changed)="patch(loc, i, { noFatigue: $event })">Niente fatica per i dadi</app-checkbox>
                    </div>
                    <small class="dlg-hint">L'eroe tira tanti dadi potere quanti sono i dadi in più del suo attacco scelto (senza dadi la prova fallisce, a meno che ne compri con la fatica); la difficoltà è il numero di onde necessarie. Di base può spendere 1 fatica per ogni dado in più prima di tirare; con "Niente fatica per i dadi" il tasto non compare. Con "Si può rifiutare" compare anche Annulla: non succede niente, la fatica spesa e il costo dell'interazione tornano indietro e il "?" resta.</small>
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
                  @case ('threat') {
                    <app-field label="Punti Minaccia (+ o −)"><input type="number" step="1" [class.bad]="!isInt(e.amount) || num(e.amount) === 0" [value]="e.amount" (input)="patch(loc, i, { amount: $any($event.target).value })" /></app-field>
                    <small class="dlg-hint">Il Signore supremo guadagna (o, con un numero negativo, perde) questa Minaccia; non scende mai sotto 0.</small>
                  }
                  @case ('drawCard') {
                    <app-field label="Quante carte"><input type="number" min="1" step="1" [class.bad]="!isInt(e.amount) || num(e.amount) < 1" [value]="e.amount" (input)="patch(loc, i, { amount: $any($event.target).value })" /></app-field>
                    <small class="dlg-hint">Il Signore supremo pesca queste carte dal suo mazzo, come a inizio turno (se il mazzo finisce vale la solita penalità); la mano non supera il limite.</small>
                  }
                  @case ('addEnding') {
                    <textarea rows="4" placeholder="Il testo che compare nel finale, dopo la conclusione dell'avventura (markdown)." [class.bad]="!e.endText.trim() && num(e.endPoints) === 0" [value]="e.endText" (input)="patch(loc, i, { endText: $any($event.target).value })"></textarea>
                    <app-field label="Modificatore dei punti Conquista (+ o −)"><input type="number" step="1" placeholder="0" [class.bad]="!isInt(e.endPoints)" [value]="e.endPoints" (input)="patch(loc, i, { endPoints: $any($event.target).value })" /></app-field>
                    @if (finalReward() !== null) {
                      <small class="dlg-hint">Punti Conquista finali dell'obiettivo: <b>{{ finalReward() }}</b>@if (num(e.endPoints) !== 0) { · con questo modificatore: <b>{{ finalReward()! + num(e.endPoints) }}</b> }.</small>
                    } @else {
                      <small class="dlg-hint warn">I punti Conquista finali dell'obiettivo non sono ancora impostati (si scrivono in Obiettivi): quando li imposti tieni conto di questo modificatore, perché la Conquista finale sarà quella dell'obiettivo {{ num(e.endPoints) >= 0 ? '+' : '−' }} {{ num(e.endPoints) >= 0 ? num(e.endPoints) : -num(e.endPoints) }}.</small>
                    }
                    <small class="dlg-hint">Non fa vincere: se poi la partita si vince (per esempio sconfiggendo il nemico dell'obiettivo), nel finale compare la conclusione dell'avventura, poi questo testo, e i punti si sommano a quelli dell'obiettivo. Di solito si usa con una condizione, per i finali alternativi.</small>
                  }
                  @case ('win') {
                    <small class="dlg-hint">Gli eroi vincono: compaiono la conclusione e i punti dell'obiettivo (si scrivono in Obiettivi), più i pezzi aggiunti con "Aggiungi al finale".</small>
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
    .dlg-hint.warn { color: var(--c-warn); }
    .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; }
    .row.cond { grid-template-columns: minmax(0, 1fr) 160px auto; }
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
    .check-opts { display: flex; flex-direction: column; gap: 6px; }
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
  /** I segnalini Incontro in mappa (l'id e dove stanno). */
  readonly encounters = input<SelectOption[]>([]);
  /** Gli oggetti del catalogo a terra in mappa (con un id), per "Sposta un oggetto a terra". */
  readonly itemMarkers = input<SelectOption[]>([]);
  readonly variables = input<string[]>([]);
  readonly confirmed = output<AdventureEvent>();
  readonly cancel = output<void>();
  /** Una variabile nuova scritta dentro la dialog: la mappa la aggiunge subito all'elenco. */
  readonly variableAdded = output<string>();

  protected readonly whenOptions = WHEN_OPTIONS;
  protected readonly stateOptions = STATE_OPTIONS;
  protected readonly immunityOptions = IMMUNITY_OPTIONS;
  readonly items = input<{ id: string; name: string; carried?: boolean }[]>([]);
  /** I punti Conquista finali dell'obiettivo (null se non ancora impostati), per mostrarli accanto al modificatore di "Aggiungi al finale". */
  readonly finalReward = input<number | null>(null);
  protected readonly carriedOptions = computed<SelectOption[]>(() => [{ value: '', label: 'Qualsiasi oggetto trasportabile' }, ...this.items().filter((i) => i.carried).map((i) => ({ value: i.id, label: i.name }))]);
  protected readonly itemOptions = computed<SelectOption[]>(() => this.items().map((o) => ({ value: o.id, label: o.name })));
  protected readonly rewardOptions: SelectOption[] = [
    { value: 'rune', label: 'Chiave runica' },
    { value: 'key', label: 'Chiave' },
    { value: 'item', label: 'Oggetto' },
    { value: 'coins', label: 'Denaro' },
    { value: 'progress', label: 'Punti Conquista' },
  ];
  protected readonly runeColorOptions: SelectOption[] = [
    { value: 'red', label: 'Rossa' },
    { value: 'blue', label: 'Blu' },
    { value: 'green', label: 'Verde' },
  ];
  protected readonly behaviorOptions: SelectOption[] = BEHAVIOR_OPTIONS.map((b) => ({ value: b.value, label: b.label }));
  readonly obstacles = input<SelectOption[]>([]);
  protected readonly itemAtOptions: SelectOption[] = [
    { value: 'hero', label: 'È con un eroe' },
    { value: 'ground', label: 'È a terra' },
    { value: 'monster', label: 'È con un mostro' },
    { value: '!hero', label: 'Non è con un eroe' },
    { value: '!ground', label: 'Non è a terra' },
    { value: '!monster', label: 'Non è con un mostro' },
  ];
  protected readonly lookOptions: SelectOption[] = PAWN_LOOKS.map((l) => ({ value: l.value, label: l.label }));
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
  /** Le scelte ancora libere nell'elenco di un innesco "non c'è più nessuno": nemici, o segnalini incontro. */
  protected readonly freeChoicesOf = (t: FormTrigger) => (t.kind === 'encountersGone' ? this.encounters() : this.monsters()).filter((m) => !t.pieceIds.includes(m.value));
  protected readonly chipName = (t: FormTrigger, id: string) => (t.kind === 'encountersGone' ? (this.encounters().find((m) => m.value === id)?.label ?? '?') : this.monsterName(id));
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
  protected readonly targetOptionsOf = (t: FormTrigger) => (t.kind === 'pickedUp' ? this.pickups() : t.kind === 'encounterUsed' ? this.encounters() : this.onPiece(t) ? this.monsters() : this.areas());
  protected readonly placeholderOf = (t: FormTrigger) => (t.kind === 'pickedUp' ? 'Scegli un oggetto…' : t.kind === 'encounterUsed' ? 'Scegli un incontro…' : this.onPiece(t) ? 'Scegli un nemico…' : 'Scegli un’area…');
  protected readonly emptyHintOf = (t: FormTrigger) =>
    t.kind === 'pickedUp' ? 'Metti prima un oggetto a terra con lo strumento Oggetti (pozione, denaro o chiave).' : t.kind === 'encounterUsed' ? 'Metti prima un segnalino Incontro con lo strumento Glifi e altro.' : this.onPiece(t) ? 'Metti prima il nemico in mappa con lo strumento Nemici.' : 'Crea prima un’area con lo strumento Aree.';
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
      this.conditions.set((v?.if ?? []).map((c): FormCondition => (isItemCondition(c) ? { kind: 'item', variable: '', is: 'on', item: c.item, at: c.at, not: !!c.not } : { kind: 'variable', variable: c.variable, is: c.is ? 'on' : 'off', item: '', at: 'hero', not: false })));
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

  /** "Una sola volta" ha senso solo se l'evento può scattare più volte: con più inneschi, o con un innesco che si ripete (più bauli nella stessa area). Con un innesco solo che non si ripete scatta comunque una volta. */
  protected readonly canOnce = computed(() => this.triggers().length > 1 || this.triggers()[0]?.kind === 'chestOpened');

  protected addTrigger() {
    this.triggers.update((l) => [...l, blankTrigger()]);
  }

  protected removeTrigger(i: number) {
    this.triggers.update((l) => l.filter((_, k) => k !== i));
    if (!this.canOnce()) this.once.set(false); // senza più inneschi non c'è da scegliere
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

  protected addCondition(kind: 'variable' | 'item' = 'variable') {
    this.conditions.update((c) => [...c, { kind, variable: '', is: 'on', item: '', at: 'hero', not: false }]);
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
      case 'placeItem': return e.rewardItem ? '' : "Scegli l'oggetto da mettere a terra";
      case 'moveItem': return e.rewardItem ? '' : "Scegli l'oggetto da spostare";
      case 'give': return e.reward === 'key' ? (e.rewardKeyId.trim() ? '' : 'Scrivi il nome della chiave') : e.reward === 'item' ? (e.rewardItem ? '' : "Scegli l'oggetto da consegnare") : e.reward === 'coins' || e.reward === 'progress' ? (num(e.rewardAmount) >= 1 ? '' : 'La quantità è un intero da 1 in su') : '';
      case 'setBehavior': return !e.pieceIds.length ? "Scegli il nemico di cui cambiare il comportamento" : e.behavior === 'endNear' && !e.behaviorTarget ? "Scegli l'ostacolo accanto a cui deve fermarsi" : '';
      case 'setLook': return e.pieceIds.length ? '' : "Scegli il nemico di cui cambiare l'aspetto";
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
      case 'threat': return isInt(e.amount) && num(e.amount) !== 0 ? '' : 'La Minaccia è un intero diverso da zero';
      case 'drawCard': return isInt(e.amount) && num(e.amount) >= 1 ? '' : 'Le carte da pescare sono un intero da 1 in su';
      case 'addEnding': return !isInt(e.endPoints) ? 'I punti sono un intero (anche negativo)' : !e.endText.trim() && num(e.endPoints) === 0 ? 'Il finale aggiunto ha bisogno di un testo o di un modificatore ai punti' : '';
      case 'win': return '';
    }
  }

  /** Cosa manca per confermare (vuoto se tutto va bene). */
  protected readonly problem = computed(() => {
    for (const t of this.triggers()) {
      if (t.kind !== 'cleared' && t.kind !== 'encountersGone' && t.kind !== 'overlordTurnEnd' && !t.target) return t.kind === 'pickedUp' ? "Scegli l'oggetto" : t.kind === 'encounterUsed' ? "Scegli l'incontro" : this.onPiece(t) ? 'Scegli il nemico' : "Scegli l'area";
      if (t.kind === 'interact' && (!isInt(t.cost) || num(t.cost) < 0)) return "Il costo dell'interazione è un intero da zero in su";
    }
    if (this.conditions().some((c) => c.kind === 'variable' && !c.variable)) return 'Una condizione non ha la variabile';
    if (this.conditions().some((c) => c.kind === 'item' && !c.item)) return "Una condizione non ha l'oggetto";
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
    const conditions: EventCondition[] = this.conditions().map((c): EventCondition => (c.kind === 'item' ? { item: c.item, at: c.at, ...(c.not ? { not: true } : {}) } : { variable: c.variable, is: c.is === 'on' }));
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
