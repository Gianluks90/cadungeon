import { translate, translate as t } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
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
  { value: 'defeated', get label() { return t('eventDialog.unNemicoESconfitto'); } },
  { value: 'interact', get label() { return t('eventDialog.unEroeInteragisceConUn'); } },
  { value: 'cleared', get label() { return t('eventDialog.nonCEPiuNessun'); } },
  { value: 'pickedUp', get label() { return t('eventDialog.unEroeRaccoglieUnOggetto'); } },
  { value: 'encounterUsed', get label() { return t('eventDialog.unEroeUsaUnIncontro'); } },
  { value: 'encountersGone', get label() { return t('eventDialog.gliIncontriSceltiNonSono'); } },
  { value: 'overlordTurnEnd', get label() { return t('eventDialog.finisceIlTurnoDelSignore'); } },
  { value: 'chestOpened', get label() { return t('eventDialog.siApreUnBauleIn'); } },
  { value: 'areaRevealed', get label() { return t('eventDialog.gliEroiRivelanoUnArea'); } },
];

const EFFECT_OPTIONS: SelectOption[] = [
  { value: 'message', get label() { return t('eventDialog.mostraUnMessaggio'); } },
  { value: 'progress', get label() { return t('eventDialog.cambiaIPuntiConquista'); } },
  { value: 'setVariable', get label() { return t('eventDialog.cambiaUnaVariabile'); } },
  { value: 'modifyMonster', get label() { return t('eventDialog.modificaUnNemico'); } },
  { value: 'revive', get label() { return t('eventDialog.ilNemicoSconfittoTornaIn'); } },
  { value: 'finishRevival', get label() { return t('eventDialog.chiudiIlRitornoInVita'); } },
  { value: 'activate', get label() { return t('eventDialog.attivaUnNemicoInattivo'); } },
  { value: 'removePiece', get label() { return t('eventDialog.rimuoviUnNemicoDallaMappa'); } },
  { value: 'makeVulnerable', get label() { return t('eventDialog.rendiVulnerabileUnNemicoInvincibile'); } },
  { value: 'setLook', get label() { return t('eventDialog.cambiaLAspettoDiUn'); } },
  { value: 'setBehavior', get label() { return t('eventDialog.cambiaIlComportamentoDiUn'); } },
  { value: 'give', get label() { return t('eventDialog.consegnaUnPremioAllEroe'); } },
  { value: 'moveItem', get label() { return t('eventDialog.spostaUnOggettoATerra'); } },
  { value: 'placeItem', get label() { return t('eventDialog.creaUnOggettoATerra'); } },
  { value: 'removeImmunity', get label() { return t('eventDialog.togliUnImmunitaAUn'); } },
  { value: 'openDoor', get label() { return t('eventDialog.apriUnaPortaEvento'); } },
  { value: 'check', get label() { return t('eventDialog.provaConIDadiPotere'); } },
  { value: 'threat', get label() { return t('eventDialog.cambiaLaMinacciaDelSignore'); } },
  { value: 'drawCard', get label() { return t('eventDialog.ilSignoreSupremoPescaDelle'); } },
  { value: 'addEnding', get label() { return t('eventDialog.aggiungiAlFinaleTestoE'); } },
  { value: 'win', get label() { return t('eventDialog.vinciLAvventura'); } },
];

const STATE_OPTIONS: SelectOption[] = [
  { value: 'on', get label() { return t('eventDialog.eAccesa'); } },
  { value: 'off', get label() { return t('eventDialog.eSpenta'); } },
];

/**
 * La dialog di un evento: **Quando** scatta (un nemico sconfitto, un baule aperto in un'area, un'area rivelata), **Se** valgono certe condizioni sulle variabili (facoltativo), e **Allora**
 * (e, se ci sono condizioni, **Altrimenti**) gli effetti, una lista di cui ogni voce ha i suoi campi. "Conferma" resta spento finché qualcosa manca; il messaggio sotto dice cosa.
 */
