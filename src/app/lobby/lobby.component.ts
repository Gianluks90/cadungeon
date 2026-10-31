import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ADVENTURES } from '../adventures/adventures';
import { objectiveText } from '../game/state/objective-text';
import { HeroSheet, loadAllHeroSheets } from '../game/heroes/hero-sheet';
import { Loadout, ShopData, emptyLoadout, loadPregameShop, loadoutCost, partySetupStore } from '../game/heroes/party-setup';
import { CatalogTextPipe } from '../i18n/catalog-text.pipe';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { AdventureDialogComponent, AdventureView } from '../ui/adventure-dialog.component';
import { HeroStatsPillComponent } from '../ui/hero-stats-pill.component';
import { HeroDetailDialogComponent } from '../ui/hero-detail-dialog.component';
import { ValueStarComponent } from '../ui/value-star.component';
import { SkillDef, loadSkillCatalog } from '../game/skills/skill';
import { FamiliarPillComponent } from '../ui/familiar-pill.component';
import { FamiliarDef, familiarsOfSheet, loadFamiliarCatalog } from '../game/familiars/familiar';
import { HeartsComponent } from '../ui/hearts.component';
import { HeroLoadoutComponent } from '../ui/hero-loadout.component';
import { ConfirmDialogComponent } from '../ui/confirm-dialog.component';
import { DotTrailComponent } from '../ui/dot-trail.component';
import { FieldComponent } from '../ui/field.component';
import { IconComponent } from '../ui/icon.component';
import { PageNavComponent } from '../ui/page-nav.component';
import { SelectComponent, SelectOption } from '../ui/select.component';
import { LobbyClient, LobbyHost, LobbyState, NetStatus, heroesPerPlayer } from './lobby-net';
import { LocalLobbyStore } from './lobby-store';

/**
 * La sala d'attesa di una partita multiplayer. Chi l'ha creata (il Signore supremo, l'host) sceglie l'avventura e vede i posti dei giocatori: vuoti finché non arrivano, poi con l'eroe che
 * ognuno sceglie, in tempo reale. Chi si è unito con il codice (`?join`) sceglie un eroe fra quelli liberi e dice "Pronto". Quando tutti sono pronti l'host fa partire la partita con la squadra scelta.
 * Lo stato sta sull'host, che valida ogni scelta (due giocatori non possono avere lo stesso eroe).
 */
