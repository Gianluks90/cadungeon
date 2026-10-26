import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { HeroSheet } from '../game/heroes/hero-sheet';
import { ItemDef } from '../game/items/item';
import { MonsterDef } from '../game/monsters/monster';
import { SkillDef } from '../game/skills/skill';
import { HeroCardComponent } from './hero-card.component';
import { IconComponent } from './icon.component';
import { MonsterCardComponent } from './monster-card.component';
import { ItemCardComponent } from './item-card.component';
import { SkillCardComponent } from './skill-card.component';

/** Un elemento del catalogo: una carta oggetto (con quante copie ci sono, se si sa) o una carta abilità. */
export type CatalogEntry =
  | { kind: 'item'; id: string; name: string; def: ItemDef; icon: string; detail: string; count: number | null; search: string }
  | { kind: 'skill'; id: string; name: string; def: SkillDef; search: string }
  | { kind: 'hero'; id: string; name: string; sheet: HeroSheet; search: string }
  | { kind: 'monster'; id: string; name: string; def: MonsterDef; search: string };

/** Una categoria del catalogo, nell'elenco a sinistra; `group` è il titolo sopra le categorie dello stesso gruppo. */
export interface CatalogCategory {
  id: string;
  group: string;
  name: string;
  entries: CatalogEntry[];
}

/** Toglie maiuscole e accenti, per cercare senza pensarci. */
const normalize = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/**
 * Il catalogo dei componenti di gioco: una finestra a due colonne. A sinistra la ricerca e l'elenco delle categorie (con quanti elementi, o quanti corrispondono
 * alla ricerca); a destra gli elementi della categoria scelta, in una griglia a due colonne dove ogni riga è alta quanto la sua card più grande.
 */
