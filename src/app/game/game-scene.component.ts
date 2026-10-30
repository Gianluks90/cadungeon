import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  afterNextRender,
  inject,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Application, Container, Graphics } from 'pixi.js';
import {
  CAMERA_CENTER_MS,
  CAMERA_FOCUS_ZOOM,
  CAMERA_FOLLOW_SMOOTH_MS,
  CELL_SIZE,
  START_MARK,
  FX,
  CLICK_SLOP_PX,
  DEV_PLACEABLE_TILES,
  ICONS,
  OBSTACLE_VARIANTS,
  PAWN_RADIUS_RATIO,
  POTION_DRINK_COST,
  POTION_HEAL,
  POTION_PRICES,
  MAP_FIT_FILL,
  ZOOM_BUTTON_FACTOR,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_START,
  ZOOM_TRACKPAD_PINCH_BOOST,
  ZOOM_WHEEL_SENSITIVITY,
  CHECK_MAX_DICE,
} from './constants';
import { onThemeChange, readTokens, theme } from './theme';
import { Board, Cell, cellKey } from './board/board';
import type { Reach } from './board/movement';
import { DoorSpan, RuneColor } from './board/door';
import { Obstacle, obstacleCells } from './board/obstacle';
import { ObstacleView } from './obstacles/obstacle-view';
import { DoorView } from './doors/door-view';
import { preloadIcons } from './icons/icon-loader';
import { GameState } from './state/game-state';
import { VeilView } from './veil-view';
import { MarkerView } from './markers/marker-view';
import { ChestView } from './markers/chest-view';
import { StairsView } from './markers/stairs-view';
import { stairsWalls } from './markers/stairs-walls';
import { monsterTakesItem } from './state/behaviors';
import { PickupView } from './markers/pickup-view';
import { ActionChange, ContextAction, armorOf, killHero, transformToad, canActOnMap, contextActions, endOverlordTurn, explore, fatigueForMovement, inventoryOf, speedOf, adjacentHeroes, placeOrder, loseOrdersOnWounds } from './state/actions';
import { chooseMonsterTarget, planMonsterMove } from './state/overlord';
import { STATUS_NAMES, applyTurnStart, describeStatus } from './state/status';
import { SkillAction, skillActions, useSkill } from './state/skills';
import { RemovalResult, removeMonster } from './state/loot';
import { applyKnockback, knockbackCells, knockbackSteps, pushAway } from './state/knockback';
import { SETUP_PLAYERS, confirmReading, hasSetup, objectiveText, placeHero, startCells, startSetup } from './state/setup';
import * as cityRules from './state/city';
import { CityEvent } from '../ui/city-panel.component';
import { PanelKind } from '../ui/hero-panel.component';
import { MonsterDetails } from '../ui/monster-sheet.component';
import { AttackDialogComponent, AttackView } from '../ui/attack-dialog.component';
import { CatalogCategory, CatalogEntry, ComponentsDialogComponent } from '../ui/components-dialog.component';
import { MenuItem } from '../ui/logo-button.component';
import { ItemDef, itemDetail } from './items/item';
import { AttackOption, AttackPlan, Dir, applyAttack, areaVictims, attackOptions, breathDirTo, controlledAttackOptions, monsterAttackOption, planAttack, resolveAttack } from './state/combat';
import { POTION_NAMES } from './markers/marker-rules';
import { HeroAction, ORDER_NAMES, Piece, createPieces, footprint } from './pieces/piece';
import { PillComponent } from '../ui/pill.component';
import { LogoButtonComponent } from '../ui/logo-button.component';
import { CompassComponent } from '../ui/compass.component';
import { AdventureDialogComponent, AdventureView } from '../ui/adventure-dialog.component';
import { Torch, TorchView } from './torches/torch-view';
import { guardChances, vigilanceChances } from './state/vigilance';
import { turnEndItems, useTurnEndItem } from './state/turn-end-items';
import { itemUse, useItem } from './state/item-use';
import { rerollsFor } from './state/reroll';
import { cancelAmount, markReactionUsed, reactionBlock, woundReactions } from './state/reactions';
import { moveCells, telekinesisMoves, telekinesisTargets } from './state/telekinesis';
import { ChoiceDialogComponent, ChoiceView } from '../ui/choice-dialog.component';
import { DicePickerComponent, DicePickView } from '../ui/dice-picker.component';
import { OverlordPanelComponent } from '../ui/overlord-panel.component';
import { ActionControlsComponent } from '../ui/action-controls.component';
import { ZoomControlsComponent } from '../ui/zoom-controls.component';
import { ContextMenuComponent } from '../ui/context-menu.component';
import { Announcement, AnnounceComponent } from '../ui/announce.component';
import { MarkdownPipe } from '../ui/markdown.pipe';
import { Toast, ToastAuthor, ToastsComponent, noticeTitle } from '../ui/toasts.component';
import { BarMember, PartyBarComponent } from '../ui/party-bar.component';
import { HeroDetails } from '../ui/hero-sheet.component';
import { Marker, PotionKind, Stairs } from './board/marker';
import { DotGrid } from './dot-grid';
import { PlacedTile, loadMap } from './map/map-data';
import { MapBounds, mapBounds } from './map/map-view';
import { TilePlacer } from './map/tile-placer';
import { loadTileDef, tileCells } from './map/tile';
import { PiecesController } from './pieces/pieces-controller';
import { loadPortraits } from './pieces/portraits';
import { HeroSheet, loadAllHeroSheets, loadHeroSheets } from './heroes/hero-sheet';
import { loadItemCatalog, loadShopStock } from './items/item';
import { loadSkillCatalog } from './skills/skill';
import { MonsterDef, loadMonsterCatalog } from './monsters/monster';
import { loadOverlordCatalog } from './overlord/card';
import { cardOf, cardsLeft, inHand, overlordUpkeep, playEvent, playPowerCard, playSummonCard, threatPerTurn } from './state/overlord-deck';
import { ruleAmount } from './state/effects';
import { DieColor } from './items/item';
import { FaceRoll } from './dice/faces';
import { ArmedTrap, armTrap, consumeTrap, freeAdjacentCell, isBlank, trapDamageBonus, waves, woundIgnoringArmor } from './state/traps';
import { isDormant, revealArea } from './state/areas';
import { PendingCheck, armCleared, checkCleared, checkDiceCount, refuseCheck, resolveCheck } from './state/events';
import { inflictStatus, keywordLevel } from './state/status';
import { DiceService } from './dice/dice.service';

type Point = { x: number; y: number };

/** I nomi dei colori delle chiavi runiche, per gli avvisi. */
const RUNE_NAMES = { red: 'rossa', blue: 'blu', green: 'verde' } as const;

/** Cosa dire quando un'azione in città non va a buon fine. */
const CITY_TEXTS: Record<string, string> = {
  soon: 'Presto disponibile', late: 'Devi tornare nel dungeon', coins: 'Non hai abbastanza monete', full: 'Non hai posto', 'sold-out': 'Esaurito', stock: 'Esaurito', already: 'Hai già scelto un servizio',
  'full-health': 'Sei già in piena salute', 'not-yet': 'Potrai tornare nel dungeon al prossimo turno', occupied: 'Quel glifo non è libero', busy: 'Ora non puoi',
  'wrong-service': 'Prima scegli questo servizio', maxed: 'Hai già il massimo di dadi', locked: 'Apri prima uno scrigno di quel tipo', none: 'Non hai questo oggetto', unknown: 'Non è possibile',
};

type Mode = 'play' | 'tiles' | 'doors' | 'obstacles';

const HINTS: Record<Mode, string> = {
  play: '', // i comandi di gioco stanno nel pannello "?"
  tiles: 'R ruota · T cambia tile · clic piazza · Backspace annulla · P: torna a giocare',
  doors: 'Clic: piazza o togli una porta · D: torna a giocare',
  obstacles: 'R ruota · T cambia ostacolo · clic piazza o togli · O: torna a giocare',
};

