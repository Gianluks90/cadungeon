import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { objectiveText } from '../game/state/objective-text';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { AdventureDialogComponent, AdventureView } from '../ui/adventure-dialog.component';
import { DotTrailComponent } from '../ui/dot-trail.component';
import { IconComponent } from '../ui/icon.component';
import { ADVENTURES, AdventureCard } from './adventures';
import { PlayChoice, PlayDialogComponent } from './play-dialog.component';

/** Ciò che serve della mappa per mostrare l'obiettivo senza caricare la scena. */
interface GoalData {
  objective?: { description?: string; text?: string } | null;
  rules?: string;
}

/**
 * La scelta dell'avventura (`/adventures`, si arriva da "Nuova partita" della home): nove schede in una griglia 3×3 (in colonna sul telefono) che compaiono una alla volta con una
 * dissolvenza, sullo stesso sfondo a puntini della home. In alto a sinistra il tasto quadrato con il logo riporta alla home.
 * Ogni scheda con una mappa ha il numero, il titolo e in alto a destra, staccati, la bandierina (apre la dialog con l'obiettivo e le regole speciali) e un segno di spunta in un cerchio che diventa verde
 * quando l'avventura è completata. Cliccando la scheda si apre la dialog del modo di gioco (`app-play-dialog`), che poi porta a `/play/<map>`; le altre sono posti ancora vuoti e spenti.
 */