@Component({
  selector: 'app-lobby',
  imports: [AdventureDialogComponent, CatalogTextPipe, ConfirmDialogComponent, DotTrailComponent, FamiliarPillComponent, HeartsComponent, ValueStarComponent, HeroDetailDialogComponent, HeroStatsPillComponent, HeroLoadoutComponent, FieldComponent, IconComponent, PageNavComponent, SelectComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dot-trail />
    <app-page-nav [confirmTitle]="(isHost ? 'lobby.closeTitle' : 'lobby.leaveTitle') | t" [confirmText]="(isHost ? 'lobby.closeText' : 'lobby.leaveText') | t" [confirmLabel]="(isHost ? 'lobby.close' : 'lobby.leave') | t" (back)="back()" (leave)="leaveGame()" />
    <header class="head">
      <span class="kicker">{{ (isHost ? 'lobby.kickerHost' : 'lobby.kickerPlayer') | t }}</span>
      <button type="button" class="code" [title]="'lobby.copy' | t" [attr.aria-label]="'lobby.copy' | t" (click)="copy()">
        {{ code }} <app-icon [name]="copied() ? 'check' : 'content_copy'" [size]="18" />
      </button>
      <p class="status" [class.bad]="problem()">{{ statusText() }}</p>
      @if (state(); as s) {
        @if (!isHost && !s.started) {
          @if (showGear()) {
            <p class="note"><b class="sec">{{ 'party.gear' | t }}</b> · {{ 'lobby.gearHint' | t }}</p>
          } @else {
            <div class="adv-box">
              <div class="adv-text">
                <span class="kicker">{{ 'lobby.adventure' | t }}</span>
                <b>{{ s.map ? adventureTitle() : ('lobby.noAdventure' | t) }}</b>
              </div>
              @if (s.map) {
                <button type="button" class="flag" [attr.aria-label]="'adventures.goal' | t" [title]="'adventures.goalHint' | t" (click)="showGoal(s.map)"><app-icon name="flag" [size]="20" /></button>
              }
            </div>
            <p class="note">{{ (perPlayer() === 2 ? 'lobby.chooseTwo' : 'lobby.chooseHero') | t }}</p>
          }
        }
        @if (isHost) {
          <div class="adv">
            <app-field [label]="'lobby.adventure' | t">
              <app-select class="block" [options]="adventures()" [value]="s.map ?? ''" [placeholder]="'lobby.chooseAdventure' | t" [label]="'lobby.adventure' | t" (changed)="host?.setMap($event || null)" />
            </app-field>
          </div>
        }
      }
    </header>
    <main>
      @if (state(); as s) {
        @if (isHost) {
          <div class="row slots">
            @for (slot of slots(); track $index) {
              <div class="card slot" [class.filled]="slot.hero" [class.ready]="slot.player?.ready">
                @if (slot.hero; as h) {
                  <img [src]="h.portraitFull" [alt]="h.name" />
                  <div class="cap"><b>{{ h.name }}</b><span>{{ h.class | ct }}</span><small>{{ gear(slot) }}</small></div>
                  @if (slot.player?.ready) { <span class="tick"><app-icon name="check_circle" [size]="24" /></span> }
                } @else {
                  <span class="empty">{{ (slot.player ? 'lobby.choosing' : 'lobby.waitingSlot') | t }}</span>
                }
              </div>
            }
          </div>
        } @else if (s.started) {
          <p class="note">{{ 'lobby.startedPlayer' | t }}</p>
        } @else if (!showGear()) {
          <div class="row" role="group" [attr.aria-label]="'lobby.chooseHero' | t">
            @for (h of heroes(); track h.id) {
              <div class="card hero" role="button" tabindex="0" [attr.aria-pressed]="!!mine()?.heroes?.includes(h.id)" [class.mine]="mine()?.heroes?.includes(h.id)" [class.taken]="takenBy(h.id)"
                [attr.aria-disabled]="takenBy(h.id) ? 'true' : null" (click)="pick(h.id)" (keydown.enter)="pick(h.id)" (keydown.space)="pick(h.id); $event.preventDefault()">
                <img [src]="h.portraitFull" [alt]="h.name" />
                <button type="button" class="info" [attr.aria-label]="'detail.open' | t: { name: h.name }" [title]="'detail.open' | t: { name: h.name }" (click)="$event.stopPropagation(); detail.set(h)"><app-icon name="info" [size]="18" /></button>
                <app-hearts class="hearts" [wounds]="h.wounds" [max]="h.wounds" [size]="18" />
                <div class="cap">
                  <app-value-star class="value" [value]="h.value" />
                  @if (familiarsOf(h).length) { <app-familiar-pill class="fam" [familiars]="familiarsOf(h)" /> }
                  <app-hero-stats-pill class="stats" [speed]="h.speed" [fatigue]="h.fatigue" />
                  <i class="armor" [title]="'shop.armor' | t" [attr.aria-label]="('shop.armor' | t) + ' ' + h.armor">
                  <svg viewBox="0 0 40 46" aria-hidden="true"><path d="M20 2 36 8v14c0 11-7 19-16 22C11 41 4 33 4 22V8Z" /></svg>
                  <em>{{ h.armor }}</em>
              </i>
                  <b>{{ h.name }}</b><span>{{ h.class | ct }}</span>
                </div>
                @if (takenBy(h.id)) { <span class="badge">{{ 'lobby.taken' | t }}</span> }
              </div>
            }
          </div>
        } @else {
          <div class="squad">
            @for (h of myHeroes(); track h.id) {
              <app-hero-loadout [hero]="h" [loadout]="loadoutOf(h.id)" [shop]="shop()" [others]="othersOf(h.id)" [skills]="skillsOf(h.id)" (changed)="setLoadout(h.id, $event)" />
            }
          </div>
        }
      }
    </main>
    <footer class="foot">
      @if (state(); as s) {
        @if (isHost) {
          <button type="button" class="dlg-btn primary" [attr.aria-disabled]="canStart() ? null : 'true'" (click)="start()">{{ 'lobby.start' | t }}</button>
          @if (!canStart()) { <p class="warn"><app-icon name="warning" [size]="18" />{{ startHint() }}</p> }
        } @else if (!s.started) {
          @if (!showGear()) {
            <button type="button" class="dlg-btn primary" [attr.aria-disabled]="complete() ? null : 'true'" (click)="enterGear()">{{ 'party.confirm' | t }}</button>
            @if (!complete()) { <p class="warn"><app-icon name="warning" [size]="18" />{{ (perPlayer() === 2 ? 'lobby.chooseTwo' : 'lobby.chooseHero') | t }}</p> }
          } @else {
            <button type="button" class="dlg-btn primary" [class.on]="mine()?.ready" (click)="toggleReady()">{{ (mine()?.ready ? 'lobby.notReady' : 'lobby.ready') | t }}</button>
          }
        }
      }
    </footer>
    <app-confirm-dialog [open]="skillNotice()" [danger]="false" [title]="'gear.noticeTitle' | t" [text]="'gear.noticeText' | t" [confirmLabel]="'gear.noticeOk' | t" (confirmed)="skillNotice.set(false)" (cancel)="skillNotice.set(false)" />
    <app-hero-detail-dialog [hero]="detail()" (closed)="detail.set(null)" />
    <app-adventure-dialog [view]="goal()" (confirm)="goal.set(null)" />
    <app-confirm-dialog [open]="askUnspent()" [danger]="false" [title]="'party.unspentTitle' | t" [text]="'party.unspentText' | t: { names: unspentNames() }" [confirmLabel]="'lobby.readyAnyway' | t" (confirmed)="askUnspent.set(false); client?.setReady(true)" (cancel)="askUnspent.set(false)" />
  `,
  styles: `
    :host { position: fixed; inset: 0; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; background: var(--c-bg); color: var(--c-text); font: 14px/1.5 var(--font-ui); }
    /* Intestazione in alto, piede in basso, contenuto al centro. */
    /* Righe esplicite: lo sfondo a puntini occupa tutta la griglia e non prende il posto di una riga. */
    app-dot-trail { grid-area: 1 / 1 / -1 / -1; }
    .head { grid-row: 1; grid-column: 1; position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: calc(14px + env(safe-area-inset-top)) 120px 8px; text-align: center; }
    .foot { grid-row: 3; grid-column: 1; position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; min-height: 84px; padding: 8px 16px calc(18px + env(safe-area-inset-bottom)); box-sizing: border-box; justify-content: flex-end; }
    main { grid-row: 2; grid-column: 1; position: relative; min-height: 0; display: flex; align-items: center; justify-content: center; overflow-x: hidden; overflow-y: auto; text-align: center; }
    @media (max-width: 600px) { .head { padding-inline: 16px; padding-top: calc(66px + env(safe-area-inset-top)); } }
    .warn { display: inline-flex; align-items: center; gap: 6px; margin: 0; color: var(--c-warn); font-size: 13px; }
    .sec { font: 600 var(--fs-md)/1.2 var(--font-display); }
    .kicker { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .code { display: inline-flex; align-items: center; gap: 10px; padding: 4px 8px; border: 0; background: none; cursor: pointer; font: 600 var(--fs-lg)/1.2 var(--font-display); letter-spacing: 0.3em; color: var(--c-interact); }
    .code:hover, .code:focus-visible { opacity: 0.8; outline: none; }
    .status { margin: 0; color: var(--c-text-dim); font-size: 13px; }
    .status.bad { color: var(--c-danger); }
    .note { margin: 0; color: var(--c-text-dim); max-width: 520px; }
    .adv { width: min(360px, 100%); text-align: left; }
    /* Le carte scorrono in orizzontale (anche col dito); se ci stanno tutte restano al centro. Il padding lascia posto all'inclinazione e all'ombra. */
    .row { display: flex; gap: 24px; width: 100%; box-sizing: border-box; padding: 18px 28px 22px; overflow-x: auto; justify-content: safe center; scroll-snap-type: x proximity; overscroll-behavior-x: contain; }
    /* Lo stile delle carte accanto ai pannelli: inclinata di 4°, riquadro con ombra, immagine a tutta carta e un piede opaco con il nome e il sottotitolo (la classe, in maiuscolo). */
    .card {
      position: relative; flex: none; box-sizing: border-box; width: 210px; height: min(440px, 56dvh); min-height: 300px; margin: 0; padding: 0; overflow: hidden; scroll-snap-align: center;
      border-radius: var(--radius-1); border: 1px dashed var(--c-line-strong); background: var(--c-tile); color: var(--c-text); font: inherit;
      display: flex; align-items: center; justify-content: center; transform: rotate(4deg); transform-origin: 30% 100%; box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55);
    }
    .card.filled, .card.hero { border-style: solid; }
    .card.ready { border-color: var(--c-ok); }
    .empty { padding: 12px; color: var(--c-text-dim); font-size: 12px; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .cap { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 2px; padding: 8px 12px 10px; background: var(--c-surface); border-top: 1px solid var(--c-line-strong); text-align: left; }
    .cap b { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.04em; }
    .cap span { color: var(--c-text-dim); font-size: 11px; font-weight: 600; letter-spacing: var(--label-tracking); text-transform: uppercase; }
    .tick { position: absolute; top: 8px; right: 8px; color: var(--c-ok); }
    .hero { cursor: pointer; transition: border-color 0.15s, transform 0.15s; }
    .hero:hover, .hero:focus-visible { border-color: var(--c-interact); outline: none; transform: rotate(4deg) translateY(-4px); }
    .hero.mine { border-color: var(--c-interact); box-shadow: 0 0 0 1px var(--c-interact), 0 8px 22px rgba(0, 0, 0, 0.55); }
    /* Passando su un eroe (o col focus) tutti gli altri perdono colore, così quello sotto il puntatore risalta. */
    .hero img { transition: filter 0.2s; }
    .row:has(.hero:is(:hover, :focus-visible)) .hero:not(:is(:hover, :focus-visible)) img { filter: saturate(0.3) brightness(0.8); }
    .hero.taken { cursor: not-allowed; }
    .hero.taken img { filter: grayscale(1) brightness(0.45); }
    .hero.taken:hover { border-color: var(--c-line-strong); transform: rotate(4deg); }
    .badge { position: absolute; top: 8px; right: 46px; padding: 3px 7px; border-radius: var(--radius-1); background: rgba(0, 0, 0, 0.75); font-size: 11px; font-weight: 600; }
    /* I punti ferita in cuori in colonna in alto a sinistra; l'armatura in uno scudo nero in basso a destra sopra il piede (come in partita). */
    .hearts { position: absolute; top: 8px; left: 8px; display: flex; flex-direction: column; gap: 2px; }
    .fam { position: absolute; left: 8px; right: 8px; bottom: calc(100% + 54px); }
    .stats { position: absolute; left: 8px; bottom: calc(100% + 6px); }
    .value { position: absolute; right: 48px; bottom: calc(100% + 6px); }
    .armor { position: absolute; right: 8px; bottom: calc(100% + 6px); width: 34px; height: 40px; display: inline-flex; align-items: center; justify-content: center; font-style: normal; }
    .armor svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .armor path { fill: var(--c-bg); stroke: var(--c-line-strong); stroke-width: 1; stroke-linejoin: round; }
    .armor em { position: relative; margin-top: -2px; font: 700 14px/1 var(--font-mono); font-style: normal; color: var(--c-text); }
    /* Il tasto "i": un pallino scuro in alto a destra che apre la scheda di dettaglio. */
    .info { position: absolute; z-index: 2; top: 8px; right: 8px; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; padding: 0; cursor: pointer; border-radius: var(--radius-round); border: 1px solid var(--c-line-strong); background: rgba(0, 0, 0, 0.7); color: var(--c-text); transition: color 0.15s, border-color 0.15s; }
    .info:hover, .info:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    .cap small { color: var(--cad-coin); font-size: 11px; }
    .squad { display: grid; grid-template-columns: repeat(2, max-content); gap: 22px 48px; justify-content: center; padding: 12px 16px; }
    @media (max-width: 700px) { .squad { grid-template-columns: max-content; } }
    .adv-box { display: flex; align-items: center; gap: 16px; box-sizing: border-box; width: min(360px, 100%); padding: 10px 10px 10px 16px; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); background: var(--c-surface); text-align: left; }
    .adv-text { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
    .adv-text b { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.04em; }
    .flag { flex: none; display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; padding: 0; border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); background: none; color: var(--c-text-dim); cursor: pointer; transition: color 0.15s, border-color 0.15s; }
    .flag:hover, .flag:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    .dlg-btn.on { border-color: var(--c-ok); color: var(--c-ok); }
  `,
})
export class LobbyComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly store = new LocalLobbyStore();

  protected readonly code = this.route.snapshot.paramMap.get('code') ?? '';
  private readonly lobby = this.store.get(this.code);
  /** Chi ha creato la partita (e non è entrato con "Unisciti") è l'host. */
  protected readonly isHost = !!this.lobby && !this.route.snapshot.queryParamMap.has('join');

  protected readonly heroes = signal<HeroSheet[]>([]);
  protected readonly shop = signal<ShopData | null>(null);
  private readonly familiarDefs = signal<ReadonlyMap<string, FamiliarDef>>(new Map());
  protected familiarsOf(h: HeroSheet): FamiliarDef[] {
    return familiarsOfSheet(h, this.familiarDefs());
  }
  private readonly skillCatalog = signal<ReadonlyMap<string, SkillDef>>(new Map());
  protected readonly host: LobbyHost | undefined = this.isHost
    ? new LobbyHost(this.code, this.lobby!.heroes, () => ({ heroIds: this.heroes().map((h) => h.id), coins: (id) => this.heroes().find((h) => h.id === id)?.coins ?? 0, shop: this.shop(), skillPool: [...this.skillCatalog().values()].map((c) => ({ id: c.id, school: c.school })), heroSkills: (id) => this.heroes().find((h) => h.id === id)?.skills ?? { combat: 0, cunning: 0, magic: 0 } }))
    : undefined;
  private readonly client: LobbyClient | undefined = this.isHost ? undefined : new LobbyClient(this.code);

  protected readonly state = computed<LobbyState | null>(() => (this.host ? this.host.state() : this.client!.state()));
  private readonly status = computed<NetStatus>(() => (this.host ? this.host.status() : this.client!.status()));
  protected readonly copied = signal(false);
  /** L'obiettivo dell'avventura scelta, letto dal file della mappa (senza caricare la scena). */
  protected readonly goal = signal<AdventureView | null>(null);

  protected readonly adventures = computed<SelectOption[]>(() => ADVENTURES.filter((a) => a.map).map((a) => ({ value: a.map!, label: a.title ?? a.map! })));
  protected readonly adventureTitle = computed(() => ADVENTURES.find((a) => a.map === this.state()?.map)?.title ?? '');

  /** I posti dell'host, nell'ordine di arrivo: ognuno col suo giocatore (se c'è) e il suo eroe (se l'ha scelto). */
  protected readonly slots = computed(() => {
    const s = this.state();
    if (!s) return [];
    // Un posto per ogni eroe: con un solo giocatore eroe sono due carte dello stesso giocatore.
    const per = heroesPerPlayer(s.heroes);
    return Array.from({ length: s.heroes * per }, (_, i) => {
      const player = s.players[Math.floor(i / per)];
      return { player, hero: this.heroes().find((h) => h.id === player?.heroes[i % per]) };
    });
  });
  /** Il mio posto (solo per chi gioca). */
  protected readonly mine = computed(() => this.state()?.players.find((p) => p.pid === this.client?.pid));
  /** Quanti eroi deve scegliere ogni giocatore (2 se è l'unico giocatore eroe) e se il mio gruppo è completo. */
  /** I miei eroi (le schede), nell'ordine in cui li ho scelti, ognuno col suo spazio per il negozio. */
  protected readonly myHeroes = computed(() => (this.mine()?.heroes ?? []).flatMap((id) => this.heroes().find((h) => h.id === id) ?? []));
  protected readonly askUnspent = signal(false);
  protected readonly skillNotice = signal(false);
  /** La scheda di dettaglio aperta dal tasto "i" di una carta. */
  protected readonly detail = signal<HeroSheet | null>(null);
  /** I miei eroi che non hanno speso niente (hanno ancora tutte le monete). */
  protected readonly unspentNames = computed(() => {
    const shop = this.shop();
    return this.myHeroes().filter((h) => !shop || loadoutCost(this.loadoutOf(h.id), shop) === 0).map((h) => h.name).join(', ');
  });
  /** Eroi confermati: si passa alla schermata degli acquisti (finché il gruppo è completo). */
  protected readonly gearStep = signal(false);
  protected readonly showGear = computed(() => this.gearStep() && this.complete());
  protected readonly perPlayer = computed(() => heroesPerPlayer(this.state()?.heroes ?? 0));
  protected readonly complete = computed(() => (this.mine()?.heroes.length ?? 0) === this.perPlayer());
  protected readonly problem = computed(() => !['online', 'connecting'].includes(this.status()));

  protected readonly statusText = computed(() => this.i18n.t(`lobby.status.${this.status()}`));
  protected readonly canStart = computed(() => !!this.host && (this.state(), this.host.canStart()));
  protected readonly startHint = computed(() => {
    const s = this.state();
    if (!s) return '';
    if (!s.map) return this.i18n.t('lobby.hint.map');
    if (s.players.length < s.heroes) return this.i18n.t('lobby.hint.players', { n: s.heroes - s.players.length });
    return this.i18n.t('lobby.hint.ready');
  });

  constructor() {
    void loadAllHeroSheets().then((h) => this.heroes.set(h));
    void loadPregameShop().then((s) => this.shop.set(s));
    void loadSkillCatalog().then((c) => this.skillCatalog.set(c));
    void loadFamiliarCatalog().then((d) => this.familiarDefs.set(d));
    inject(DestroyRef).onDestroy(() => {
      this.host?.destroy();
      this.client?.destroy();
    });
  }

  protected async showGoal(map: string) {
    try {
      const res = await fetch(new URL(`maps/${map}.json`, document.baseURI));
      if (!res.ok) return;
      const data = (await res.json()) as { objective?: { description?: string; text?: string }; rules?: string };
      const rules = data.rules?.trim();
      const t = (key: 'adventures.goal' | 'adventures.specialRules' | 'common.close') => this.i18n.t(key);
      this.goal.set({ kicker: t('adventures.goal'), title: this.adventureTitle(), text: objectiveText(data) + (rules ? `\n\n### ${t('adventures.specialRules')}\n\n${rules}` : ''), action: t('common.close'), dismissible: true });
    } catch {
      /* senza il file non c'è niente da mostrare */
    }
  }

  /** Le carte abilità secondarie che l'host ha assegnato a un mio eroe. */
  protected skillsOf(id: string): SkillDef[] {
    return (this.mine()?.skillCards[id] ?? []).flatMap((c) => this.skillCatalog().get(c) ?? []);
  }

  protected loadoutOf(id: string): Loadout {
    return this.mine()?.loadouts[id] ?? emptyLoadout();
  }

  /** Gli acquisti di tutti gli altri eroi (anche di altri giocatori): le copie in vendita sono comuni. */
  protected othersOf(id: string): Loadout[] {
    return (this.state()?.players ?? []).flatMap((p) => Object.entries(p.loadouts).filter(([h]) => h !== id).map(([, l]) => l));
  }

  protected setLoadout(id: string, l: Loadout) {
    this.client?.setLoadout(id, l);
  }

  /** Per il Signore supremo: monete rimaste e numero di acquisti di un posto, da mostrare sulla carta. */
  protected gear(slot: { player?: { loadouts: Record<string, Loadout> }; hero?: HeroSheet }): string {
    const h = slot.hero;
    const shop = this.shop();
    if (!h || !shop) return '';
    const l = slot.player?.loadouts[h.id] ?? emptyLoadout();
    return this.i18n.t('lobby.gear', { coins: h.coins - loadoutCost(l, shop), n: l.items.length + l.potions.length });
  }

  /** Eroi confermati: si passa agli acquisti e una dialog avvisa delle abilità assegnate. */
  protected enterGear() {
    if (!this.complete()) return;
    this.gearStep.set(true);
    this.skillNotice.set(true);
  }

  /** Si torna a cambiare gli eroi: il "Pronto" cade da solo (lo toglie l'host alla prima scelta). */
  protected backToHeroes() {
    if (this.mine()?.ready) this.client?.setReady(false);
    this.gearStep.set(false);
  }

  protected takenBy(id: string): boolean {
    return !!this.state()?.players.some((p) => p.heroes.includes(id) && p.pid !== this.client?.pid);
  }

  protected pick(id: string) {
    if (this.takenBy(id)) return;
    this.client?.pick(id);
  }

  protected toggleReady() {
    const me = this.mine();
    if (!this.complete()) return;
    // Dire "Pronto" con eroi che non hanno speso niente: prima si chiede conferma. Togliere il "Pronto" non chiede niente.
    if (!me!.ready && this.unspentNames()) this.askUnspent.set(true);
    else this.client?.setReady(!me!.ready);
  }

  /** Fa partire la partita sull'avventura scelta con gli eroi scelti, nell'ordine dei posti. */
  protected start() {
    const map = this.state()?.map;
    const setup = this.host?.setup();
    const party = this.host?.start();
    if (setup && party) partySetupStore.save(setup);
    if (map && party) void this.router.navigate(['/play', map], { queryParams: { new: 1, party: party.join(',') } });
  }

  private readonly nav = viewChild(PageNavComponent);

  /** La freccia: dagli acquisti si torna agli eroi; dal resto si chiede se uscire. */
  protected back() {
    if (this.showGear()) this.backToHeroes();
    else this.nav()?.ask();
  }

  /** Confermata l'uscita: l'host chiude la sala (la partita sparisce dalla home), chi gioca lascia il suo posto. */
  protected leaveGame() {
    if (this.isHost) this.store.remove(this.code);
    void this.router.navigateByUrl('/');
  }

  protected copy() {
    navigator.clipboard?.writeText(this.code).then(
      () => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 1500);
      },
      () => {},
    );
  }
}
