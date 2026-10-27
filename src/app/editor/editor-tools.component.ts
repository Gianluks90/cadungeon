import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DoorSampleComponent } from '../ui/door-sample.component';
import { IconComponent } from '../ui/icon.component';
import { PaletteTile } from './palette';
import { DoorKind } from './tile-editor';
import { tilePreview } from './tile-preview';

/** Gli strumenti di costruzione: ognuno ha un tasto nella barra e, quando è acceso, mostra la sua cassetta. */
interface Tool {
  id: 'tiles' | 'doors';
  icon: string;
  label: string;
}

const TOOLS: Tool[] = [
  { id: 'tiles', icon: 'map', label: 'Tessere' },
  { id: 'doors', icon: 'door_front', label: 'Porte' },
];

/** Lato in pixel di una cella nelle anteprime. */
const PREVIEW_CELL = 12;

/**
 * La cassetta degli attrezzi dell'editor, legata al bordo inferiore dello schermo: una barra di tasti (Tessere, icona `map`, e Porte, icona `door_front`) e, sopra, quando uno strumento è acceso,
 * un footer a scorrimento orizzontale con tutti gli elementi che si possono inserire. Ogni scheda ha il contatore dei pezzi già messi in mappa (anche il totale sul tasto dello strumento);
 * un clic su una scheda la prende in mano (`pick`: l'editor la lega al puntatore), un altro clic sulla stessa la lascia.
 */
