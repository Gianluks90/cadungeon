import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DotWaveComponent } from '../ui/dot-wave.component';
import { IconComponent } from '../ui/icon.component';

/**
 * La pagina iniziale: il logo al centro, in basso "Nuova partita" (ancora bloccato), "Demo" (apre l'avventura Nelle Tenebre) ed "Editor" e in alto a destra tre tasti quadrati (profilo, impostazioni e lingua). Per ora i tasti non fanno nulla: le mappe si aprono solo da `/gioca/<mappa>` scritto a mano.
 */
@Component({
  selector: 'app-home',
  imports: [IconComponent, DotWaveComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dot-wave />
    <main>
      <div class="logo-wrap"><div class="logo"><app-icon name="logo/logoipsum-419" [size]="120" /></div></div>
      <nav aria-label="Dove andare" class="nav" [class.open]="menuOpen()">
        <button type="button" class="btn" aria-disabled="true" title="Presto disponibile">Nuova partita</button>
        <a class="btn menu-off" routerLink="/gioca/nelle-tenebre" title="Prova l'avventura Nelle Tenebre" (click)="menuOpen.set(false)">Demo</a>
        <a class="btn" routerLink="/editor" (click)="menuOpen.set(false)">Editor</a>
      </nav>
    </main>
    @if (menuOpen()) { <div class="scrim" (click)="menuOpen.set(false)"></div> }
    <div class="tools">
      <button type="button" class="square menu-btn" aria-label="Menu" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(!menuOpen())"><app-icon [name]="menuOpen() ? 'close' : 'menu'" [size]="22" /></button>
      <button type="button" class="square" aria-label="Profilo" title="Profilo utente (presto disponibile)" aria-disabled="true"><app-icon name="person" [size]="22" /></button>
      <button type="button" class="square" aria-label="Impostazioni" title="Impostazioni (presto disponibile)" aria-disabled="true"><app-icon name="settings" [size]="22" /></button>
      <button type="button" class="square" aria-label="Lingua" title="Lingua (presto disponibile)" aria-disabled="true"><app-icon name="public" [size]="22" /></button>
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; display: block; overflow: auto; background: var(--c-bg); }
    main { position: relative; }
    main { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; padding: 24px 16px calc(32px + env(safe-area-inset-bottom)); }
    /* Il logo sta nel centro esatto della pagina (e dell'onda), indipendente dai tasti in basso. */
    .logo-wrap { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
    /* Il logo sta in un cerchio pieno, con lo sfondo di base: i puntini non passano dietro. */
    .logo { display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 220px; height: 220px; border-radius: var(--radius-round); background: var(--c-bg); border: 1px solid var(--c-line-strong); color: var(--c-text); }
    nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: 720px; }
    .btn {
      box-sizing: border-box; padding: 10px 18px; border-radius: var(--radius-1); cursor: pointer; text-decoration: none;
      background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-line-strong); font: 600 13px/1.2 var(--font-ui);
      transition: color 0.15s, border-color 0.15s;
    }
    .btn:hover, .btn:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    .tools { position: fixed; z-index: 2; top: calc(12px + env(safe-area-inset-top)); right: 12px; display: flex; flex-direction: column; gap: 8px; }
    .square {
      display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 44px; height: 44px; padding: 0; border-radius: var(--radius-1); cursor: pointer;
      background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-line-strong); transition: color 0.15s, border-color 0.15s;
    }
    .square:hover, .square:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    .menu-btn, .scrim { display: none; }
    /* Su schermi stretti: logo più piccolo e le scelte in basso diventano una tendina del tasto menu, con il tasto in basso a destra (gli altri tasti quadrati restano in alto). */
    @media (max-width: 600px) {
      .logo { width: 150px; height: 150px; }
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
      /* Nel menu a tendina "Nuova partita" e "Demo" sono spenti. */
      nav.nav .btn[aria-disabled='true'], nav.nav .btn.menu-off { opacity: 0.4; pointer-events: none; }
    }
  `,
})
export class HomeComponent {
  protected readonly menuOpen = signal(false);
}
