import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HeroSheet, loadAllHeroSheets } from '../game/heroes/hero-sheet';
import { Loadout, PartySetup, ShopData, drawSkillCards, emptyLoadout, loadPregameShop, loadoutCost, partySetupStore } from '../game/heroes/party-setup';
import { CatalogTextPipe } from '../i18n/catalog-text.pipe';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ConfirmDialogComponent } from '../ui/confirm-dialog.component';
import { DotTrailComponent } from '../ui/dot-trail.component';
import { HeroStatsPillComponent } from '../ui/hero-stats-pill.component';
import { HeroDetailDialogComponent } from '../ui/hero-detail-dialog.component';
import { ValueStarComponent } from '../ui/value-star.component';
import { SkillDef, loadSkillCatalog } from '../game/skills/skill';
import { FamiliarPillComponent } from '../ui/familiar-pill.component';
import { FamiliarDef, familiarsOfSheet, loadFamiliarCatalog } from '../game/familiars/familiar';
import { HeartsComponent } from '../ui/hearts.component';
import { HeroLoadoutComponent } from '../ui/hero-loadout.component';
import { IconComponent } from '../ui/icon.component';
import { PageNavComponent } from '../ui/page-nav.component';
import { ADVENTURES } from './adventures';

/** Quanti eroi si possono portare (sempre almeno 2: da soli si gioca con la squadra, mai con un eroe solo). */
export const PARTY_MIN = 2;
export const PARTY_MAX = 4;

/**
 * La scelta degli eroi del giocatore singolo (`/party/<map>`, dopo la scelta dell'avventura, con uno scorrimento di lato): da 2 a 4 eroi, nell'ordine in cui si toccano. Il Signore supremo è
 * controllato dal gioco. "Inizia" apre la partita su `/play/<map>?new&party=a,b,…`.
 */