@Component({
  selector: 'app-editor-tools',
  imports: [DoorSampleComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (tool() === 'tiles') {
      <div class="tray" role="region" aria-label="Tessere">
        <header>
          <span class="title">Tessere</span>
          <span class="actions">
            <button type="button" class="act" [class.on]="deleting()" [attr.aria-pressed]="deleting()" aria-label="Elimina" title="Elimina: un clic toglie il pezzo, trascinando si traccia un'area e al rilascio spariscono i pezzi che tocca" (click)="toggleDelete.emit()"><app-icon name="delete" [size]="18" /></button>
            <button type="button" class="act" [class.off]="!carrying()" [attr.aria-disabled]="!carrying()" aria-label="Ruota" title="Ruota il pezzo in mano (R)" (click)="carrying() && rotate.emit()"><app-icon name="rotate_right" [size]="18" /></button>
            <button type="button" class="act" [class.off]="!openExits()" [attr.aria-disabled]="!openExits()" aria-label="Chiudi le uscite" [title]="openExits() ? 'Chiudi con un punto morto le ' + openExits() + ' uscite rimaste libere' : 'Nessuna uscita libera da chiudere'" (click)="openExits() && closeExits.emit()"><app-icon name="fence" [size]="18" /></button>
          </span>
        </header>
        <ul>
          @for (it of items(); track it.tile.id) {
            <li>
              <button type="button" class="item" [class.carrying]="carrying() === it.tile.id" [attr.aria-pressed]="carrying() === it.tile.id" [title]="it.tile.name" (click)="pick.emit(it.tile.id)">
                @if (counts()[it.tile.id]) { <span class="count" title="Pezzi in mappa">×{{ counts()[it.tile.id] }}</span> }
                <svg [attr.viewBox]="'0 0 ' + it.preview.w * cell + ' ' + it.preview.h * cell" [style.width.px]="it.preview.w * cell" [style.height.px]="it.preview.h * cell" aria-hidden="true">
                  <g [attr.transform]="'scale(' + cell + ')'">
                    @for (r of it.preview.floor; track $index) { <rect [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" [attr.height]="r.h" class="floor" /> }
                    <path [attr.d]="it.preview.walls" class="wall" />
                  </g>
                </svg>
                <span class="name">{{ it.tile.name }}</span>
                <span class="size">{{ it.tile.def.size.w }}×{{ it.tile.def.size.h }}</span>
              </button>
            </li>
          }
        </ul>
      </div>
    }
    @if (tool() === 'doors') {
      <div class="tray" role="region" aria-label="Porte">
        <header>
          <span class="title">Porte</span>
          <span class="actions">
            <button type="button" class="act" [class.on]="deleting()" [attr.aria-pressed]="deleting()" aria-label="Elimina" title="Elimina: un clic toglie la porta, trascinando si traccia un'area e al rilascio spariscono i pezzi che tocca" (click)="toggleDelete.emit()"><app-icon name="delete" [size]="18" /></button>
          </span>
        </header>
        <ul>
          @for (d of doorTypes; track d.kind) {
            <li>
              <button type="button" class="item door" [class.carrying]="carryingDoor() === d.kind" [class.off]="d.runic && doorCounts()[d.kind] >= 1 && carryingDoor() !== d.kind" [attr.aria-pressed]="carryingDoor() === d.kind" [attr.aria-disabled]="d.runic && doorCounts()[d.kind] >= 1 && carryingDoor() !== d.kind" [title]="d.name" [style.--tone]="d.tone" (click)="pickDoor.emit(d.kind)">
                @if (!d.runic) { <span class="count" title="Porte in mappa">×{{ doorCounts()[d.kind] }}</span> }
                @else if (doorCounts()[d.kind] >= 1) { <span class="count" title="Già in mappa">1/1</span> }
                <app-door-sample [kind]="d.kind" />
                <span class="name">{{ d.name }}</span>
                <span class="size">{{ d.note }}</span>
              </button>
            </li>
          }
        </ul>
      </div>
    }
    <div class="bar">
      @for (t of tools; track t.id) {
        <button type="button" [class.on]="tool() === t.id" [attr.aria-pressed]="tool() === t.id" [attr.aria-label]="t.label" [title]="t.label" (click)="toggle(t.id)">
          <app-icon [name]="t.icon" [size]="20" />@if (badge(t.id)) { <span class="badge">{{ badge(t.id) }}</span> }
        </button>
      }
      <span class="sep" aria-hidden="true"></span>
      <button type="button" [class.off]="!canUndo()" [attr.aria-disabled]="!canUndo()" aria-label="Annulla" title="Annulla (Ctrl+Z)" (click)="canUndo() && undo.emit()"><app-icon name="undo" [size]="20" /></button>
      <button type="button" [class.off]="!canRedo()" [attr.aria-disabled]="!canRedo()" aria-label="Ripeti" title="Ripeti (Ctrl+Maiusc+Z)" (click)="canRedo() && redo.emit()"><app-icon name="redo" [size]="20" /></button>
    </div>
  `,
  styles: `
    :host { position: absolute; z-index: 10; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
    .bar { display: flex; align-items: center; gap: 8px; pointer-events: auto; }
    .sep { width: 1px; height: 22px; background: var(--c-line-strong); }
    .bar button.off { opacity: 0.4; cursor: default; }
    .bar button.off:hover { color: var(--c-text); border-color: var(--c-line-strong); }
    button {
      position: relative; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 34px; height: 34px; padding: 0; border-radius: var(--radius-1); cursor: pointer;
      background: var(--c-surface); border: 1px solid var(--c-line-strong); color: var(--c-text); transition: color 0.15s, border-color 0.15s;
    }
    button:hover, button:focus-visible, button.on { color: var(--c-interact); border-color: var(--c-interact); outline: none; }
    @media (pointer: coarse) { button { width: 44px; height: 44px; } }
    /* Il footer con gli elementi: una riga che scorre in orizzontale. */
    .tray { width: 100%; box-sizing: border-box; pointer-events: auto; background: var(--c-surface); border: 1px solid var(--c-line-strong); border-radius: var(--radius-1); animation: tray-in 0.18s ease-out; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 8px 6px 14px; border-bottom: 1px solid var(--c-line-strong); }
    .title { font: 600 11px/1 var(--font-ui); letter-spacing: var(--label-tracking); text-transform: uppercase; color: var(--c-text-dim); }
    .actions { display: flex; align-items: center; gap: 4px; }
    .dcount { color: var(--c-text); font: 600 11px/1 var(--font-mono); font-variant-numeric: tabular-nums; }
    .act { position: static; width: 28px; height: 28px; background: none; border-color: transparent; color: var(--c-text-dim); }
    .act:hover, .act:focus-visible, .act.on { color: var(--c-interact); border-color: var(--c-interact); }
    .act.off { opacity: 0.4; cursor: default; }
    .act.off:hover { color: var(--c-text-dim); border-color: transparent; }
    ul { list-style: none; margin: 0; padding: 12px; display: flex; gap: 10px; overflow-x: auto; overscroll-behavior-x: contain; }
    .badge { position: absolute; top: -7px; right: -7px; min-width: 16px; box-sizing: border-box; padding: 2px 4px; border-radius: 8px; background: var(--c-interact); color: var(--c-bg); font: 700 10px/1 var(--font-mono); text-align: center; pointer-events: none; }
    .item { position: relative; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; box-sizing: border-box; width: 112px; height: 130px; padding: 10px 8px 8px; border: 1px solid var(--c-line); border-radius: var(--radius-1); background: var(--c-bg); color: var(--c-text); font: 12px/1.2 var(--font-ui); cursor: pointer; transition: border-color 0.15s; }
    .item:hover, .item:focus-visible { border-color: var(--c-text-dim); outline: none; }
    .item.carrying { border-color: var(--c-interact); }
    .item.door.carrying { border-color: var(--tone); }
    .item.door.off { opacity: 0.4; cursor: default; }
    .count { position: absolute; top: 6px; right: 7px; color: var(--c-interact); font: 600 11px/1 var(--font-mono); }
    .item svg { display: block; flex: none; }
    .floor { fill: var(--cad-floor); }
    .wall { fill: none; stroke: var(--cad-wall); stroke-width: 0.14; stroke-linecap: square; }
    .name { font-weight: 600; text-align: center; }
    .size { color: var(--c-text-dim); font-family: var(--font-mono); font-size: 11px; }
    @keyframes tray-in { from { opacity: 0; transform: translateY(8px); } }
    @media (prefers-reduced-motion: reduce) { .tray { animation: none; } }
  `,
})
export class EditorToolsComponent {
  protected readonly tools = TOOLS;
  protected readonly cell = PREVIEW_CELL;
  /** Lo strumento acceso (la sua cassetta è aperta), o nessuno. */
  protected readonly tool = signal<Tool['id'] | null>(null);
  /** Le tessere disponibili e quante ne sono già in mappa, per tipo. */
  readonly tiles = input<PaletteTile[]>([]);
  readonly counts = input<Record<string, number>>({});
  /** L'id della tessera che si porta in mano adesso, o null. */
  readonly carrying = input<string | null>(null);
  readonly pick = output<string>();
  /** Ruota la tessera in mano (serve soprattutto sul tocco, dove non c'è il tasto R). */
  readonly rotate = output<void>();
  /** Modalità elimina (accesa o no) e il suo tasto. */
  readonly deleting = input(false);
  readonly toggleDelete = output<void>();
  /** Quante uscite dei pezzi piazzati sono ancora libere, e il tasto che le chiude con i punti morti. */
  readonly openExits = input(0);
  readonly closeExits = output<void>();
  /** Le porte: quante ce ne sono per tipo (le runiche una per colore), quale si porta in mano e il tasto per prenderne una. */
  readonly doorCounts = input<Record<DoorKind, number>>({ normal: 0, key: 0, blue: 0, red: 0, green: 0 });
  readonly carryingDoor = input<DoorKind | null>(null);
  readonly pickDoor = output<DoorKind>();
  /** I tipi di porta che si possono inserire. Le runiche una per colore (la scheda si spegne quando è in mappa); le altre senza limite, con il contatore. */
  protected readonly doorTypes: { kind: DoorKind; name: string; note: string; tone: string; badge: string | null; runic: boolean }[] = [
    { kind: 'normal', name: 'Porta', note: 'Si apre liberamente', tone: 'var(--cad-door)', badge: null, runic: false },
    { kind: 'key', name: 'Porta a chiave', note: 'Serve una chiave', tone: 'var(--c-loot)', badge: 'tokens/padlock', runic: false },
    { kind: 'red', name: 'Runica rossa', note: 'Chiave runica rossa', tone: 'var(--cad-rune-red)', badge: 'diamond', runic: true },
    { kind: 'green', name: 'Runica verde', note: 'Chiave runica verde', tone: 'var(--cad-rune-green)', badge: 'diamond', runic: true },
    { kind: 'blue', name: 'Runica blu', note: 'Chiave runica blu', tone: 'var(--cad-rune-blue)', badge: 'diamond', runic: true },
  ];
  /** Annulla e rifai (le stesse azioni di Ctrl+Z e Ctrl+Maiusc+Z), con i tasti sempre visibili. */
  readonly canUndo = input(false);
  readonly canRedo = input(false);
  readonly undo = output<void>();
  readonly redo = output<void>();

  protected readonly items = computed(() => this.tiles().map((tile) => ({ tile, preview: tilePreview(tile.def) })));
  /** Il totale dei pezzi (o delle porte) in mappa, sul tasto dello strumento. */
  private readonly total = computed(() => Object.values(this.counts()).reduce((a, b) => a + b, 0));
  private readonly doorTotal = computed(() => Object.values(this.doorCounts()).reduce((a, b) => a + b, 0));

  protected badge(tool: Tool['id']): number {
    return tool === 'tiles' ? this.total() : this.doorTotal();
  }

  protected toggle(id: Tool['id']) {
    this.tool.update((cur) => (cur === id ? null : id));
  }
}