@Component({
  selector: 'app-adventures',
  imports: [IconComponent, DotTrailComponent, RouterLink, AdventureDialogComponent, PlayDialogComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dot-trail />
    <section class="grid" [attr.aria-label]="'adventures.choose' | t">
      @for (a of adventures; track $index) {
        @if (a.map) {
          <div class="card" [style.--i]="$index">
            <button type="button" class="hit" [attr.aria-label]="'adventures.play' | t: { title: a.title ?? '' }" (click)="choose(a)"></button>
            <span class="n">{{ number($index) }}</span>
            <span class="t">{{ a.title }}</span>
            <span class="marks">
              <button type="button" class="flag" [attr.aria-label]="'adventures.goal' | t" [title]="'adventures.goalHint' | t" (click)="showGoal(a)"><app-icon name="flag" [size]="20" /></button>
              <span class="status" [class.done]="completed().has(a.map)" [title]="(completed().has(a.map) ? 'adventures.completed' : 'adventures.notCompleted') | t"><app-icon name="check_circle" [size]="20" /></span>
            </span>
          </div>
        } @else {
          <div class="card off" aria-disabled="true" [style.--i]="$index"><span class="n">{{ number($index) }}</span><span class="t">{{ 'common.soon' | t }}</span></div>
        }
      }
    </section>
    <a class="square back" routerLink="/" [attr.aria-label]="'adventures.backHome' | t" [title]="'adventures.backHome' | t"><app-icon name="logo/logoipsum-419" [size]="20" /></a>
    <app-adventure-dialog [view]="goal()" (confirm)="goal.set(null)" />
    @if (chosen(); as c) { <app-play-dialog [title]="c.title ?? ('adventures.fallbackTitle' | t)" (closed)="chosen.set(null)" (confirm)="play(c, $event)" /> }
  `,
  styles: `
    :host { position: fixed; inset: 0; display: block; overflow: auto; background: var(--c-bg); }
    .grid {
      position: relative; z-index: 1; box-sizing: border-box; min-height: 100%; padding: 72px 16px calc(32px + env(safe-area-inset-bottom));
      display: grid; grid-template-columns: repeat(3, minmax(0, 260px)); grid-auto-rows: 136px; gap: 16px; justify-content: center; align-content: center;
    }
    .card {
      position: relative; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-end; padding: 14px 16px; border-radius: var(--radius-1);
      background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-line-strong); transition: color 0.15s, border-color 0.15s;
      animation: fade-in 0.5s ease-out both; animation-delay: calc(0.1s + var(--i) * 90ms);
    }
    /* Tutta la scheda è un tasto che apre la dialog del modo di gioco; la bandierina sta sopra di lui. */
    .hit { position: absolute; inset: 0; z-index: 0; border-radius: inherit; padding: 0; border: 0; background: none; cursor: pointer; }
    .hit:focus-visible { outline: 1px solid var(--c-interact); outline-offset: 2px; }
    .card:has(.hit:hover) { border-color: var(--c-interact); }
    .card:has(.hit:hover) .t { color: var(--c-interact); }
    .n { position: absolute; top: 14px; left: 16px; font: 600 12px/1 var(--font-mono); letter-spacing: 0.08em; color: var(--c-text-dim); pointer-events: none; }
    .t { position: relative; pointer-events: none; font: 600 17px/1.25 var(--font-display); letter-spacing: 0.03em; transition: color 0.15s; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    /* In alto a destra, le due icone una accanto all'altra (stessa dimensione e stesso colore, ognuna nella sua casella di 28 px): la bandierina (un tasto) e il cerchio dell'avventura completata. */
    .marks { position: absolute; z-index: 1; top: 6px; right: 8px; display: flex; align-items: center; gap: 0; }
    .flag, .status { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; }
    .flag { border: 0; background: none; color: var(--c-text-dim); cursor: pointer; border-radius: var(--radius-1); transition: color 0.15s; }
    .flag:hover, .flag:focus-visible { color: var(--c-interact); outline: none; }
    .status { color: var(--c-text-dim); opacity: 0.25; transition: color 0.3s, opacity 0.3s; }
    .status.done { color: var(--c-ok); opacity: 1; }
    @media (pointer: coarse) { .flag, .status { width: 36px; height: 36px; } }
    .card.off { opacity: 0.4; }
    .card.off .t { font: 400 13px/1.3 var(--font-ui); letter-spacing: 0; color: var(--c-text-dim); }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    /* Il tasto con il logo, in alto a sinistra: stesse misure dei tasti quadrati della home (34 px con il mouse, 44 px col dito). */
    .back {
      position: fixed; z-index: 2; top: calc(12px + env(safe-area-inset-top)); left: 12px; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 34px; height: 34px;
      border-radius: var(--radius-1); background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-line-strong); transition: color 0.15s, border-color 0.15s; animation: fade-in 0.4s ease-out both;
    }
    @media (pointer: coarse) { .back { width: 44px; height: 44px; } }
    .back:hover, .back:focus-visible { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    @media (max-width: 600px) { .grid { grid-template-columns: minmax(0, 1fr); align-content: start; } }
  `,
})
export class AdventuresComponent {
  protected readonly adventures = ADVENTURES;
  /** Le avventure completate (il nome della mappa): per ora nessuna, arriveranno con i salvataggi. */
  protected readonly completed = signal<ReadonlySet<string>>(new Set());
  /** La dialog dell'obiettivo, quando è aperta. */
  protected readonly goal = signal<AdventureView | null>(null);
  /** L'avventura scelta, finché la dialog del modo di gioco è aperta. */
  protected readonly chosen = signal<AdventureCard | null>(null);
  private readonly goals = new Map<string, GoalData>();
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  protected choose(a: AdventureCard) {
    this.chosen.set(a);
  }

  /** Per ora la scelta del modo non cambia ancora la partita: si apre l'avventura come prima. */
  protected play(a: AdventureCard, _choice: PlayChoice) {
    void this.router.navigate(['/play', a.map]);
  }

  protected number(i: number): string {
    return String(i + 1).padStart(2, '0');
  }

  /** Apre la dialog con l'obiettivo e, sotto, le regole speciali (come il tasto Obiettivo in partita); legge il file della mappa la prima volta. */
  protected async showGoal(a: AdventureCard) {
    if (!a.map || this.goal()) return;
    let data = this.goals.get(a.map);
    if (!data) {
      try {
        const res = await fetch(new URL(`maps/${a.map}.json`, document.baseURI));
        if (!res.ok) return;
        data = (await res.json()) as GoalData;
        this.goals.set(a.map, data);
      } catch {
        return;
      }
    }
    const rules = data.rules?.trim();
    const t = (key: 'adventures.goal' | 'adventures.fallbackTitle' | 'adventures.specialRules' | 'common.close') => this.i18n.t(key);
    this.goal.set({ kicker: t('adventures.goal'), title: a.title ?? t('adventures.fallbackTitle'), text: objectiveText(data) + (rules ? `\n\n### ${t('adventures.specialRules')}\n\n${rules}` : ''), action: t('common.close'), dismissible: true });
  }
}