@Component({
  selector: 'app-party',
  imports: [CatalogTextPipe, ConfirmDialogComponent, DotTrailComponent, FamiliarPillComponent, HeartsComponent, ValueStarComponent, HeroDetailDialogComponent, HeroStatsPillComponent, HeroLoadoutComponent, IconComponent, PageNavComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dot-trail />
    <app-page-nav [confirmTitle]="'party.cancelTitle' | t" [confirmText]="'party.cancelText' | t" [confirmLabel]="'party.cancelLabel' | t" (back)="back()" (leave)="home()" />
    <header class="head">
      <span class="kicker">{{ title }}</span>
      @if (step() === 'pick') {
        <h1>{{ 'party.title' | t }}</h1>
        <p class="hint">{{ 'party.hint' | t: { min: min, max: max } }}</p>
      } @else {
        <h1>{{ 'party.gear' | t }}</h1>
        <p class="hint">{{ 'party.gearHint' | t: { coins: startCoins() } }}</p>
      }
    </header>
    <main>
      @if (step() === 'pick') {
        <div class="row" role="group" [attr.aria-label]="'party.title' | t">
          @for (h of heroes(); track h.id) {
            <div class="card" role="button" tabindex="0" [class.on]="order(h.id) > 0" [attr.aria-pressed]="order(h.id) > 0" [attr.aria-disabled]="!order(h.id) && full() ? 'true' : null" (click)="toggle(h.id)" (keydown.enter)="toggle(h.id)" (keydown.space)="toggle(h.id); $event.preventDefault()">
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
                @if (order(h.id) > 0) { <span class="n">{{ order(h.id) }}</span> }
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="squad">
          @for (h of squad(); track h.id) {
            <app-hero-loadout [hero]="h" [loadout]="loadoutOf(h.id)" [shop]="shop()" [others]="othersOf(h.id)" [skills]="skillsOf(h.id)" (changed)="setLoadout(h.id, $event)" />
          }
        </div>
      }
    </main>
    <footer class="foot">
      @if (step() === 'pick') {
        <button type="button" class="dlg-btn primary" [attr.aria-disabled]="ready() ? null : 'true'" (click)="confirm()">{{ 'party.confirm' | t }}</button>
        @if (!ready()) { <p class="warn"><app-icon name="warning" [size]="18" />{{ 'party.warning' | t }}</p> }
      } @else {
        <button type="button" class="dlg-btn primary" (click)="start()">{{ 'party.start' | t }}</button>
      }
    </footer>
    <app-confirm-dialog [open]="skillNotice()" [danger]="false" [title]="'gear.noticeTitle' | t" [text]="'gear.noticeText' | t" [confirmLabel]="'gear.noticeOk' | t" (confirmed)="skillNotice.set(false)" (cancel)="skillNotice.set(false)" />
    <app-hero-detail-dialog [hero]="detail()" (closed)="detail.set(null)" />
    <app-confirm-dialog [open]="askUnspent()" [danger]="false" [title]="'party.unspentTitle' | t" [text]="'party.unspentText' | t: { names: unspentNames() }" [confirmLabel]="'party.startAnyway' | t" (confirmed)="askUnspent.set(false); go()" (cancel)="askUnspent.set(false)" />
  `,
  styles: `
    :host { position: fixed; inset: 0; overflow: hidden; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; background: var(--c-bg); color: var(--c-text); font: 14px/1.5 var(--font-ui); animation: slide-in 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    @keyframes slide-in { from { opacity: 0; transform: translateX(48px); } }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
    /* Come una pagina con intestazione e piede: il titolo in alto, i tasti in basso, il contenuto al centro. */
    /* Righe esplicite: lo sfondo a puntini occupa tutta la griglia e non prende il posto di una riga. */
    app-dot-trail { grid-area: 1 / 1 / -1 / -1; }
    .head { grid-row: 1; grid-column: 1; position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: calc(14px + env(safe-area-inset-top)) 120px 8px; text-align: center; }
    .foot { grid-row: 3; grid-column: 1; position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; min-height: 84px; padding: 8px 16px calc(18px + env(safe-area-inset-bottom)); box-sizing: border-box; justify-content: flex-end; }
    main { grid-row: 2; grid-column: 1; position: relative; min-height: 0; display: flex; align-items: center; justify-content: center; overflow-x: hidden; overflow-y: auto; }
    @media (max-width: 600px) { .head { padding-inline: 16px; padding-top: calc(66px + env(safe-area-inset-top)); } }
    .kicker { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    h1 { margin: 0; font: 600 var(--fs-lg)/1.2 var(--font-display); letter-spacing: 0.03em; }
    .hint, .count { margin: 0; color: var(--c-text-dim); font-size: 13px; }
    /* Gli eroi con il loro spazio: una griglia 2×2. */
    .squad { display: grid; grid-template-columns: repeat(2, max-content); gap: 22px 48px; justify-content: center; padding: 12px 16px; }
    @media (max-width: 700px) { .squad { grid-template-columns: max-content; } }
    .warn { display: inline-flex; align-items: center; gap: 6px; margin: 0; color: var(--c-warn); font-size: 13px; }
    .row { display: flex; gap: 24px; width: 100%; box-sizing: border-box; padding: 18px 28px 22px; overflow-x: auto; justify-content: safe center; scroll-snap-type: x proximity; overscroll-behavior-x: contain; }
    .card {
      position: relative; flex: none; box-sizing: border-box; width: 210px; height: min(440px, 56dvh); min-height: 300px; margin: 0; padding: 0; overflow: hidden; scroll-snap-align: center; cursor: pointer;
      border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-tile); color: var(--c-text); font: inherit;
      transform: rotate(4deg); transform-origin: 30% 100%; box-shadow: 0 8px 22px rgba(0, 0, 0, 0.55); transition: border-color 0.15s, transform 0.15s;
    }
    .card:hover, .card:focus-visible { border-color: var(--c-interact); outline: none; transform: rotate(4deg) translateY(-4px); }
    .card.on { border-color: var(--c-interact); box-shadow: 0 0 0 1px var(--c-interact), 0 8px 22px rgba(0, 0, 0, 0.55); }
    .card[aria-disabled='true'] { cursor: not-allowed; }
    .card[aria-disabled='true'] img { filter: grayscale(1) brightness(0.45); }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: filter 0.2s; }
    /* Passando su un eroe (o col focus) gli altri perdono colore, come nella sala d'attesa. */
    .row:has(.card:is(:hover, :focus-visible)) .card:not(:is(:hover, :focus-visible)) img { filter: saturate(0.3) brightness(0.8); }
    /* Il numero di scelta sta nel piede, a destra, accanto al nome. */
    .cap .n { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: var(--radius-round); background: var(--c-interact); color: var(--c-bg); font: 700 13px/1 var(--font-mono); letter-spacing: 0; text-transform: none; }
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
    .cap { position: absolute; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; gap: 2px; padding: 8px 12px 10px; background: var(--c-surface); border-top: 1px solid var(--c-line-strong); text-align: left; }
    .cap b { font: 600 var(--fs-md)/1.2 var(--font-display); letter-spacing: 0.04em; }
    .cap span { color: var(--c-text-dim); font-size: 11px; font-weight: 600; letter-spacing: var(--label-tracking); text-transform: uppercase; }
  `,
})
export class PartyComponent {
  private readonly router = inject(Router);
  private readonly map = inject(ActivatedRoute).snapshot.paramMap.get('map') ?? '';
  protected readonly title = ADVENTURES.find((a) => a.map === this.map)?.title ?? this.map;
  protected readonly min = PARTY_MIN;
  protected readonly max = PARTY_MAX;
  protected readonly heroes = signal<HeroSheet[]>([]);
  /** Gli eroi scelti, nell'ordine in cui si sono toccati. */
  protected readonly chosen = signal<string[]>([]);
  protected readonly ready = computed(() => this.chosen().length >= PARTY_MIN);
  /** Le schede degli eroi scelti, nell'ordine della squadra, e ciò che ognuno ha comprato. */
  protected readonly squad = computed(() => this.chosen().flatMap((id) => this.heroes().find((h) => h.id === id) ?? []));
  protected readonly shop = signal<ShopData | null>(null);
  /** I famigli del catalogo: una carta eroe che ne dà uno lo mostra già nella scelta (pillola "Famiglio"). */
  private readonly familiarDefs = signal<ReadonlyMap<string, FamiliarDef>>(new Map());
  protected familiarsOf(h: HeroSheet): FamiliarDef[] {
    return familiarsOfSheet(h, this.familiarDefs());
  }
  /** Il catalogo delle carte abilità e quelle assegnate a ogni eroe della squadra (pescate quando si conferma la scelta). */
  private readonly skillCatalog = signal<ReadonlyMap<string, SkillDef>>(new Map());
  protected readonly skillCards = signal<Record<string, string[]>>({});
  /** Prima si scelgono gli eroi, poi (confermata la scelta) si comprano gli oggetti. */
  protected readonly step = signal<'pick' | 'gear'>('pick');
  protected readonly loadouts = signal<Record<string, Loadout>>({});
  protected readonly startCoins = computed(() => this.squad()[0]?.coins ?? 300);
  protected readonly full = computed(() => this.chosen().length >= PARTY_MAX);

  constructor() {
    void loadAllHeroSheets().then((h) => this.heroes.set(h));
    void loadPregameShop().then((s) => this.shop.set(s));
    void loadSkillCatalog().then((c) => this.skillCatalog.set(c));
    void loadFamiliarCatalog().then((d) => this.familiarDefs.set(d));
  }

  /** La posizione dell'eroe nella squadra (1, 2…), o 0 se non è scelto. */
  protected order(id: string): number {
    return this.chosen().indexOf(id) + 1;
  }

  protected toggle(id: string) {
    this.chosen.update((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < PARTY_MAX ? [...c, id] : c));
    // Un eroe lasciato a casa rimette in negozio ciò che aveva comprato.
    this.loadouts.update((l) => Object.fromEntries(Object.entries(l).filter(([hero]) => this.chosen().includes(hero))));
  }

  protected loadoutOf(id: string): Loadout {
    return this.loadouts()[id] ?? emptyLoadout();
  }

  /** Gli acquisti degli altri eroi della squadra: le copie in vendita sono comuni. */
  protected othersOf(id: string): Loadout[] {
    return Object.entries(this.loadouts()).filter(([hero]) => hero !== id).map(([, l]) => l);
  }

  protected setLoadout(id: string, l: Loadout) {
    this.loadouts.update((all) => ({ ...all, [id]: l }));
  }

  /** La freccia: dalla schermata degli acquisti si torna agli eroi, da quella degli eroi alla scelta dell'avventura. */
  protected back() {
    if (this.step() === 'gear') this.step.set('pick');
    else void this.router.navigate(['/adventures']);
  }

  protected home() {
    void this.router.navigate(['/']);
  }

  protected confirm() {
    if (!this.ready()) return;
    this.assignSkills();
    this.step.set('gear');
    this.skillNotice.set(true);
  }

  /** Dà a ogni eroe della squadra le sue carte abilità secondarie (una a caso per punto di attributo, senza doppioni nella squadra); chi le ha già le tiene, chi esce dalla squadra le rimette nel mazzo. */
  private assignSkills() {
    const pool = [...this.skillCatalog().values()].map((c) => ({ id: c.id, school: c.school }));
    const kept: Record<string, string[]> = {};
    for (const h of this.squad()) if (this.skillCards()[h.id]) kept[h.id] = this.skillCards()[h.id];
    const taken = new Set(Object.values(kept).flat());
    for (const h of this.squad()) {
      if (kept[h.id]) continue;
      kept[h.id] = drawSkillCards(h.skills, pool, taken);
      kept[h.id].forEach((id) => taken.add(id));
    }
    this.skillCards.set(kept);
  }

  protected skillsOf(id: string): SkillDef[] {
    return (this.skillCards()[id] ?? []).flatMap((c) => this.skillCatalog().get(c) ?? []);
  }

  /** Gli eroi che non hanno speso niente (hanno ancora tutte le monete): prima di partire si chiede conferma. */
  protected readonly unspentNames = computed(() => {
    const shop = this.shop();
    return this.squad().filter((h) => !shop || loadoutCost(this.loadoutOf(h.id), shop) === 0).map((h) => h.name).join(', ');
  });
  protected readonly askUnspent = signal(false);
  /** Entrando nell'Equipaggiamento una dialog avvisa che le abilità secondarie sono state assegnate a caso. */
  protected readonly skillNotice = signal(false);
  /** La scheda di dettaglio aperta dal tasto "i" di una carta. */
  protected readonly detail = signal<HeroSheet | null>(null);

  protected start() {
    if (!this.ready()) return;
    if (this.unspentNames()) this.askUnspent.set(true);
    else this.go();
  }

  private go() {
    // Gli acquisti passano alla partita: per ogni eroe la dotazione e le monete che gli restano.
    const shop = this.shop();
    const setup: PartySetup = {};
    for (const h of this.squad()) {
      const l = this.loadoutOf(h.id);
      setup[h.id] = { ...l, coins: h.coins - (shop ? loadoutCost(l, shop) : 0), skillCards: this.skillCards()[h.id] ?? [] };
    }
    partySetupStore.save(setup);
    void this.router.navigate(['/play', this.map], { queryParams: { new: 1, party: this.chosen().join(',') } });
  }
}