@Component({
  selector: 'app-game-scene',
  imports: [PillComponent, LogoButtonComponent, ZoomControlsComponent, ActionControlsComponent, AdventureDialogComponent, ChoiceDialogComponent, DicePickerComponent, OverlordPanelComponent, PartyBarComponent, ContextMenuComponent, ToastsComponent, AnnounceComponent, AttackDialogComponent, ComponentsDialogComponent, MarkdownPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--footer-height]': "hint() ? '30px' : '0px'" },
  template: `
    <div #host class="host"></div>
    <app-toasts [toasts]="toasts()" (expired)="expireToast($event)" />
    <app-announce [message]="announcement()" [durationMs]="announceMs" />
    <app-context-menu [anchor]="contextAnchor()" [actions]="contextActions()" (chosen)="runContext($event)" (denied)="showNotice($event, 'warning')" />
    <!-- Il menu dell'attacco: compare sopra il nemico toccato, già aperto, con le armi che si possono usare. -->
    <app-context-menu [anchor]="attackAnchor()" [actions]="attackActions()" [autoOpen]="true" bangIcon="swords" (chosen)="startAttack($event)" (denied)="showNotice($event, 'warning')" (closed)="closeAttackMenu()" />
    <app-attack-dialog [view]="attackView()" (aim)="aimChosen()" (reroll)="rerollChosen($event)" (roll)="rollAttack()" (apply)="applyAttackNow()" (autoDone)="applyAttackNow()" (addDie)="addPowerDie()" [adding]="addingDie()" (cancel)="cancelAttack()" (choose)="chooseFace($event)" (use)="useEffect($event)" (reset)="resetEffects()" (sorceryStep)="sorceryStep($event)" />
    <!-- I testi dell'avventura: introduzione e obiettivo all'inizio (si confermano), l'obiettivo si rilegge dal suo tasto. -->
    <app-adventure-dialog [view]="adventureDialog()" (confirm)="onAdventureDialog()" />
    <app-choice-dialog [view]="choiceView()" (chosen)="onChoice($event)" />
    <app-dice-picker [view]="dicePickView()" (done)="onDicePicked($event)" />
    @if (setupPrompt(); as prompt) { <div class="setup-prompt" role="status">{{ prompt }}</div> }
    <app-components-dialog [open]="componentsOpen()" [categories]="catalog()" (closed)="componentsOpen.set(false)" />
    @if (telekinesis(); as t) {
      <div class="knockback" role="status">Telecinesi: {{ t.step === 'model' ? 'tocca uno dei modelli evidenziati per spostarlo di 1 spazio' : 'tocca la casella dove spostarlo' }}<button type="button" (click)="cancelTelekinesis()">Annulla</button></div>
    }
    @if (knockback(); as k) {
      <div class="knockback" role="status">Contraccolpo: tocca una casella evidenziata per spostare {{ k.name }} (fino a 3 spazi)<button type="button" (click)="chooseKnockback(null)">Resta fermo</button></div>
    }
    @if ((victory() || defeated()) && !endDismissed()) {
      <div class="end" role="dialog" aria-modal="true" [attr.aria-label]="victory() ? 'Vittoria' : 'Sconfitta'">
        <div class="end-box">
          <h2>{{ victory() ? 'Vittoria!' : 'Sconfitta' }}</h2>
          @if (victory()) { <p class="reward">Conquista finale: {{ progress() }}</p> }
          @if (victory() && conclusion()) { <div class="md" [innerHTML]="conclusion() | markdown"></div> } @else { <p>{{ endText() }}</p> }
          <div class="end-actions">
            <button type="button" (click)="endDismissed.set(true)">Guarda la mappa</button>
            <button type="button" class="strong" (click)="restart()">Ricomincia</button>
          </div>
        </div>
      </div>
    }
    <div class="top">
      <app-logo-button [items]="menuItems" (chosen)="onMenu($event)" />
      @if (defeated()) { <app-pill icon="skull" label="Sconfitta" class="alert" /> }
    </div>
    <!-- Contatori sul bordo sinistro (come i comandi della camera sul destro): solo icona e valore, l'etichetta si apre al passaggio. -->
    <div class="rail">
      <app-pill rail primary icon="brightness_empty" label="Conquista" [value]="progress()" [class.alert]="defeated()" />
      <app-pill rail primary icon="autorenew" label="Round" [value]="round()" />
      <app-pill rail icon="tokens/little_key" label="Chiavi" [value]="keys()" />
    </div>
    @if (barsIn()) { <app-overlord-panel [slots]="heroSlots()" [hasObjective]="hasObjective()" (objective)="showObjective()" [view]="overlordView()" [playing]="overlordBusy()" [threat]="threat()" [deck]="deckLeft()" [hand]="handCount()" (toggle)="toggleOverlordView()" /> }
    @if (barsIn()) { <app-party-bar [members]="members()" [panel]="panel()" [monster]="monsterInfo()" [passBusy]="commandsBusy()" (pass)="tapCommand('pass')" (spendFatigue)="spendFatigueForMove()" (skillUse)="useSkillAction($event)" (monsterClosed)="monsterPanel.set(null)" (selected)="selectFromBar($event)" (info)="togglePanel($event, 'info')" (inventory)="togglePanel($event, 'inventory')" (city)="togglePanel($event, 'city')" (cityAction)="onCityAction($event)" (denied)="showReason($event)" (sheetClosed)="panel.set(null)" (panelSwitch)="switchPanel($event)" (itemAction)="onItemAction($event)" /> }
    <!-- Footer temporaneo: tiene i comandi a schermo fuori dalla barra degli eroi. -->
    @if (hint()) { <footer class="footer keyboard-hints"><p class="hint">{{ hint() }}</p></footer> }
    @if (barsIn() && !settingUp()) { <app-action-controls [slots]="heroSlots()" [runes]="runes()" [action]="activeAction()" [busy]="commandsBusy()" (chosen)="tapCommand($event)" /> }
    <app-zoom-controls (zoom)="zoomByButton($event)" (center)="centerOnActive()" (fit)="showWholeMap()" />
  `,
  styles: `
    :host { position: fixed; inset: 0; display: block; overflow: hidden; }
    .host { position: absolute; inset: 0; touch-action: none; }
    .footer {
      position: absolute; z-index: 5; left: 0; right: 0; bottom: 0; box-sizing: border-box; overflow: hidden;
      height: calc(var(--footer-height) + env(safe-area-inset-bottom)); padding: 0 16px env(safe-area-inset-bottom);
      display: flex; align-items: center; justify-content: center; text-align: center;
      background: var(--c-surface); border-top: 1px solid var(--c-line-strong);
      pointer-events: none; user-select: none;
    }
    .hint { margin: 0; font: 12px/1.35 var(--font-ui); color: var(--c-text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* La schermata finale: vittoria o sconfitta */
    .end { position: fixed; inset: 0; z-index: 850; display: grid; place-items: center; padding: 12px; background: rgba(0, 0, 0, 0.6); animation: end-in 0.3s ease-out; }
    .end-box { display: flex; flex-direction: column; gap: 12px; align-items: center; text-align: center; max-width: 420px; padding: 28px 32px; border-radius: var(--radius-1); background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-text); font: 14px/1.4 var(--font-ui); }
    .end-box .reward { color: var(--c-text); font-weight: 600; }
    .end-box .md { color: var(--c-text-dim); text-align: left; max-height: 50vh; overflow-y: auto; }
    .end-box h2 { margin: 0; font: 600 22px/1.2 var(--font-ui); letter-spacing: 0.12em; text-transform: uppercase; }
    .end-box p { margin: 0; color: var(--c-text-dim); }
    .end-actions { display: flex; gap: 10px; margin-top: 6px; }
    .end-actions button { padding: 8px 18px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; border: 1px solid var(--c-line-strong); font: 13px/1.2 var(--font-ui); }
    .end-actions button.strong { border-color: var(--c-interact); font-weight: 600; }
    .end-actions button:hover { border-color: var(--c-interact); color: var(--c-interact); }
    @keyframes end-in { from { opacity: 0; } }
    /* Contraccolpo: la barra in basso al centro (sopra i tab) che dice cosa fare; in alto al centro ci sono le notifiche */
    /* La scelta della casella di partenza: la barra in alto al centro che dice cosa fare */
    .setup-prompt { position: absolute; z-index: 12; top: calc(12px + env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); padding: 8px 14px; border-radius: var(--radius-1); background: var(--c-surface); border: 1px solid var(--c-interact); color: var(--c-text); font: 13px/1.3 var(--font-ui); max-width: calc(100vw - 24px); text-align: center; pointer-events: none; }
    .knockback { position: absolute; z-index: 12; bottom: calc(var(--footer-height, 0px) + env(safe-area-inset-bottom) + 12px + 76px + 28px); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 8px 14px; border-radius: var(--radius-1); background: var(--c-surface); border: 1px solid var(--c-interact); color: var(--c-text); font: 13px/1.3 var(--font-ui); max-width: calc(100vw - 24px); }
    .knockback button { padding: 4px 12px; border-radius: var(--radius-1); background: none; color: var(--c-text); cursor: pointer; border: 1px solid var(--c-line-strong); font: 12px/1.2 var(--font-ui); }
    .knockback button:hover { border-color: var(--c-interact); color: var(--c-interact); }
    @media (max-width: 720px) { .top { max-width: calc(100% - 232px) !important; } }
    .rail { position: absolute; z-index: 22; left: 12px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: flex-start; gap: 8px; pointer-events: none; }
    .rail app-pill { box-sizing: border-box; min-width: 72px; }
    .top { max-width: calc(100% - 356px); z-index: 30; /* sopra il menu contestuale (20) e la barra (25): il pannello della guida si apre da qui */ position: absolute; top: calc(12px + env(safe-area-inset-top)); left: 12px; display: flex; flex-wrap: wrap; gap: 8px; pointer-events: none; }
  `,
})
export class GameSceneComponent implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly route = inject(ActivatedRoute);
  private readonly dice = inject(DiceService);
  private readonly hostRef = viewChild.required<ElementRef<HTMLDivElement>>('host');

  private app?: Application;
  private world?: Container; // qui dentro andranno tile e pedine
  private placer?: TilePlacer; // strumento di sviluppo: piazza tile agganciandoli
  private pieces?: PiecesController;
  private placed: PlacedTile[] = []; // i tile della mappa (lo strumento di piazzamento ne aggiunge)
  private mode: Mode = 'play';
  private board?: Board;
  /** Lo stato della partita: porte, ostacoli, segnalini, pedine, gruppo, ciò che si è visto. */
  private state = GameState.empty();
  private get doors() { return this.state.doors; }
  private get obstacles() { return this.state.obstacles; }
  private get markers() { return this.state.markers; }
  private get party() { return this.state.party; }
  private get exploration() { return this.state.exploration; }
  private get pieceList() { return this.state.pieces; }
  private doorView?: DoorView;
  private markerView?: MarkerView;
  private chestView?: ChestView;
  private stairsView?: StairsView;
  private pickupView?: PickupView;
  private veil?: VeilView;
  private obstacleView?: ObstacleView;
  private obstacleVariant = 0; // quale tipo e lunghezza si sta piazzando
  private obstacleVertical = false;
  private toastId = 0;
  private readonly toastTimers = new Set<ReturnType<typeof setTimeout>>();
  protected readonly hint = signal(HINTS.play);
  protected readonly progress = signal(0);
  /** La Minaccia dell'Overlord (si vede solo nella sua vista) e le carte che restano nel suo mazzo (si vedono sempre). */
  protected readonly threat = signal(0);
  protected readonly deckLeft = signal(0);
  protected readonly handCount = signal(0);
  protected readonly round = signal(1);
  protected readonly defeated = signal(false);
  /** L'avventura è vinta (l'obiettivo è raggiunto); la schermata finale si può chiudere per guardare la mappa. */
  protected readonly victory = signal(false);
  protected readonly endDismissed = signal(false);
  /** Il testo di conclusione dell'avventura (markdown), se l'autore l'ha scritto. */
  protected conclusion(): string {
    return [this.state.objective?.conclusion ?? '', ...this.state.endingExtras.map((x) => x.text)].filter((t) => t.trim()).join('\n\n'); // la conclusione e, dopo, i pezzi aggiunti dagli eventi
  }
  protected endText(): string {
    return this.victory() ? (this.state.objective?.text ? `Obiettivo raggiunto: ${this.state.objective.text}.` : "L'obiettivo dell'avventura è raggiunto.") : 'La Conquista è arrivata a zero: gli eroi hanno perso.';
  }
  protected restart() {
    location.reload();
  }
  protected readonly keys = signal(0);
  /** Il denaro: ogni eroe ne ha questa quantità. */
  /** Le chiavi runiche presenti nella partita (al massimo 3): colorate quando il gruppo le ha, altrimenti spente. */
  protected readonly runes = signal<{ color: RuneColor; owned: boolean; label: string }[]>([]);
  protected readonly members = signal<BarMember[]>([]);
  /** Quanti eroi ha la partita, anche quelli ancora da parte durante la preparazione: serve a dimensionare il blocco del Signore supremo fin dall'inizio. */
  protected readonly heroSlots = signal(2);
  /** La barra degli eroi, il blocco del Signore supremo e i comandi compaiono (con uno scorrimento) solo a preparazione finita. */
  protected readonly barsIn = signal(false);
  /** Il pannello aperto (informazioni o inventario) dal tab di un eroe, se ce n'è uno. */
  protected readonly panel = signal<{ id: string; kind: PanelKind } | null>(null);
  /** La vista Overlord (provvisoria: toccando il tab dell'Overlord): si vedono tutti i mostri e toccandone uno si apre la sua scheda. I giocatori non conoscono i parametri dei nemici. */
  protected readonly overlordView = signal(false);
  /** Il menu dell'app (dal logo). Le prime due voci sono segnaposto. */
  protected readonly menuItems: MenuItem[] = [
    { id: 'settings', label: 'Impostazioni' },
    { id: 'quit', label: 'Concludi partita' },
    { id: 'components', label: 'Componenti' },
  ];
  /** Il catalogo dei componenti di gioco: aperto dal menu, costruito dai cataloghi caricati. */
  protected readonly componentsOpen = signal(false);
  protected readonly catalog = signal<CatalogCategory[]>([]);
  /** Il catalogo dei mostri caricato all'avvio (per il catalogo dei componenti). */
  /** Nome e testo delle aree dell'avventura (dalla mappa). */
  private areaInfo = new Map<string, { name?: string; subtitle?: string; text?: string }>();
  private monsterDefs: ReadonlyMap<string, MonsterDef> = new Map();
  /** Il nemico toccato per attaccarlo (il menu delle armi è aperto sopra di lui) e le armi che si possono usare. */
  protected readonly attackTarget = signal<string | null>(null);
  protected readonly attackActions = signal<ContextAction[]>([]);
  protected readonly attackAnchor = signal<{ x: number; y: number } | null>(null);
  /** L'attacco in corso nella finestra al centro: arma scelta, piano, tiro e scelte. */
  protected readonly attackSession = signal<{
    attackerId: string; targetId: string; option: AttackOption; plan: AttackPlan;
    step: 'preview' | 'rolling' | 'rolled'; rolls: FaceRoll[]; choices: Record<number, 'range' | 'heart'>; spent: number[];
    /** Stregoneria: i punti scelti dopo il tiro per la gittata e per il danno. */
    sorcery: { range: number; damage: number };
    /** Lo gioca lo script dell'Overlord: i dadi li tira lui e chi guarda può solo proseguire. */
    auto?: boolean;
    /** Soffio: la direzione del cono. */
    breathDir?: Dir | null;
    /** Mira: l'eroe ha l'ordine e può ripetere dei dadi (uno solo ripete per attacco: vale anche per Occhio del cacciatore). */
    aim?: boolean;
    /** Quanti dadi si possono ancora ripetere scegliendo (Occhio del cacciatore) e chi lo permette. */
    rerolls?: number;
    rerollSource?: string;
    /** Un attacco fuori turno (Vigilanza): non consuma gli attacchi dell'eroe, e la fatica si paga quando lo si applica. */
    free?: { pay: number; consumeOrder?: boolean };
  } | null>(null);
  /** È il turno dell'Overlord (lo script): niente comandi per gli eroi. */
  protected readonly overlordBusy = signal(false);
  protected readonly attackView = computed<AttackView | null>(() => {
    const se = this.attackSession();
    const attacker = this.state?.pieces.find((p) => p.id === se?.attackerId);
    const target = this.state?.pieces.find((p) => p.id === se?.targetId);
    if (!se || !attacker || !target) return null;
    const outcome = se.step === 'rolled' ? resolveAttack(this.state, target, se.plan, se.rolls, se.choices, se.spent, se.sorcery) : null;
    const side = (p: Piece) => ({ name: p.name, subtitle: p.team === 'hero' ? p.heroClass : p.enhanced ? 'Mostro potenziato' : 'Mostro', portrait: p.portraitFull ?? p.portrait, team: p.team, enhanced: p.enhanced, wounds: p.wounds, maxWounds: p.maxWounds });
    return {
      attacker: side(attacker),
      target: { ...side(target), armor: target.team === 'hero' ? armorOf(this.state, target, se.option.attack) : target.armor, invincible: !!target.invincible },
      auto: !!se.auto,
      weapon: { lead: attacker.team === 'monster' ? 'Attaccante' : 'Arma utilizzata', name: se.option.name, icon: se.option.icon, attackLabel: { melee: 'in mischia', ranged: 'a distanza', magic: 'magico' }[se.option.attack], dice: se.option.dice },
      distance: se.plan.distance, needsRange: se.plan.needsRange, bonuses: se.plan.sources, step: se.step,
      fatigue: attacker.fatigue, blackDice: se.rolls.filter((r) => r.color === 'black').length,
      rolls: se.rolls.map((r, i) => ({ ...r, choice: se.choices[i] ?? null })),
      rerolls: se.step === 'rolled' && !se.auto && !this.rerolling() ? (se.rerolls ?? 0) : 0, rerollSource: se.rerollSource ?? '', aim: se.step === 'rolled' && !se.auto && !!se.aim && !this.rerolling(),
      effects: se.plan.effects.map((e) => ({
        index: e.index, cost: e.cost, text: e.text, supported: e.supported, count: se.spent.filter((i) => i === e.index).length,
        usable: e.supported && !!outcome && e.cost <= outcome.surges - outcome.surgesSpent,
      })),
      sorcery: { level: se.plan.sorcery, ...se.sorcery },
      victims: outcome && !outcome.miss && outcome.inRange && !outcome.feared && this.board
        ? areaVictims(this.state, this.board, attacker, target, se.plan, se.spent, se.breathDir).map((v) => ({
            name: v.name, friend: v.team === attacker.team,
            damage: resolveAttack(this.state, v, { ...se.plan, fearless: true }, se.rolls, se.choices, se.spent, se.sorcery).damage,
          }))
        : [],
      outcome,
    };
  });
  protected readonly monsterPanel = signal<string | null>(null);
  protected readonly monsterInfo = computed<MonsterDetails | null>(() => {
    void this.members(); // si ricalcola a ogni cambio dello stato (ferite, ecc.)
    const p = this.state?.pieces.find((q) => q.id === this.monsterPanel() && q.team === 'monster');
    if (!p) return null; // le carte dei mostri sono pubbliche: la scheda si apre anche nella vista dei giocatori
    const attack = p.attackType ? { melee: 'Mischia', ranged: 'Distanza', magic: 'Magia' }[p.attackType] : '—';
    return {
      id: p.id, name: p.name, heroClass: p.enhanced ? 'Mostro potenziato' : 'Mostro', enhanced: p.enhanced, portrait: p.portrait, portraitFull: p.portraitFull,
      wounds: p.wounds, maxWounds: p.maxWounds, speed: p.speed, armor: p.armor, invincible: !!p.invincible, attack, dice: p.attackDice, abilities: p.traits, size: `${p.size.w}×${p.size.h}`, states: describeStatus(p.status), poison: p.status.poison,
    };
  });
  /** Un eroe in città sta scegliendo il glifo su cui tornare: i glifi possibili emettono l'onda e un clic su uno lo fa tornare. */
  private readonly returnMode = signal(false);
  private noGlyphFor = '';
  protected readonly toasts = signal<Toast[]>([]);
  protected readonly contextActions = signal<ContextAction[]>([]);
  /** Il punto sullo schermo appena sopra la pedina attiva, dove sta il bottone contestuale. */
  protected readonly contextAnchor = signal<{ x: number; y: number } | null>(null);
  private dots?: DotGrid;
  private destroyed = false;
  private cleanup: Array<() => void> = [];

  // Camera: dove cade l'origine del mondo sullo schermo (pixel CSS) e quanto è ingrandito.
  private camX = 0;
  private camY = 0;
  private zoom = ZOOM_START;
  private mapBox?: MapBounds;

  // Dita/mouse attualmente premuti (per pan e pinch).
  private pointers = new Map<number, Point>();
  private lastPinchDistance = 0;
  private mouse: Point | null = null; // ultima posizione del mouse sul canvas
  private downPos: Point | null = null; // dove è stato premuto il tasto, per distinguere clic e trascinamento

  constructor() {
    this.dice.onResult = (text) => this.showNotice(text, 'deployed_code'); // prova temporanea: il risultato dei dadi toccati sulle card
    afterNextRender(() => {
      // Pixi lavora fuori da Angular, così i suoi eventi non scatenano controlli inutili.
      this.zone.runOutsideAngular(() => this.start());
    });
  }

  private async start() {
    readTokens(); // i fogli di stile sono già caricati: rilegge i token per essere sicuri
    const host = this.hostRef().nativeElement;
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: theme.color.background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: 'webgl',
    });
    if (this.destroyed) {
      app.destroy(true);
      return;
    }
    this.app = app;
    host.appendChild(app.canvas);

    // Pixi segue solo l'evento "resize" della finestra: se il contenitore cambia misura senza (per esempio durante un ricaricamento) il canvas resta della misura sbagliata. Si osserva il contenitore.
    const sizeWatch = new ResizeObserver(() => app.queueResize());
    sizeWatch.observe(host);
    this.cleanup.push(() => sizeWatch.disconnect());

    this.dots = new DotGrid();
    // Al cambio di tema si ridisegna tutto (oggi c'è un solo tema, ma la struttura resta).
    this.cleanup.push(onThemeChange(() => this.applyTheme()));
    this.world = new Container();
    app.stage.addChild(this.dots.mesh, this.world);

    // All'inizio l'origine del mondo sta al centro dello schermo.
    this.camX = app.screen.width / 2;
    this.camY = app.screen.height / 2;
    this.applyCamera();

    // Mappa di prova: tile piazzati a mano (public/maps/prova.json).
    // La mappa viene dall'indirizzo (/gioca/catalogo mostra tutti i tile del catalogo).
    const mapName = this.route.snapshot.paramMap.get('mappa')?.replace(/[^a-z0-9-]/g, '') || 'prova';
    this.mapName = mapName;
    await preloadIcons([ICONS.doorKey, ICONS.doorEvent, ICONS.doorRune, ICONS.potion, ICONS.runeKey, ICONS.keyPickup]); // le icone delle porte e della pozione; quelle che mancano usano una forma di riserva
    try {
      const { data, placed } = await loadMap(`maps/${mapName}.json`);
      const defs = await Promise.all(DEV_PLACEABLE_TILES.map(loadTileDef));
      if (this.destroyed) return;
      const mapLayer = new Container();
      const pawnLayer = new Container();
      this.doorView = new DoorView();
      this.obstacleView = new ObstacleView(data.seed);
      this.veil = new VeilView();
      this.torchView = new TorchView();
      this.torches = data.torches ?? [];
      this.markerView = new MarkerView(data.seed);
      this.chestView = new ChestView();
      this.stairsView = new StairsView();
      this.pickupView = new PickupView(data.seed);
      this.pickupView.iconOf = (id) => this.state?.items.get(id)?.icon;
      // Il velo sta sopra mappa, ostacoli e porte (così li spegne se non sono ancora esplorati) e sotto le pedine.
      this.world.addChild(mapLayer, this.markerView.container, this.stairsView.container, this.chestView.container, this.pickupView.container, this.obstacleView.container, this.doorView.container, this.torchView.container, this.veil.graphics, pawnLayer);
      this.placed = placed;
      // Pedine dalla mappa; senza, parte un solo eroe al centro del primo tile.
      const start = this.startCell(placed);
      const sheets = await loadHeroSheets((data.pieces ?? []).map((p) => p.hero));
      const [items, shopStock, skills, monsters, overlordCards] = await Promise.all([loadItemCatalog(), loadShopStock('city'), loadSkillCatalog(), loadMonsterCatalog(), loadOverlordCatalog()]);
      this.monsterDefs = monsters;
      this.areaInfo = new Map((data.areas ?? []).map((a) => [a.id, a]));
      this.state = GameState.fromMap(data, [{ id: 'h1', name: 'Eroe 1', team: 'hero', x: start.x, y: start.y }], sheets, items, shopStock, skills, monsters, overlordCards);
      this.placer = new TilePlacer(data.seed, placed, defs, mapLayer);
      // La cella di un glifo è liscia: niente crepe né altri dettagli ambientali.
      // ...e così le caselle con un segnalino o un ostacolo: niente crepe né ragnatele. Intorno alle rocce cadono sassi e detriti, ma non in acqua, in buche o sui glifi.
      const keyOf = (c: Cell) => `${c.x},${c.y}`;
      this.placer.setNoCrackCells(new Set([...this.markers.map(keyOf), ...this.obstacles.flatMap((o) => obstacleCells(o).map(keyOf))]));
      this.placer.setScenery({
        rocks: new Set(this.obstacles.filter((o) => o.type === 'rock').flatMap((o) => obstacleCells(o).map(keyOf))),
        noPebbles: new Set([...this.obstacles.filter((o) => o.type !== 'rock').flatMap((o) => obstacleCells(o).map(keyOf)), ...this.markers.filter((m) => m.type === 'glyph').map(keyOf)]),
      });
      const portraits = await loadPortraits(this.state.pieces.map((p) => p.portrait));
      // Con una preparazione (introduzione o caselle di partenza) gli eroi entrano in campo solo alla fine: intanto restano da parte.
      if (hasSetup(data)) this.setUpAdventure();
      this.startLayer = new Graphics();
      this.world.addChild(this.startLayer);
      this.pieces = new PiecesController(
        pawnLayer,
        app.ticker,
        this.state,
        (a) => this.showHud(a),
        (text, icon) => this.showNotice(text, icon),
        portraits,
      );
      // Dopo ogni passo di un eroe si ricalcola cosa vede il gruppo; se compare un mostro, il movimento si ferma.
      this.markerView!.stateProvider = () => this.glyphState();
      this.pieces.onMonsterClick = (piece) => {
        if (!this.overlordView()) {
          this.selectAttackTarget(piece); // i giocatori non vedono i parametri dei nemici: toccandolo si attacca
          return;
        }
        this.panel.set(null); // un solo pannello alla volta
        this.monsterPanel.set(piece.id);
      };
      this.pieces.onMonsterStep = (m, before) => !!this.board && (vigilanceChances(this.state, this.board, m, before).length > 0 || guardChances(this.state, this.board, m, this.guardDeclined).length > 0) && ((this.vigilanceFrom = before), true);
      this.pieces.onDied = (piece) => {
        this.showNotice(`${piece.name} è morto: il gruppo perde ${piece.value} di Conquista e torna dalla città`, 'skull');
        this.pass();
      };
      this.pieces.onStepped = (_piece, outcome) => {
        // Entrando in una casella un eroe può aver acceso un glifo o raccolto un oggetto (anche solo passandoci sopra).
        const event = outcome.marker;
        if (event) {
          this.showNotice(event.notice, this.markerIcon(event.marker));
          if (event.kind === 'picked-up') this.pickupView?.redraw(this.board!, (m) => !this.fogOn() || this.exploration.markers.has(m));
        }
        this.afterDrop(outcome.drop);
        if (outcome.opened?.length) this.monsterOpenedDoors(_piece, outcome.opened);
        if (outcome.trap && _piece.team === 'hero') {
          void this.resolveTrap(_piece, outcome.trap); // una trappola armata scatta: il movimento si ferma
          return true;
        }
        return this.exploreAndNotify();
      };
      this.rebuildBoard();
      this.hasObjective.set(!!this.state.objective);
      this.mapBox = mapBounds(placed);
      this.fitToBounds(this.mapBox);
      this.loadSavedCamera(); // l'inquadratura che il giocatore aveva l'ultima volta
      if (this.state.setup) this.nextSetupStep();
      else this.barsIn.set(true); // senza preparazione la partita è già pronta
      if (!this.state.setup && this.state.objective) this.showNotice(`Obiettivo: ${this.state.objective.text ?? 'sconfiggi il boss'}`, 'brightness_empty', 'game');
    } catch (err) {
      console.error('Impossibile caricare la mappa di prova', err);
      this.barsIn.set(true);
    }

    // Quando la finestra cambia, il punto al centro resta al centro.
    app.renderer.on('resize', (w: number, h: number) => {
      this.camX += (w - this.lastW) / 2;
      this.camY += (h - this.lastH) / 2;
      this.applyCamera();
    });
    this.lastW = app.screen.width;
    this.lastH = app.screen.height;

    app.ticker.add((t) => {
      this.doorView?.tick(t.deltaMS);
      this.veil?.tick(t.deltaMS);
      this.markerView?.tick(performance.now(), t.deltaMS);
      this.chestView?.tick(t.deltaMS);
      this.obstacleView?.tick(t.deltaMS);
      this.torchView?.tick(t.deltaMS);
      this.tickStartLayer(t.deltaMS);
      this.tickCameraTween(t.deltaMS);
      this.followMovingPawn(t.deltaMS);
      this.updateContextAnchor();
    });
    this.bindInput(app.canvas);
  }

  private lastW = 0;
  /** L'utente ha trascinato o zoomato durante un movimento: la camera non segue più la pedina fino alla fine del movimento. */
  private followSuppressed = false;
  /** Lo scorrimento in corso della camera verso l'eroe, con pan e zoom (si interrompe se l'utente trascina o zooma). */
  private camTween?: { fromZoom: number; toZoom: number; from: Point; to: Point; elapsed: number; /** Durata (se manca, quella del tasto centra). */ ms?: number };
  private lastH = 0;

  /** Il tema è cambiato: sfondo, puntini, mappa, porte, ostacoli e pedine riprendono i colori nuovi. */
  private applyTheme() {
    if (!this.app) return;
    this.app.renderer.background.color = theme.color.background;
    this.dots?.applyTheme();
    this.placer?.refresh();
    this.pieces?.applyTheme();
    if (this.board) this.rebuildBoard();
  }

  private applyCamera() {
    const app = this.app!;
    this.world!.position.set(this.camX, this.camY);
    this.world!.scale.set(this.zoom);
    this.refreshHover();
    this.dots!.update(app.screen.width, app.screen.height, this.camX, this.camY, this.zoom, app.renderer.resolution);
    this.lastW = app.screen.width;
    this.lastH = app.screen.height;
    if (!this.cameraScripted) this.rememberCamera();
  }

  // --- La camera di chi gioca: si ricorda a ogni cambiamento (e si salva nel localStorage) e ci si torna dopo le inquadrature automatiche ---

  private mapName = 'prova';
  /** La camera dell'utente: il centro (in pixel del mondo) e lo zoom. Non cambia mentre la muove lo script (turno dell'Overlord). */
  private userCam: { x: number; y: number; zoom: number } | null = null;
  private cameraScripted = false;
  private camSaveTimer?: ReturnType<typeof setTimeout>;

  private rememberCamera() {
    const app = this.app;
    if (!app) return;
    this.userCam = { x: (app.screen.width / 2 - this.camX) / this.zoom, y: (app.screen.height / 2 - this.camY) / this.zoom, zoom: this.zoom };
    clearTimeout(this.camSaveTimer);
    this.camSaveTimer = setTimeout(() => {
      try { localStorage.setItem(`cad-camera:${this.mapName}`, JSON.stringify(this.userCam)); } catch { /* storage non disponibile: vale solo per questa sessione */ }
    }, 400);
  }

  /** Ripristina la camera salvata per questa mappa (se c'è e ha senso). */
  private loadSavedCamera() {
    const app = this.app;
    if (!app) return;
    try {
      const raw = localStorage.getItem(`cad-camera:${this.mapName}`);
      const c = raw ? JSON.parse(raw) : null;
      if (!c || ![c.x, c.y, c.zoom].every(Number.isFinite) || c.zoom < ZOOM_MIN || c.zoom > ZOOM_MAX) return;
      this.zoom = c.zoom;
      this.camX = app.screen.width / 2 - c.x * c.zoom;
      this.camY = app.screen.height / 2 - c.y * c.zoom;
      this.applyCamera();
    } catch { /* niente storage o dati rovinati: resta l'inquadratura iniziale */ }
  }

  /**
   * Nel turno dell'Overlord, quando un mostro attacca un eroe: la camera si adatta (pan e, se serve, zoom indietro) perché entrambe le pedine stiano
   * nell'area libera dello schermo (sotto i contatori e sopra la barra degli eroi). Se ci stanno già, non si muove.
   */
  private async frameBoth(a: Piece, b: Piece) {
    await this.frameCells([...footprint(a), ...footprint(b)]);
  }

  /** Come `frameBoth`, per delle caselle qualunque (una scala e la pedina vicina, per esempio). */
  private async frameCells(cells: Cell[]) {
    const app = this.app;
    if (!app) return;
    const pad = 1; // una casella di respiro
    const x0 = (Math.min(...cells.map((c) => c.x)) - pad) * CELL_SIZE;
    const x1 = (Math.max(...cells.map((c) => c.x)) + 1 + pad) * CELL_SIZE;
    const y0 = (Math.min(...cells.map((c) => c.y)) - pad) * CELL_SIZE;
    const y1 = (Math.max(...cells.map((c) => c.y)) + 1 + pad) * CELL_SIZE;
    const m = { top: 96, bottom: 150, left: 24, right: 24 }; // l'interfaccia: contatori e blocco del Signore supremo in alto, barra degli eroi in basso
    const sw = app.screen.width, sh = app.screen.height;
    const vw = sw - m.left - m.right, vh = sh - m.top - m.bottom;
    const sx = (wx: number) => this.camX + wx * this.zoom;
    const sy = (wy: number) => this.camY + wy * this.zoom;
    if (sx(x0) >= m.left && sx(x1) <= sw - m.right && sy(y0) >= m.top && sy(y1) <= sh - m.bottom) return;
    const need = Math.min(vw / (x1 - x0), vh / (y1 - y0));
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(this.zoom, need)));
    const focus = { x: (x0 + x1) / 2 + (sw / 2 - (m.left + vw / 2)) / zoom, y: (y0 + y1) / 2 + (sh / 2 - (m.top + vh / 2)) / zoom };
    this.camTween = {
      fromZoom: this.zoom,
      toZoom: zoom,
      from: { x: (sw / 2 - this.camX) / this.zoom, y: (sh / 2 - this.camY) / this.zoom },
      to: focus,
      elapsed: 0,
      ms: FX.cameraPanMs,
    };
    await this.sleep(FX.cameraPanMs + 50);
  }

  /** Finito il turno automatico dell'Overlord ognuno ritrova la sua camera (quella che aveva prima, o che ha cambiato lui). */
  private async restoreUserCamera() {
    const app = this.app;
    const u = this.userCam;
    if (!app || !u) return;
    this.camTween = {
      fromZoom: this.zoom,
      toZoom: u.zoom,
      from: { x: (app.screen.width / 2 - this.camX) / this.zoom, y: (app.screen.height / 2 - this.camY) / this.zoom },
      to: { x: u.x, y: u.y },
      elapsed: 0,
      ms: FX.cameraPanMs,
    };
    await this.sleep(FX.cameraPanMs + 50);
  }

  /** La casella da cui parte la pedina: al centro del primo tile. */
  private startCell(placed: PlacedTile[]): Cell {
    const t = placed[0];
    const centre = { x: t.x + Math.floor(t.def.size.w / 2), y: t.y + Math.floor(t.def.size.h / 2) };
    if (tileCells(t.def).has(`${centre.x - t.x},${centre.y - t.y}`)) return centre;
    const [cx, cy] = [...tileCells(t.def)][0].split(',').map(Number);
    return { x: t.x + cx, y: t.y + cy };
  }

  /** Posizione di un punto dello schermo, in celle (con la parte decimale). */
  private toCells(p: Point): Point {
    const scale = this.zoom * CELL_SIZE;
    return { x: (p.x - this.camX) / scale, y: (p.y - this.camY) / scale };
  }

  /** Ricostruisce le regole della mappa (dopo che tile o porte sono cambiati) e ridisegna le porte. */
  private rebuildBoard() {
    this.board = new Board(this.placed, this.doors, this.obstacles, this.markers, this.state.walls);
    this.state.board = this.board;
    armCleared(this.state); // gli eventi "non c'è più nessuno" ricordano chi c'era all'inizio
    this.pieces?.setBoard(this.board);
    explore(this.state, this.board); // quello che si vede subito, senza animazione
    this.applyVisibility();
    this.refreshContext();
  }

  /** Giocando si vede solo ciò che gli eroi hanno visto; negli strumenti di piazzamento si vede tutto, perché l'autore deve poter lavorare. */
  private fogOn(): boolean {
    return this.mode === 'play';
  }

  /** Ridisegna ostacoli, porte, velo e mostri secondo ciò che è rivelato. */
  private applyVisibility() {
    const board = this.board;
    if (!board) return;
    const fog = this.fogOn();
    this.obstacleView?.redraw(board, fog ? (o) => this.exploration.obstacles.has(o) : undefined);
    this.doorView?.redraw(board, fog ? (d) => this.exploration.doors.has(d) : undefined);
    this.markerView?.redraw(board, fog ? (m) => this.exploration.markers.has(m) : undefined);
    this.chestView?.redraw(board, fog ? (m) => this.exploration.markers.has(m) : undefined);
    this.stairsView?.redraw(board, fog ? (m) => this.exploration.markers.has(m) : undefined);
    this.syncStairsWalls(board);
    this.pickupView?.redraw(board, fog ? (m) => this.exploration.markers.has(m) : undefined);
    this.veil?.setState(board, fog ? this.exploration.cells : null);
    this.syncTorches();
    this.syncMonsterVisibility(fog);
    this.pieces?.setKnownMarkers(fog ? this.exploration.markers : null); // si viaggia solo verso glifi già scoperti
  }

  private torchView?: TorchView;
  private torches: Torch[] = [];
  private torchKey = '';

  /** Le torce con almeno una delle due caselle che illuminano già esplorata si vedono, e la loro luce cade solo sulle caselle esplorate. */
  private syncTorches() {
    const board = this.board;
    if (!board || !this.torchView) return;
    const fog = this.fogOn();
    const seen = (c: Cell) => !fog || this.exploration.cells.has(cellKey(c));
    const lit = board.walkableCells().filter(seen);
    const near = (t: Torch): Cell[] => {
      const a = t.facing === 'S' || t.facing === 'E' ? { x: t.x, y: t.y } : { x: t.x - 1, y: t.y - 1 };
      // Le due caselle accanto all'incrocio dal lato verso cui sporge la torcia.
      return t.facing === 'S' ? [{ x: t.x - 1, y: t.y }, { x: t.x, y: t.y }]
        : t.facing === 'N' ? [{ x: t.x - 1, y: t.y - 1 }, { x: t.x, y: t.y - 1 }]
        : t.facing === 'E' ? [{ x: t.x, y: t.y - 1 }, a]
        : [{ x: t.x - 1, y: t.y - 1 }, { x: t.x - 1, y: t.y }];
    };
    const shown = this.torches.filter((t) => near(t).some(seen));
    const key = `${shown.map((t) => `${t.x},${t.y},${t.facing}`).join('|')}#${lit.length}`;
    if (key === this.torchKey) return;
    this.torchKey = key;
    this.torchView.redraw(shown, lit);
  }

  /** Quali scale hanno i muri già disegnati: si ridisegna la mappa solo quando ne compare una nuova. */
  private stairsDrawn = '';

  /** I muri delle scale si disegnano insieme a quelli dei tile, ma solo per le scale scoperte (non svelano dove sono). */
  private syncStairsWalls(board: Board) {
    const fog = this.fogOn();
    const shown = board.markers.filter((m): m is Stairs => m.type === 'stairs' && (!fog || this.exploration.markers.has(m)));
    const key = shown.map((s) => `${s.x},${s.y},${s.rotation ?? 0}`).join('|') + `#${board.walls.length}`;
    if (key === this.stairsDrawn) return;
    this.stairsDrawn = key;
    this.placer?.setExtraWalls([...stairsWalls(shown), ...board.wallSegments()]); // i muri dell'avventura si vedono sempre, come quelli dei tile
  }

  /** Per i glifi: quali sono destinazioni di un viaggio e quali hanno una pedina sopra. */
  private glyphState() {
    const occupied = new Set<Marker>();
    for (const p of this.pieceList) {
      const m = p.city ? undefined : this.board?.markerAt(p.cell);
      if (m) occupied.add(m);
    }
    // Chi è in città e sta scegliendo dove tornare: i glifi possibili emettono l'onda.
    const active = this.pieces?.active;
    const returning = this.returnMode() && active?.city ? new Set<Marker>(this.returnOptions().map((c) => c.marker)) : null;
    return { destinations: returning ?? this.pieces?.travelDestinations() ?? new Set<Marker>(), occupied };
  }

  /**
   * Ricalcola cosa vede il gruppo e mostra le novità: il velo svanisce sulle caselle nuove, compaiono ostacoli, porte
   * e mostri rivelati. Restituisce true se è comparso un mostro (chi si sta muovendo deve fermarsi).
   */
  private exploreAndNotify(): boolean {
    if (!this.board || !this.fogOn()) return false;
    const r = explore(this.state, this.board);
    if (r.obstacles.length || r.doors.length || r.markers.length) {
      this.obstacleView?.redraw(this.board, (o) => this.exploration.obstacles.has(o));
      this.doorView?.redraw(this.board, (d) => this.exploration.doors.has(d));
      this.markerView?.redraw(this.board, (m) => this.exploration.markers.has(m));
      this.chestView?.redraw(this.board, (m) => this.exploration.markers.has(m));
      this.stairsView?.redraw(this.board, (m) => this.exploration.markers.has(m));
      this.syncStairsWalls(this.board);
      this.pickupView?.redraw(this.board, (m) => this.exploration.markers.has(m));
    }
    this.veil?.reveal(r.cells);
    if (r.cells.length) this.syncTorches(); // la luce segue ciò che si vede
    if (r.monsters.length) {
      this.syncMonsterVisibility(true);
      this.pieces?.revealMonsters(r.monsters.map((m) => m.id));
      this.showNotice(`Compare: ${r.monsters.map((m) => m.name).join(', ')}`, 'skull', 'overlord');
    }
    if (r.areas.length) void this.areasRevealed(r.areas);
    this.refreshContext(); // una porta appena vista può diventare un'azione
    return r.monsters.length > 0;
  }

  /** Le aree rivelate per la prima volta: il testo dell'avventura (se c'è), i mostri si svegliano e agiscono Orda di Creature e Abile comandante. */
  private async areasRevealed(areas: string[]) {
    if (!this.board) return;
    for (const id of areas) {
      const info = this.areaInfo.get(id);
      if (info?.text) {
        const title = [info.name, info.subtitle].filter(Boolean).join(' · ');
        this.showNotice(title ? `**${title}**\n\n${info.text}` : info.text, 'info', 'game', true); // la descrizione è in markdown
      }
      const res = revealArea(this.state, this.board, id);
      if (res.upgraded.length) {
        for (const m of res.upgraded) this.pieces?.redraw(m);
        await this.announce('Abile comandante', `${res.upgraded.map((m) => m.name).join(', ')} diventa potenziato.`);
      }
      if (res.spawned.length) await this.presentSpawned(res.spawned, 'Orda di Creature', `Appaiono: ${res.spawned.map((m) => m.name).join(', ')}.`);
      if (res.spawned.length || res.upgraded.length) this.exploreAndNotify(); // i nuovi mostri possono essere in vista
    }
  }

  /** Dice a chi ne ha bisogno dove si trova il mouse (niente durante il trascinamento). */
  private refreshHover() {
    const cell = this.mouse && this.pointers.size === 0 ? this.toCells(this.mouse) : null;
    this.placer?.setHover(this.mode === 'tiles' ? cell : null);
    this.pieces?.hover(this.mode === 'play' && cell ? { x: Math.floor(cell.x), y: Math.floor(cell.y) } : null);
    this.doorView?.setPreview(null);
    this.obstacleView?.setPreview(null);
    if (this.mode === 'obstacles' && cell) {
      const o = this.obstacleCandidate({ x: Math.floor(cell.x), y: Math.floor(cell.y) });
      this.obstacleView?.setPreview(o, this.canPlace(o));
    }
    if (this.mode === 'doors' && cell) {
      const c = this.doorCandidate(cell);
      if (c) this.doorView?.setPreview(c.span, c.index >= 0, this.board!.hasJambPosts(c.span));
    }
  }

  /** Il lato di cella più vicino al puntatore su cui può stare una porta, con la porta (da muro a muro) che ci starebbe. */
  private doorCandidate(cell: Point): { span: DoorSpan; unit: number; index: number } | null {
    if (!this.board) return null;
    // Le due possibilità: la linea orizzontale più vicina e la verticale più vicina; si prova prima la più vicina.
    const options = [
      { horizontal: true, line: Math.round(cell.y), unit: Math.floor(cell.x), dist: Math.abs(cell.y - Math.round(cell.y)) },
      { horizontal: false, line: Math.round(cell.x), unit: Math.floor(cell.y), dist: Math.abs(cell.x - Math.round(cell.x)) },
    ].sort((a, b) => a.dist - b.dist);
    for (const o of options) {
      const span = this.board.spanAt(o.horizontal, o.line, o.unit);
      if (span) return { span, unit: o.unit, index: this.board.doorIndexAt(o.horizontal, o.line, o.unit) };
    }
    return null;
  }

  /** L'ostacolo che si piazzerebbe con la cella `c` come prima casella: tipo, lunghezza e rotazione correnti. */
  private obstacleCandidate(c: Point): Obstacle {
    const v = OBSTACLE_VARIANTS[this.obstacleVariant];
    return { type: v.type, length: v.length, x: c.x, y: c.y, vertical: this.obstacleVertical || undefined };
  }

  /** Si può piazzare qui? Serve che stia sui tile, senza altri ostacoli e senza pedine sopra. */
  private canPlace(o: Obstacle): boolean {
    return !!this.board?.canPlaceObstacle(o) && !obstacleCells(o).some((c) => this.pieces?.isOccupied(c));
  }

  /** Clic in modalità "ostacoli": toglie l'ostacolo che c'è, oppure ne mette uno nuovo. */
  private obstaclesClick(p: Point) {
    const c = this.toCells(p);
    const cell = { x: Math.floor(c.x), y: Math.floor(c.y) };
    const existing = this.board?.obstacleAt(cell);
    if (existing) this.obstacles.splice(this.obstacles.indexOf(existing), 1);
    else {
      const o = this.obstacleCandidate(cell);
      if (!this.canPlace(o)) return;
      this.obstacles.push(o);
    }
    this.rebuildBoard();
    this.refreshHover();
  }

  /** Cambia modalità: tornando a "gioco" i tile e le porte appena piazzati diventano parte della mappa. */
  private setMode(mode: Mode) {
    this.mode = this.mode === mode ? 'play' : mode;
    this.hint.set(HINTS[this.mode]);
    this.pieces?.setEnabled(this.mode === 'play');
    if (this.mode === 'play') this.rebuildBoard();
    else this.applyVisibility(); // negli strumenti di piazzamento si vede tutto
    this.refreshContext();
    this.refreshHover();
  }

  /** Aggiorna l'interfaccia (pillole in alto e barra degli eroi) da ciò che c'è nello stato. */
  private showHud(_active: Piece | null) {
    const s = this.state;
    s.checkVictory(); // prima della Conquista: la vittoria dà i punti dell'obiettivo
    void this.flushEvents(); // i messaggi degli eventi scattati (una sconfitta, uno scrigno, un'area) si leggono appena la scena è aggiornata
    this.progress.set(s.progress);
    this.round.set(s.round);
    this.threat.set(s.overlord.threat);
    this.deckLeft.set(cardsLeft(s));
    this.handCount.set(s.overlord.hand.length);
    this.defeated.set(s.status === 'defeat');
    this.victory.set(s.status === 'victory');
    this.keys.set(s.party.keys.size);
    const hero = s.pieces.find((p) => p.id === s.activeId && p.team === 'hero');
    this.runes.set(s.runesInPlay().map((color) => ({ color, owned: s.party.runeKeys.has(color), label: `Chiave runica ${RUNE_NAMES[color]}${s.party.runeKeys.has(color) ? '' : ' (non ancora trovata)'}` })));
    const heroes: BarMember[] = s.pieces
      .filter((p) => p.team === 'hero')
      .map((p) => ({
        id: p.id,
        name: p.name,
        kind: 'hero',
        portrait: p.portrait,
        active: p.id === s.activeId && s.phase === 'heroes',
        done: p.done,
        wounds: p.wounds,
        maxWounds: p.maxWounds,
        points: p.points,
        fatigue: p.fatigue,
        armor: armorOf(s, p),
        potions: p.potions.length,
        inCity: !!p.city,
        cityPanel: !!p.city && !cityRules.cityView(s, p)?.mustReturn,
        action: p.action,
        order: p.order ?? null,
        status: { ...p.status },
        skillsReady: p.id === s.activeId && skillActions(s, p).some((a) => a.enabled),
        details: {
          name: p.name, heroClass: p.heroClass, portrait: p.portrait, portraitFull: p.portraitFull, wounds: p.wounds, maxWounds: p.maxWounds, fatigue: p.fatigue,
          armor: armorOf(s, p), speed: speedOf(s, p), value: p.value, potions: [...p.potions], coins: p.coins, inventory: this.inventoryWithUses(s, p), inCity: !!p.city, cityPanel: !!p.city && !cityRules.cityView(s, p)?.mustReturn, city: cityRules.cityView(s, p), dice: p.dice, skillActions: skillActions(s, p), states: [...describeStatus(p.status), ...(p.toad ? [`Rospo ×${p.toad.tokens}`] : [])], poison: p.status.poison, skills: p.skills, skillCards: p.skillCards.flatMap((id) => { const c = s.skills.get(id); return c ? [c] : []; }), ability: p.ability,
        } satisfies HeroDetails,
      }));
    this.members.set(heroes);
    this.heroSlots.set(heroes.length + this.pendingHeroes.length);
    if (this.panel() && this.panel()!.id !== s.activeId) this.panel.set(null); // il pannello è dell'eroe che agisce
    const shown = this.panel();
    if (shown?.kind === 'city' && !(s.pieces.find((p) => p.id === shown.id)?.city && !cityRules.cityView(s, s.pieces.find((p) => p.id === shown.id)!)?.mustReturn)) this.panel.set(null); // la città c'è solo per chi ci si trova e non deve ancora tornare
    if (this.returnMode() && !this.pieces?.active?.city) this.endReturn();
    this.maybeStartReturn();
    this.refreshContext();
  }

  /** Dai titoli in cima ai pannelli: passa all'altro pannello, per lo stesso eroe. */
  protected switchPanel(kind: PanelKind) {
    this.panel.update((cur) => (cur ? { id: cur.id, kind } : cur));
  }

  /** I tasti "i" e della cassa del tab: aprono la scheda con le informazioni o l'inventario dell'eroe, o li chiudono se sono già aperti. */
  protected togglePanel(id: string, kind: PanelKind) {
    this.monsterPanel.set(null); // un solo pannello alla volta
    this.panel.update((cur) => (cur?.id === id && cur.kind === kind ? null : { id, kind }));
  }

  /** Un nemico toccato nella vista dei giocatori: se si può attaccare compare il menu delle armi. */
  private selectAttackTarget(target: Piece) {
    const hero = this.pieces?.active;
    if (!hero || hero.team !== 'hero' || !this.board || this.attackSession() || this.overlordBusy()) return;
    if (this.fogOn() && !this.exploration.monsters.has(target.id)) return; // un nemico non ancora scoperto non si può toccare
    if (target.inactive) return; // un nemico inattivo è come un ostacolo: non si attacca
    // Le carte dei mostri sono pubbliche (come sul tavolo, manuale 3B): oltre alle armi c'è sempre la voce Scheda; se non si può attaccare resta solo quella.
    const options = canActOnMap(this.state, hero) ? attackOptions(this.state, this.board, hero, target) : [];
    this.attackTarget.set(target.id);
    this.attackActions.set([
      ...options.map((o) => ({ id: o.id, kind: 'attack' as const, icon: o.icon, label: o.name, cost: 0, enabled: o.enabled, reason: o.reason })),
      { id: 'sheet', kind: 'attack' as const, icon: 'info', label: 'Scheda', cost: 0, enabled: true },
    ]);
    this.updateContextAnchor();
  }

  protected closeAttackMenu() {
    this.attackTarget.set(null);
    this.attackActions.set([]);
  }

  /** Dal menu delle armi: apre la finestra dell'attacco con l'arma scelta (prima del tiro non si spende niente). */
  protected async startAttack(optionId: string) {
    if (optionId === 'sheet') {
      // La scheda del nemico: stessa cornice dei pannelli degli eroi, sopra la barra.
      const monster = this.attackTarget();
      this.closeAttackMenu();
      if (monster) {
        this.panel.set(null);
        this.monsterPanel.set(monster);
      }
      return;
    }
    const hero = this.pieces?.active;
    const target = this.state.pieces.find((p) => p.id === this.attackTarget());
    if (!hero || !target || !this.board || this.attackSession()) return;
    const option = attackOptions(this.state, this.board, hero, target).find((o) => o.id === optionId);
    if (!option?.enabled) return;
    this.attackTarget.set(null);
    this.attackActions.set([]);
    await this.attackIntro(hero, target, option);
    this.attackSession.set({
      attackerId: hero.id, targetId: target.id, option, plan: planAttack(this.state, hero, target, option),
      step: 'preview', rolls: [], choices: {}, spent: [], sorcery: { range: 0, damage: 0 },
    });
  }

  protected cancelAttack() {
    const attacker = this.state.pieces.find((p) => p.id === this.attackSession()?.attackerId);
    if (attacker) this.pieces?.cancelAttackFx(attacker); // la pedina torna al suo posto e la linea sparisce
    this.attackSession.set(null);
    this.dice.scheduleClear(true);
  }

  /** Il tiro: i dadi 3D rotolano sopra la finestra e le facce uscite arrivano nella finestra. */
  protected async rollAttack() {
    const se = this.attackSession();
    if (!se || se.step !== 'preview') return;
    this.attackSession.set({ ...se, step: 'rolling' });
    const rolls = await this.dice.rollFaces(se.option.dice);
    const cur = this.attackSession();
    if (!cur) return;
    if (!rolls) {
      this.attackSession.set({ ...cur, step: 'preview' });
      this.showNotice('I dadi 3D non sono disponibili', 'warning', 'game');
      return;
    }
    const victim = this.state.pieces.find((p) => p.id === cur.targetId);
    const final = victim?.team === 'monster' ? await this.maybeDodge(rolls, cur.plan) : rolls; // Schivare
    if (!this.attackSession()) return;
    const attacker = this.state.pieces.find((p) => p.id === cur.attackerId);
    const offer = attacker && attacker.team === 'hero' ? rerollsFor(this.state, attacker, cur.option.attack) : { count: 0, sources: [] as string[] };
    const aim = !!attacker && attacker.team === 'hero' && attacker.order === 'aim' && !cur.auto && !cur.free?.consumeOrder;
    this.attackSession.set({ ...cur, step: 'rolled', rolls: final, choices: {}, spent: [], sorcery: { range: 0, damage: 0 }, rerolls: offer.count, rerollSource: offer.sources.join(', '), aim });
  }

  /** Un dado potere in più per 1 fatica, dopo il tiro (al massimo 5 dadi potere in un attacco). */
  protected readonly addingDie = signal(false);
  protected async addPowerDie() {
    const se = this.attackSession();
    const attacker = this.state.pieces.find((p) => p.id === se?.attackerId);
    if (!se || !attacker || se.step !== 'rolled' || se.auto || this.addingDie()) return;
    if (attacker.fatigue < 1 || se.rolls.filter((r) => r.color === 'black').length >= 5) return;
    this.addingDie.set(true);
    attacker.fatigue -= 1; // la fatica si spende subito: il dado non si può annullare
    this.pieces?.refreshActive();
    const extra = await this.dice.rollFaces(['black'], true);
    this.addingDie.set(false);
    const cur = this.attackSession();
    if (!cur) return;
    if (!extra) {
      attacker.fatigue += 1; // i dadi 3D non ci sono: la fatica torna
      this.pieces?.refreshActive();
      this.showNotice('I dadi 3D non sono disponibili', 'warning', 'game');
      return;
    }
    this.attackSession.set({ ...cur, rolls: [...cur.rolls, ...extra] });
  }

  /** Sta ripetendo un dado scelto (Occhio del cacciatore): i tasti aspettano. */
  private readonly rerolling = signal(false);

  /** Ripete il dado `index` scelto dall'eroe (una delle ripetizioni che la sua abilità gli dà): resta il secondo risultato. */
  protected async rerollChosen(index: number) {
    const se = this.attackSession();
    if (!se || se.step !== 'rolled' || se.auto || (se.rerolls ?? 0) < 1 || this.rerolling() || !se.rolls[index]) return;
    this.rerolling.set(true);
    const rolls = await this.rerollDice(se.rolls, [index]);
    this.rerolling.set(false);
    const cur = this.attackSession();
    if (!cur) return;
    const choices = { ...cur.choices };
    delete choices[index]; // il dado è nuovo: se è multivalente si sceglie di nuovo
    this.attackSession.set({ ...cur, rolls, choices, spent: [], rerolls: (cur.rerolls ?? 1) - 1, aim: false }); // un solo ripetuto per attacco
  }

  /** Mira: l'eroe sceglie quali dadi ripetere (anche i mancati); si tiene il secondo risultato e l'ordine si usa. */
  protected async aimChosen() {
    const se = this.attackSession();
    if (!se || se.step !== 'rolled' || se.auto || !se.aim || this.rerolling()) return;
    const picked = await this.pickDice({ title: 'Attacco mirato', text: 'Scegli i dadi da ripetere, anche i mancati: terrai il secondo risultato. È l\'unica ripetizione di questo attacco.', dice: se.rolls, confirm: 'Ripeti i dadi scelti', skip: 'Annulla' });
    if (!picked?.length) return;
    this.rerolling.set(true);
    const rolls = await this.rerollDice(se.rolls, picked);
    this.rerolling.set(false);
    const cur = this.attackSession();
    if (!cur) return;
    const choices = { ...cur.choices };
    for (const i of picked) delete choices[i];
    const attacker = this.state.pieces.find((p) => p.id === cur.attackerId);
    if (attacker) attacker.order = null; // l'ordine si usa
    this.attackSession.set({ ...cur, rolls, choices, spent: [], rerolls: 0, aim: false });
    this.showNotice('Attacco mirato: ordine Mira usato', 'tactic');
    this.showHud(this.pieces?.active ?? null);
  }

  /** Sulla faccia multivalente del dado potere chi tira sceglie quale dei due valori tenere. */
  protected chooseFace(e: { index: number; value: 'range' | 'heart' | null }) {
    this.attackSession.update((se) => {
      if (!se) return se;
      const choices = { ...se.choices };
      if (e.value) choices[e.index] = e.value;
      else delete choices[e.index]; // un tocco sul risultato riapre la scelta
      return { ...se, choices };
    });
  }

  /** Attiva un'abilità dell'arma pagando le sue Scariche: si può fare più volte, finché ce ne sono. */
  protected useEffect(index: number) {
    const se = this.attackSession();
    const target = this.state.pieces.find((p) => p.id === se?.targetId);
    if (!se || !target) return;
    const effect = se.plan.effects.find((e) => e.index === index);
    const o = resolveAttack(this.state, target, se.plan, se.rolls, se.choices, se.spent, se.sorcery);
    if (!effect?.supported || effect.cost > o.surges - o.surgesSpent) return;
    this.attackSession.set({ ...se, spent: [...se.spent, index] });
  }

  /** Stregoneria: sposta un punto (dopo il tiro) fra la gittata e il danno, senza superare il livello. */
  protected sorceryStep(e: { kind: 'range' | 'damage'; delta: 1 | -1 }) {
    this.attackSession.update((se) => {
      if (!se || se.auto) return se;
      const next = { ...se.sorcery, [e.kind]: Math.max(0, se.sorcery[e.kind] + e.delta) };
      if (next.range + next.damage > se.plan.sorcery) return se;
      return { ...se, sorcery: next };
    });
  }

  /** Rimette a posto tutte le Scariche spese. */
  protected resetEffects() {
    this.attackSession.update((se) => (se ? { ...se, spent: [] } : se));
  }

  /** Applica l'attacco: consuma l'attacco, toglie le ferite e, se il nemico è sconfitto, sparisce dalla mappa. */
  protected async applyAttackNow() {
    const se = this.attackSession();
    const attacker = this.state.pieces.find((p) => p.id === se?.attackerId);
    const target = this.state.pieces.find((p) => p.id === se?.targetId);
    if (!se || !attacker || !target || se.step !== 'rolled') return;
    let outcome = resolveAttack(this.state, target, se.plan, se.rolls, se.choices, se.spent, se.sorcery);
    if (!outcome.miss && se.rolls.some((r, i) => r.face.slash && !se.choices[i])) {
      this.showNotice('Scegli cosa tenere sulle facce del dado potere', 'warning');
      return;
    }
    this.attackSession.set(null); // chiude la finestra subito (e non si applica due volte)
    this.applyingAttack = true;
    this.dice.scheduleClear(true);
    // Un eroe che sta per subire ferite può reagire (Mantelli, Scudi, Pelle di corteccia): quelle che restano sono quelle che subisce davvero.
    if (target.team === 'hero' && outcome.damage > 0 && !outcome.kill) {
      const left = await this.reduceWounds(target, outcome.damage);
      if (left !== outcome.damage) outcome = { ...outcome, damage: left, poison: outcome.poison > 0 ? left : 0 };
    }
    // Immortale: se il colpo sarebbe mortale si tira un dado potere; con una Scarica il mostro si rialza.
    let undying = false;
    if (outcome.damage > 0 && outcome.damage >= target.wounds && !outcome.kill && target.traits.some((t) => /^Immortale$/i.test(t))) { // il Tocco della morte ignora Immortale
      const roll = await this.dice.rollFaces(['black']);
      await this.sleep(1600);
      undying = !!roll?.some((r) => r.face.surge > 0);
    }
    // Chi altro è colpito (Spazzata, Esplosione, Soffio): si calcola prima, perché il bersaglio può uscire dalla mappa.
    const hit = !outcome.miss && outcome.inRange && !outcome.feared;
    const victims = hit && this.board ? areaVictims(this.state, this.board, attacker, target, se.plan, se.spent, se.breathDir) : [];
    if (se.free) {
      attacker.fatigue = Math.max(0, attacker.fatigue - se.free.pay); // Vigilanza: la fatica si paga adesso
      this.pieces?.refreshActive();
    }
    const result = applyAttack(this.state, attacker, target, outcome, { undying, option: se.option, extra: !!se.free });
    await this.attackImpact(attacker, target, se.option, outcome);
    const states = result.applied.map((a) => `${STATUS_NAMES[a.kind]} ×${a.n}`).join(', ');
    const text = result.undying ? `${target.name} è immortale e si rialza!` : result.killed ? `${target.name} è sconfitto!${result.reward ? ` +${result.reward} monete` : ''}` : outcome.miss ? `${se.option.name}: mancato` : !outcome.inRange ? `${se.option.name}: fuori portata` : outcome.damage ? `${se.option.name}: ${outcome.damage} ${outcome.damage === 1 ? 'ferita' : 'ferite'} a ${target.name}${states ? ` (${states})` : ''}` : `${se.option.name}: nessun danno a ${target.name}`;
    const by = attacker.team === 'monster' ? 'overlord' : 'hero';
    if (outcome.threatLoss) this.showHud(this.pieces?.active ?? null);
    if (outcome.threatLoss) this.showNotice(`Il Signore supremo perde ${outcome.threatLoss} ${outcome.threatLoss === 1 ? 'punto' : 'punti'} Minaccia`, 'skull', 'overlord');
    if (result.killed && target.team === 'hero') this.showNotice(`${target.name} è caduto: il gruppo perde ${target.value} di Conquista e torna dalla città`, 'skull', by);
    else this.showNotice(text, result.killed ? 'skull' : 'swords', by);
    this.pieces?.afterCombat(attacker, target, result.killed);
    this.afterDrop(result.drop);
    for (const v of victims) {
      let vo = resolveAttack(this.state, v, { ...se.plan, fearless: true }, se.rolls, se.choices, se.spent, se.sorcery);
      if (v.team === 'hero' && vo.damage > 0) {
        const left = await this.reduceWounds(v, vo.damage);
        if (left !== vo.damage) vo = { ...vo, damage: left, poison: vo.poison > 0 ? left : 0 };
      }
      const vr = applyAttack(this.state, attacker, v, vo, { extra: true, option: se.option });
      this.pieces?.floatText(v, vo.miss || !vo.inRange ? 'Mancato' : vo.damage > 0 ? `-${vo.damage}` : '0', vo.damage > 0 ? 'damage' : 'miss');
      this.pieces?.afterCombat(attacker, v, vr.killed);
      this.pieces?.monstersSlain(vr.slain);
      this.afterDrop(vr.drop);
      this.showNotice(vr.killed ? `${v.name} è ${v.team === 'hero' ? 'caduto' : 'sconfitto'}!` : `${se.option.name}: ${vo.damage} ${vo.damage === 1 ? 'ferita' : 'ferite'} a ${v.name}`, vr.killed ? 'skull' : 'swords', by);
    }
    if (result.slain.length) {
      this.pieces?.monstersSlain(result.slain);
      this.showNotice(`Giustizia divina: ${result.slain.map((m) => m.name).join(', ')} ${result.slain.length > 1 ? 'sono uccisi' : 'è ucciso'}`, 'skull', 'hero');
    }
    this.exploreAndNotify(); // un nemico in meno cambia cosa si vede
    this.refreshContext();
    if (result.knockback) await this.startKnockback(attacker, target);
    this.applyingAttack = false;
  }

  /**
   * Un eroe sta per subire `damage` ferite da un attacco: prima si applicano le reazioni (docs/cards/abilities.md, livello 2). I Mantelli tirano un dado potere per ogni
   * ferita e ne annullano una per faccia vuota (inganno) o per onda (nebbie, Elfico); gli Scudi (si esauriscono) e Pelle di corteccia si propongono al giocatore, che
   * può usarle una dopo l'altra finché ci sono ferite e reazioni. Restituisce le ferite che subisce davvero.
   */
  private async reduceWounds(hero: Piece, damage: number): Promise<number> {
    let left = damage;
    const reactions = woundReactions(this.state, hero);
    for (const r of reactions.filter((x) => x.auto && !reactionBlock(hero, x))) {
      if (left <= 0) break;
      const faces = await this.powerDice(Math.min(left, 8));
      const n = r.cancel === 'blank' ? faces.filter(isBlank).length : r.cancel === 'surge' ? waves(faces) : 0;
      const cancelled = Math.min(left, n);
      left -= cancelled;
      this.showNotice(cancelled ? `${r.name}: ${cancelled} ${cancelled === 1 ? 'ferita annullata' : 'ferite annullate'}` : `${r.name}: nessuna ferita annullata`, 'shield', 'hero');
    }
    for (let guard = 0; guard < 6 && left > 0; guard++) {
      const options = reactions.filter((x) => !x.auto && !reactionBlock(hero, x));
      if (!options.length) break;
      const answer = await this.askChoice({
        title: 'Reazione',
        text: `${hero.name} sta per subire ${left} ${left === 1 ? 'ferita' : 'ferite'}. Usare una reazione?`,
        choices: [...options.map((o) => ({ id: o.id, label: `${o.name} (−${cancelAmount(this.state, hero, o)})`, primary: true })), { id: 'no', label: 'Subisci le ferite' }],
      });
      const picked = options.find((o) => o.id === answer);
      if (!picked) break;
      markReactionUsed(hero, picked);
      const cancelled = Math.min(left, cancelAmount(this.state, hero, picked));
      left -= cancelled;
      this.showNotice(`${picked.name}: ${cancelled} ${cancelled === 1 ? 'ferita annullata' : 'ferite annullate'}`, 'shield', 'hero');
    }
    return left;
  }

  /** Il bottino di un mostro appena uscito dalla mappa: si dice cosa ha lasciato e, se un oggetto è caduto a terra, si ridisegna la mappa. */
  private afterDrop(drop: RemovalResult | null | undefined) {
    if (!drop) return;
    if (drop.lines.length) this.showNotice(`Bottino: ${drop.lines.join(' · ')}`, 'inventory_2', 'game');
    if (drop.groundItems) this.rebuildBoard();
    for (const m of drop.modified ?? []) this.pieces?.redraw(m); // un evento ha cambiato i valori di una pedina
  }

  /**
   * I messaggi degli eventi (`state.events`, vedi `state/events.ts`): uno alla volta in una dialog con "Ho letto", e le frasi brevi come notifiche. Si può chiamare spesso: se sta già
   * mostrando la coda restituisce quella stessa attesa, e il turno dell'Overlord la aspetta prima di andare avanti.
   */
  private eventResolve: (() => void) | null = null;
  private eventFlush: Promise<void> | null = null;
  private flushEvents(): Promise<void> {
    const ev = this.state.events;
    this.drainEventChanges();
    if (this.eventFlush || (!ev.messages.length && !ev.notices.length && !ev.checks?.length)) return this.eventFlush ?? Promise.resolve();
    this.eventFlush = (async () => {
      while (!this.destroyed && (ev.messages.length || ev.notices.length || ev.checks?.length)) {
        const note = ev.notices.shift();
        if (note) {
          this.showNotice(note, 'inventory_2', 'game');
          continue;
        }
        const message = ev.messages.shift();
        if (message) {
          await new Promise<void>((resolve) => {
            this.eventResolve = resolve;
            this.adventureDialog.set({ kicker: 'Evento', title: message.title ?? this.state.title ?? 'Avventura', text: message.text, action: 'Ho letto', dismissible: false });
          });
        } else await this.runCheck(ev.checks.shift()!);
        this.drainEventChanges(); // ciò che l'evento o la prova hanno cambiato
      }
    })().finally(() => {
      this.eventFlush = null;
    });
    return this.eventFlush;
  }

  /** Mostra ciò che gli eventi hanno cambiato sulla mappa: gruppi di nemici svuotati ("non c'è più nessuno"), porte evento aperte, nemici attivati o tolti. */
  private drainEventChanges() {
    const ev = this.state.events;
    for (const m of checkCleared(this.state).modified) this.pieces?.redraw(m);
    if (ev.groundItems) {
      ev.groundItems = false;
      this.rebuildBoard(); // un oggetto è caduto a terra
    }
    // Le porte evento appena aperte si ridisegnano (parte l'animazione dell'anta) e aprirle può far vedere cose nuove.
    if (ev.doorsOpened?.splice(0).length && this.board) {
      this.doorView?.redraw(this.board, (d) => !this.fogOn() || this.exploration.doors.has(d));
      this.exploreAndNotify();
    }
    // I nemici attivati si ridisegnano, quelli tolti dalla mappa svaniscono.
    for (const change of ev.pieceChanges?.splice(0) ?? []) {
      if (change.kind === 'restyled') this.pieces?.fadeLook(change.piece, change.from);
      else if (change.kind === 'activated' || change.kind === 'modified') this.pieces?.redraw(change.piece);
      else this.pieces?.withdraw([change.piece]);
    }
  }

  /**
   * Una prova di un evento: l'eroe legge il testo e sceglie se farla (se si può rifiutare); tira i dadi potere (tanti quanti i dadi in più del suo attacco: senza dadi la prova
   * fallisce da sola); con abbastanza onde valgono gli effetti "superata", altrimenti "fallita".
   */
  private async runCheck(check: PendingCheck) {
    const hero = this.state.pieces.find((p) => p.id === check.heroId);
    if (!hero) return;
    const base = Math.min(checkDiceCount(this.state, check), CHECK_MAX_DICE);
    const kind = { melee: 'Mischia', ranged: 'Distanza', magic: 'Magia' }[check.dice];
    // Prima del tiro l'eroe può comprare dadi potere con la fatica (1 per dado), a meno che l'evento lo vieti; la fatica si spende subito e torna se rinuncia.
    let extra = 0;
    let answer = '';
    for (;;) {
      const total = base + extra;
      const canAdd = !check.noFatigue && hero.fatigue >= 1 && total < CHECK_MAX_DICE;
      const dice = total === 0 ? 'nessun dado potere' : `${total} ${total === 1 ? 'dado potere' : 'dadi potere'}`;
      const paid = extra ? `, di cui ${extra} ${extra === 1 ? 'pagato' : 'pagati'} con la fatica` : '';
      const none = total === 0 ? (canAdd ? ' Senza dadi la prova fallisce: puoi comprarne con la fatica.' : ' Senza dadi la prova fallisce.') : '';
      const rule = `**Prova:** ${hero.name} tira ${dice} (dadi in più dell'attacco ${kind}${paid}); serve almeno ${check.needs} ${check.needs === 1 ? 'onda' : 'onde'}.${none}`;
      answer = await this.askChoice({
        title: check.title ?? 'Prova',
        text: `${check.text}\n\n${rule}`,
        markdown: true,
        choices: [...(canAdd ? [{ id: 'add', label: '{fat:1} +1 dado potere' }] : []), { id: 'roll', label: 'Effettua la prova', primary: true }, ...(check.refusable ? [{ id: 'cancel', label: 'Annulla' }] : [])],
      });
      if (answer !== 'add') break;
      hero.fatigue -= 1;
      extra += 1;
      this.pieces?.refreshActive();
    }
    if (answer === 'cancel') {
      hero.fatigue += extra; // rinuncia: la fatica spesa torna
      const target = refuseCheck(this.state, check);
      if (target) this.pieces?.redraw(target); // il "?" torna sulla miniatura
      this.pieces?.refreshActive(); // i punti e la fatica tornano all'eroe
      this.showNotice(`${hero.name} rinuncia`, 'info', 'hero');
      return;
    }
    const n = base + extra;
    const faces = n > 0 ? await this.powerDice(n) : [];
    const waves = faces.reduce((sum, f) => sum + (f.surge ?? 0), 0);
    const { success, report } = resolveCheck(this.state, check, waves);
    for (const m of report.modified) this.pieces?.redraw(m);
    this.showNotice(`Prova ${success ? 'superata' : 'fallita'}: ${waves} ${waves === 1 ? 'onda' : 'onde'} su ${check.needs} richiesta${check.needs === 1 ? '' : 'e'}`, success ? 'check_circle' : 'warning', 'hero');
    this.pieces?.refreshActive();
  }

  /** Sta applicando un attacco (può aspettare un dado o una scelta): lo script dell'Overlord aspetta che finisca. */
  private applyingAttack = false;

  // --- Contraccolpo ---

  /** Le caselle dove si può spostare il bersaglio (scelta di chi ha attaccato) e chi è. */
  /** La dialog dei testi dell'avventura (introduzione, obiettivo), e la barra che guida la scelta delle caselle di partenza. */
  protected readonly adventureDialog = signal<AdventureView | null>(null);
  protected readonly setupPrompt = signal<string | null>(null);
  /** C'è una preparazione in corso: i comandi degli eroi sono fermi. */
  protected readonly settingUp = signal(false);
  protected readonly hasObjective = signal(false);
  /** Gli eroi non ancora messi in campo, nell'ordine in cui sceglieranno la casella, e dove stavano nella lista delle pedine. */
  private pendingHeroes: { piece: Piece; index: number }[] = [];
  private startLayer?: Graphics;
  protected readonly knockback = signal<{ targetId: string; name: string; cells: Cell[] } | null>(null);

  /** Dopo un attacco con Contraccolpo: l'eroe sceglie dove spostare il bersaglio (o resta fermo), lo script lo spinge lontano. */
  private async startKnockback(attacker: Piece, target: Piece) {
    if (!this.board) return;
    if (attacker.team === 'monster') {
      const dest = pushAway(this.state, this.board, attacker, target);
      if (dest) {
        await this.sleep(500);
        await this.doKnockback(target, dest);
      }
      return;
    }
    const cells = knockbackCells(this.state, this.board, target);
    if (!cells.length) {
      if (target.size.w * target.size.h > 1 && knockbackSteps(target) < 1) this.showNotice(`${target.name} è troppo pesante per essere spostato dal Contraccolpo`, 'info');
      return;
    }
    this.knockback.set({ targetId: target.id, name: target.name, cells });
    this.pieces?.showCells(cells);
    // Si aspetta la scelta: la scena riprende il controllo quando si tocca una casella o "Resta fermo".
  }

  /** Il bersaglio si sposta nella casella scelta: cade se è una buca, subisce l'Aura, può morire. */
  private async doKnockback(target: Piece, dest: Cell) {
    if (!this.board) return;
    this.pieces?.showCells(null);
    this.knockback.set(null);
    const from = { ...target.cell };
    const out = applyKnockback(this.state, this.board, target, dest);
    this.pieces?.redraw(target);
    if (!out.died) await this.pieces?.jump(target, from); // la pedina salta fino alla nuova casella e atterra con una raggiera di linee
    this.showNotice(`${target.name} è scaraventato`, 'swords', 'hero');
    if (out.fell) this.showNotice(`${target.name} cade in una buca`, 'warning');
    for (const h of out.auraHits) this.showNotice(`${target.name} subisce 1 ferita per l'Aura di ${h.name}`, 'warning');
    this.afterDrop(out.drop);
    if (out.died) {
      this.pieces?.afterCombat(target, target, true);
      this.pieces?.monstersSlain(out.slain);
      this.showNotice(target.team === 'hero' ? `${target.name} è caduto: il gruppo perde ${target.value} di Conquista e torna dalla città` : `${target.name} è sconfitto!`, 'skull');
    }
    this.exploreAndNotify();
    this.refreshContext();
  }

  /** Si tocca una casella evidenziata (o "Resta fermo"): scelto dove spostare il bersaglio con il Contraccolpo. */
  protected chooseKnockback(cell: Cell | null) {
    const k = this.knockback();
    const target = this.state.pieces.find((p) => p.id === k?.targetId);
    if (!k || !target) return;
    if (cell && k.cells.some((c) => c.x === cell.x && c.y === cell.y)) void this.doKnockback(target, cell);
    else if (!cell) {
      this.pieces?.showCells(null);
      this.knockback.set(null);
    } else this.showNotice('Tocca una casella evidenziata', 'warning');
  }

  // --- Il turno dell'Overlord (script v1, docs/REGOLE.md sezione 9) ---

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Aspetta che `cond` sia vera (controlla ogni 100 ms), al massimo `maxMs`. */
  private async waitUntil(cond: () => boolean, maxMs: number) {
    for (let t = 0; t < maxMs && !cond() && !this.destroyed; t += 100) await this.sleep(100);
  }

  /**
   * Gli stati all'inizio del turno di una creatura (un eroe a inizio round, un mostro quando viene attivato): per fiamma e rete un dado potere per segnalino
   * (ogni Scarica ne toglie uno), le ferite della fiamma rimasta, la rete che toglie il movimento, uno stordimento che si scarta. Restituisce true se muore.
   */
  private async resolveTurnStart(piece: Piece): Promise<boolean> {
    const s = piece.status;
    if (!s.burn && !s.web && !s.stun) return false;
    const surgesOf = async (n: number) => {
      if (n < 1) return 0;
      const rolls = await this.dice.rollFaces(Array<'black'>(Math.min(n, 8)).fill('black'));
      await this.sleep(1700);
      return rolls ? rolls.filter((r) => r.face.surge > 0).length : 0;
    };
    const burn = await surgesOf(s.burn);
    const web = await surgesOf(s.web);
    const r = applyTurnStart(piece, { burn, web });
    const by = piece.team === 'hero' ? 'hero' : 'overlord';
    if (r.burnBefore) this.showNotice(`${STATUS_NAMES.burn}: ${r.burnBefore - r.burnLeft} su ${r.burnBefore} spente${r.burnDamage ? `, ${piece.name} subisce ${r.burnDamage} ${r.burnDamage === 1 ? 'ferita' : 'ferite'}` : ''}`, 'skull', by);
    if (r.webBefore) this.showNotice(r.webLeft ? `${STATUS_NAMES.web}: ${piece.name} resta impigliato e non può muoversi` : `${STATUS_NAMES.web}: ${piece.name} si libera`, 'warning', by);
    if (r.stunned) this.showNotice(`${piece.name} è stordito: ${piece.team === 'hero' ? 'può solo muoversi o attaccare' : 'perde il turno'}`, 'warning', by);
    if (r.killed) {
      const slain = piece.team === 'hero' ? killHero(this.state, piece) : [];
      if (piece.team !== 'hero') this.afterDrop(removeMonster(this.state, piece));
      this.pieces?.afterCombat(piece, piece, true);
      this.pieces?.monstersSlain(slain);
      this.showNotice(piece.team === 'hero' ? `${piece.name} è caduto: il gruppo perde ${piece.value} di Conquista e torna dalla città` : `${piece.name} è sconfitto!`, 'skull', by);
    } else this.pieces?.roundStarted();
    return r.killed;
  }

  /** Tocca all'Overlord: ogni mostro, uno alla volta, si muove verso l'eroe più vicino e attacca; poi comincia il nuovo round. */
  private async runOverlordTurn() {
    if (this.overlordBusy()) return;
    this.overlordBusy.set(true);
    this.panel.set(null);
    this.monsterPanel.set(null);
    this.closeAttackMenu();
    this.cameraScripted = true; // da qui la camera la muove lo script: quella dell'utente resta quella di prima
    try {
      const recharge = threatPerTurn(this.state); // 1 Minaccia per eroe, meno Prudente (la riceve `overlordUpkeep`)
      this.showNotice(`Turno del Signore supremo: ricarica ${recharge} ${recharge === 1 ? 'punto' : 'punti'} Minaccia`, 'skull', 'overlord');
      await this.sleep(900);
      try {
        await this.overlordCards();
      } catch (err) {
        console.error('Errore nelle carte dell\'Overlord', err); // un errore nelle carte non deve fermare il turno
      }
      for (const id of this.state.pieces.filter((p) => p.team === 'monster').map((p) => p.id)) {
        if (this.destroyed || this.state.status !== 'playing') break;
        const monster = this.state.pieces.find((p) => p.id === id);
        if (monster && this.board) await this.monsterTurn(monster);
        await this.flushEvents();
      }
      if (!this.destroyed && this.state.status === 'playing') {
        const revived = endOverlordTurn(this.state);
        await this.flushEvents(); // messaggi e avvisi degli eventi di fine turno
        this.pieces?.roundStarted();
        if (revived.length) await this.presentSpawned(revived, 'Ritorno in vita', `${revived.map((m) => m.name).join(', ')} ${revived.length === 1 ? 'torna' : 'tornano'} in vita.`);
        this.showNotice(`Round ${this.state.round}: tocca agli eroi`, 'autorenew', 'game');
        // Ricomincia il turno degli eroi: ognuno ritrova la sua camera (zoom e pan di prima); senza, si va sul primo eroe.
        if (this.userCam) void this.restoreUserCamera();
        else {
          const first = this.pieces?.active;
          if (first) void this.panCamera({ x: (first.cell.x + 0.5) * CELL_SIZE, y: (first.cell.y + 0.5) * CELL_SIZE }, FX.cameraPanMs);
        }
        // Gli stati degli eroi si risolvono a inizio round (uno alla volta, con i dadi potere).
        for (const hero of this.state.pieces.filter((p) => p.team === 'hero' && !p.city)) if (!this.destroyed) await this.resolveTurnStart(hero);
      }
    } finally {
      // Lo scorrimento di ritorno dura FX.cameraPanMs: finché non è finito la camera resta "dello script" (e non si memorizza).
      setTimeout(() => {
        this.cameraScripted = false;
        this.rememberCamera();
      }, FX.cameraPanMs + 100);
      this.overlordBusy.set(false);
    }
  }

  /** Il mazzo dell'Overlord all'inizio del suo turno: raccoglie Minaccia, pesca e gioca le sue carte (Potere, Raffica di vento, Seduzione oscura, una trappola armata in segreto e una Evocazione). */
  private async overlordCards() {
    if (!this.board) return;
    const o = this.state.overlord;
    o.gust = false; // la Raffica di vento dura fino all'inizio di questo turno
    const up = overlordUpkeep(this.state);
    if (up.deckEnded) this.showNotice('Il mazzo dell\'Overlord è finito: il gruppo perde Conquista', 'warning', 'overlord');
    const power = playPowerCard(this.state);
    if (power) {
      await this.announce(power.name, power.text.replace(/^Gioca questa carta all'inizio del tuo turno e piazzala a faccia in su davanti a te\.\s*/, ''));
    }
    if (!o.gust && this.state.random() < 0.5 && playEvent(this.state, 'gust')) {
      o.gust = true;
      await this.announceEvent('Raffica di vento', 'Le torce si spengono: fino al prossimo turno gli eroi non vedono oltre 5 spazi.', 'warning');
    }
    await this.seduction();
    const armed = armTrap(this.state, this.board); // le trappole si armano in segreto: i giocatori non lo sanno
    if (armed && this.overlordView()) this.showNotice(`Trappola armata: ${cardOf(this.state, armed.card)?.name}`, 'warning', 'overlord');
    const played = playSummonCard(this.state, this.board);
    if (played) await this.presentSpawned(played.spawned, played.card.name, `Evoca: ${played.spawned.map((m) => m.name).join(', ')}`);
    this.showHud(this.pieces?.active ?? null);
  }

  /** Seduzione oscura: un eroe tira un dado potere; se non è vuoto attacca, sotto il controllo dell'Overlord, un altro eroe che può colpire. */
  private async seduction() {
    const o = this.state.overlord;
    const heroes = this.state.pieces.filter((p) => p.team === 'hero' && !p.city);
    const card = cardOf(this.state, 'dark-allure');
    if (!card || heroes.length < 2 || !inHand(this.state, card.id) || card.cost > o.threat || !this.board) return;
    // Lo script la gioca solo se l'eroe scelto ha qualcuno da colpire (altrimenti sarebbe sprecata).
    const options = heroes.flatMap((h) => heroes.filter((t) => t !== h).flatMap((t) => controlledAttackOptions(this.state, this.board!, h, t).map((option) => ({ h, t, option }))));
    if (!options.length) return;
    playEvent(this.state, card.id);
    const pick = options[Math.floor(this.state.random() * options.length)];
    await this.announceEvent('Seduzione oscura', `${pick.h.name} deve tirare un dado potere.`, 'warning');
    const [face] = await this.powerDice(1);
    if (!face || isBlank(face)) {
      this.showNotice(`${pick.h.name} resiste alla seduzione`, 'shield', 'overlord');
      return;
    }
    // Fra le sue opzioni, l'attacco con più dadi contro il bersaglio più ferito.
    const mine = options.filter((x) => x.h === pick.h).sort((a, b) => b.option.dice.length - a.option.dice.length || a.t.wounds / a.t.maxWounds - b.t.wounds / b.t.maxWounds)[0];
    this.showNotice(`${mine.h.name} attacca ${mine.t.name} contro la sua volontà`, 'swords', 'overlord');
    await this.monsterAttack(mine.h, mine.t, mine.option);
  }

  /** Ripete il tiro dei dadi `indices` di `rolls` (Mirare, Schivare): resta il secondo risultato. */
  private async rerollDice(rolls: FaceRoll[], indices: number[]): Promise<FaceRoll[]> {
    if (!indices.length) return rolls;
    const fresh = await this.dice.rollFaces(indices.map((i) => rolls[i].color));
    await this.sleep(1700);
    if (!fresh) return rolls;
    const pool = new Map<DieColor, FaceRoll[]>();
    for (const f of fresh) pool.set(f.color, [...(pool.get(f.color) ?? []), f]);
    const out = [...rolls];
    for (const i of indices) out[i] = pool.get(rolls[i].color)?.shift() ?? rolls[i];
    return out;
  }

  /** Schivare: dopo l'attacco di un eroe a un mostro, lo script può obbligare l'eroe a ripetere i dadi migliori. Restituisce le facce (nuove o le stesse). */
  private async maybeDodge(rolls: FaceRoll[], plan: AttackPlan): Promise<FaceRoll[]> {
    // Se il tiro è già fallito (un Mancato, o una gittata che nemmeno al meglio arriva) un giocatore vero non spenderebbe punti per Schivare: lo script nemmeno.
    const bestRange = rolls.reduce((n, r) => n + r.face.range, 0) + plan.bonusRange + plan.effects.reduce((n, e) => n + (e.supported ? e.range : 0), 0) + plan.sorcery;
    const failed = rolls.some((r) => r.face.miss) || (plan.needsRange && bestRange < plan.distance);
    if (failed) return rolls;
    const hearts = rolls.reduce((n, r) => n + (r.face.slash ? 0 : r.face.hearts), 0);
    if (hearts < 2 || this.state.random() > 0.7 || !playEvent(this.state, 'dodge')) return rolls;
    await this.announceEvent('Schivare', "Il mostro evita il colpo: l'eroe ripete i dadi migliori.", 'shield');
    const strong = rolls.map((r, i) => i).filter((i) => rolls[i].face.hearts >= 2 || rolls[i].face.surge > 0);
    return this.rerollDice(rolls, strong.length ? strong : rolls.map((r, i) => i).filter((i) => rolls[i].face.hearts >= 1));
  }

  // --- Messaggio al centro, camera e ingressi (i tempi sono in `FX`, constants.ts) ---

  protected readonly announcement = signal<Announcement | null>(null);
  protected readonly announceMs = FX.announceMs;
  private announceSeq = 0;

  /** La coda dei messaggi: ognuno aspetta che il precedente sia sparito, così più carte di fila si leggono una alla volta. */
  private announceChain: Promise<void> = Promise.resolve();

  /**
   * Un messaggio al centro dello schermo (una carta giocata, una trappola scattata): resta `announceMs` e sparisce da solo, senza bloccare i tocchi.
   * Se ce n'è già uno in corso aspetta che finisca. Restituisce una promessa che si risolve `announceLeadMs` dopo che il messaggio è comparso:
   * chi la aspetta fa partire la sua azione solo allora, dopo il tempo di leggere.
   */
  private announce(title: string, text: string, icon = 'skull'): Promise<void> {
    const shown = this.announceChain.then(async () => {
      const id = ++this.announceSeq;
      this.announcement.set({ id, by: 'Overlord', icon, title, text });
      setTimeout(() => {
        if (this.announcement()?.id === id) this.announcement.set(null);
      }, FX.announceMs);
      await this.sleep(FX.announceLeadMs);
    });
    this.announceChain = shown.then(() => this.sleep(Math.max(0, FX.announceMs - FX.announceLeadMs)));
    return shown;
  }

  /** Come `announce`, per gli eventi (Mirare, Carica, Furore, Schivare). */
  private announceEvent(title: string, text: string, icon = 'bolt'): Promise<void> {
    return this.announce(title, text, icon);
  }

  /** La camera scorre (solo pan: lo zoom resta quello dei giocatori) fino al punto `to`, in pixel del mondo. Finisce quando arriva. */
  private async panCamera(to: Point, ms = FX.cameraPanMs) {
    const app = this.app;
    if (!app) return;
    this.camTween = {
      fromZoom: this.zoom,
      toZoom: this.zoom,
      from: { x: (app.screen.width / 2 - this.camX) / this.zoom, y: (app.screen.height / 2 - this.camY) / this.zoom },
      to,
      elapsed: 0,
      ms,
    };
    await this.sleep(ms + 50);
  }

  /** Il centro del tile (in pixel del mondo) che contiene la casella: da lì escono i mostri evocati. */
  private tileCenterOf(cell: Cell): Point {
    for (const t of this.placed) {
      const cells = [...tileCells(t.def)].map((k) => k.split(',').map(Number));
      if (!cells.some(([cx, cy]) => t.x + cx === cell.x && t.y + cy === cell.y)) continue;
      const xs = cells.map(([cx]) => t.x + cx);
      const ys = cells.map(([, cy]) => t.y + cy);
      return { x: ((Math.min(...xs) + Math.max(...xs) + 1) / 2) * CELL_SIZE, y: ((Math.min(...ys) + Math.max(...ys) + 1) / 2) * CELL_SIZE };
    }
    return { x: (cell.x + 0.5) * CELL_SIZE, y: (cell.y + 0.5) * CELL_SIZE };
  }

  /**
   * Dei mostri appaiono (evocazione, Orda di Creature): messaggio al centro, la camera va sulla zona, poi i mostri escono dall'ombra
   * (arrivano dall'alto: scala da 1,5 a 1) e restano visibili a tutti prima che qualcuno si attivi.
   */
  private async presentSpawned(spawned: Piece[], title: string, text: string) {
    await this.announce(title, text); // il tempo di leggere l'effetto prima che qualcosa si muova
    const mid = {
      x: (spawned.reduce((n, p) => n + p.cell.x + p.size.w / 2, 0) / spawned.length) * CELL_SIZE,
      y: (spawned.reduce((n, p) => n + p.cell.y + p.size.h / 2, 0) / spawned.length) * CELL_SIZE,
    };
    await this.panCamera(mid);
    await this.sleep(FX.summonDelayMs);
    const textures = await loadPortraits(spawned.map((p) => p.portrait));
    for (const m of spawned) this.exploration.monsters.add(m.id);
    this.syncMonsterVisibility(true);
    for (const m of spawned) this.pieces?.addPiece(m, textures);
    await Promise.all(spawned.map((m) => this.pieces?.enter(m)));
    await this.sleep(FX.afterSummonMs);
  }

  /** Un id libero per una pedina nuova. */
  private newPieceId(base: string): string {
    let n = this.state.pieces.length;
    while (this.state.pieces.some((p) => p.id === `${base}-${n}`)) n++;
    return `${base}-${n}`;
  }

  /** Tira `n` dadi potere e dice le facce uscite. */
  private async powerDice(n: number) {
    const rolls = await this.dice.rollFaces(Array<'black'>(n).fill('black'));
    await this.sleep(1700);
    return (rolls ?? []).map((r) => r.face);
  }

  /** I dadi potere che un eroe tira contro una trappola: quelli della carta più quelli che gli dà un'abilità (Talento naturale: 1 in più). */
  private trapDice(hero: Piece, n: number) {
    return this.powerDice(n + ruleAmount(this.state, hero, 'trapPowerDice'));
  }

  /** Ferite che l'armatura non riduce, da una trappola (1 in meno con Prudente, mai meno di 0). Se l'eroe cade lo racconta e restituisce true. */
  private hurtByTrap(hero: Piece, base: number): boolean {
    const amount = Math.max(0, base + ruleAmount(this.state, hero, 'trapWounds'));
    if (amount <= 0) {
      this.showNotice(`${hero.name} non subisce ferite`, 'shield', 'overlord');
      return false;
    }
    const dead = woundIgnoringArmor(hero, amount);
    loseOrdersOnWounds(hero); // e perde la Mira e la Guardia
    this.showNotice(`${hero.name} subisce ${amount} ${amount === 1 ? 'ferita' : 'ferite'}`, 'skull', 'overlord');
    if (!dead) {
      this.pieces?.redraw(hero);
      return false;
    }
    const slain = killHero(this.state, hero);
    this.pieces?.afterCombat(hero, hero, true);
    this.pieces?.monstersSlain(slain);
    this.showNotice(`${hero.name} è caduto: il gruppo perde ${hero.value} di Conquista e torna dalla città`, 'skull', 'overlord');
    return true;
  }

  /** Una trappola armata scatta su `hero`: la carta si scopre, si tirano i dadi potere e si applica l'effetto (docs/cards/overlord.md). */
  private async resolveTrap(hero: Piece, trap: ArmedTrap) {
    const card = cardOf(this.state, trap.card);
    if (!card || !this.board || this.overlordBusy()) return;
    this.overlordBusy.set(true);
    consumeTrap(this.state, trap);
    await this.announce(card.name, `${hero.name} ha fatto scattare una trappola!`, 'warning');
    const bonus = trapDamageBonus(this.state);
    let endTurn = false;
    const fallen: Piece[] = [];
    const board = this.board;
    switch (trap.card) {
      case 'spike-pit': {
        const faces = await this.trapDice(hero, 1);
        const cell = { ...hero.cell };
        this.obstacles.push({ type: 'pit', x: cell.x, y: cell.y, length: 1 });
        if (faces.some(isBlank)) { // basta una faccia vuota per schivare
          const out = freeAdjacentCell(this.state, board, cell);
          if (out) hero.cell = out;
          this.showNotice(`${hero.name} schiva la fossa e si sposta`, 'shield', 'overlord');
        } else if (this.hurtByTrap(hero, 2 + bonus)) fallen.push(hero);
        this.rebuildBoard();
        break;
      }
      case 'rockfall': {
        const faces = await this.trapDice(hero, 4);
        const cell = { ...hero.cell };
        const out = freeAdjacentCell(this.state, board, cell);
        if (this.hurtByTrap(hero, 4 + bonus - waves(faces))) fallen.push(hero);
        else if (out) hero.cell = out;
        this.obstacles.push({ type: 'rock', x: cell.x, y: cell.y, length: 1 });
        this.rebuildBoard();
        break;
      }
      case 'exploding-door': {
        const index = board.doors.findIndex((d) => d.door === this.doors[trap.at.kind === 'door' ? trap.at.index : -1]);
        for (const h of this.state.pieces.filter((p) => p.team === 'hero' && !p.city && index >= 0 && board.isAdjacentToDoor(p.cell, index))) {
          const faces = await this.trapDice(h, 4);
          if (this.hurtByTrap(h, 4 + bonus - waves(faces))) fallen.push(h);
        }
        break;
      }
      case 'exploding-rune': {
        const at = trap.at.kind === 'chest' ? trap.at : null;
        for (const h of this.state.pieces.filter((p) => at && p.team === 'hero' && !p.city && Math.max(Math.abs(p.cell.x - at.x), Math.abs(p.cell.y - at.y)) <= 1)) {
          const faces = await this.trapDice(h, 3);
          if (this.hurtByTrap(h, 6 + bonus - 2 * waves(faces))) fallen.push(h);
        }
        break;
      }
      case 'mimic': {
        // Lo scrigno è vivo: si sposta accanto all'eroe, diventa un Mimic e agisce subito; il bottino arriva quando muore.
        const chest = board.markerAt(hero.cell);
        const out = freeAdjacentCell(this.state, board, hero.cell);
        if (chest?.type !== 'chest' || !out) {
          this.showNotice('Lo scrigno resta immobile', 'inventory_2', 'overlord');
          break;
        }
        this.markers.splice(this.markers.indexOf(chest), 1);
        const [mimic] = createPieces([{ id: this.newPieceId('mimic'), team: 'monster', monster: 'mimic', x: out.x, y: out.y, drop: chest.contents ?? [], chestTier: chest.random === false ? undefined : chest.tier, chestDraws: chest.treasures }], new Map(), this.state.items, this.state.monsters, this.state.pieces.filter((p) => p.team === 'hero').length);
        this.state.pieces.push(mimic);
        this.exploration.monsters.add(mimic.id);
        const textures = await loadPortraits([mimic.portrait]);
        this.rebuildBoard();
        this.pieces?.addPiece(mimic, textures);
        await this.announce('Mimic', 'Lo scrigno era vivo!');
        await this.pieces?.enter(mimic);
        await this.sleep(500);
        await this.monsterTurn(mimic);
        break;
      }
      case 'toad-curse': {
        const faces = await this.trapDice(hero, 1);
        if (faces.length && !faces.some(isBlank)) { // si resiste con almeno una faccia vuota
          transformToad(hero);
          this.showNotice(`${hero.name} è trasformato in un rospo: il suo turno finisce`, 'warning', 'overlord');
          endTurn = true;
        } else this.showNotice(`${hero.name} resiste alla maledizione`, 'shield', 'overlord');
        break;
      }
      case 'paralyzing-gas': {
        const faces = await this.trapDice(hero, 1);
        if (faces.length && !faces.some(isBlank)) { // si resiste con almeno una faccia vuota
          inflictStatus(this.state, hero, 'stun', 1);
          this.showNotice(`${hero.name} è paralizzato: il suo turno finisce`, 'stun', 'overlord');
          endTurn = true;
        } else this.showNotice(`${hero.name} trattiene il fiato: il gas non ha effetto`, 'shield', 'overlord');
        break;
      }
    }
    this.pieces?.redraw(hero);
    this.exploreAndNotify();
    this.showHud(this.pieces?.active ?? null);
    this.overlordBusy.set(false);
    if (fallen.includes(hero) || endTurn) this.pass();
  }

  /** Un mostro: si muove se serve e, se può, attacca. */
  /** Com'era un mostro prima dell'ultimo passo, quando un eroe può usare la Vigilanza (il suo movimento si ferma lì). */
  /** Gli eroi che hanno rifiutato la Guardia contro il mostro che sta agendo (si azzera a ogni sua attivazione). */
  private guardDeclined = new Set<string>();
  private vigilanceFrom: { cell: Cell; size: { w: number; h: number } } | null = null;

  /**
   * Il mostro cammina lungo il suo percorso; se a un passo un eroe può usare la Vigilanza (è entrato accanto a lui), il movimento si ferma, l'eroe sceglie
   * se attaccare, e se il mostro sopravvive riprende da dove era arrivato.
   */
  private async walkMonster(monster: Piece, steps: Reach[]) {
    let rest = steps;
    for (let guard = 0; guard < 24 && rest.length && !this.destroyed; guard++) {
      this.vigilanceFrom = null;
      await this.pieces?.walk(monster, rest);
      if (!this.state.pieces.includes(monster)) return; // morto per strada
      const at = rest.findIndex((s) => s.cell.x === monster.cell.x && s.cell.y === monster.cell.y && (!s.size || (s.size.w === monster.size.w && s.size.h === monster.size.h)));
      rest = at < 0 ? [] : rest.slice(at + 1);
      const from = this.vigilanceFrom;
      if (!rest.length || !from) return;
      await this.resolveVigilance(monster, from);
      if (!this.state.pieces.includes(monster) || monster.wounds <= 0 || this.state.status !== 'playing') return;
    }
  }

  /** Vigilanza: a ogni eroe che può, si chiede se spendere la fatica per attaccare il mostro appena arrivato accanto a lui (e con quale arma). */
  private async resolveVigilance(monster: Piece, from: { cell: Cell; size: { w: number; h: number } }) {
    if (!this.board) return;
    for (const chance of vigilanceChances(this.state, this.board, monster, from)) {
      if (!this.state.pieces.includes(monster)) return;
      const answer = await this.askChoice({
        title: 'Vigilanza',
        text: `${monster.name} è entrato accanto a ${chance.hero.name}. Spendere {fat:${chance.cost}} per attaccarlo subito?`,
        choices: [...chance.options.map((o) => ({ id: o.id, label: o.name, primary: true })), { id: 'no', label: 'Rinuncia' }],
      });
      const option = chance.options.find((o) => o.id === answer);
      if (option) await this.vigilanceAttack(chance.hero, monster, option, chance.cost);
    }
    await this.resolveGuard(monster);
  }

  /** Guardia: gli eroi con quell'ordine scelgono se interrompere il mostro con un attacco gratuito; l'ordine si perde dopo l'uso. */
  private async resolveGuard(monster: Piece) {
    if (!this.board) return;
    for (const chance of guardChances(this.state, this.board, monster, this.guardDeclined)) {
      if (!this.state.pieces.includes(monster) || monster.wounds <= 0) return;
      const answer = await this.askChoice({
        title: 'Guardia',
        text: `${chance.hero.name} è in Guardia: può interrompere ${monster.name} con un attacco. Perde l'ordine dopo averlo usato.`,
        choices: [...chance.options.map((o) => ({ id: o.id, label: o.name, primary: true })), { id: 'no', label: 'Rinuncia' }],
      });
      const option = chance.options.find((o) => o.id === answer);
      if (!option) {
        this.guardDeclined.add(chance.hero.id); // non può ripensarci in questa attivazione
        continue;
      }
      chance.hero.order = null;
      await this.vigilanceAttack(chance.hero, monster, option, 0);
      this.showHud(this.pieces?.active ?? null);
    }
  }

  /** L'attacco della Vigilanza: la finestra normale dell'attacco (l'eroe tira i dadi), fuori turno e senza consumare i suoi attacchi; la fatica si paga all'applicazione. */
  private async vigilanceAttack(hero: Piece, monster: Piece, option: AttackOption, pay: number) {
    await this.frameBoth(hero, monster);
    const plan = planAttack(this.state, hero, monster, option);
    await this.attackIntro(hero, monster, option);
    this.attackSession.set({ attackerId: hero.id, targetId: monster.id, option, plan, step: 'preview', rolls: [], choices: {}, spent: [], sorcery: { range: 0, damage: 0 }, free: { pay } });
    await this.waitUntil(() => !this.attackSession() && !this.applyingAttack, 120000);
    await this.waitUntil(() => !this.knockback(), 60000); // un Contraccolpo dell'arma si risolve prima che il mostro riprenda
  }

  private async monsterTurn(monster: Piece) {
    this.guardDeclined = new Set();
    if (monster.inactive) return; // un nemico inattivo non agisce
    if (await this.resolveTurnStart(monster)) return; // morto per la fiamma
    // Stordito: un mostro normale perde il turno; uno potenziato può solo muoversi oppure attaccare.
    if (monster.stunned && !monster.enhanced) return;
    if (isDormant(this.state, this.board!, monster)) return; // dorme finché la sua area non è rivelata
    // Carica: se non ha nessuno da colpire, la velocità di questa attivazione è raddoppiata.
    if (!chooseMonsterTarget(this.state, this.board!, monster) && this.state.random() < 0.6 && playEvent(this.state, 'charge')) {
      monster.points *= 2;
      await this.announceEvent('Carica', `${monster.name} corre il doppio.`);
    }
    const steps = monster.stunned && chooseMonsterTarget(this.state, this.board!, monster) ? [] : planMonsterMove(this.state, this.board!, monster);
    if (steps.length) {
      await this.walkMonster(monster, steps);
      await this.sleep(250);
    }
    this.monsterPicksUp(monster); // se si è fermato su un oggetto trasportabile (la Principessa) lo prende
    let attacked = false;
    // Furore: due attacchi in questa attivazione (quattro con Colpo veloce).
    if (!(monster.stunned && steps.length) && monster.attacks > 0 && chooseMonsterTarget(this.state, this.board!, monster) && this.state.random() < 0.7 && playEvent(this.state, 'fury')) {
      monster.attacks = keywordLevel(this.state, monster, 'Colpo veloce') > 0 ? 4 : 2;
      await this.announceEvent('Furore', `${monster.name} attacca più volte.`);
    }
    // Colpo veloce: fino a due attacchi (uno solo per chi non lo ha).
    for (let i = 0; i < 5 && monster.attacks > 0 && !this.destroyed; i++) {
      const target = monster.stunned && steps.length ? null : chooseMonsterTarget(this.state, this.board!, monster);
      if (!target) break;
      await this.monsterAttack(monster, target);
      attacked = true;
      if (this.state.status !== 'playing') break;
    }
    if (!attacked) await this.sleep(150);
  }

  /** Un mostro che sa trasportare e si è fermato sulla casella di un oggetto trasportabile lo prende: sparisce dalla mappa e lo si dice. */
  private monsterPicksUp(monster: Piece) {
    if (!this.board) return;
    const item = monsterTakesItem(this.state, this.board, monster);
    if (!item) return;
    this.rebuildBoard();
    this.pieces?.redraw(monster);
    this.showNotice(`${monster.name} afferra ${item.name}!`, item.icon ?? 'person', 'overlord');
  }

  /**
   * L'inizio di un attacco, prima del dialogo: in mischia l'attaccante scatta verso il bersaglio e si ferma a metà strada; a distanza o con la magia
   * compare la linea (azzurra o viola) e un proiettile corre a metà strada.
   */
  private async attackIntro(attacker: Piece, target: Piece, option: AttackOption) {
    if (!this.pieces) return;
    if (option.attack === 'melee') {
      if (option.via) await this.pieces.pulse(attacker); // attraverso una scala il bersaglio è lontano: niente scatto, solo un guizzo
      else await this.pieces.lunge(attacker, target);
    } else await this.pieces.beginShot(attacker, target, option.attack === 'magic' ? 'magic' : 'ranged', option.via);
  }

  /** Dopo che l'attacco si applica: lo scontro (mischia) o l'arrivo del proiettile, con il numero rosso dei danni o la scritta Mancato sopra il bersaglio. */
  private async attackImpact(attacker: Piece, target: Piece, option: AttackOption, outcome: { miss: boolean; inRange: boolean; feared?: boolean; damage: number }) {
    if (!this.pieces) return;
    const hit = !outcome.miss && outcome.inRange && !outcome.feared;
    const hurt = hit && outcome.damage > 0;
    const text = !hit ? (outcome.miss ? 'Mancato' : !outcome.inRange ? 'Fuori portata' : 'Spaventato') : outcome.damage > 0 ? `-${outcome.damage}` : '0';
    const show = () => this.pieces?.floatText(target, text, hurt ? 'damage' : 'miss');
    // Attraverso una scala il bersaglio sta altrove: la camera va da lui perché si veda l'esito.
    if (option.via) await this.frameCells([...footprint(target), option.via.to]);
    if (option.attack === 'melee') await (option.via ? this.pieces.strikeThrough(attacker, target, hurt, show) : this.pieces.strike(attacker, target, hurt, show));
    else await this.pieces.finishShot(hit, show);
  }

  /** L'attacco di un mostro con la stessa finestra degli eroi: tira l'Overlord, chi guarda vede e prosegue (o aspetta qualche secondo). */
  private async monsterAttack(monster: Piece, target: Piece, forced?: AttackOption) {
    const option = forced ?? monsterAttackOption(this.state, this.board!, monster, target);
    if (!option?.enabled) return;
    if (monster.team === 'monster') {
      this.exploration.monsters.add(monster.id); // chi attacca si fa vedere
      this.pieces?.showMonster(monster);
    }
    if (monster.team === 'monster' && target.team === 'hero') {
      // La camera contiene i due che combattono; se l'attacco passa per una scala sono lontani: si inquadra prima l'attaccante con la sua scala, poi (all'impatto) il bersaglio.
      if (option.via) await this.frameCells([...footprint(monster), option.via.from]);
      else await this.frameBoth(monster, target);
    }
    // Guardia: gli eroi in guardia possono interrompere prima che l'attacco si svolga; se il mostro cade, l'attacco salta.
    if (monster.team === 'monster' && target.team === 'hero') {
      await this.resolveGuard(monster);
      if (!this.state.pieces.includes(monster) || monster.wounds <= 0 || !this.state.pieces.includes(target) || this.state.status !== 'playing') return;
    }
    // Mirare: l'attacco è mirato, cioè i dadi che non servono si ripetono (resta il secondo risultato). Contro un eroe con Schivata si annullano a vicenda.
    const dodging = target.team === 'hero' && target.order === 'dodge' && monster.team === 'monster';
    let aimed = monster.team === 'monster' && this.state.random() < 0.8 && playEvent(this.state, 'aim');
    if (aimed && dodging) {
      aimed = false;
      target.order = null;
      this.showNotice(`${target.name}: la Schivata annulla l'attacco mirato`, 'tactic');
    }
    const canDodge = dodging && target.order === 'dodge';
    if (aimed) await this.announceEvent('Mirare', `${monster.name} fa un attacco mirato: ripete i dadi che non servono.`, 'swords');
    const plan = planAttack(this.state, monster, target, option);
    const breathDir = plan.area.breath ? breathDirTo(this.state, this.board!, monster, target) : null;
    await this.attackIntro(monster, target, option);
    this.attackSession.set({ attackerId: monster.id, targetId: target.id, option, plan, step: 'preview', rolls: [], choices: {}, spent: [], sorcery: { range: 0, damage: 0 }, auto: true, breathDir });
    await this.sleep(700);
    const cur = this.attackSession();
    if (!cur || this.destroyed) return;
    this.attackSession.set({ ...cur, step: 'rolling' });
    let rolls = await this.dice.rollFaces(option.dice);
    if (!rolls) {
      this.attackSession.set(null);
      return;
    }
    if (aimed) {
      await this.sleep(1700);
      const bad = rolls.map((_, i) => i).filter((i) => { const f = rolls![i].face; return f.miss || isBlank(f) || (!f.slash && !f.hearts && !f.surge); });
      rolls = await this.rerollDice(rolls, bad);
    }
    // Schivata: l'eroe sceglie quali dadi dell'attacco far ripetere (una sola volta; l'ordine resta fino al suo prossimo turno).
    if (canDodge) {
      await this.sleep(1400);
      const picked = await this.pickDice({ title: 'Schivata', text: `Scegli i dadi di ${monster.name} da far ripetere: varrà il secondo risultato.`, dice: rolls, confirm: 'Ripeti i dadi scelti', skip: 'Tieni il tiro' });
      if (picked?.length) rolls = await this.rerollDice(rolls, picked);
    }
    // Sulle facce multivalenti del dado potere sceglie lo script: la gittata se serve per arrivare, altrimenti il cuore.
    const choices: Record<number, 'range' | 'heart'> = {};
    let range = plan.bonusRange + rolls.reduce((n, r) => n + (r.face.slash ? 0 : r.face.range), 0);
    rolls.forEach((r, i) => {
      if (!r.face.slash) return;
      choices[i] = plan.needsRange && range < plan.distance ? 'range' : 'heart';
      if (choices[i] === 'range') range += r.face.range;
    });
    // Stregoneria: lo script porta la gittata fino alla distanza e mette il resto sul danno.
    const need = plan.needsRange ? Math.max(0, plan.distance - range) : 0;
    const sr = Math.min(plan.sorcery, need);
    this.attackSession.update((se) => (se ? { ...se, step: 'rolled', rolls, choices, sorcery: { range: sr, damage: plan.sorcery - sr } } : se));
    await this.waitUntil(() => !this.attackSession() && !this.applyingAttack, 120000); // il pannello si chiude da solo quando finisce la sua barra (ferma con il mouse sopra o con un tocco)
    await this.sleep(500);
  }

  /** Una voce del menu dell'app. */
  protected onMenu(id: string) {
    if (id === 'components') {
      void loadAllHeroSheets().then((heroes) => {
        this.catalog.set(this.buildCatalog(heroes));
        this.componentsOpen.set(true);
      });
    } else this.showNotice('Non ancora disponibile', 'info', 'game');
  }

  /** Il catalogo dei componenti, dai cataloghi caricati: oggetti del negozio, i tre mazzi dei tesori, le reliquie e le carte abilità dei tre rami. */
  private buildCatalog(heroes: HeroSheet[]): CatalogCategory[] {
    const s = this.state;
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'it');
    const itemEntry = (d: ItemDef, count: number | null): CatalogEntry => {
      const detail = itemDetail(d);
      return { kind: 'item', id: d.id, name: d.name, def: d, icon: d.icon ?? 'inventory_2', detail, count, search: [d.name, detail, d.offHand ?? '', ...(d.rules ?? []), ...(d.surge ?? []).map((x) => x.effect)].join(' ') };
    };
    const items = [...s.items.values()];
    const itemsOf = (pick: (d: ItemDef) => boolean, count: (d: ItemDef) => number | null) => items.filter(pick).map((d) => itemEntry(d, count(d))).sort(byName);
    const skillEntries = (school: string): CatalogEntry[] =>
      [...s.skills.values()].filter((k) => k.school === school).map((k): CatalogEntry => ({ kind: 'skill', id: k.id, name: k.name, def: k, search: `${k.name} ${k.text}` })).sort(byName);
    // Le pozioni non sono oggetti del catalogo (ogni eroe ne porta fino a 3 nel suo set) e altri consumabili potranno aggiungersi: hanno la loro categoria, con il prezzo del negozio.
    const potion = (id: string, name: string, kind: PotionKind, rules: string[]): CatalogEntry => {
      const def: ItemDef = { id, name, kind: 'other', hands: 0, price: POTION_PRICES[kind], rules };
      return { kind: 'item', id, name, def, icon: 'tokens/potion', detail: 'Pozione', count: null, search: [name, 'pozione', ...rules].join(' ') };
    };
    const potionEntries: CatalogEntry[] = [
      potion('potion-heal', 'Pozione curativa', 'heal', [`Recupera ${POTION_HEAL} ferite. Berla costa ${POTION_DRINK_COST} punto movimento.`, 'Si porta fino a 3 pozioni.']),
      potion('potion-vital', 'Pozione del vigore', 'vital', ['Riporta la fatica al massimo. Berla costa 1 punto movimento.', 'Si porta fino a 3 pozioni.']),
    ];
    const heroEntries = heroes.map((h): CatalogEntry => ({
      kind: 'hero', id: h.id, name: h.name, sheet: h, search: [h.name, h.class, h.archetype].join(' '),
    })).sort(byName);
    const monsterEntries = [...this.monsterDefs.values()].map((m): CatalogEntry => ({
      kind: 'monster', id: m.id, name: m.name, def: m, search: [m.name, ...m.normal.abilities, ...m.enhanced.abilities].join(' '),
    })).sort(byName);
    return [
      { id: 'heroes', group: 'Personaggi', name: 'Eroi', entries: heroEntries },
      { id: 'monsters', group: 'Personaggi', name: 'Mostri', entries: monsterEntries },
      { id: 'shop', group: 'Oggetti', name: 'Negozio', entries: itemsOf((d) => d.id in s.shop, (d) => s.shop[d.id] ?? 0) },
      { id: 'potions', group: 'Consumabili', name: 'Pozioni', entries: potionEntries },
      { id: 'copper', group: 'Tesori', name: 'Rame', entries: itemsOf((d) => d.deck === 'copper', (d) => d.copies ?? 1) },
      { id: 'silver', group: 'Tesori', name: 'Argento', entries: itemsOf((d) => d.deck === 'silver', (d) => d.copies ?? 1) },
      { id: 'gold', group: 'Tesori', name: 'Oro', entries: itemsOf((d) => d.deck === 'gold', (d) => d.copies ?? 1) },
      { id: 'relics', group: 'Reliquie', name: 'Reliquie', entries: itemsOf((d) => !!d.tags?.includes('relic'), () => null) },
      { id: 'combat', group: 'Abilità', name: 'Combattimento', entries: skillEntries('combat') },
      { id: 'cunning', group: 'Abilità', name: 'Sotterfugio', entries: skillEntries('cunning') },
      { id: 'magic', group: 'Abilità', name: 'Magia', entries: skillEntries('magic') },
    ];
  }

  /** Quali mostri si vedono: quelli scoperti dagli eroi (o tutti, se non c'è la nebbia); nella vista Overlord tutti. */
  private syncMonsterVisibility(fog = this.fogOn()) {
    this.pieces?.setVisibleMonsters(fog && !this.overlordView() ? this.exploration.monsters : null);
  }

  /** Accende e spegne la vista Overlord (provvisorio, dal tab dell'Overlord). */
  protected toggleOverlordView() {
    this.overlordView.update((v) => !v);
    this.monsterPanel.set(null);
    this.syncMonsterVisibility();
    this.showNotice(this.overlordView() ? 'Vista Overlord: tocca un mostro per vederne la scheda' : 'Vista Giocatore', 'skull', 'overlord');
  }

  /** Un clic sul pallino di un eroe nella barra. */
  protected selectFromBar(id: string) {
    this.pieces?.selectHero(id);
  }

  /** L'azione scelta dall'eroe attivo, per i pallini dei comandi. */
  protected readonly activeAction = computed(() => this.members().find((m) => m.kind === 'hero' && m.active)?.action ?? 'advance');

  /** Ora i comandi non si possono usare: durante l'attacco, il turno dell'Overlord o la finestra dei componenti. */
  protected readonly commandsBusy = computed(() => !!this.attackSession() || this.overlordBusy() || this.componentsOpen() || this.settingUp() || !!this.adventureDialog() || !!this.telekinesis() || !!this.choiceView() || !!this.dicePickView());

  /** Un comando scelto con un pallino o con il bottone Passa (gli stessi dei tasti R, C, S e Invio). */
  protected tapCommand(c: 'run' | 'fight' | 'rest' | 'prepare' | 'pass') {
    if (this.commandsBusy()) return;
    if (c === 'pass') this.pass();
    else this.command(c);
  }

  /** Correre o Combattere per l'eroe attivo (tasti R e C). */
  private command(requested: 'run' | 'fight' | 'rest' | 'prepare') {
    const hero = this.pieces?.active;
    // Prepararsi senza ordine: premerlo di nuovo non annulla l'azione ma riapre la scelta dell'ordine.
    if (requested === 'prepare' && hero?.action === 'prepare' && !hero.order && !hero.orderPlaced && canActOnMap(this.state, hero)) {
      void this.chooseOrder();
      return;
    }
    const r = this.pieces?.setAction(requested);
    if (r && !r.ok) this.showNotice(this.deniedText(r, requested), 'warning');
    else if (r?.ok && r.action === 'prepare') void this.chooseOrder();
  }

  /** Prepararsi: si sceglie l'ordine da piazzare (Mira, Schivata, Guardia): uno solo alla volta, finché non è usato o perso non se ne piazza un altro. */
  private async chooseOrder() {
    const hero = this.pieces?.active;
    if (!hero || hero.action !== 'prepare') return;
    if (hero.order) {
      this.showNotice(`Hai già l'ordine ${ORDER_NAMES[hero.order]}: finché non lo usi o lo perdi non ne piazzi un altro`, 'info');
      return;
    }
    const answer = await this.askChoice({
      title: 'Prepararsi: piazza un ordine',
      text: 'Mira: ripeti dei dadi del tuo prossimo attacco, finché non ti muovi, cambi equipaggiamento o sei ferito. Schivata: fai ripetere un attacco nemico, fino al tuo prossimo turno. Guardia: interrompi il turno del Signore supremo con un attacco, fino al tuo prossimo turno.',
      choices: [
        { id: 'aim', label: 'Mira', primary: true }, { id: 'dodge', label: 'Schivata', primary: true }, { id: 'guard', label: 'Guardia', primary: true },
        { id: 'no', label: 'Nessuno per ora' },
      ],
    });
    if (answer !== 'aim' && answer !== 'dodge' && answer !== 'guard') return;
    const r = placeOrder(this.state, hero, answer);
    if (!r.ok) {
      this.showNotice(r.reason === 'has' ? 'Hai già un ordine' : 'Non puoi piazzare un ordine adesso', 'warning');
      return;
    }
    this.showNotice(`Ordine piazzato: ${ORDER_NAMES[answer]}`, 'tactic');
    this.pieces?.refreshActive();
    this.showHud(this.pieces?.active ?? null);
  }

  private deniedText(r: Extract<ActionChange, { ok: false }>, requested: 'run' | 'fight' | 'rest' | 'prepare'): string {
    if (r.reason === 'turn') return 'Ora non puoi cambiare azione';
    if (r.reason === 'ordered') return 'Hai già piazzato un ordine: non puoi cambiare azione';
    if (requested === 'prepare') return 'Per prepararti non devi aver già mosso e attaccato';
    if (r.reason === 'toad') return 'Sei un rospo: niente correre né combattere';
    if (r.reason === 'stunned') return 'Sei stordito: puoi solo muoverti o attaccare';
    if (requested === 'rest') return 'Per riposare non devi aver mosso né attaccato';
    if (r.reason === 'attacked') return 'Hai già attaccato: non puoi correre';
    return requested === 'fight' ? 'Hai già speso punti movimento: non puoi combattere' : 'Hai già speso troppi punti movimento per cambiare azione';
  }

  /** L'eroe attivo passa (tasto Invio). */
  private async pass() {
    if (this.returnMode() && this.returnOptions().length) {
      this.showNotice('Devi tornare nel dungeon: scegli un glifo', 'warning');
      return;
    }
    if (this.overlordBusy() || this.choiceView()) return;
    // Al termine del turno si può usare un oggetto che lo prevede (il Flauto del riposo: stordisce i mostri vicini e si scarta).
    const hero = this.pieces?.active;
    if (hero && hero.team === 'hero' && !hero.city && this.state.phase === 'heroes') {
      for (const item of turnEndItems(this.state, hero)) {
        const answer = await this.askChoice({
          title: item.name,
          text: `Scartarlo per mettere ${item.amount === 1 ? '1 segnalino stordito' : `${item.amount} segnalini storditi`} su ogni mostro entro ${item.range} spazi da ${hero.name}?`,
          choices: [{ id: 'use', label: `Usa ${item.name}`, primary: true }, { id: 'no', label: 'Non ora' }],
        });
        if (answer !== 'use') continue;
        const used = useTurnEndItem(this.state, hero, item.id);
        if (!used) continue;
        const seen = (m: Piece) => !this.fogOn() || this.exploration.monsters.has(m.id);
        const names = used.stunned.filter(seen).map((m) => m.name);
        this.showNotice(names.length ? `${item.name}: storditi ${names.join(', ')}` : `${item.name}: nessun mostro in vista è stato stordito`, 'stun');
        for (const m of used.stunned) this.pieces?.redraw(m);
        this.pieces?.refreshActive();
      }
    }
    const r = this.pieces?.passTurn();
    if (!r) return;
    if (r.overlord) {
      void this.runOverlordTurn();
      return;
    }
    if (r.toadEnded) this.showNotice('La maledizione è finita: torna normale', 'autorenew', 'overlord');
    const next = this.state.pieces.find((p) => p.id === r.nextActive);
    this.showNotice(r.roundStarted ? `Round ${this.state.round}: tocca agli eroi` : `Tocca a ${next?.name ?? '—'}`, 'autorenew', 'game');
  }

  /** Un bottone spento è stato toccato: il motivo per cui non si può, come notifica. */
  protected showReason(text: string) {
    this.showNotice(text, 'warning');
  }

  /**
   * Una notifica in alto a destra: autore (di solito l'eroe attivo, oppure l'Overlord o il gioco), titolo (la categoria, dall'icona), icona e testo.
   * Sparisce da sola quando la sua barra del tempo finisce (`expireToast`).
   */
  private showNotice(text: string, icon = 'info', by: 'hero' | 'overlord' | 'game' = 'hero', markdown = false) {
    const toast: Toast = { id: ++this.toastId, icon, title: noticeTitle(icon), author: this.noticeAuthor(by), text, ...(markdown ? { markdown } : {}) };
    this.toasts.update((list) => [...list, toast].slice(-4));
  }

  /** Chi firma la notifica. */
  private noticeAuthor(by: 'hero' | 'overlord' | 'game'): ToastAuthor {
    if (by === 'overlord') return { name: 'Signore supremo', portrait: 'characters/overlord.webp' };
    const hero = by === 'hero' ? this.state.pieces.find((p) => p.id === this.state.activeId && p.team === 'hero') : undefined;
    return hero ? { name: hero.name, portrait: hero.portrait } : { name: 'Gioco' };
  }

  /** La barra del tempo di una notifica è finita: parte la dissolvenza, poi sparisce. */
  protected expireToast(id: number) {
    this.toasts.update((list) => list.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    const timer = setTimeout(() => {
      this.toastTimers.delete(timer);
      this.toasts.update((list) => list.filter((x) => x.id !== id));
    }, 260);
    this.toastTimers.add(timer);
  }

  /** L'icona della notifica per un segnalino toccato. */
  private markerIcon(m: Marker): string {
    if (m.type === 'item') return this.state.items.get(m.itemId)?.icon ?? 'inventory_2';
    return { glyph: 'brightness_empty', potion: 'tokens/potion', coins: 'tokens/gold_pile', key: 'tokens/little_key', rune: 'tokens/rune_key', chest: 'inventory_2', stairs: 'stairs', encounter: 'lightning_stand' }[m.type];
  }

  /** Clic in modalità "gioco": si muove la pedina (porte e scrigni si usano dal bottone contestuale). */
  private playClick(p: Point) {
    if (this.overlordBusy()) return; // gioca l'Overlord
    const c = this.toCells(p);
    const cell = { x: Math.floor(c.x), y: Math.floor(c.y) };
    if (this.state.setup) {
      this.placementClick(cell); // preparazione: si sceglie la casella di partenza
      return;
    }
    if (this.telekinesis()) {
      void this.telekinesisClick(cell); // Telecinesi: si sceglie il modello e dove spostarlo
      return;
    }
    if (this.knockback()) {
      this.chooseKnockback(cell); // Contraccolpo: si sceglie dove spostare il bersaglio
      return;
    }
    if (this.returnMode()) {
      this.returnClick(cell);
      return;
    }
    this.pieces?.click(cell);
  }

  // --- Inizio della partita (state/setup.ts) ---

  /** Mette da parte gli eroi e apre la preparazione (prima che nasca la grafica delle pedine). */
  private setUpAdventure() {
    const s = this.state;
    this.pendingHeroes = s.pieces.map((piece, index) => ({ piece, index })).filter((x) => x.piece.team === 'hero');
    this.heroSlots.set(this.pendingHeroes.length);
    for (const { piece } of this.pendingHeroes) s.pieces.splice(s.pieces.indexOf(piece), 1);
    s.activeId = null;
    s.setup = startSetup(s);
    this.settingUp.set(true);
    this.barsIn.set(false);
  }

  /** Mostra il passo di preparazione in corso: una dialog di lettura oppure la scelta delle caselle. */
  private nextSetupStep() {
    const s = this.state;
    const setup = s.setup;
    if (!setup) return;
    const title = s.title ?? 'Avventura';
    if (setup.step === 'intro') this.adventureDialog.set({ kicker: 'Introduzione', title, text: s.intro ?? '', action: 'Ho letto', dismissible: false });
    else if (setup.step === 'objective') this.adventureDialog.set({ kicker: 'Obiettivo', title, text: objectiveText(s), action: 'Ho letto', dismissible: false });
    else if (setup.step === 'rules') this.adventureDialog.set({ kicker: 'Regole speciali', title, text: s.rules ?? '', action: 'Ho letto', dismissible: false });
    else this.beginPlacement();
  }

  /** Scegliere dei dadi da ripetere (Mira, Schivata): si aspetta la scelta (le posizioni dei dadi, o null se si rinuncia). */
  protected readonly dicePickView = signal<DicePickView | null>(null);
  private dicePickResolve: ((picked: number[] | null) => void) | null = null;
  private pickDice(view: DicePickView): Promise<number[] | null> {
    return new Promise((resolve) => {
      this.dicePickResolve = resolve;
      this.dicePickView.set(view);
    });
  }
  protected onDicePicked(picked: number[] | null) {
    this.dicePickView.set(null);
    const resolve = this.dicePickResolve;
    this.dicePickResolve = null;
    resolve?.(picked);
  }

  /** Una domanda con dei bottoni (Vigilanza...): si aspetta la scelta. */
  protected readonly choiceView = signal<ChoiceView | null>(null);
  private choiceResolve: ((id: string) => void) | null = null;
  private askChoice(view: ChoiceView): Promise<string> {
    return new Promise((resolve) => {
      this.choiceResolve = resolve;
      this.choiceView.set(view);
    });
  }
  protected onChoice(id: string) {
    this.choiceView.set(null);
    const resolve = this.choiceResolve;
    this.choiceResolve = null;
    resolve?.(id);
  }

  /** Il tasto della dialog: durante la preparazione conferma la lettura (e passa al passo dopo), altrimenti chiude. */
  protected onAdventureDialog() {
    if (this.eventResolve) {
      // Un messaggio di evento: chiude e lascia passare al prossimo della coda.
      const resolve = this.eventResolve;
      this.eventResolve = null;
      this.adventureDialog.set(null);
      resolve();
      return;
    }
    const setup = this.state.setup;
    this.adventureDialog.set(null);
    if (!setup) return;
    confirmReading(this.state, SETUP_PLAYERS);
    this.nextSetupStep();
  }

  /** Il tasto Obiettivo in alto: rilegge il testo dell'obiettivo in qualunque momento. */
  protected showObjective() {
    if (this.adventureDialog() || !this.state.objective) return;
    const rules = this.state.rules?.trim();
    this.adventureDialog.set({ kicker: 'Obiettivo', title: this.state.title ?? 'Avventura', text: objectiveText(this.state) + (rules ? `\n\n### Regole speciali\n\n${rules}` : ''), action: 'Chiudi', dismissible: true }); // l'obiettivo e, sotto, le regole speciali
  }

  /** Le caselle di partenza si illuminano e la camera si porta lì; gli eroi scelgono uno alla volta. */
  private beginPlacement() {
    this.pieces?.setEnabled(false); // niente area di movimento finché gli eroi non sono in campo
    const cells = startCells(this.state, this.board!);
    this.drawStartCells(cells);
    const next = this.pendingHeroes[0];
    if (!next || !cells.length) {
      this.finishSetup();
      return;
    }
    this.setupPrompt.set(`Scegli la casella di partenza di ${next.piece.name}`);
    const app = this.app;
    if (app) {
      const cx = cells.reduce((a, c) => a + c.x + 0.5, 0) / cells.length;
      const cy = cells.reduce((a, c) => a + c.y + 0.5, 0) / cells.length;
      this.camTween = {
        fromZoom: this.zoom,
        toZoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, CAMERA_FOCUS_ZOOM)),
        from: { x: (app.screen.width / 2 - this.camX) / this.zoom, y: (app.screen.height / 2 - this.camY) / this.zoom },
        to: { x: cx * CELL_SIZE, y: cy * CELL_SIZE },
        elapsed: 0,
      };
    }
  }

  /** Le caselle fra cui scegliere: un cerchio giallo a trattini, senza riempimento, che lampeggia piano (`tickStartLayer`). */
  private drawStartCells(cells: Cell[]) {
    const g = this.startLayer;
    if (!g) return;
    g.clear();
    const m = START_MARK;
    const r = m.radius * CELL_SIZE;
    const step = (Math.PI * 2) / m.dashes;
    for (const c of cells) {
      const cx = (c.x + 0.5) * CELL_SIZE;
      const cy = (c.y + 0.5) * CELL_SIZE;
      for (let i = 0; i < m.dashes; i++) {
        const a = i * step;
        g.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        g.arc(cx, cy, r, a, a + step * m.dashFill);
      }
    }
    if (cells.length) g.stroke({ width: m.line, color: theme.color.accentReach, cap: 'round' });
  }

  private startPulse = 0;
  private readonly reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** Il lampeggio lento dei cerchi di partenza. */
  private tickStartLayer(dtMs: number) {
    const g = this.startLayer;
    if (!g || !this.state?.setup) return;
    this.startPulse = (this.startPulse + dtMs) % START_MARK.pulseMs;
    const wave = this.reduceMotion ? 1 : (1 - Math.cos((this.startPulse / START_MARK.pulseMs) * Math.PI * 2)) / 2;
    g.alpha = START_MARK.alphaMin + (START_MARK.alphaMax - START_MARK.alphaMin) * wave;
  }

  /** Un clic sulla mappa durante la scelta: l'eroe di turno parte da quella casella (o da una libera vicina se è già presa). */
  private placementClick(cell: Cell) {
    const s = this.state;
    const board = this.board;
    const next = this.pendingHeroes[0];
    if (s.setup?.step !== 'placement' || !board || !next) return;
    if (!startCells(s, board).some((c) => c.x === cell.x && c.y === cell.y)) {
      this.showNotice('Scegli una delle caselle evidenziate', 'warning', 'game');
      return;
    }
    const final = placeHero(s, board, next.piece, cell);
    if (!final) {
      this.showNotice('Non c’è una casella libera', 'warning', 'game');
      return;
    }
    this.pendingHeroes.shift();
    s.pieces.splice(Math.min(next.index, s.pieces.length), 0, next.piece);
    this.pieces?.addPiece(next.piece);
    this.showHud(null); // la barra degli eroi si riempie man mano che entrano
    if (final.x !== cell.x || final.y !== cell.y) this.showNotice(`La casella era occupata: ${next.piece.name} parte lì accanto`, 'info', 'game');
    this.drawStartCells(startCells(s, board));
    const after = this.pendingHeroes[0];
    if (after) this.setupPrompt.set(`Scegli la casella di partenza di ${after.piece.name}`);
    else this.finishSetup();
  }

  /** Tutti gli eroi sono in campo: la preparazione finisce, si scopre ciò che vedono e comincia il primo turno. */
  private finishSetup() {
    const s = this.state;
    s.setup = null;
    this.settingUp.set(false);
    this.setupPrompt.set(null);
    this.startLayer?.clear();
    s.activeId = s.pieces.find((p) => p.team === 'hero')?.id ?? null;
    this.pieces?.setEnabled(true);
    this.rebuildBoard();
    this.showHud(this.pieces?.active ?? null); // l'eroe attivo e i suoi valori nella barra
    // A partita pronta la camera torna alla vista intera, con lo scorrimento di sempre, senza tener conto dell'inquadratura salvata; solo dopo entrano le barre.
    this.showWholeMap();
    void this.waitUntil(() => !this.camTween, 5000).then(() => this.barsIn.set(true));
    const first = s.pieces.find((p) => p.id === s.activeId);
    if (first) this.showNotice(`Tocca a ${first.name}`, 'autorenew', 'game');
  }

  /** L'eroe attivo usa la porta `index` (dal bottone contestuale). */
  private useDoorAt(index: number) {
    const r = this.pieces?.useDoor(index);
    if (!r) return;
    if (r.code === 'opened' || r.code === 'closed' || r.code === 'unlocked' || r.code === 'picked') {
      this.doorView?.redraw(this.board!, (d) => this.exploration.doors.has(d)); // parte l'animazione dell'anta
      this.exploreAndNotify(); // aprire una porta può far vedere cose nuove
      if (r.code === 'unlocked') this.showNotice('Serratura aperta con la chiave', 'lock_open');
      else if (r.code === 'picked') this.showNotice(`Serratura scassinata ({mov:${r.cost}})`, 'lock_open');
      const hero = this.pieces?.active;
      if (r.trap && hero) void this.resolveTrap(hero, r.trap);
    } else if (r.code === 'cost') this.showNotice(`Servono {mov:${r.cost}}`, 'warning');
    else if (r.code === 'blocked') this.showNotice("Una creatura è nel varco: la porta non si può chiudere", 'warning');
    else if (r.code === 'needs-key') this.showNotice('Porta chiusa a chiave: serve la chiave giusta', 'lock');
    else if (r.code === 'needs-rune') this.showNotice(`Serve la chiave runica ${RUNE_NAMES[r.color!]}`, 'lock');
    else if (r.code === 'needs-event') this.showNotice('La porta è sigillata: si aprirà quando succederà qualcosa', 'lock');
  }

  /** Un mostro ha aperto delle porte lungo la strada: si ridisegnano (parte l'animazione dell'anta) e, se i giocatori le vedono, lo si dice. */
  private monsterOpenedDoors(monster: Piece, indexes: number[]) {
    if (!this.board) return;
    this.doorView?.redraw(this.board, (d) => !this.fogOn() || this.exploration.doors.has(d));
    const seen = indexes.some((i) => !this.fogOn() || this.exploration.doors.has(this.board!.doors[i].door));
    if (seen) this.showNotice(`${monster.name} apre ${indexes.length > 1 ? 'delle porte' : 'una porta'}`, 'door_front', 'overlord');
    this.exploreAndNotify(); // una porta aperta può far vedere cose nuove agli eroi
  }

  /** L'eroe attivo usa il segnalino Incontro della sua casella (dal bottone contestuale): sparisce dalla mappa e scattano gli eventi. */
  private useEncounterHere() {
    const r = this.pieces?.useEncounter();
    if (!r) return;
    if (r.code === 'cost') {
      this.showNotice('Non hai abbastanza punti movimento', 'warning');
      return;
    }
    if (r.code !== 'used') return;
    this.pickupView?.redraw(this.board!, (m) => !this.fogOn() || this.exploration.markers.has(m));
    this.refreshContext();
    void this.flushEvents(); // gli eventi "usa un incontro" e "gli incontri non ci sono più"
  }

  /** L'eroe attivo raccoglie l'oggetto a terra nella sua casella (dal bottone contestuale, senza costo). */
  private pickUpHere() {
    const event = this.pieces?.pickUp();
    if (!event) return;
    this.showNotice(event.notice, event.kind === 'picked-up' ? this.markerIcon(event.marker) : 'warning');
    if (event.kind === 'picked-up') {
      this.pickupView?.redraw(this.board!, (m) => !this.fogOn() || this.exploration.markers.has(m));
      this.refreshContext();
      void this.flushEvents(); // gli eventi "un eroe raccoglie un oggetto"
    }
  }

  /** L'eroe attivo apre lo scrigno su cui sta (dal bottone contestuale). */
  private openChestHere() {
    const r = this.pieces?.useChest();
    if (!r) return;
    if (r.code === 'opened') {
      this.showNotice([r.ticket ? `Scrigno aperto (${r.ticket})` : 'Scrigno aperto', ...(r.found ?? [])].join(' · '), 'inventory_2');
      const hero = this.pieces?.active;
      if (r.trap && hero) void this.resolveTrap(hero, r.trap);
    }
    else if (r.code === 'mimic' && r.trap) {
      if (r.found?.length) this.showNotice(r.found.join(' · '), 'inventory_2'); // le Maledizioni dello scrigno, risolte prima
      const hero = this.pieces?.active;
      if (hero) void this.resolveTrap(hero, r.trap);
    } else if (r.code === 'already') this.showNotice('Lo scrigno è già aperto', 'inventory_2');
    else if (r.code === 'cost') this.showNotice(`Servono {mov:${r.cost}}`, 'warning');
    else if (r.code === 'full') this.showNotice('Non hai posto per ciò che contiene lo scrigno', 'warning');
  }

  /** Usa un'abilità dal bottone sulla sua carta. */
  protected useSkillAction(id: string) {
    const hero = this.pieces?.active;
    if (!hero || this.overlordBusy()) return;
    const action = skillActions(this.state, hero).find((a) => a.id === id);
    if (action?.kind === 'active') {
      this.beginTelekinesis(hero, action);
      return;
    }
    const r = useSkill(this.state, hero, id);
    if (!r.ok) {
      this.showNotice(r.reason, 'warning');
      return;
    }
    this.pieces?.refreshActive();
    this.showNotice(r.notice, 'bolt');
  }

  // --- Telecinesi: si sceglie un modello in vista e dove spostarlo di 1 spazio ---

  protected readonly telekinesis = signal<{ cost: number; step: 'model' | 'cell'; model?: string; moves?: Reach[] } | null>(null);
  private telekinesisOptions: Piece[] = [];

  private beginTelekinesis(hero: Piece, action: SkillAction) {
    if (!this.board || this.attackSession() || this.telekinesis()) return;
    if (!action.enabled) {
      this.showNotice(action.reason ?? 'Non è possibile', 'warning');
      return;
    }
    const known = (p: Piece) => p.team === 'hero' || !this.fogOn() || this.exploration.monsters.has(p.id);
    const targets = telekinesisTargets(this.state, this.board, hero, known);
    if (!targets.length) {
      this.showNotice('Nessun modello in vista che si possa spostare', 'warning');
      return;
    }
    const card = this.state.skills.get(action.cardId);
    this.telekinesisOptions = targets;
    this.panel.set(null); // la scheda non deve coprire la mappa
    this.pieces?.setEnabled(false); // niente area di movimento mentre si sceglie
    this.pieces?.showCells(targets.flatMap((p) => footprint(p)));
    this.telekinesis.set({ cost: card?.effects.reduce((n, e) => n + (((e as { cost?: { fatigue?: number } }).cost?.fatigue) ?? 0), 0) ?? 1, step: 'model' });
  }

  protected cancelTelekinesis() {
    this.telekinesis.set(null);
    this.pieces?.showCells(null);
    this.pieces?.setEnabled(true);
  }

  private async telekinesisClick(cell: Cell) {
    const t = this.telekinesis();
    const hero = this.pieces?.active;
    if (!t || !hero || !this.board) return;
    if (t.step === 'model') {
      const model = this.telekinesisOptions.find((p) => footprint(p).some((c) => c.x === cell.x && c.y === cell.y));
      if (!model) {
        this.showNotice('Tocca uno dei modelli evidenziati', 'warning');
        return;
      }
      const moves = telekinesisMoves(this.state, this.board, model);
      this.telekinesis.set({ ...t, step: 'cell', model: model.id, moves });
      this.pieces?.showCells(moveCells(moves));
      return;
    }
    const move = t.moves?.find((m) => m.cell.x === cell.x && m.cell.y === cell.y);
    const model = this.state.pieces.find((p) => p.id === t.model);
    if (!move || !model) {
      this.showNotice('Tocca una delle caselle evidenziate', 'warning');
      return;
    }
    hero.fatigue = Math.max(0, hero.fatigue - t.cost); // si paga quando si sposta
    this.telekinesis.set(null);
    this.pieces?.showCells(null);
    this.pieces?.setEnabled(true);
    this.showNotice(`Telecinesi: ${model.name} si sposta di 1 spazio ({fat:${t.cost}})`, 'bolt');
    await this.pieces?.walk(model, [move]);
    this.pieces?.refreshActive();
    this.exploreAndNotify();
    this.refreshContext();
  }

  /** Spende 1 fatica per 1 punto movimento in più (dal valore della fatica nel tab dell'eroe attivo). */
  protected spendFatigueForMove() {
    const hero = this.pieces?.active;
    if (!hero || this.overlordBusy()) return;
    const r = fatigueForMovement(this.state, hero);
    if (r.code === 'ok') {
      this.pieces?.refreshActive();
      this.showNotice('Spesa {fat:1}: +{mov:1}', 'water_drop');
    } else if (r.code === 'none') this.showNotice('Non hai più fatica', 'warning');
    else this.showNotice('Ora non puoi spendere fatica', 'warning');
  }

  /** L'eroe attivo beve una pozione (dal bottone contestuale). */
  private drinkPotion(kind: PotionKind) {
    const r = this.pieces?.drinkPotion(kind);
    if (!r) return;
    const name = POTION_NAMES[kind];
    if (r.code === 'drunk') this.showNotice(kind === 'vital' ? `${name} bevuta: fatica al massimo` : `${name} bevuta: +${r.healed} ferite`, 'tokens/potion');
    else if (r.code === 'full-health') this.showNotice('Sei già in piena salute', 'warning');
    else if (r.code === 'full-fatigue') this.showNotice('Hai già la fatica al massimo', 'warning');
    else if (r.code === 'cost') this.showNotice('Serve {mov:1}', 'warning');
  }

  /** L'eroe attivo interagisce con una pedina (dal bottone contestuale): scattano gli eventi, e i loro messaggi si leggono quando la scena si aggiorna. */
  private interactWith(targetId: string) {
    const r = this.pieces?.interact(targetId);
    if (!r) return;
    if (r.code === 'cost') this.showNotice('Non hai abbastanza punti movimento', 'warning');
    else if (r.code === 'far') this.showNotice('Sei troppo lontano', 'warning');
    else if (r.code === 'ok') void this.flushEvents();
  }

  /** L'eroe attivo viaggia in città dal glifo su cui si trova (dal bottone contestuale): spende tutto il movimento e si apre il pannello Città. */
  private travelToCity() {
    const active = this.pieces?.active;
    const r = this.pieces?.cityDo((s, b, p) => cityRules.travelToCity(s, b, p));
    if (!r || !active) return;
    if (r.code === 'ok') {
      this.showNotice(`${active.name} è in città`, 'castle');
      this.exploreAndNotify(); // la pedina non c'è più: la vista del gruppo cambia
      this.panel.set({ id: active.id, kind: 'city' });
    } else this.showNotice(r.code === 'cost' ? 'Serve almeno {mov:1}' : 'Serve un glifo acceso', 'warning');
  }

  /** Un'azione in città, dal pannello Città: servizi, acquisti, vendite, concludere la visita o tornare nel dungeon. */
  protected onCityAction(e: CityEvent) {
    if (e.kind === 'conclude') {
      this.pass();
      return;
    }
    const r = this.pieces?.cityDo((s, _b, p) => {
      switch (e.kind) {
        case 'service': return cityRules.chooseService(s, p, e.service);
        case 'potion': return cityRules.buyPotion(s, p, e.id);
        case 'treasure': return cityRules.buyTreasure(s, p, e.id);
        case 'item': return cityRules.buyItem(s, p, e.id);
        case 'sell': return cityRules.sellItem(s, p, e.id);
        case 'skill': return cityRules.buySkill(s, p, e.id);
        case 'train': return cityRules.trainDice(s, p, e.id);
        case 'heal': return cityRules.templeHeal(s, p);
      }
    });
    if (!r) return;
    if (r.code === 'ok') {
      if (r.notice) this.showNotice(r.notice, 'castle');
    } else this.showNotice(CITY_TEXTS[r.code] ?? 'Non è possibile', r.code === 'soon' ? 'info' : 'warning');
  }

  /** I glifi su cui l'eroe attivo (in città) può tornare adesso: quelli che può pagare. */
  private returnOptions(): cityRules.ReturnChoice[] {
    const active = this.pieces?.active;
    if (!active?.city || !this.board) return [];
    return cityRules.returnChoices(this.state, this.board, active).filter((c) => c.coins <= active.coins);
  }

  /**
   * Quando tocca a un eroe che è in città dal turno scorso, la scelta del glifo su cui tornare parte da sola (il pannello Città non c'è più): i glifi
   * possibili brillano e si clicca quello scelto. Non si annulla: deve tornare. Se nessun glifo è libero, lo dice e può solo passare.
   */
  private maybeStartReturn() {
    const active = this.pieces?.active;
    if (!active?.city || !this.board || this.returnMode() || !cityRules.canReturn(this.state, active)) return;
    const choices = this.returnOptions();
    if (!choices.length) {
      const key = `${active.id}:${this.state.round}`;
      if (this.noGlyphFor !== key) {
        this.noGlyphFor = key;
        this.showNotice('Nessun glifo acceso è libero: puoi solo passare il turno', 'warning');
      }
      return;
    }
    this.returnMode.set(true);
    this.panel.set(null);
    this.hint.set('Scegli il glifo su cui tornare: clic su uno di quelli che brillano');
    this.showNotice(`${active.name} torna nel dungeon: il glifo di partenza è gratis, gli altri costano ${cityRules.CITY_TELEPORT_COST_TEXT} monete`, 'castle');
    this.focusCell(choices.find((c) => c.coins === 0)?.cell ?? choices[0].cell);
  }

  private endReturn() {
    this.returnMode.set(false);
    this.hint.set(HINTS[this.mode]);
  }

  /** Sposta la camera (solo il pan, con uno scorrimento) su una casella. */
  private focusCell(cell: Cell) {
    const app = this.app;
    if (!app) return;
    this.camTween = {
      fromZoom: this.zoom, toZoom: this.zoom,
      from: { x: (app.screen.width / 2 - this.camX) / this.zoom, y: (app.screen.height / 2 - this.camY) / this.zoom },
      to: { x: (cell.x + 0.5) * CELL_SIZE, y: (cell.y + 0.5) * CELL_SIZE },
      elapsed: 0,
    };
  }

  /** Clic su una casella mentre si sceglie il glifo di ritorno. */
  private returnClick(cell: Cell) {
    const active = this.pieces?.active;
    if (!active || !this.board) return;
    const choice = this.returnOptions().find((c) => c.cell.x === cell.x && c.cell.y === cell.y);
    if (!choice) {
      this.showNotice('Scegli uno dei glifi accesi che brillano', 'warning');
      return;
    }
    const r = this.pieces?.cityDo((s, b, p) => cityRules.returnFromCity(s, b, p, choice.cell));
    if (r?.code === 'ok') {
      this.endReturn();
      this.exploreAndNotify();
      this.showNotice(r.notice ?? `${active.name} è tornato nel dungeon`, 'brightness_empty');
    } else if (r) this.showNotice(CITY_TEXTS[r.code] ?? 'Non è possibile', 'warning');
  }

  /** Le azioni sull'inventario dalla scheda completa: equipaggiare, mettere nello zaino, scartare. */
  /** L'inventario dell'eroe con, per ogni oggetto equipaggiato che si usa (Cura minore, Cristallo di Tival...), il suo uso: costo e se si può adesso. */
  private inventoryWithUses(s: GameState, p: Piece) {
    const inv = inventoryOf(s, p);
    for (const e of inv.equipped) e.use = itemUse(s, this.board ?? null, p, e.id) ?? undefined;
    return inv;
  }

  /** Usa un oggetto dell'eroe attivo (dal bottone "Usa" della sua card): se può curare un adiacente, l'eroe sceglie chi. */
  private async useItemAction(itemId: string) {
    const hero = this.pieces?.active;
    if (!hero || this.overlordBusy() || !this.board) return;
    const use = itemUse(this.state, this.board, hero, itemId);
    if (!use?.enabled) {
      this.showNotice(use?.reason ?? 'Non è possibile', 'warning');
      return;
    }
    let target: string | undefined;
    if (use.pickTarget) {
      const needs = (h: Piece) => h.wounds < h.maxWounds || h.status.poison > 0;
      const options = [hero, ...adjacentHeroes(this.state, this.board, hero)].filter(needs);
      if (options.length > 1) {
        const answer = await this.askChoice({
          title: this.state.items.get(itemId)?.name ?? 'Oggetto',
          text: 'Chi vuoi curare?',
          choices: [...options.map((h) => ({ id: h.id, label: h.id === hero.id ? 'Te stesso' : h.name, primary: true })), { id: 'no', label: 'Annulla' }],
        });
        if (answer === 'no') return;
        target = answer;
      } else target = options[0]?.id;
    }
    const r = useItem(this.state, this.board, hero, itemId, target);
    if (!r.ok) {
      this.showNotice(r.reason, 'warning');
      return;
    }
    this.showNotice(r.notice, this.state.items.get(itemId)?.icon ?? 'bolt');
    for (const h of r.healed) this.pieces?.redraw(h);
    this.pieces?.refreshActive();
    this.showHud(this.pieces?.active ?? null);
  }

  protected onItemAction(e: { action: 'equip' | 'stow' | 'drop' | 'use'; itemId: string }) {
    if (e.action === 'use') {
      void this.useItemAction(e.itemId);
      return;
    }
    const r = this.pieces?.itemAction(e.action, e.itemId);
    if (!r) return;
    const name = this.state.items.get(e.itemId)?.name ?? 'Oggetto';
    const icon = this.state.items.get(e.itemId)?.icon ?? 'inventory_2';
    if (r.code === 'ok') {
      const carried = !!this.state.items.get(e.itemId)?.carried;
      this.showNotice({ equip: `${name} equipaggiato`, stow: `${name} nello zaino`, drop: carried ? `${name} posata a terra` : `${name} scartato: è perso` }[e.action], icon);
      if (carried && e.action === 'drop') this.rebuildBoard(); // l'oggetto è comparso a terra
    }
    else if (r.code === 'cost') this.showNotice('Servono {mov:2} per ri-equipaggiarsi', 'warning');
    else if (r.code === 'full') this.showNotice("Non c'è posto nello zaino", 'warning');
    else if (r.code === 'conflict') this.showNotice('Incompatibile con un oggetto equipaggiato', 'warning');
    else if (r.code === 'carried') this.showNotice('Si porta in braccio: si posa a terra', 'warning');
  }

  /** L'eroe attivo dà un oggetto a un eroe adiacente (dal bottone contestuale). */
  private giveItem(receiverId: string, itemId: string) {
    const r = this.pieces?.giveItem(receiverId, itemId);
    if (!r) return;
    const to = this.state.pieces.find((p) => p.id === receiverId)?.name ?? '';
    const item = this.state.items.get(itemId);
    if (r.code === 'ok') this.showNotice(`${item?.name ?? 'Oggetto'} dato a ${to}`, item?.icon ?? 'inventory_2');
    else if (r.code === 'full') this.showNotice(`${to} non ha posto`, 'warning');
    else if (r.code === 'cost') this.showNotice('Serve {mov:1}', 'warning');
    else if (r.code === 'far') this.showNotice(`${to} non è abbastanza vicino`, 'warning');
  }

  /** L'eroe attivo dà una pozione a un eroe adiacente (dal bottone contestuale). */
  private givePotion(receiverId: string, kind: PotionKind) {
    const r = this.pieces?.givePotion(receiverId, kind);
    if (!r) return;
    const to = this.state.pieces.find((p) => p.id === receiverId)?.name ?? '';
    if (r.code === 'given') this.showNotice(`${POTION_NAMES[kind]} data a ${to}`, 'tokens/potion');
    else if (r.code === 'full') this.showNotice(`${to} porta già troppe pozioni`, 'warning');
    else if (r.code === 'cost') this.showNotice('Serve {mov:1}', 'warning');
    else if (r.code === 'far') this.showNotice(`${to} non è abbastanza vicino`, 'warning');
  }

  /** Un'azione scelta dal bottone contestuale sopra la pedina. */
  protected runContext(id: string) {
    const active = this.pieces?.active;
    if (id === 'chest') this.openChestHere();
    else if (id === 'pickup') this.pickUpHere();
    else if (id === 'encounter') this.useEncounterHere();
    else if (id === 'stairs') {
      const partner = active ? this.board?.stairsPartnerAt(active.cell) : undefined;
      if (partner) this.pieces?.click({ x: partner.x, y: partner.y });
    } else if (id === 'city') this.travelToCity();
    else if (id.startsWith('door:')) this.useDoorAt(Number(id.slice(5)));
    else if (id.startsWith('giveitem:')) {
      const [, target, itemId] = id.split(':');
      this.giveItem(target, itemId);
    }
    else if (id.startsWith('interact:')) this.interactWith(id.slice(9));
    else if (id.startsWith('drink:')) this.drinkPotion(id.slice(6) as PotionKind);
    else if (id.startsWith('give:')) {
      const [, target, kind] = id.split(':');
      this.givePotion(target, kind as PotionKind);
    }
  }

  /** Ricalcola le azioni del bottone contestuale per l'eroe attivo (solo giocando). */
  private refreshContext() {
    const active = this.pieces?.active;
    const next = !this.board || !active || this.mode !== 'play' ? [] : contextActions(this.state, this.board, active, this.fogOn() ? this.exploration.doors : null);
    // Si aggiorna solo se è cambiato qualcosa: il menu aperto si richiude a ogni cambio.
    if (JSON.stringify(next) !== JSON.stringify(this.contextActions())) this.contextActions.set(next);
  }

  /** Tiene il bottone contestuale sopra la pedina attiva (anche mentre si muove, o quando la camera cambia). */
  private updateContextAnchor() {
    const pos = this.mode === 'play' ? this.pieces?.activeWorldPos() : null;
    const next = pos
      ? { x: Math.round(this.camX + pos.x * this.zoom), y: Math.round(this.camY + pos.y * this.zoom - CELL_SIZE * PAWN_RADIUS_RATIO * this.zoom) }
      : null;
    const cur = this.contextAnchor();
    if (next?.x !== cur?.x || next?.y !== cur?.y) this.contextAnchor.set(next);
    // Il menu delle armi sta sopra il nemico toccato (sopra tutte le sue caselle, se è grande).
    const t = this.state?.pieces.find((p) => p.id === this.attackTarget());
    const tNext = t && this.mode === 'play'
      ? { x: Math.round(this.camX + (t.cell.x + t.size.w / 2) * CELL_SIZE * this.zoom), y: Math.round(this.camY + (t.cell.y * CELL_SIZE + CELL_SIZE * (0.5 - PAWN_RADIUS_RATIO)) * this.zoom) }
      : null;
    const tCur = this.attackAnchor();
    if (tNext?.x !== tCur?.x || tNext?.y !== tCur?.y) this.attackAnchor.set(tNext);
  }

  /** Clic in modalità "porte": toglie la porta che c'è, oppure ne mette una nuova. */
  private doorsClick(p: Point) {
    const cand = this.doorCandidate(this.toCells(p));
    if (!cand) return;
    if (cand.index >= 0) {
      this.doors.splice(this.doors.indexOf(this.board!.doors[cand.index].door), 1);
    } else {
      const { span, unit } = cand;
      this.doors.push({ x: span.horizontal ? unit : span.line, y: span.horizontal ? span.line : unit, horizontal: span.horizontal, open: false });
    }
    this.rebuildBoard();
    this.refreshHover();
  }

  /** Inquadra un'area (in pixel del mondo) al centro dello schermo, senza ingrandire oltre lo zoom iniziale. */
  private fitToBounds(b: MapBounds) {
    const app = this.app!;
    const fit = Math.min((app.screen.width * MAP_FIT_FILL) / b.w, (app.screen.height * MAP_FIT_FILL) / b.h);
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(fit, ZOOM_START)));
    this.camX = app.screen.width / 2 - (b.x + b.w / 2) * this.zoom;
    this.camY = app.screen.height / 2 - (b.y + b.h / 2) * this.zoom;
    this.applyCamera();
  }

  /** Il tasto "mostra tutta la mappa": scorrimento unico di pan e zoom fino all'inquadratura iniziale. */
  protected showWholeMap() {
    const app = this.app;
    const b = this.mapBox;
    if (!app || !b) return;
    const fit = Math.min((app.screen.width * MAP_FIT_FILL) / b.w, (app.screen.height * MAP_FIT_FILL) / b.h);
    this.camTween = {
      fromZoom: this.zoom,
      toZoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.min(fit, ZOOM_START))),
      from: { x: (app.screen.width / 2 - this.camX) / this.zoom, y: (app.screen.height / 2 - this.camY) / this.zoom },
      to: { x: b.x + b.w / 2, y: b.y + b.h / 2 },
      elapsed: 0,
    };
  }

  /** Zoom mantenendo fermo il punto sotto (px, py): è quello che "senti" sotto il dito o il mouse. */
  private zoomAt(px: number, py: number, newZoom: number) {
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom));
    const k = z / this.zoom;
    this.camX = px - (px - this.camX) * k;
    this.camY = py - (py - this.camY) * k;
    this.zoom = z;
    this.applyCamera();
  }

  /**
   * Il tasto "centra": porta l'eroe attivo al centro dello schermo e lo zoom a quello di 4 click su + dallo zoom iniziale (`CAMERA_FOCUS_ZOOM`),
   * con uno scorrimento unico di pan e zoom. Mentre scorre, il punto al centro dello schermo si sposta dal vecchio all'eroe e lo zoom cambia in
   * modo geometrico, come uno zoom vero.
   */
  protected centerOnActive() {
    const app = this.app;
    const hero = this.pieces?.active;
    if (!app || !hero) return;
    this.camTween = {
      fromZoom: this.zoom,
      toZoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, CAMERA_FOCUS_ZOOM)),
      from: { x: (app.screen.width / 2 - this.camX) / this.zoom, y: (app.screen.height / 2 - this.camY) / this.zoom },
      to: { x: (hero.cell.x + 0.5) * CELL_SIZE, y: (hero.cell.y + 0.5) * CELL_SIZE },
      elapsed: 0,
    };
  }

  /**
   * Mentre un eroe si muove la camera lo segue, solo con il pan (lo zoom resta quello che è), con un inseguimento morbido. Se durante
   * il movimento l'utente trascina o zooma, smette di seguirlo fino alla fine di quel movimento.
   */
  private followMovingPawn(deltaMs: number) {
    const pos = this.pieces?.movingWorldPos();
    const app = this.app;
    if (!pos || !app) {
      this.followSuppressed = false;
      return;
    }
    if (this.followSuppressed || this.camTween) return;
    const k = 1 - Math.exp(-deltaMs / CAMERA_FOLLOW_SMOOTH_MS);
    this.camX += (app.screen.width / 2 - pos.x * this.zoom - this.camX) * k;
    this.camY += (app.screen.height / 2 - pos.y * this.zoom - this.camY) * k;
    this.applyCamera();
  }

  /** Avanza lo scorrimento della camera (se c'è), con una frenata dolce alla fine. */
  private tickCameraTween(deltaMs: number) {
    const tw = this.camTween;
    const app = this.app;
    if (!tw || !app) return;
    tw.elapsed += deltaMs;
    const k = Math.min(1, tw.elapsed / (tw.ms ?? CAMERA_CENTER_MS));
    const e = 1 - Math.pow(1 - k, 3);
    this.zoom = tw.fromZoom * Math.pow(tw.toZoom / tw.fromZoom, e);
    const cx = tw.from.x + (tw.to.x - tw.from.x) * e;
    const cy = tw.from.y + (tw.to.y - tw.from.y) * e;
    this.camX = app.screen.width / 2 - cx * this.zoom;
    this.camY = app.screen.height / 2 - cy * this.zoom;
    this.applyCamera();
    if (k >= 1) this.camTween = undefined;
  }

  /** Tasti + e −: zoom attorno al centro dello schermo. */
  protected zoomByButton(direction: 1 | -1) {
    if (!this.app) return;
    const f = direction === 1 ? ZOOM_BUTTON_FACTOR : 1 / ZOOM_BUTTON_FACTOR;
    this.zoomAt(this.app.screen.width / 2, this.app.screen.height / 2, this.zoom * f);
  }

  private bindInput(canvas: HTMLCanvasElement) {
    const local = (e: PointerEvent | WheelEvent): Point => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const listen = <K extends keyof HTMLElementEventMap>(
      type: K,
      fn: (e: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      canvas.addEventListener(type, fn as EventListener, options);
      this.cleanup.push(() => canvas.removeEventListener(type, fn as EventListener));
    };

    // Rotella (e pinch del trackpad, che arriva come rotella + ctrl).
    listen('wheel', (e) => {
      this.camTween = undefined;
      this.followSuppressed = true;
      e.preventDefault();
      const p = local(e);
      const boost = e.ctrlKey ? ZOOM_TRACKPAD_PINCH_BOOST : 1;
      this.zoomAt(p.x, p.y, this.zoom * Math.exp(-e.deltaY * ZOOM_WHEEL_SENSITIVITY * boost));
    }, { passive: false });

    listen('pointerdown', (e) => {
      this.camTween = undefined;
      if (this.pieces?.movingWorldPos()) this.followSuppressed = true;
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, local(e));
      this.downPos = this.pointers.size === 1 ? local(e) : null;
      if (this.pointers.size === 2) this.lastPinchDistance = this.pinchDistance();
    });

    listen('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const cur = local(e);

      if (this.pointers.size === 1) {
        // Un dito (o il mouse): trascina la mappa.
        this.camX += cur.x - prev.x;
        this.camY += cur.y - prev.y;
        this.pointers.set(e.pointerId, cur);
        this.applyCamera();
      } else if (this.pointers.size === 2) {
        // Due dita: zoom in base a quanto si allontanano, pan in base a come si spostano.
        const before = this.pinchCenter();
        this.pointers.set(e.pointerId, cur);
        const after = this.pinchCenter();
        this.camX += after.x - before.x;
        this.camY += after.y - before.y;
        const dist = this.pinchDistance();
        if (this.lastPinchDistance > 0) this.zoomAt(after.x, after.y, this.zoom * (dist / this.lastPinchDistance));
        else this.applyCamera();
        this.lastPinchDistance = dist;
      }
    });

    // Il mouse che passa sopra la scena: serve a mostrare il tile da agganciare.
    listen('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      this.mouse = local(e);
      this.refreshHover();
    });
    listen('pointerleave', () => {
      this.mouse = null;
      this.refreshHover();
    });

    const release = (e: PointerEvent) => {
      // Un clic (senza trascinare): muove la pedina, oppure piazza il tile agganciato.
      const p = local(e);
      const isClick =
        e.type === 'pointerup' && e.button === 0 && this.pointers.size === 1 &&
        this.downPos !== null && Math.hypot(p.x - this.downPos.x, p.y - this.downPos.y) < CLICK_SLOP_PX;
      this.pointers.delete(e.pointerId);
      this.lastPinchDistance = 0;
      this.downPos = null;
      if (e.pointerType === 'mouse') this.mouse = p;
      this.refreshHover(); // il tile da agganciare torna visibile appena il tasto è rilasciato
      if (isClick) {
        if (this.mode === 'play') this.playClick(p);
        else if (this.mode === 'doors') this.doorsClick(p);
        else if (this.mode === 'obstacles') this.obstaclesClick(p);
        else if (e.pointerType === 'mouse') this.placer?.place();
      }
    };
    listen('pointerup', release);
    listen('pointercancel', release);

    // Tastiera: P cambia modalità; poi i tasti dipendono dalla modalità.
    // Sul tocco non c'è il passaggio del mouse: un tocco su un elemento che ha un suggerimento (le icone delle statistiche, le pozioni, i cubi dei dadi...) lo
    // mostra come notifica. I bottoni no: hanno già il loro nome e (se spenti) il motivo, che si mostra da sé.
    const onTap = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      const el = (e.target as Element | null)?.closest<HTMLElement>('[title]');
      if (!el?.title || el.matches('button, a, [role=tab]') || el.closest('button')) return;
      this.showNotice(el.title, 'info');
    };
    document.addEventListener('pointerup', onTap);
    this.cleanup.push(() => document.removeEventListener('pointerup', onTap));

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'escape' && this.telekinesis()) this.cancelTelekinesis();
      if (key === 'p') this.setMode('tiles');
      else if (key === 'd') this.setMode('doors');
      else if (key === 'o') this.setMode('obstacles');
      else if (key === 'z' && !e.repeat) this.showWholeMap();
      else if (key === 'f' && !e.repeat) this.centerOnActive();
      else if (this.mode === 'obstacles') {
        if (key === 'r') this.obstacleVertical = !this.obstacleVertical;
        else if (key === 't') this.obstacleVariant = (this.obstacleVariant + 1) % OBSTACLE_VARIANTS.length;
        this.refreshHover();
      } else if (this.mode === 'tiles') {
        if (key === 'r') this.placer?.rotate();
        else if (key === 't') this.placer?.nextTile();
        else if (key === 'backspace') this.placer?.undo();
      } else if (!e.repeat) {
        // Giocando: i comandi dell'eroe attivo (non mentre c'è la finestra dell'attacco).
        if (key === 'r') this.tapCommand('run');
        else if (key === 'c') this.tapCommand('fight');
        else if (key === 'q') this.tapCommand('rest');
        else if ((key === 's' || key === 'i') && this.barsIn() && !this.commandsBusy() && this.state.activeId) this.togglePanel(this.state.activeId, key === 's' ? 'info' : 'inventory');
        else if (key === 'e') this.tapCommand('prepare');
        else if (key === 'enter') this.tapCommand('pass');
      }
    };
    window.addEventListener('keydown', onKey);
    this.cleanup.push(() => window.removeEventListener('keydown', onKey));
  }

  private pinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private pinchCenter(): Point {
    const [a, b] = [...this.pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  ngOnDestroy() {
    this.destroyed = true;
    this.toastTimers.forEach(clearTimeout);
    this.cleanup.forEach((fn) => fn());
    this.app?.destroy(true, { children: true });
  }
}