@Component({
  selector: 'app-components-dialog',
  imports: [HeroCardComponent, IconComponent, ItemCardComponent, MonsterCardComponent, SkillCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    @if (open()) {
      <div class="backdrop" (pointerdown)="backdrop($event)">
        <div class="dialog" role="dialog" aria-modal="true" aria-label="Componenti di gioco">
          <aside class="side">
            <h2>Componenti</h2>
            <input type="search" class="search" placeholder="Cerca" aria-label="Cerca fra i componenti" [value]="query()" (input)="query.set($any($event.target).value)" />
            <nav class="cats" aria-label="Categorie">
              @for (c of shown(); track c.id) {
                @if ($first || shown()[$index - 1].group !== c.group) { <h3>{{ c.group }}</h3> }
                <button type="button" class="cat" [class.on]="c.id === current()?.id" [class.none]="!c.matches" (click)="selected.set(c.id)">
                  <span>{{ c.name }}</span><span class="n">{{ c.matches }}</span>
                </button>
              }
            </nav>
          </aside>
          <section class="main">
            <header>
              <h2>{{ current()?.name }}</h2>
              <button type="button" class="x" aria-label="Chiudi" title="Chiudi" (click)="closed.emit()"><app-icon name="close" [size]="20" /></button>
            </header>
            <div class="grid">
              @for (e of entries(); track e.id) {
                @if (e.kind === 'item') {
                  <app-item-card [def]="e.def" [icon]="e.icon" [detail]="e.detail" [plain]="true">
                    @if (e.count !== null) { <span class="copies" title="Copie">×{{ e.count }}</span> }
                  </app-item-card>
                } @else if (e.kind === 'skill') {
                  <app-skill-card [skill]="e.def" />
                } @else if (e.kind === 'hero') {
                  <app-hero-card [sheet]="e.sheet" />
                } @else {
                  <app-monster-card [monster]="e.def" />
                }
              } @empty {
                <p class="empty">Nessun componente corrisponde alla ricerca.</p>
              }
            </div>
          </section>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .backdrop { position: fixed; inset: 0; z-index: 900; display: grid; place-items: center; padding: 12px; background: rgba(0, 0, 0, 0.6); animation: fade-in 0.2s ease-out; }
    @keyframes fade-in { from { opacity: 0; } }
    .dialog {
      display: grid; grid-template-columns: 250px minmax(0, 1fr); width: min(1020px, 100%); height: min(680px, calc(100vh - 24px)); overflow: hidden;
      border-radius: var(--radius-1); background: var(--c-surface); border: 1px solid var(--c-line-strong); box-shadow: 0 14px 40px rgba(0, 0, 0, 0.6);
      color: var(--c-text); font: 13px/1.35 var(--font-ui);
    }
    .side { display: flex; flex-direction: column; gap: 12px; min-height: 0; padding: 16px 12px 12px; border-right: 1px solid var(--c-line-strong); background: var(--c-bg); }
    h2 { margin: 0; font: 600 14px/1.2 var(--font-ui); letter-spacing: 0.06em; text-transform: uppercase; }
    .side h2 { padding: 0 4px; }
    .search {
      width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: var(--radius-1); border: 1px solid var(--c-line-strong); background: var(--c-surface);
      color: var(--c-text); font: 13px/1.2 var(--font-ui);
    }
    .search:focus-visible { outline: none; border-color: var(--c-interact); }
    .cats { flex: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 2px; }
    h3 { margin: 12px 4px 4px; font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    h3:first-child { margin-top: 0; }
    .cat {
      display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid transparent; border-radius: var(--radius-1);
      background: none; color: var(--c-text); text-align: left; cursor: pointer; font: 13px/1.2 var(--font-ui);
    }
    .cat:hover, .cat:focus-visible { background: color-mix(in srgb, var(--c-text) 7%, transparent); outline: none; }
    .cat.on { border-color: var(--c-line-strong); background: var(--c-surface); }
    .cat.none { color: var(--c-text-faint); }
    .n { color: var(--c-text-dim); font: 12px var(--font-mono); font-variant-numeric: tabular-nums; }
    .main { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
    .main header { flex: none; display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--c-line-strong); }
    .x { display: inline-flex; padding: 4px; border: 0; border-radius: var(--radius-1); background: none; color: var(--c-text-dim); cursor: pointer; }
    .x:hover, .x:focus-visible { color: var(--c-text); outline: none; }
    /* Due colonne; ogni riga è alta quanto la sua card più grande (le card si allungano). */
    .grid { flex: 1; min-height: 0; overflow: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: auto; align-items: stretch; gap: 10px; padding: 16px; align-content: start; }
    .empty { grid-column: 1 / -1; margin: 0; color: var(--c-text-dim); font-style: italic; }
    .copies { font: 12px var(--font-mono); color: var(--c-text-dim); font-variant-numeric: tabular-nums; }
    @media (max-width: 760px) {
      .dialog { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
      .side { border-right: 0; border-bottom: 1px solid var(--c-line-strong); max-height: 40vh; }
      .grid { grid-template-columns: 1fr; }
    }
    @media (prefers-reduced-motion: reduce) { .backdrop { animation: none; } }
  `,
})
export class ComponentsDialogComponent {
  readonly open = input(false);
  readonly categories = input<CatalogCategory[]>([]);
  readonly closed = output<void>();

  protected readonly query = signal('');
  protected readonly selected = signal<string | null>(null);

  /** Le categorie con quanti elementi corrispondono alla ricerca (tutti, se non si cerca). */
  protected readonly shown = computed(() => {
    const q = normalize(this.query().trim());
    return this.categories().map((c) => ({ ...c, matches: q ? c.entries.filter((e) => normalize(e.search).includes(q)).length : c.entries.length }));
  });

  protected readonly current = computed(() => this.shown().find((c) => c.id === this.selected()) ?? this.shown()[0] ?? null);

  protected readonly entries = computed(() => {
    const c = this.current();
    const q = normalize(this.query().trim());
    return c ? (q ? c.entries.filter((e) => normalize(e.search).includes(q)) : c.entries) : [];
  });

  /** Un tocco sullo sfondo, fuori dalla finestra, la chiude. */
  protected backdrop(e: PointerEvent) {
    if ((e.target as HTMLElement).classList.contains('backdrop')) this.closed.emit();
  }
}
