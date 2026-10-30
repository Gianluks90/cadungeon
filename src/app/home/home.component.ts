import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DotTrailComponent } from '../ui/dot-trail.component';
import { I18nService, Lang } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { IconComponent } from '../ui/icon.component';

/**
 * La pagina iniziale: il logo al centro, in basso, in colonna e tutti della stessa larghezza, "Nuova partita" (fa svanire tutto e porta alla scelta dell'avventura, `/adventures`), "Continua" (spento) ed "Editor"; in alto a sinistra due tasti quadrati (schermo intero, che entra ed esce, e audio, spento per ora) e in alto a destra tre tasti quadrati (profilo, impostazioni e lingua). Per ora i tasti non fanno nulla: le mappe si aprono solo da `/play/<map>` scritto a mano.
 */
@Component({
  selector: 'app-home',
  imports: [IconComponent, DotTrailComponent, RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dot-trail />
    <main>
      <div class="logo-wrap fade" [class.gone]="leaving()">
        <!-- Il titolo del gioco gira piano intorno al logo: il testo è ripetuto tre volte e distribuito su tutta la circonferenza (r = 124 → 779 px). Non si traduce: è il titolo del gioco. -->
        <svg class="ring" viewBox="0 0 300 300" aria-hidden="true">
          <defs><path id="ring-path" d="M150 26 a124 124 0 1 1 -0.01 0" /></defs>
          <text><textPath href="#ring-path" textLength="779" lengthAdjust="spacing">Delve: Legends in the Deep · Delve: Legends in the Deep · Delve: Legends in the Deep ·</textPath></text>
        </svg>
        <div class="logo"><app-icon name="logo/logoipsum-419" [size]="120" /></div></div>
      <nav [attr.aria-label]="'home.nav' | t" class="nav fade" [class.open]="menuOpen()" [class.gone]="leaving()">
        <button type="button" class="btn" (click)="newGame()">{{ 'home.newGame' | t }}</button>
        <button type="button" class="btn" aria-disabled="true" [title]="'common.soon' | t">{{ 'home.continue' | t }}</button>
        <a class="btn" routerLink="/editor" (click)="menuOpen.set(false)">{{ 'home.editor' | t }}</a>
      </nav>
    </main>
    @if (menuOpen()) { <div class="scrim" (click)="menuOpen.set(false)"></div> }
    <div class="tools-left fade" [class.gone]="leaving()">
      <button type="button" class="square" [attr.aria-label]="(fullscreen() ? 'home.exitFullscreen' : 'home.fullscreen') | t" [title]="(fullscreen() ? 'home.exitFullscreen' : 'home.fullscreen') | t" [attr.aria-disabled]="canFullscreen ? null : 'true'" (click)="toggleFullscreen()"><app-icon [name]="fullscreen() ? 'fullscreen_exit' : 'fullscreen'" [size]="20" /></button>
      <button type="button" class="square" [attr.aria-label]="'home.audio' | t" [title]="'home.audioSoon' | t" aria-disabled="true"><app-icon name="volume_off" [size]="20" /></button>
    </div>
    <div class="tools fade" [class.gone]="leaving()">
      <button type="button" class="square menu-btn" [attr.aria-label]="'home.menu' | t" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())"><app-icon [name]="menuOpen() ? 'close' : 'menu'" [size]="20" /></button>
      <button type="button" class="square" [attr.aria-label]="'home.profile' | t" [title]="'home.profileSoon' | t" aria-disabled="true"><app-icon name="person" [size]="20" /></button>
      <button type="button" class="square" [attr.aria-label]="'home.settings' | t" [title]="'home.settingsSoon' | t" aria-disabled="true"><app-icon name="settings" [size]="20" /></button>
      <div class="lang">
        <button type="button" class="square" [attr.aria-label]="'home.language' | t" [title]="'home.language' | t" aria-haspopup="menu" [attr.aria-expanded]="langOpen()" (click)="langOpen.set(!langOpen())"><app-icon name="public" [size]="20" /></button>
        @if (langOpen()) {
          <div class="lang-menu" role="menu">
            @for (l of i18n.languages; track l.code) {
              <button type="button" role="menuitemradio" [attr.aria-checked]="l.code === i18n.lang()" [class.on]="l.code === i18n.lang()" (click)="setLang(l.code)">{{ l.label }}</button>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; display: block; overflow: auto; background: var(--c-bg); }
    main { position: relative; }
    main { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 24px 16px calc(32px + env(safe-area-inset-bottom)); }
    /* Il logo sta nel centro esatto della pagina (e dell'onda), indipendente dai tasti in basso. */
    .logo-wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    /* Il titolo intorno al logo: carattere normale dell'interfaccia (non il serif), nel giallo di accento, in rotazione lenta (con la riduzione del movimento sta fermo). */
    .ring { position: absolute; width: 300px; height: 300px; overflow: visible; animation: ring-spin 90s linear infinite; }
    .ring text { fill: var(--c-interact); font: 500 11px/1 var(--font-ui); letter-spacing: 0.16em; text-transform: uppercase; }
    @keyframes ring-spin { to { transform: rotate(360deg); } }
    /* Il logo sta in un cerchio pieno, con lo sfondo di base: i puntini non passano dietro. */
    .logo { display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 220px; height: 220px; border-radius: var(--radius-round); background: var(--c-bg); border: 1px solid var(--c-line-strong); color: var(--c-text); }
    nav { display: flex; flex-direction: column; align-items: stretch; gap: 8px; width: 200px; }
    .btn {
      box-sizing: border-box; padding: 10px 18px; border-radius: var(--radius-1); cursor: pointer; text-decoration: none;
      background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-line-strong); font: 600 13px/1.2 var(--font-ui);
      transition: color 0.15s, border-color 0.15s; text-align: center;
    }
    /* "Nuova partita" e "Continua" sono spenti, su ogni schermo. */
    .btn[aria-disabled='true'] { opacity: 0.4; pointer-events: none; }
    .btn:hover, .btn:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    /* Premendo "Nuova partita" logo, tasti e tendina svaniscono (e non si possono più toccare) prima di cambiare pagina. */
    .fade { transition: opacity 0.3s ease-out, visibility 0s; }
    .fade.gone { opacity: 0; visibility: hidden; pointer-events: none; transition: opacity 0.3s ease-out, visibility 0s 0.3s; }
    .tools, .tools-left { position: fixed; z-index: 2; top: calc(12px + env(safe-area-inset-top)); right: 12px; display: flex; flex-direction: column; gap: 8px; }
    .tools-left { right: auto; left: 12px; }
    .square {
      display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 34px; height: 34px; padding: 0; border-radius: var(--radius-1); cursor: pointer;
      background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-line-strong); transition: color 0.15s, border-color 0.15s;
    }
    /* Come nell'editor: 34 px con il mouse, 44 px (più facili da toccare) con il dito. */
    @media (pointer: coarse) { .square { width: 44px; height: 44px; } }
    .square:hover, .square:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    /* I tasti spenti (audio, profilo, impostazioni, lingua) hanno lo stesso aspetto dei tasti di testo spenti. */
    .square[aria-disabled='true'] { opacity: 0.4; pointer-events: none; }
    /* La scelta della lingua: una piccola tendina a sinistra del tasto, con la lingua di adesso in colore di accento. */
    .lang { position: relative; }
    .lang-menu {
      position: absolute; top: 0; right: calc(100% + 8px); display: flex; flex-direction: column; min-width: 120px; padding: 3px; box-sizing: border-box;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
    }
    .lang-menu button { padding: 8px 12px; border: 0; background: none; color: var(--c-text); text-align: left; cursor: pointer; font: 13px/1.3 var(--font-ui); border-radius: var(--radius-1); }
    .lang-menu button:hover, .lang-menu button:focus-visible { background: color-mix(in srgb, var(--c-text) 8%, transparent); outline: none; }
    .lang-menu button.on { color: var(--c-interact); }
    .menu-btn, .scrim { display: none; }
    /* Su schermi stretti: logo più piccolo e le scelte in basso diventano una tendina del tasto menu, con il tasto in basso a destra (gli altri tasti quadrati restano in alto). */
    @media (max-width: 600px) {
      .logo { width: 150px; height: 150px; }
      .ring { width: 216px; height: 216px; }
      .logo app-icon { transform: scale(0.68); }
      .menu-btn { display: inline-flex; position: fixed; z-index: 2; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); }
      .scrim { display: block; position: fixed; inset: 0; z-index: 1; }
      nav.nav {
        display: none; position: fixed; z-index: 2; bottom: calc(64px + env(safe-area-inset-bottom)); right: 12px;
        flex-direction: column; flex-wrap: nowrap; gap: 0; min-width: 180px; padding: 4px;
        background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1);
      }
      nav.nav.open { display: flex; }
      nav.nav .btn { border: 0; text-align: left; background: transparent; padding: 12px 14px; }
    }
  `,
})
export class HomeComponent {
  protected readonly menuOpen = signal(false);
  /** Dopo "Nuova partita": tutto svanisce e poi si apre la scelta dell'avventura. */
  protected readonly leaving = signal(false);
  protected readonly i18n = inject(I18nService);
  protected readonly langOpen = signal(false);
  private readonly router = inject(Router);
  private timer: ReturnType<typeof setTimeout> | undefined;
  protected readonly fullscreen = signal(!!document.fullscreenElement);
  /** Non tutti i browser lo permettono (per esempio iPhone): lì il tasto resta spento. */
  protected readonly canFullscreen = document.fullscreenEnabled;

  constructor() {
    const sync = () => this.fullscreen.set(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', sync);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('fullscreenchange', sync);
      clearTimeout(this.timer);
    });
  }

  protected newGame() {
    this.menuOpen.set(false);
    this.leaving.set(true);
    this.timer = setTimeout(() => void this.router.navigateByUrl('/adventures'), 300); // il tempo della dissolvenza
  }

  protected setLang(lang: Lang) {
    this.i18n.setLang(lang);
    this.langOpen.set(false);
  }

  /** Il menu della lingua si chiude con un tocco fuori o con Esc. */
  @HostListener('document:pointerdown', ['$event'])
  protected outside(e: Event) {
    if (this.langOpen() && !(e.target as Element).closest('.lang')) this.langOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  protected closeLang() {
    this.langOpen.set(false);
  }

  protected toggleFullscreen() {
    if (!this.canFullscreen) return;
    const done = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    done.catch(() => {}); // il browser può rifiutare: lo stato resta quello che dice `fullscreenchange`
  }
}