@Component({
  selector: 'app-event-dialog',
  imports: [TranslatePipe, NgTemplateOutlet, CheckboxComponent, DialogComponent, FieldComponent, SelectComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <app-dialog [closeOnBackdrop]="false" [title]="title()" width="min(1120px, 100%)" height="min(680px, calc(100vh - 48px))" [flush]="true" (closed)="cancel.emit()">
        <div class="cols">
        <div class="col">
        <app-field [label]="'eventDialog.nome' | t" [note]="'common.facoltativo' | t">
          <input type="text" autocomplete="off" [placeholder]="'eventDialog.perEsempioIlCuoreDi' | t" [value]="name()" (input)="name.set($any($event.target).value)" />
        </app-field>

        <section>
          <h3>{{ 'eventDialog.quando' | t }} <small>{{ 'eventDialog.seCeNEPiu' | t }}</small></h3>
          @for (t of triggers(); track $index; let ti = $index) {
            <div class="trigger">
              @if (ti > 0) { <span class="or">{{ 'eventDialog.oppure' | t }}</span> }
              <div class="row">
                <div class="dlg-cols">
                  <app-select class="block" [options]="whenOptions" [value]="t.kind" [label]="'eventDialog.quando' | t" (changed)="setTriggerKind(ti, $event)" />
                  @if (t.kind !== 'cleared' && t.kind !== 'encountersGone' && t.kind !== 'overlordTurnEnd') {
                    <app-select class="block" [options]="targetOptionsOf(t)" [value]="t.target" [placeholder]="placeholderOf(t)" [label]="'eventDialog.doveOChi' | t" (changed)="patchTrigger(ti, { target: $event })" />
                  } @else {
                    <app-select class="block" [options]="whereOptions()" [value]="t.whereArea" [label]="'eventDialog.dove' | t" (changed)="patchTrigger(ti, { whereArea: $event })" />
                  }
                </div>
                @if (triggers().length > 1) { <button type="button" class="dlg-rm" [attr.aria-label]="'eventDialog.togliQuestoInnesco' | t" [title]="'eventDialog.togliQuestoInnesco' | t" (click)="removeTrigger(ti)">×</button> }
              </div>
              @if (t.kind === 'cleared' || t.kind === 'encountersGone') {
                <div class="dlg-chips">
                  @for (id of t.pieceIds; track id) {
                    <span class="dlg-chip">{{ chipName(t, id) }}<button type="button" [attr.aria-label]="'common.removeNamed' | t: { name: chipName(t, id) }" (click)="removePieceId(ti, id)">×</button></span>
                  } @empty { <small class="dlg-hint">{{ (t.kind === 'cleared' ? 'eventDialog.p.anyEnemy' : 'eventDialog.p.allEncounters') | t }}</small> }
                </div>
                <app-select class="block" [options]="freeChoicesOf(t)" value="" [placeholder]="(t.kind === 'cleared' ? 'eventDialog.p.addEnemyToList' : 'eventDialog.p.addEncounterToList') | t" [label]="'eventDialog.elenco' | t" (changed)="addPieceId(ti, $event)" />
                @if (t.kind === 'cleared') {
                  <small class="dlg-hint">{{ 'eventDialog.scattaQuandoLUltimoDei' | t }}</small>
                } @else {
                  <small class="dlg-hint">{{ 'eventDialog.scattaQuandoLUltimoDei2' | t }}</small>
                }
              }
              @if (t.kind === 'interact') {
                <app-field [label]="'eventDialog.costoDellInterazionePuntiMovimento' | t"><input type="number" min="0" step="1" [class.bad]="!isInt(t.cost)" [value]="t.cost" (input)="patchTrigger(ti, { cost: $any($event.target).value })" /></app-field>
                <app-checkbox [checked]="t.onlyInactive" (changed)="patchTrigger(ti, { onlyInactive: $event })">{{ 'eventDialog.soloFincheIlNemicoE' | t }}</app-checkbox>
                <small class="dlg-hint">{{ 'eventDialog.sulNemicoCompareUnE' | t }}</small>
              }
              @if (t.kind === 'overlordTurnEnd') { <small class="dlg-hint">{{ 'eventDialog.scattaAllaFineDelTurno' | t }}</small> }
              @if (t.kind !== 'cleared' && t.kind !== 'encountersGone' && t.kind !== 'overlordTurnEnd' && !targetOptionsOf(t).length) { <small class="dlg-hint">{{ emptyHintOf(t) }}</small> }
            </div>
          }
          <button type="button" class="dlg-btn small" (click)="addTrigger()">{{ 'eventDialog.aggiungiUnAltroInnescoOppure' | t }}</button>
          <app-checkbox [checked]="once()" [disabled]="!canOnce()" (changed)="once.set($event)">{{ 'eventDialog.scattaUnaSolaVolta' | t }}</app-checkbox>
          @if (canOnce()) {
            <small class="dlg-hint">{{ 'eventDialog.dopoIlPrimoScattoL' | t }}</small>
          } @else {
            <small class="dlg-hint">{{ 'eventDialog.conUnSoloInnescoL' | t }}</small>
          }
        </section>

        <section>
          <h3>{{ 'eventDialog.se' | t }} <small>{{ 'eventDialog.facoltativoTutteLeCondizioniDevono' | t }}</small></h3>
          @for (c of conditions(); track $index; let i = $index) {
            <div class="row cond">
              @if (c.kind === 'item') {
                <app-select class="block" [options]="itemOptions()" [value]="c.item" [placeholder]="'common.scegliUnOggetto' | t" [label]="'common.oggetto' | t" (changed)="patchCondition(i, { item: $event })" />
                <app-select class="block" [options]="itemAtOptions" [value]="(c.not ? '!' : '') + c.at" [label]="'eventDialog.dove' | t" (changed)="patchCondition(i, { at: $any($event).replace('!', ''), not: $any($event).startsWith('!') })" />
              } @else {
                <app-select class="block" [options]="varOptions()" [value]="c.variable" [placeholder]="'eventDialog.scegliUnaVariabile' | t" [label]="'eventDialog.variabile' | t" (changed)="patchCondition(i, { variable: $event })" />
                <app-select class="block" [options]="stateOptions" [value]="c.is" [label]="'eventDialog.stato' | t" (changed)="patchCondition(i, { is: $any($event) })" />
              }
              <button type="button" class="dlg-rm" [attr.aria-label]="'eventDialog.togliLaCondizione' | t" [title]="'eventDialog.togliLaCondizione' | t" (click)="removeCondition(i)">×</button>
            </div>
          }
          <button type="button" class="dlg-btn small" (click)="addCondition('variable')">{{ 'eventDialog.aggiungiUnaCondizioneSuUna' | t }}</button>
          <button type="button" class="dlg-btn small" (click)="addCondition('item')">{{ 'eventDialog.aggiungiUnaCondizioneSuUn' | t }}</button>
        </section>

        <section>
          <h3>{{ 'eventDialog.nuovaVariabile' | t }}</h3>
          <div class="dlg-add">
            <input type="text" autocomplete="off" maxlength="40" [placeholder]="'eventDialog.perEsempioCuoreDiMunkar' | t" [value]="newVariable()" (input)="newVariable.set($any($event.target).value)" (keydown.enter)="addVariable()" />
            <button type="button" class="dlg-btn small" [class.off]="!canAddVariable()" [attr.aria-disabled]="!canAddVariable()" (click)="addVariable()">{{ 'common.aggiungi' | t }}</button>
          </div>
        </section>
        </div>
        <div class="col">
        @for (side of sides(); track side) {
          <section>
            <h3>{{ (side === 'then' ? 'eventDialog.p.then' : 'eventDialog.p.else') | t }}</h3>
            @for (e of list(side)(); track $index; let i = $index) {
              <ng-container *ngTemplateOutlet="fx; context: { $implicit: e, loc: { side: side, parent: null }, i: i }" />
            }
            <button type="button" class="dlg-btn small" (click)="addEffect({ side: side, parent: null })">{{ 'eventDialog.aggiungiUnEffetto' | t }}</button>
          </section>
        }

        </div>
      </div>

        <!-- I nemici su cui agisce un effetto: un elenco a chip (anche "il nemico dell'evento" se l'innesco è "sconfitto" o "interagisce"). -->
        <ng-template #targets let-e let-loc="loc" let-i="i">
          <div class="dlg-chips">
            @for (id of e.pieceIds; track id) {
              <span class="dlg-chip">{{ targetName(id) }}<button type="button" [attr.aria-label]="'common.removeNamed' | t: { name: targetName(id) }" (click)="removeTarget(loc, i, id)">×</button></span>
            } @empty { <small class="dlg-hint">{{ 'eventDialog.nessunNemicoScelto' | t }}</small> }
          </div>
          <app-select class="block" [options]="targetChoices(e)" value="" [placeholder]="'eventDialog.aggiungiUnNemico' | t" [label]="'eventDialog.nemico' | t" (changed)="addTarget(loc, i, $event)" />
        </ng-template>

        <!-- Un effetto con i suoi campi. È un modello perché la Prova contiene altre due liste di effetti (superata e fallita) che si scrivono allo stesso modo. -->
        <ng-template #fx let-e let-loc="loc" let-i="i">
              <div class="effect">
                <div class="row head">
                  <app-select class="block" [options]="effectOptionsFor(loc)" [value]="e.kind" [label]="'eventDialog.effetto' | t" (changed)="setKind(loc, i, $event)" />
                  <button type="button" class="dlg-rm" [attr.aria-label]="'eventDialog.togliLEffetto' | t" [title]="'eventDialog.togliLEffetto' | t" (click)="removeEffect(loc, i)">×</button>
                </div>
                @switch (e.kind) {
                  @case ('message') {
                    <input type="text" autocomplete="off" [placeholder]="'eventDialog.titoloFacoltativo' | t" [value]="e.title" (input)="patch(loc, i, { title: $any($event.target).value })" />
                    <textarea rows="4" [placeholder]="'eventDialog.ilTestoCheIGiocatori' | t" [class.bad]="!e.text.trim()" [value]="e.text" (input)="patch(loc, i, { text: $any($event.target).value })"></textarea>
                  }
                  @case ('progress') {
                    <app-field [label]="'eventDialog.puntiConquistaAncheNegativi' | t"><input type="number" step="1" [class.bad]="!num(e.amount)" [value]="e.amount" (input)="patch(loc, i, { amount: $any($event.target).value })" /></app-field>
                  }
                  @case ('setVariable') {
                    <div class="dlg-cols">
                      <app-select class="block" [options]="varOptions()" [value]="e.variable" [placeholder]="'eventDialog.scegliUnaVariabile' | t" [label]="'eventDialog.variabile' | t" (changed)="patch(loc, i, { variable: $event })" />
                      <app-select class="block" [options]="stateOptions" [value]="e.on" [label]="'eventDialog.diventa' | t" (changed)="patch(loc, i, { on: $any($event) })" />
                    </div>
                  }
                  @case ('modifyMonster') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <div class="dlg-cols three">
                      <app-field [label]="'eventDialog.ferite' | t"><input type="number" step="1" placeholder="0" [value]="e.wounds" (input)="patch(loc, i, { wounds: $any($event.target).value })" /></app-field>
                      <app-field [label]="'eventDialog.velocita' | t"><input type="number" step="1" placeholder="0" [value]="e.speed" (input)="patch(loc, i, { speed: $any($event.target).value })" /></app-field>
                      <app-field [label]="'eventDialog.armatura' | t"><input type="number" step="1" placeholder="0" [value]="e.armor" (input)="patch(loc, i, { armor: $any($event.target).value })" /></app-field>
                    </div>
                    <small class="dlg-hint">{{ 'eventDialog.siSommaAiValoriChe' | t }}</small>
                  }
                  @case ('revive') {
                    <div class="dlg-cols">
                      <app-field [label]="'eventDialog.turniDelSignoreSupremo' | t"><input type="number" min="1" step="1" [class.bad]="num(e.turns) < 1" [value]="e.turns" (input)="patch(loc, i, { turns: $any($event.target).value })" /></app-field>
                      <app-field [label]="'eventDialog.distanzaMinimaDagliEroiCaselle' | t"><input type="number" min="0" step="1" [class.bad]="!isInt(e.distance)" [value]="e.distance" (input)="patch(loc, i, { distance: $any($event.target).value })" /></app-field>
                    </div>
                    <small class="dlg-hint">{{ 'eventDialog.esceDallaMappaSenzaBottino' | t }}</small>
                  }
                  @case ('finishRevival') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <small class="dlg-hint">{{ 'eventDialog.seStaAspettandoDiTornare' | t }}</small>
                  }
                  @case ('activate') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <small class="dlg-hint">{{ 'eventDialog.seIlNemicoEInattivo' | t }}</small>
                  }
                  @case ('removePiece') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <small class="dlg-hint">{{ 'eventDialog.ilNemicoVieneToltoDalla' | t }}</small>
                  }
                  @case ('makeVulnerable') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <small class="dlg-hint">{{ 'eventDialog.daOraLeFeriteContano' | t }}</small>
                  }
                  @case ('setLook') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <app-field [label]="'eventDialog.nuovoAspetto' | t"><app-select class="block" [options]="lookOptions" [value]="e.look" [label]="'common.aspetto' | t" (changed)="patch(loc, i, { look: $any($event) })" /></app-field>
                    <small class="dlg-hint">{{ 'eventDialog.ilVecchioStileSvanisceCon' | t }}</small>
                  }
                  @case ('moveItem') {
                    <app-field [label]="'common.oggetto' | t"><app-select class="block" [options]="itemMarkers()" [value]="e.rewardItem" [placeholder]="'eventDialog.scegliUnOggettoATerra' | t" [label]="'common.oggetto' | t" (changed)="patch(loc, i, { rewardItem: $event })" /></app-field>
                    @if (!itemMarkers().length) { <small class="dlg-hint">{{ 'eventDialog.mettiPrimaUnOggettoDel' | t }}</small> }
                    <small class="dlg-hint">{{ 'eventDialog.ilGettoneGiaPiazzatoE' | t }}</small>
                  }
                  @case ('placeItem') {
                    <app-field [label]="'common.oggetto' | t"><app-select class="block" [options]="itemOptions()" [value]="e.rewardItem" [placeholder]="'common.scegliUnOggetto' | t" [label]="'common.oggetto' | t" (changed)="patch(loc, i, { rewardItem: $event })" /></app-field>
                    <small class="dlg-hint">{{ 'eventDialog.lOggettoCompareATerra' | t }}</small>
                  }
                  @case ('give') {
                    <app-field [label]="'eventDialog.premio' | t"><app-select class="block" [options]="rewardOptions" [value]="e.reward" [label]="'eventDialog.premio' | t" (changed)="patch(loc, i, { reward: $any($event) })" /></app-field>
                    @switch (e.reward) {
                      @case ('rune') { <app-field [label]="'common.colore' | t"><app-select class="block" [options]="runeColorOptions" [value]="e.rewardColor" [label]="'common.colore' | t" (changed)="patch(loc, i, { rewardColor: $any($event) })" /></app-field> }
                      @case ('key') { <app-field [label]="'eventDialog.chiave' | t"><input type="text" autocomplete="off" [placeholder]="'eventDialog.ilNomeDellaChiavePer' | t" [class.bad]="!e.rewardKeyId.trim()" [value]="e.rewardKeyId" (input)="patch(loc, i, { rewardKeyId: $any($event.target).value })" /></app-field> }
                      @case ('item') { <app-field [label]="'common.oggetto' | t"><app-select class="block" [options]="itemOptions()" [value]="e.rewardItem" [placeholder]="'common.scegliUnOggetto' | t" [label]="'common.oggetto' | t" (changed)="patch(loc, i, { rewardItem: $event })" /></app-field> }
                      @default { <app-field [label]="(e.reward === 'coins' ? 'eventDialog.p.moneyEach' : 'eventDialog.puntiConquista') | t"><input type="number" min="1" step="1" [class.bad]="num(e.rewardAmount) < 1" [value]="e.rewardAmount" (input)="patch(loc, i, { rewardAmount: $any($event.target).value })" /></app-field> }
                    }
                    <small class="dlg-hint">{{ 'eventDialog.loRiceveLEroeChe' | t }}</small>
                  }
                  @case ('setBehavior') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <app-field [label]="'eventDialog.nuovoComportamento' | t"><app-select class="block" [options]="behaviorOptions" [value]="e.behavior" [label]="'common.comportamento' | t" (changed)="patch(loc, i, { behavior: $any($event) })" /></app-field>
                    @if (e.behavior === 'endNear') {
                      <app-field [label]="'eventDialog.accantoA' | t"><app-select class="block" [options]="obstacles()" [value]="e.behaviorTarget" [placeholder]="'eventDialog.scegliUnOstacolo' | t" [label]="'eventDialog.ostacolo' | t" (changed)="patch(loc, i, { behaviorTarget: $event })" /></app-field>
                      @if (!obstacles().length) { <small class="dlg-hint">{{ 'eventDialog.mettiPrimaUnOstacoloCon' | t }}</small> }
                    }
                    @if (e.behavior === 'carry') {
                      <app-field [label]="'common.oggetto' | t" [note]="'common.facoltativo' | t"><app-select class="block" [options]="carriedOptions()" [value]="e.behaviorItem" [label]="'common.oggetto' | t" (changed)="patch(loc, i, { behaviorItem: $event })" /></app-field>
                    }
                    <small class="dlg-hint">{{ 'eventDialog.ilVincoloValeDalProssimo' | t }}</small>
                  }
                  @case ('removeImmunity') {
                    <ng-container *ngTemplateOutlet="targets; context: { $implicit: e, loc: loc, i: i }" />
                    <app-field [label]="'eventDialog.immunitaDaTogliere' | t"><app-select class="block" [options]="immunityOptions" [value]="e.immunity" [label]="'common.immunita' | t" (changed)="patch(loc, i, { immunity: $event })" /></app-field>
                    <small class="dlg-hint">{{ 'eventDialog.toglieSoloQuestaVoceLe' | t }}</small>
                  }
                  @case ('openDoor') {
                    <app-select class="block" [options]="doors()" [value]="e.doorId" [placeholder]="'eventDialog.scegliUnaPortaEvento' | t" [label]="'eventDialog.porta' | t" (changed)="patch(loc, i, { doorId: $event })" />
                    <small class="dlg-hint">{{ (doors().length ? 'eventDialog.p.doorOpens' : 'eventDialog.p.doorFirst') | t }}</small>
                  }
                  @case ('check') {
                    <input type="text" autocomplete="off" [placeholder]="'eventDialog.titoloFacoltativo' | t" [value]="e.title" (input)="patch(loc, i, { title: $any($event.target).value })" />
                    <textarea rows="4" [placeholder]="'eventDialog.lIndovinelloOLaSituazione' | t" [class.bad]="!e.text.trim()" [value]="e.text" (input)="patch(loc, i, { text: $any($event.target).value })"></textarea>
                    <div class="dlg-cols">
                      <app-field [label]="'eventDialog.tipoDiProva' | t"><app-select class="block" [options]="diceOptions" [value]="e.dice" [label]="'eventDialog.tipoDiProva' | t" (changed)="patch(loc, i, { dice: $any($event) })" /></app-field>
                      <app-field [label]="'eventDialog.difficolta' | t"><input type="number" min="1" step="1" [class.bad]="num(e.needs) < 1" [value]="e.needs" (input)="patch(loc, i, { needs: $any($event.target).value })" /></app-field>
                    </div>
                    <div class="check-opts">
                      <app-checkbox [checked]="e.refusable" (changed)="patch(loc, i, { refusable: $event })">{{ 'eventDialog.siPuoRifiutare' | t }}</app-checkbox>
                      <app-checkbox [checked]="e.noFatigue" (changed)="patch(loc, i, { noFatigue: $event })">{{ 'eventDialog.nienteFaticaPerIDadi' | t }}</app-checkbox>
                    </div>
                    <small class="dlg-hint">{{ 'eventDialog.lEroeTiraTantiDadi' | t }}</small>
                    @for (branch of branches; track branch.id) {
                      <div class="branch">
                        <h4>{{ branch.label }}</h4>
                        @for (c of (branch.id === 'ok' ? e.ok : e.ko); track $index; let j = $index) {
                          <ng-container *ngTemplateOutlet="fx; context: { $implicit: c, loc: { side: loc.side, parent: { i: i, branch: branch.id } }, i: j }" />
                        }
                        <button type="button" class="dlg-btn small" (click)="addEffect({ side: loc.side, parent: { i: i, branch: branch.id } })">{{ 'eventDialog.aggiungiUnEffetto' | t }}</button>
                      </div>
                    }
                  }
                  @case ('threat') {
                    <app-field [label]="'eventDialog.puntiMinacciaO' | t"><input type="number" step="1" [class.bad]="!isInt(e.amount) || num(e.amount) === 0" [value]="e.amount" (input)="patch(loc, i, { amount: $any($event.target).value })" /></app-field>
                    <small class="dlg-hint">{{ 'eventDialog.ilSignoreSupremoGuadagnaO' | t }}</small>
                  }
                  @case ('drawCard') {
                    <app-field [label]="'eventDialog.quanteCarte' | t"><input type="number" min="1" step="1" [class.bad]="!isInt(e.amount) || num(e.amount) < 1" [value]="e.amount" (input)="patch(loc, i, { amount: $any($event.target).value })" /></app-field>
                    <small class="dlg-hint">{{ 'eventDialog.ilSignoreSupremoPescaQueste' | t }}</small>
                  }
                  @case ('addEnding') {
                    <textarea rows="4" [placeholder]="'eventDialog.ilTestoCheCompareNel' | t" [class.bad]="!e.endText.trim() && num(e.endPoints) === 0" [value]="e.endText" (input)="patch(loc, i, { endText: $any($event.target).value })"></textarea>
                    <app-field [label]="'eventDialog.modificatoreDeiPuntiConquistaO' | t"><input type="number" step="1" placeholder="0" [class.bad]="!isInt(e.endPoints)" [value]="e.endPoints" (input)="patch(loc, i, { endPoints: $any($event.target).value })" /></app-field>
                    @if (finalReward() !== null) {
                      <small class="dlg-hint">{{ 'eventDialog.puntiConquistaFinaliDellObiettivo' | t }} <b>{{ finalReward() }}</b>@if (num(e.endPoints) !== 0) { {{ 'eventDialog.p.withModifier' | t }} <b>{{ finalReward()! + num(e.endPoints) }}</b> }.</small>
                    } @else {
                      <small class="dlg-hint warn">{{ 'eventDialog.p.finalUnset' | t }} {{ num(e.endPoints) >= 0 ? '+' : '−' }} {{ num(e.endPoints) >= 0 ? num(e.endPoints) : -num(e.endPoints) }}.</small>
                    }
                    <small class="dlg-hint">{{ 'eventDialog.nonFaVincereSePoi' | t }}</small>
                  }
                  @case ('win') {
                    <small class="dlg-hint">{{ 'eventDialog.gliEroiVinconoCompaionoLa' | t }}</small>
                  }
                }
              </div>
        </ng-template>


        <ng-container dialogFooter>
          @if (problem()) { <span class="problem">{{ problem() }}</span> }
          <button type="button" class="dlg-btn primary" [class.off]="!!problem()" [attr.aria-disabled]="!!problem()" (click)="confirm()">{{ 'common.conferma' | t }}</button>
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
  protected readonly carriedOptions = computed<SelectOption[]>(() => [{ value: '', get label() { return t('eventDialog.qualsiasiOggettoTrasportabile'); } }, ...this.items().filter((i) => i.carried).map((i) => ({ value: i.id, label: i.name }))]);
  protected readonly itemOptions = computed<SelectOption[]>(() => this.items().map((o) => ({ value: o.id, label: o.name })));
  protected readonly rewardOptions: SelectOption[] = [
    { value: 'rune', get label() { return t('eventDialog.chiaveRunica'); } },
    { value: 'key', get label() { return t('eventDialog.chiave'); } },
    { value: 'item', get label() { return t('eventDialog.oggetto'); } },
    { value: 'coins', get label() { return t('eventDialog.denaro'); } },
    { value: 'progress', get label() { return t('eventDialog.puntiConquista'); } },
  ];
  protected readonly runeColorOptions: SelectOption[] = [
    { value: 'red', get label() { return t('eventDialog.rossa'); } },
    { value: 'blue', get label() { return t('eventDialog.blu'); } },
    { value: 'green', get label() { return t('eventDialog.verde'); } },
  ];
  protected readonly behaviorOptions: SelectOption[] = BEHAVIOR_OPTIONS.map((b) => ({ value: b.value, label: b.label }));
  readonly obstacles = input<SelectOption[]>([]);
  protected readonly itemAtOptions: SelectOption[] = [
    { value: 'hero', get label() { return t('eventDialog.eConUnEroe'); } },
    { value: 'ground', get label() { return t('eventDialog.eATerra'); } },
    { value: 'monster', get label() { return t('eventDialog.eConUnMostro'); } },
    { value: '!hero', get label() { return t('eventDialog.nonEConUnEroe'); } },
    { value: '!ground', get label() { return t('eventDialog.nonEATerra'); } },
    { value: '!monster', get label() { return t('eventDialog.nonEConUnMostro'); } },
  ];
  protected readonly lookOptions: SelectOption[] = PAWN_LOOKS.map((l) => ({ value: l.value, label: l.label }));
  protected readonly diceOptions: SelectOption[] = [
    { value: 'magic', get label() { return t('eventDialog.attaccoMagico'); } },
    { value: 'melee', get label() { return t('eventDialog.attaccoInMischia'); } },
    { value: 'ranged', get label() { return t('eventDialog.attaccoADistanza'); } },
  ];
  /** I due rami di una Prova. */
  protected readonly branches = [{ id: 'ok' as const, get label() { return t('eventDialog.seLaProvaESuperata'); } }, { id: 'ko' as const, get label() { return t('eventDialog.seLaProvaFallisce'); } }];
  protected readonly num = num;
  protected readonly isInt = isInt;

  protected readonly name = signal('');
  /** Gli inneschi: il primo e gli altri ("oppure"). */
  protected readonly triggers = signal<FormTrigger[]>([blankTrigger()]);
  protected readonly once = signal(false);
  protected readonly whereOptions = computed<SelectOption[]>(() => [{ value: '*', get label() { return t('eventDialog.nellaMappaIntera'); } }, ...this.areas()]);
  /** Le scelte ancora libere nell'elenco di un innesco "non c'è più nessuno": nemici, o segnalini incontro. */
  protected readonly freeChoicesOf = (t: FormTrigger) => (t.kind === 'encountersGone' ? this.encounters() : this.monsters()).filter((m) => !t.pieceIds.includes(m.value));
  protected readonly chipName = (t: FormTrigger, id: string) => (t.kind === 'encountersGone' ? (this.encounters().find((m) => m.value === id)?.label ?? '?') : this.monsterName(id));
  protected readonly monsterName = (id: string) => this.monsters().find((m) => m.value === id)?.label ?? '?';
  /** C'è un nemico dell'evento (sconfitto, o con cui si interagisce): gli effetti possono indicarlo con "il nemico dell'evento". */
  protected readonly hasThis = computed(() => this.triggers().some((t) => t.kind === 'defeated' || t.kind === 'interact'));
  protected readonly hasDefeated = computed(() => this.triggers().some((t) => t.kind === 'defeated'));
  /** I nemici fra cui scegliere in un effetto: quelli in mappa e, se c'è un nemico dell'evento, anche lui. */
  private readonly effectMonsters = computed<SelectOption[]>(() => (this.hasThis() ? [{ value: THIS_PIECE, get label() { return t('eventDialog.ilNemicoDellEvento'); } }, ...this.monsters()] : this.monsters()));
  protected readonly targetName = (id: string) => (id === THIS_PIECE ? translate('eventDialog.ilNemicoDellEvento') : this.monsterName(id));
  protected readonly targetChoices = (e: FormEffect) => this.effectMonsters().filter((m) => !e.pieceIds.includes(m.value));
  protected readonly conditions = signal<FormCondition[]>([]);
  protected readonly effectsThen = signal<FormEffect[]>([]);
  protected readonly effectsElse = signal<FormEffect[]>([]);
  protected readonly newVariable = signal('');

  protected readonly title = computed(() => (this.value() ? translate('eventDialog.p.modifyEvent') : translate('eventDialog.p.newEvent')));
  /** Un innesco riguarda un nemico (sconfitto, o con cui si interagisce) e non un'area o un oggetto. */
  private readonly onPiece = (t: FormTrigger) => t.kind === 'defeated' || t.kind === 'interact';
  protected readonly targetOptionsOf = (t: FormTrigger) => (t.kind === 'pickedUp' ? this.pickups() : t.kind === 'encounterUsed' ? this.encounters() : this.onPiece(t) ? this.monsters() : this.areas());
  protected readonly placeholderOf = (t: FormTrigger) => (t.kind === 'pickedUp' ? translate('common.scegliUnOggetto') : t.kind === 'encounterUsed' ? translate('eventDialog.p.phEncounter') : this.onPiece(t) ? translate('eventDialog.p.phEnemy') : translate('eventDialog.p.phArea'));
  protected readonly emptyHintOf = (t: FormTrigger) =>
    t.kind === 'pickedUp' ? translate('eventDialog.p.hintPickup') : t.kind === 'encounterUsed' ? translate('eventDialog.p.hintEncounter') : this.onPiece(t) ? translate('eventDialog.p.hintEnemy') : translate('eventDialog.p.hintArea');
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
    if (e.pieceIds.includes(THIS_PIECE) && !this.hasThis()) return translate('eventDialog.prob.thisPiece');
    switch (e.kind) {
      case 'message': return e.text.trim() ? '' : translate('eventDialog.prob.message');
      case 'progress': return num(e.amount) ? '' : translate('eventDialog.prob.progress');
      case 'setVariable': return e.variable ? '' : translate('eventDialog.prob.setVariable');
      case 'modifyMonster': return !e.pieceIds.length ? translate('eventDialog.prob.modifyPick') : ![e.wounds, e.speed, e.armor].every(isInt) || !(num(e.wounds) || num(e.speed) || num(e.armor)) ? translate('eventDialog.prob.modifyNumbers') : '';
      case 'revive': return num(e.turns) >= 1 && isInt(e.distance) && num(e.distance) >= 0 ? '' : translate('eventDialog.prob.revive');
      case 'finishRevival': return e.pieceIds.length ? '' : translate('eventDialog.prob.finishRevival');
      case 'activate': return e.pieceIds.length ? '' : translate('eventDialog.prob.activate');
      case 'removePiece': return e.pieceIds.length ? '' : translate('eventDialog.prob.removePiece');
      case 'makeVulnerable': return e.pieceIds.length ? '' : translate('eventDialog.prob.makeVulnerable');
      case 'placeItem': return e.rewardItem ? '' : translate('eventDialog.prob.placeItem');
      case 'moveItem': return e.rewardItem ? '' : translate('eventDialog.prob.moveItem');
      case 'give': return e.reward === 'key' ? (e.rewardKeyId.trim() ? '' : translate('eventDialog.prob.giveKey')) : e.reward === 'item' ? (e.rewardItem ? '' : translate('eventDialog.prob.giveItem')) : e.reward === 'coins' || e.reward === 'progress' ? (num(e.rewardAmount) >= 1 ? '' : translate('eventDialog.prob.giveAmount')) : '';
      case 'setBehavior': return !e.pieceIds.length ? translate('eventDialog.prob.setBehavior') : e.behavior === 'endNear' && !e.behaviorTarget ? translate('eventDialog.prob.setBehaviorTarget') : '';
      case 'setLook': return e.pieceIds.length ? '' : translate('eventDialog.prob.setLook');
      case 'removeImmunity': return e.pieceIds.length ? '' : translate('eventDialog.prob.removeImmunity');
      case 'openDoor': return e.doorId ? '' : translate('eventDialog.prob.openDoor');
      case 'check': {
        if (!e.text.trim()) return translate('eventDialog.prob.checkText');
        if (num(e.needs) < 1 || !isInt(e.needs)) return translate('eventDialog.prob.checkNeeds');
        for (const c of [...e.ok, ...e.ko]) {
          const p = this.effectProblem(c);
          if (p) return p;
        }
        return '';
      }
      case 'threat': return isInt(e.amount) && num(e.amount) !== 0 ? '' : translate('eventDialog.prob.threat');
      case 'drawCard': return isInt(e.amount) && num(e.amount) >= 1 ? '' : translate('eventDialog.prob.drawCard');
      case 'addEnding': return !isInt(e.endPoints) ? translate('eventDialog.prob.endingPoints') : !e.endText.trim() && num(e.endPoints) === 0 ? translate('eventDialog.prob.endingEmpty') : '';
      case 'win': return '';
    }
  }

  /** Cosa manca per confermare (vuoto se tutto va bene). */
  protected readonly problem = computed(() => {
    for (const t of this.triggers()) {
      if (t.kind !== 'cleared' && t.kind !== 'encountersGone' && t.kind !== 'overlordTurnEnd' && !t.target) return t.kind === 'pickedUp' ? translate('eventDialog.prob.pickObject') : t.kind === 'encounterUsed' ? translate('eventDialog.prob.pickEncounter') : this.onPiece(t) ? translate('eventDialog.prob.pickEnemy') : translate('eventDialog.prob.pickArea');
      if (t.kind === 'interact' && (!isInt(t.cost) || num(t.cost) < 0)) return translate('eventDialog.prob.interactCost');
    }
    if (this.conditions().some((c) => c.kind === 'variable' && !c.variable)) return translate('eventDialog.prob.condNoVar');
    if (this.conditions().some((c) => c.kind === 'item' && !c.item)) return translate('eventDialog.prob.condNoItem');
    if (!this.effectsThen().length) return translate('eventDialog.prob.noEffect');
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
