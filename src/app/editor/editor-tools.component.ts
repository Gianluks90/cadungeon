import { WALL_LENGTHS } from '../game/board/wall';
import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { DoorSampleComponent } from '../ui/door-sample.component';
import { ObstacleSampleComponent } from '../ui/obstacle-sample.component';
import type { ObstacleType } from '../game/board/obstacle';
import type { MonsterDef } from '../game/monsters/monster';
import { CHEST_TABLE_MAX } from '../game/board/marker';
import { MARKER_LIMITS, MARKER_MINIMUMS, MarkerSpec, markerKey } from './tile-editor';
import { IconComponent } from '../ui/icon.component';
import { PaletteTile } from './palette';
import { DoorKind } from './tile-editor';
import { tilePreview } from './tile-preview';

/** Gli strumenti di costruzione: ognuno ha un tasto nella barra e, quando è acceso, mostra la sua cassetta. */
interface Tool {
  id: 'tiles' | 'doors' | 'obstacles' | 'markers' | 'specials' | 'monsters' | 'areas' | 'events';
  icon: string;
  label: string;
}

const TOOLS: Tool[] = [
  { id: 'tiles', icon: 'map', label: 'Tessere' },
  { id: 'doors', icon: 'door_front', label: 'Porte e passaggi' },
  { id: 'areas', icon: 'select_all', label: 'Aree' },
  { id: 'obstacles', icon: 'landslide', label: 'Ostacoli e muri' },
  { id: 'markers', icon: 'inventory_2', label: 'Oggetti' },
  { id: 'monsters', icon: 'skull', label: 'Nemici' },
  { id: 'specials', icon: 'brightness_empty', label: 'Glifi e altro' },
  { id: 'events', icon: 'bolt', label: 'Eventi' },
];

/** Lato in pixel di una cella nelle anteprime. */
const PREVIEW_CELL = 12;
/** Le anteprime non sono più grandi di una stanza di questo lato (in celle): le tessere più grandi si rimpiccioliscono, le altre restano come sono. */
const PREVIEW_MAX_CELLS = 6;

/**
 * La cassetta degli attrezzi dell'editor, legata al bordo inferiore dello schermo: una barra di tasti (Tessere, icona `map`, e Porte, icona `door_front`) e, sopra, quando uno strumento è acceso,
 * un footer a scorrimento orizzontale con tutti gli elementi che si possono inserire. Ogni scheda ha il contatore dei pezzi già messi in mappa (anche il totale sul tasto dello strumento);
 * un clic su una scheda la prende in mano (`pick`: l'editor la lega al puntatore), un altro clic sulla stessa la lascia.
 */
@Component({
  selector: 'app-editor-tools',
  imports: [ObstacleSampleComponent, DoorSampleComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (handActions()) {
      <div class="hand" role="group" aria-label="Pezzo in mano">
        <button type="button" class="hand-btn" aria-label="Lascia il pezzo" title="Lascia il pezzo" (click)="handCancel.emit()"><app-icon name="close" [size]="22" /></button>
        <button type="button" class="hand-btn ok" aria-label="Piazza il pezzo" title="Piazza il pezzo" (click)="handConfirm.emit()"><app-icon name="check" [size]="22" /></button>
      </div>
    }
    @if (tool() === 'tiles') {
      <div class="tray" role="region" aria-label="Tessere" (wheel)="hscroll($event)">
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
                <svg [attr.viewBox]="'0 0 ' + it.preview.w * it.cell + ' ' + it.preview.h * it.cell" [style.width.px]="it.preview.w * it.cell" [style.height.px]="it.preview.h * it.cell" aria-hidden="true">
                  <g [attr.transform]="'scale(' + it.cell + ')'">
                    @for (r of it.preview.floor; track $index) { <rect [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" [attr.height]="r.h" class="floor" /> }
                    <path [attr.d]="it.preview.walls" class="wall" [style.stroke-width]="0.14 * cell / it.cell" />
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
      <div class="tray" role="region" aria-label="Porte e passaggi" (wheel)="hscroll($event)">
        <header>
          <span class="title">Porte e passaggi</span>
          <span class="actions">
            <button type="button" class="act" [class.off]="carryingMarker()?.type !== 'stairs'" [attr.aria-disabled]="carryingMarker()?.type !== 'stairs'" aria-label="Ruota" title="Ruota la scala in mano (R): cambia da che lato si entra" (click)="carryingMarker()?.type === 'stairs' && rotate.emit()"><app-icon name="rotate_right" [size]="18" /></button>
            <button type="button" class="act" [class.on]="deleting()" [attr.aria-pressed]="deleting()" aria-label="Elimina" title="Elimina: un clic toglie la porta o la scala, trascinando si traccia un'area e al rilascio spariscono i pezzi che tocca" (click)="toggleDelete.emit()"><app-icon name="delete" [size]="18" /></button>
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
          <li>
            <button type="button" class="item stairs" [class.carrying]="carryingMarker()?.type === 'stairs'" [attr.aria-pressed]="carryingMarker()?.type === 'stairs'" title="Scala: si mettono a coppie, un clic per capo; il secondo si collega al primo" (click)="pickMarker.emit({ type: 'stairs' })">
              <span class="count" title="Scale in mappa">×{{ markerCounts()['stairs'] ?? 0 }}</span>
              <svg class="stairs-sample" viewBox="0 0 48 48" aria-hidden="true"><path d="M9 42V8H39V42" class="swall" /><path d="M13 15H35M13 22H35M13 29H35M13 36H35" class="sstep" /></svg>
              <span class="name">Scala</span>
              <span class="size">a coppie</span>
            </button>
          </li>
        </ul>
      </div>
    }
    @if (tool() === 'obstacles') {
      <div class="tray" role="region" aria-label="Ostacoli e muri" (wheel)="hscroll($event)">
        <header>
          <span class="title">Ostacoli e muri</span>
          <span class="actions">
            <button type="button" class="act" [class.on]="separating()" [attr.aria-pressed]="separating()" aria-label="Separa" title="Separa: un clic su un ostacolo lo stacca dal suo gruppo (macerie, buche e acqua); su una buca o acqua già separata la riunisce" (click)="toggleSeparate.emit()"><app-icon name="splitscreen_vertical_add" [size]="18" /></button>
            <button type="button" class="act" [class.on]="deleting()" [attr.aria-pressed]="deleting()" aria-label="Elimina" title="Elimina: un clic toglie l'ostacolo o il muro, trascinando si traccia un'area e al rilascio spariscono quelli che tocca" (click)="toggleDelete.emit()"><app-icon name="delete" [size]="18" /></button>
          </span>
        </header>
        <ul>
          @for (o of obstacleTypes; track o.type) {
            <li>
              <button type="button" class="item" [class.carrying]="carryingObstacle() === o.type" [attr.aria-pressed]="carryingObstacle() === o.type" [title]="o.note" (click)="pickObstacle.emit(o.type)">
                @if (obstacleCounts()[o.type]) { <span class="count" title="Caselle in mappa">×{{ obstacleCounts()[o.type] }}</span> }
                <app-obstacle-sample [kind]="o.type" />
                <span class="name">{{ o.name }}</span>
                <span class="size">{{ o.note }}</span>
              </button>
            </li>
          }
          @for (w of wallTypes; track w.length) {
            <li>
              <button type="button" class="item" [class.carrying]="carryingWall() === w.length" [attr.aria-pressed]="carryingWall() === w.length" [title]="w.note" (click)="pickWall.emit(w.length)">
                @if (wallCounts()[w.length]) { <span class="count" title="Muri in mappa">×{{ wallCounts()[w.length] }}</span> }
                <svg class="wall-sample" viewBox="0 0 48 48" aria-hidden="true">
                  <path [attr.d]="'M' + (24 - w.length * 5) + ' 24H' + (24 + w.length * 5)" class="wthick" />
                  <path [attr.d]="'M' + (24 - w.length * 5) + ' 24H' + (24 + w.length * 5)" class="wgap" />
                  @for (t of w.ticks; track t) { <path [attr.d]="'M' + t + ' 19V29'" class="wtick" /> }
                </svg>
                <span class="name">{{ w.name }}</span>
                <span class="size">{{ w.note }}</span>
              </button>
            </li>
          }
        </ul>
      </div>
    }
    @if (tool() === 'markers' || tool() === 'specials') {
      <div class="tray" role="region" [attr.aria-label]="tool() === 'specials' ? 'Glifi e altro' : 'Oggetti'" (wheel)="hscroll($event)">
        <header>
          <span class="title">{{ tool() === 'specials' ? 'Glifi, partenza e incontri' : 'Oggetti e tesori' }}</span>
          <span class="actions">
            @if (tool() === 'markers') {
              <button type="button" class="act" [class.on]="customizing()" [attr.aria-pressed]="customizing()" aria-label="Personalizza" title="Personalizza: tocca un oggetto del catalogo a terra per cambiarne l'oggetto, l'aspetto e il titolo" (click)="toggleCustomize.emit()"><app-icon name="genetics" [size]="18" /></button>
              <button type="button" class="act" aria-label="Ricompense dei bauli" title="Ricompense dei bauli: la tabella dei ritrovamenti" (click)="openChestTable.emit()"><app-icon name="list_alt" [size]="18" /></button>
              <button type="button" class="act" [class.off]="carryingMarker()?.type !== 'chest'" [attr.aria-disabled]="carryingMarker()?.type !== 'chest'" aria-label="Ruota" title="Ruota il baule in mano (R)" (click)="carryingMarker()?.type === 'chest' && rotate.emit()"><app-icon name="rotate_right" [size]="18" /></button>
            }
            @if (tool() === 'specials') {
              <button type="button" class="act" [class.on]="customizing()" [attr.aria-pressed]="customizing()" aria-label="Personalizza" title="Personalizza: tocca un segnalino Incontro per scegliere il testo dell'azione e quanto costa" (click)="toggleCustomize.emit()"><app-icon name="genetics" [size]="18" /></button>
            }
            <button type="button" class="act" [class.on]="deleting()" [attr.aria-pressed]="deleting()" aria-label="Elimina" title="Elimina: un clic toglie l'oggetto, trascinando si traccia un'area e al rilascio spariscono quelli che tocca" (click)="toggleDelete.emit()"><app-icon name="delete" [size]="18" /></button>
          </span>
        </header>
        <ul>
          @for (c of cardsOfTool(); track c.key) {
            <li>
              <button type="button" class="item marker" [class.carrying]="isCarrying(c.key)" [class.off]="markerFull(c)" [attr.aria-pressed]="isCarrying(c.key)" [attr.aria-disabled]="markerFull(c)" [title]="c.name + (c.limit ? ' (al massimo ' + c.limit + ')' : c.min ? ' (almeno ' + c.min + ')' : '')" [style.--tone]="c.tone" (click)="!markerFull(c) && pickMarker.emit(c.spec)">
                <span class="count" [title]="c.limit ? 'In mappa / massimo' : c.min ? 'In mappa / minimo' : 'In mappa'">{{ markerCounts()[c.key] ?? 0 }}{{ c.limit ? '/' + c.limit : c.min ? '/' + c.min + '+' : '' }}</span>
                @if (markerImages()[c.key]; as src) { <img class="sample" [src]="src" alt="" draggable="false" /> } @else { <span class="sample"></span> }
                <span class="name">{{ c.name }}</span>
              </button>
            </li>
          }
        </ul>
      </div>
    }
    @if (tool() === 'monsters') {
      <div class="tray" role="region" aria-label="Nemici" (wheel)="hscroll($event)">
        <header>
          <span class="title">Nemici</span>
          <span class="actions">
            <button type="button" class="act" [class.on]="customizing()" [attr.aria-pressed]="customizing()" aria-label="Personalizza" title="Personalizza: tocca un nemico per dargli un nome, cambiarne i valori, aggiungere abilità e un bottino" (click)="toggleCustomize.emit()"><app-icon name="genetics" [size]="18" /></button>
            <button type="button" class="act" [class.off]="!carryingMonster()" [attr.aria-disabled]="!carryingMonster()" aria-label="Ruota" title="Ruota il nemico in mano (R): cambia come stanno le sue caselle" (click)="carryingMonster() && rotate.emit()"><app-icon name="rotate_right" [size]="18" /></button>
            <button type="button" class="act" [class.on]="deleting()" [attr.aria-pressed]="deleting()" aria-label="Elimina" title="Elimina: un clic toglie il nemico, trascinando si traccia un'area e al rilascio spariscono quelli che tocca" (click)="toggleDelete.emit()"><app-icon name="delete" [size]="18" /></button>
          </span>
        </header>
        <ul>
          @for (c of monsterCards(); track c.key) {
            <li>
              <button type="button" class="item monster" [class.enhanced]="c.enhanced" [class.carrying]="carryingMonster()?.id === c.def.id && carryingMonster()?.enhanced === c.enhanced" [attr.aria-pressed]="carryingMonster()?.id === c.def.id && carryingMonster()?.enhanced === c.enhanced" [title]="c.def.name + (c.enhanced ? ' potenziato' : '')" (click)="pickMonster.emit({ id: c.def.id, enhanced: c.enhanced })">
                <span class="count" title="In mappa">×{{ monsterCounts()[c.key] ?? 0 }}</span>
                <span class="dim" title="Caselle occupate">{{ c.def.size.w }}×{{ c.def.size.h }}@if (c.enhanced) { <b class="pot" title="Potenziato">P</b> }</span>
                <span class="token">
                  @if (!brokenImages().has(c.def.id)) { <img [src]="c.def.image + '-token.webp'" alt="" draggable="false" (error)="imageFailed(c.def.id)" /> }
                  @else { <app-icon name="skull" [size]="22" class="placeholder-icon" /> }
                </span>
                <span class="name">{{ c.def.name }}</span>
              </button>
            </li>
          }
        </ul>
      </div>
    }
    @if (tool() === 'areas') {
      <div class="tray" role="region" aria-label="Aree" (wheel)="hscroll($event)">
        <header>
          <span class="title">Aree</span>
          <span class="actions">
            <button type="button" class="act" [class.on]="deletingAreas()" [attr.aria-pressed]="deletingAreas()" aria-label="Elimina" title="Elimina: un clic su un'area la cancella (la mappa resta); se ha già dei testi chiede conferma" (click)="toggleDeleteAreas.emit()"><app-icon name="delete" [size]="18" /></button>
            <button type="button" class="act" [class.on]="creatingArea()" [attr.aria-pressed]="creatingArea()" aria-label="Crea un'area" title="Crea un'area: tocca i pezzi da includere, poi conferma con la spunta azzurra" (click)="toggleCreateArea.emit()"><app-icon name="add" [size]="18" /></button>
          </span>
        </header>
        @if (!areas().length) {
          <p class="placeholder">{{ creatingArea() ? 'Tocca i pezzi da includere, poi conferma con la spunta azzurra.' : 'Nessuna area ancora. Premi + per crearne una.' }}</p>
        } @else {
          <ul #areaList [class.deleting]="deletingAreas()">
            @for (a of areas(); track a.id) {
              <li class="item area" [class.start]="a.start" [class.hl]="highlighted() === a.id" [class.dragging]="drag()?.id === a.id" [class.drop-before]="drag() && drag()!.beforeId === a.id" [class.drop-end]="drag() && drag()!.beforeId === null && $last && drag()!.id !== a.id" [style.transform]="drag()?.id === a.id ? 'translateX(' + drag()!.dx + 'px)' : null" [attr.data-area]="a.id" (mouseenter)="hoverArea.set(a.id); areaHighlight.emit(a.id)" (mouseleave)="hoverArea.set(null); areaHighlight.emit(pinnedArea())" (click)="cardClick(a.id)">
                @if (!a.start) {
                  <button type="button" class="handle" aria-label="Sposta l'area" title="Trascina per riordinare" (pointerdown)="dragStart($event, a.id)" (pointermove)="dragMove($event)" (pointerup)="dragEnd($event)" (pointercancel)="dragEnd($event, true)" (click)="$event.stopPropagation()"><app-icon name="drag_indicator" [size]="16" /></button>
                }
                <span class="name">{{ a.name }}</span>
                @if (a.subtitle) { <span class="sub">{{ a.subtitle }}</span> }
                <span class="size">{{ a.cells }} {{ a.cells === 1 ? 'casella' : 'caselle' }}</span>
                <span class="row">
                  @if (a.start || !hasStart()) {
                    <button type="button" class="act" [class.on]="a.start" [attr.aria-pressed]="a.start" [attr.aria-label]="a.start ? 'Togli la partenza' : 'Usa come area di partenza'" [title]="a.start ? 'Area di partenza: clic per toglierla' : 'Usa come area di partenza'" (click)="setStartArea.emit(a.id)"><app-icon name="home" [size]="18" /></button>
                  }
                  @if (hasStart()) {
                    <button type="button" class="act" aria-label="Modifica l'area" title="Sottotitolo e descrizione dell'area" (click)="editArea.emit(a.id)"><app-icon name="edit" [size]="18" /></button>
                  }
                </span>
              </li>
            }
          </ul>
        }
      </div>
    }
    @if (tool() === 'events') {
      <div class="tray" role="region" aria-label="Eventi" (wheel)="hscroll($event)">
        <header>
          <span class="title">Eventi</span>
          <span class="actions">
            <button type="button" class="act" aria-label="Variabili" title="Variabili dell'avventura: gli interruttori che gli eventi accendono e leggono" (click)="openVariables.emit()"><app-icon name="list_alt" [size]="18" /></button>
            <button type="button" class="act" [class.on]="deletingEvents()" [attr.aria-pressed]="deletingEvents()" aria-label="Elimina" title="Elimina: un clic su un evento lo cancella (chiede conferma)" (click)="toggleDeleteEvents.emit()"><app-icon name="delete" [size]="18" /></button>
            <button type="button" class="act" aria-label="Nuovo evento" title="Nuovo evento" (click)="createEvent.emit()"><app-icon name="add" [size]="18" /></button>
          </span>
        </header>
        @if (!events().length) {
          <p class="placeholder">Nessun evento ancora. Premi + per crearne uno: "quando succede questo, se vale quest'altro, fai quello".</p>
        } @else {
          <ul [class.deleting]="deletingEvents()">
            @for (e of events(); track e.id) {
              <li class="item event" tabindex="0" (click)="eventClick(e.id)" (keydown.enter)="eventClick(e.id)">
                <span class="status" [attr.data-level]="e.level" role="img" [attr.aria-label]="e.notes || 'Evento verificato'" [title]="e.notes || 'Evento verificato'"><app-icon [name]="e.level === 'error' ? 'report' : e.level === 'warning' ? 'warning' : 'check_circle'" [size]="16" /></span>
                <span class="name">{{ e.name }}</span>
                <span class="sub">{{ e.when }}</span>
                <span class="size">{{ e.summary }}</span>
                <button type="button" class="act dup" aria-label="Duplica l'evento" title="Duplica l'evento" (click)="$event.stopPropagation(); duplicateEvent.emit(e.id)" (keydown.enter)="$event.stopPropagation()"><app-icon name="content_copy" [size]="16" /></button>
              </li>
            }
          </ul>
        }
      </div>
    }
    <div class="bar">
      @for (t of tools; track t.id) {
        <button type="button" [class.on]="tool() === t.id" [attr.aria-pressed]="tool() === t.id" [attr.aria-label]="t.label" [title]="t.label" (click)="toggle(t.id)">
          <app-icon [name]="t.icon" [size]="20" />@if (badge(t.id)) { <span class="badge">{{ badge(t.id) }}</span> }
        </button>
      }
      <span class="sep" aria-hidden="true"></span>
      <button type="button" class="ur undo" [class.off]="!canUndo()" [attr.aria-disabled]="!canUndo()" aria-label="Annulla" title="Annulla (Ctrl+Z)" (click)="canUndo() && undo.emit()"><app-icon name="undo" [size]="20" /></button>
      <button type="button" class="ur redo" [class.off]="!canRedo()" [attr.aria-disabled]="!canRedo()" aria-label="Ripeti" title="Ripeti (Ctrl+Maiusc+Z)" (click)="canRedo() && redo.emit()"><app-icon name="redo" [size]="20" /></button>
    </div>
  `,
  styles: `
    :host { position: absolute; z-index: 10; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
    /* Sul tocco, con un pezzo in mano: la X e la spunta sopra la cassetta, a destra. */
    .hand { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); display: flex; gap: 16px; pointer-events: auto; }
    /* Tondi, come il tasto di conferma delle aree: azzurro pieno con la spunta scura. */
    .hand-btn { width: 52px; height: 52px; border-radius: var(--radius-round); border-width: 2px; }
    .hand-btn.ok { background: var(--c-water); border-color: var(--c-bg); color: var(--c-bg); }
    .hand-btn.ok:hover, .hand-btn.ok:focus-visible { color: var(--c-bg); border-color: var(--c-text); }
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
    ul { list-style: none; margin: 0; padding: 12px; display: flex; gap: 10px; overflow-x: auto; overscroll-behavior-x: contain; touch-action: pan-x; scrollbar-width: thin; }
    li { flex: none; }
    .badge { position: absolute; top: -7px; right: -7px; min-width: 16px; box-sizing: border-box; padding: 2px 4px; border-radius: 8px; background: var(--c-interact); color: var(--c-bg); font: 700 10px/1 var(--font-mono); text-align: center; pointer-events: none; }
    .placeholder { margin: 0; min-height: 130px; box-sizing: border-box; display: flex; align-items: center; justify-content: center; padding: 12px; text-align: center; color: var(--c-text-dim); font: 13px/1.4 var(--font-ui); }
    .item.area { justify-content: space-between; align-items: stretch; text-align: center; }
    .item.area.start { border-color: var(--c-interact); }
    .item.area { cursor: pointer; transition: border-color 0.15s; }
    .item.area .handle { position: absolute; top: 4px; left: 4px; width: 22px; height: 22px; padding: 0; border: 0; background: none; color: var(--c-text-dim); cursor: grab; touch-action: none; display: inline-flex; align-items: center; justify-content: center; }
    .item.area .handle:hover { color: var(--c-text); }
    .item.area .sub { color: var(--c-text-dim); font-size: 11px; font-style: italic; }
    .item.area.dragging { z-index: 3; opacity: 0.92; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5); pointer-events: none; cursor: grabbing; }
    .item.area.drop-before { box-shadow: -4px 0 0 -1px var(--c-interact); }
    .item.area.drop-end { box-shadow: 4px 0 0 -1px var(--c-interact); }
    .item.area.hl { border-color: color-mix(in srgb, var(--c-water) 55%, white); }
    .item.area.start.hl { border-color: color-mix(in srgb, var(--c-interact) 55%, white); }
    .deleting .item.area { cursor: pointer; }
    .deleting .item.area:hover { border-color: var(--c-danger); }
    .deleting .item.area .act, .deleting .item.area .handle { pointer-events: none; }
    .item.event { width: 176px; justify-content: flex-start; align-items: stretch; gap: 6px; text-align: left; cursor: pointer; padding-top: 10px; transition: border-color 0.15s; }
    .item.event .name { text-align: left; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
    .item.event .sub { color: var(--c-text-dim); font-size: 11px; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; overflow: hidden; }
    .item.event .status { position: absolute; top: 6px; right: 6px; display: inline-flex; color: var(--c-ok); }
    .item.event .status[data-level='warning'] { color: var(--c-warn); }
    .item.event .status[data-level='error'] { color: var(--c-error); }
    .item.event .name { padding-right: 20px; }
    .item.event .size { margin-top: auto; padding-right: 28px; }
    .item.event .dup { position: absolute; right: 4px; bottom: 4px; width: 24px; height: 24px; }
    .deleting .item.event .dup { pointer-events: none; }
    .deleting .item.event:hover { border-color: var(--c-danger); }
    .item.area .row { display: flex; justify-content: center; gap: 6px; }
    .item { position: relative; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 6px; box-sizing: border-box; width: 112px; height: 130px; padding: 10px 8px 8px; border: 1px solid var(--c-line); border-radius: var(--radius-1); background: var(--c-bg); color: var(--c-text); font: 12px/1.2 var(--font-ui); cursor: pointer; transition: border-color 0.15s; }
    .item:hover, .item:focus-visible { border-color: var(--c-text-dim); outline: none; }
    .item.carrying { border-color: var(--c-interact); }
    .item.marker { justify-content: flex-start; padding-top: 26px; }
    .item.marker .sample { display: block; width: 56px; height: 56px; border-radius: var(--radius-1); object-fit: contain; }
    .item.marker.off { opacity: 0.4; cursor: default; }
    .item.marker.carrying { border-color: var(--tone); }
    .item.marker .name { text-align: center; }
    .item.monster .token { display: inline-flex; box-sizing: border-box; width: 56px; height: 56px; overflow: hidden; border-radius: var(--radius-1); border: 2px solid var(--c-line-strong); background: var(--c-surface); }
    .item.monster.enhanced .token { border-color: var(--c-faction-overlord); }
    /* Tutte le schede dei nemici sono uguali: immagine sempre alla stessa altezza e nome su due righe al massimo (poi i puntini). */
    .item.monster { justify-content: flex-start; padding-top: 26px; }
    .item.monster .name { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; text-overflow: ellipsis; box-sizing: border-box; width: 100%; min-height: 2.4em; max-height: 2.4em; line-height: 1.2; }
    .item.monster .pot { margin-left: 4px; color: var(--c-faction-overlord); font-weight: 700; }
    .item.monster .dim { position: absolute; top: 6px; left: 7px; color: var(--c-text-dim); font: 600 11px/1 var(--font-mono); }
    .item.monster .placeholder-icon { margin: auto; color: var(--c-text-dim); }
    .item.monster .token img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .item.door.carrying { border-color: var(--tone); }
    .item.stairs.carrying { border-color: var(--c-interact); }
    .stairs-sample, .wall-sample { width: 56px; height: 56px; }
    .wall-sample .wthick { fill: none; stroke: var(--cad-wall); stroke-width: 7; stroke-linecap: square; }
    .wall-sample .wgap { fill: none; stroke: var(--c-surface); stroke-width: 3; stroke-linecap: butt; }
    .wall-sample .wtick { fill: none; stroke: var(--cad-wall); stroke-width: 1; opacity: 0.6; }
    .stairs-sample .swall { fill: none; stroke: var(--cad-wall); stroke-width: 4; stroke-linejoin: round; }
    .stairs-sample .sstep { fill: none; stroke: var(--cad-wall); stroke-width: 1.5; stroke-linecap: round; }
    .item.door.off { opacity: 0.4; cursor: default; }
    .count { position: absolute; top: 6px; right: 7px; color: var(--c-interact); font: 600 11px/1 var(--font-mono); }
    .item svg { display: block; flex: none; }
    .floor { fill: var(--cad-floor); }
    .wall { fill: none; stroke: var(--cad-wall); stroke-width: 0.14; stroke-linecap: square; }
    .name { font-weight: 600; text-align: center; }
    .size { color: var(--c-text-dim); font-family: var(--font-mono); font-size: 11px; }
    /* Solo schermi stretti: la barra scorre in orizzontale (il padding lascia spazio ai contatori sul bordo) e annulla/ripeti vanno in alto a destra. */
    @media (max-width: 600px) {
      .bar { max-width: 100%; box-sizing: border-box; overflow-x: auto; overscroll-behavior-x: contain; touch-action: pan-x; scrollbar-width: none; padding: 8px 8px 0; margin: -8px -8px 0; }
      .bar::-webkit-scrollbar, ul::-webkit-scrollbar { display: none; }
      ul { scrollbar-width: none; }
      .bar button { flex: none; }
      .bar .sep { display: none; }
      .bar .ur { position: fixed; z-index: 10; top: calc(12px + env(safe-area-inset-top)); }
      .bar .redo { right: 12px; }
      .bar .undo { right: 54px; }
      @media (pointer: coarse) { .bar .undo { right: 64px; } }
    }
    @keyframes tray-in { from { opacity: 0; transform: translateY(8px); } }
    @media (prefers-reduced-motion: reduce) { .tray { animation: none; } }
  `,
})
export class EditorToolsComponent {
  protected readonly tools = TOOLS;
  protected readonly cell = PREVIEW_CELL;
  /** Lo strumento acceso (la sua cassetta è aperta), o nessuno. */
  protected readonly tool = signal<Tool['id'] | null>(null);
  /** Sul tocco, con un pezzo in mano: i tasti per piazzarlo (spunta) o lasciarlo (X). */
  readonly handActions = input(false);
  readonly handConfirm = output<void>();
  readonly handCancel = output<void>();
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
  /** Le aree (con il nome mostrato e quante tessere hanno) e se si sta creando una nuova. */
  readonly areas = input<{ id: string; name: string; start: boolean; cells: number; subtitle: string }[]>([]);
  readonly creatingArea = input(false);
  /** Gli eventi (nome, "quando" e riassunto già scritti) e la modalità elimina: un clic su una scheda la modifica o, in modalità elimina, la cancella. */
  readonly events = input<{ id: string; name: string; when: string; summary: string; level: 'ok' | 'warning' | 'error'; notes: string }[]>([]);
  readonly deletingEvents = input(false);
  readonly toggleDeleteEvents = output<void>();
  readonly createEvent = output<void>();
  readonly editEvent = output<string>();
  readonly deleteEvent = output<string>();
  readonly duplicateEvent = output<string>();
  readonly openVariables = output<void>();

  protected eventClick(id: string) {
    if (this.deletingEvents()) this.deleteEvent.emit(id);
    else this.editEvent.emit(id);
  }
  readonly toggleCreateArea = output<void>();
  /** La modalità elimina delle aree: un clic su una scheda la cancella invece di evidenziarla. */
  readonly deletingAreas = input(false);
  readonly toggleDeleteAreas = output<void>();
  /** L'area da evidenziare sulla mappa: quella sotto il mouse, o l'ultima cliccata. */
  readonly areaHighlight = output<string | null>();
  protected readonly hoverArea = signal<string | null>(null);
  protected readonly pinnedArea = signal<string | null>(null);
  protected readonly highlighted = computed(() => this.hoverArea() ?? this.pinnedArea());

  /** Un clic su una scheda: in modalità elimina la cancella, altrimenti la evidenzia. */
  protected cardClick(id: string) {
    if (this.deletingAreas()) this.deleteArea.emit(id);
    else this.pinArea(id);
  }

  /** Un clic su una scheda la tiene evidenziata (un secondo clic, o un altro, la lascia). */
  protected pinArea(id: string) {
    this.pinnedArea.update((cur) => (cur === id ? null : id));
    this.areaHighlight.emit(this.hoverArea() ?? this.pinnedArea());
  }
  readonly setStartArea = output<string>();
  readonly editArea = output<string>();
  /** Un'area è stata trascinata in un'altra posizione dell'elenco (`to`: l'indice finale). */
  readonly moveArea = output<{ id: string; to: number }>();
  protected readonly hasStart = computed(() => this.areas().some((a) => a.start));
  private readonly areaListEl = viewChild<ElementRef<HTMLUListElement>>('areaList');
  /** Il riordino in corso: l'area presa, di quanto si è spostata, e prima di quale area finirebbe (null = in fondo). */
  protected readonly drag = signal<{ id: string; dx: number; beforeId: string | null; to: number; startX: number } | null>(null);

  protected dragStart(e: PointerEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.drag.set({ id, dx: 0, beforeId: id, to: -1, startX: e.clientX });
    this.dragMove(e);
  }

  /** Mentre si trascina: la card segue il puntatore e si calcola dove finirebbe (contando le altre card a sinistra del puntatore). */
  protected dragMove(e: PointerEvent) {
    const d = this.drag();
    const list = this.areaListEl()?.nativeElement;
    if (!d || !list) return;
    const others = [...list.querySelectorAll<HTMLElement>('li.area')].filter((el) => el.dataset['area'] !== d.id);
    let k = others.filter((el) => { const r = el.getBoundingClientRect(); return e.clientX > r.left + r.width / 2; }).length;
    if (this.hasStart()) k = Math.max(1, k); // l'area di partenza resta la prima
    const beforeId = others[k]?.dataset['area'] ?? null;
    this.drag.set({ ...d, dx: e.clientX - d.startX, beforeId, to: k });
  }

  /** Al rilascio l'area passa alla nuova posizione (e i numeri si ricalcolano); se è stato annullato resta dov'è. */
  protected dragEnd(e: PointerEvent, cancelled = false) {
    const d = this.drag();
    if (!d) return;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    this.drag.set(null);
    if (!cancelled && d.to >= 0) this.moveArea.emit({ id: d.id, to: d.to });
  }
  readonly deleteArea = output<string>();
  /** Lo strumento acceso è cambiato (o nessuno). */
  readonly toolChange = output<Tool['id'] | null>();
  readonly doorCounts = input<Record<DoorKind, number>>({ normal: 0, key: 0, event: 0, blue: 0, red: 0, green: 0 });
  readonly carryingDoor = input<DoorKind | null>(null);
  readonly pickDoor = output<DoorKind>();
  /** Gli ostacoli: quante caselle ne ha ogni tipo in mappa, quale si porta in mano e il tasto per prenderlo (si piazza una casella per clic). */
  readonly obstacleCounts = input<Record<ObstacleType, number>>({ rock: 0, pit: 0, water: 0 });
  readonly carryingObstacle = input<ObstacleType | null>(null);
  readonly pickObstacle = output<ObstacleType>();
  /** I muri: quanti in mappa per lunghezza, quale è in mano e il segnale per prenderne uno. */
  readonly wallCounts = input<Record<number, number>>({});
  readonly carryingWall = input<number | null>(null);
  readonly pickWall = output<number>();
  /** I nemici del catalogo, quanti ne sono in mappa (chiave `id` per i normali e `id+` per i potenziati), quale si porta in mano e il tasto per prenderne uno. */
  readonly monsters = input<MonsterDef[]>([]);
  readonly monsterCounts = input<Record<string, number>>({});
  readonly carryingMonster = input<{ id: string; enhanced: boolean } | null>(null);
  readonly pickMonster = output<{ id: string; enhanced: boolean }>();
  /** Gli oggetti e i tesori: quanti ce ne sono in mappa per tipo (chiave `markerKey`), quale si porta in mano e il tasto per prenderne uno. */
  readonly markerCounts = input<Record<string, number>>({});
  readonly carryingMarker = input<MarkerSpec | null>(null);
  readonly pickMarker = output<MarkerSpec>();
  /** Le immagini delle schede (una per `markerKey`): sono disegnate con le stesse viste della mappa, così scheda e mappa coincidono. */
  readonly markerImages = input<Record<string, string>>({});
  /** Il tasto che apre la dialog della tabella dei ritrovamenti (le ricompense casuali dei bauli). */
  readonly openChestTable = output<void>();
  protected readonly markerCards: { key: string; name: string; spec: MarkerSpec; icon: string; tone: string; sample: 'icon' | 'chest'; limit: number; /** Quanti ne servono almeno (nessun massimo). */ min?: number }[] = [
    { key: 'potion:heal', name: 'Pozione curativa', spec: { type: 'potion', kind: 'heal' }, icon: 'tokens/potion', tone: 'var(--cad-potion-heal)', sample: 'icon', limit: 0 },
    { key: 'potion:vital', name: 'Pozione del vigore', spec: { type: 'potion', kind: 'vital' }, icon: 'tokens/potion', tone: 'var(--cad-potion-vital)', sample: 'icon', limit: 0 },
    { key: 'coins', name: 'Pila di monete', spec: { type: 'coins' }, icon: 'tokens/gold_pile', tone: 'var(--cad-coin)', sample: 'icon', limit: 0 },
    { key: 'chest:copper', name: 'Baule di rame', spec: { type: 'chest', tier: 'copper' }, icon: '', tone: 'var(--cad-chest-copper)', sample: 'chest', limit: CHEST_TABLE_MAX.copper },
    { key: 'chest:silver', name: 'Baule d\'argento', spec: { type: 'chest', tier: 'silver' }, icon: '', tone: 'var(--cad-chest-silver)', sample: 'chest', limit: CHEST_TABLE_MAX.silver },
    { key: 'chest:gold', name: 'Baule d\'oro', spec: { type: 'chest', tier: 'gold' }, icon: '', tone: 'var(--cad-chest-gold)', sample: 'chest', limit: CHEST_TABLE_MAX.gold },
    { key: 'rune:red', name: 'Chiave runica rossa', spec: { type: 'rune', color: 'red' }, icon: 'tokens/rune_key', tone: 'var(--cad-rune-red)', sample: 'icon', limit: MARKER_LIMITS.rune },
    { key: 'rune:blue', name: 'Chiave runica blu', spec: { type: 'rune', color: 'blue' }, icon: 'tokens/rune_key', tone: 'var(--cad-rune-blue)', sample: 'icon', limit: MARKER_LIMITS.rune },
    { key: 'rune:green', name: 'Chiave runica verde', spec: { type: 'rune', color: 'green' }, icon: 'tokens/rune_key', tone: 'var(--cad-rune-green)', sample: 'icon', limit: MARKER_LIMITS.rune },
    { key: 'item', name: 'Oggetto del catalogo', spec: { type: 'item', itemId: '' }, icon: '', tone: 'var(--c-text)', sample: 'icon', limit: 0 },
  ];

  /** Le schede dello strumento "Glifi e altro": glifi, il glifo già acceso dell'inizio (uno solo), le caselle di partenza degli eroi (si segnano e si tolgono con un clic) e il segnalino Incontro. */
  protected readonly specialCards: { key: string; name: string; spec: MarkerSpec; icon: string; tone: string; sample: 'icon' | 'chest'; limit: number; /** Quanti ne servono almeno (nessun massimo). */ min?: number }[] = [
    { key: 'glyph:active', name: 'Glifo iniziale acceso', spec: { type: 'glyph', active: true }, icon: '', tone: 'var(--c-text)', sample: 'icon', limit: 0, min: MARKER_MINIMUMS.activeGlyph },
    { key: 'start', name: 'Caselle di partenza', spec: { type: 'start' }, icon: '', tone: 'var(--c-interact)', sample: 'icon', limit: 0, min: MARKER_MINIMUMS.start },
    { key: 'glyph', name: 'Glifo', spec: { type: 'glyph' }, icon: '', tone: 'var(--c-text)', sample: 'icon', limit: 0 },
    { key: 'encounter', name: 'Incontro', spec: { type: 'encounter' }, icon: '', tone: 'var(--c-interact)', sample: 'icon', limit: 0 },
  ];
  protected readonly cardsOfTool = computed(() => (this.tool() === 'specials' ? this.specialCards : this.markerCards));

  protected isCarrying(key: string): boolean {
    const m = this.carryingMarker();
    return !!m && markerKey(m) === key;
  }

  /** Il limite è raggiunto (3 bauli per tipo, 1 chiave runica per colore): la scheda si spegne, a meno che sia quella che si ha in mano. */
  protected markerFull(c: { key: string; limit: number }): boolean {
    return c.limit > 0 && (this.markerCounts()[c.key] ?? 0) >= c.limit && !this.isCarrying(c.key);
  }
  /** Modalità personalizza (accesa o no) e il suo tasto: un clic su un nemico apre la dialog delle sue modifiche. */
  readonly customizing = input(false);
  readonly toggleCustomize = output<void>();
  /** I nemici la cui immagine non si carica: al posto dell'immagine si vede un segnaposto (non l'errore del browser). */
  protected readonly brokenImages = signal<ReadonlySet<string>>(new Set());

  protected imageFailed(id: string) {
    this.brokenImages.update((s) => new Set([...s, id]));
  }

  /** La rotella (verticale) fa scorrere in orizzontale gli elenchi: sono righe a scorrimento laterale. Con il tocco scorrono con il dito (`touch-action: pan-x`). */
  protected hscroll(e: WheelEvent) {
    const list = (e.currentTarget as HTMLElement).querySelector<HTMLElement>('ul');
    if (!list || list.scrollWidth <= list.clientWidth || e.deltaX !== 0) return; // niente da scorrere, o lo scorrimento è già orizzontale (trackpad)
    e.preventDefault();
    list.scrollLeft += e.deltaY;
  }
  /** Per ogni nemico due schede, una dopo l'altra: la normale e la potenziata, ognuna con il suo contatore. */
  protected readonly monsterCards = computed(() => this.monsters().flatMap((def) => [{ def, enhanced: false, key: def.id }, { def, enhanced: true, key: `${def.id}+` }]));
  /** Modalità separa (accesa o no) e il suo tasto. */
  readonly separating = input(false);
  readonly toggleSeparate = output<void>();
  /** I muri pronti: un lato di cella e quattro (quanto la parete di una stanza piccola); i trattini del disegno separano i lati. */
  protected readonly wallTypes = WALL_LENGTHS.map((length) => ({
    length,
    name: length === 1 ? 'Muro' : 'Muro lungo',
    note: length === 1 ? '1 lato' : `${length} lati`,
    ticks: Array.from({ length: length - 1 }, (_, i) => 24 - length * 5 + (i + 1) * 10),
  }));
  protected readonly obstacleTypes: { type: ObstacleType; name: string; note: string }[] = [
    { type: 'rock', name: 'Macerie', note: 'Blocca passo e vista' },
    { type: 'pit', name: 'Buca', note: 'Si cade, si salta' },
    { type: 'water', name: 'Acqua', note: 'Blocca il passo' },
  ];
  /** I tipi di porta che si possono inserire. Le runiche una per colore (la scheda si spegne quando è in mappa); le altre senza limite, con il contatore. */
  protected readonly doorTypes: { kind: DoorKind; name: string; note: string; tone: string; badge: string | null; runic: boolean }[] = [
    { kind: 'normal', name: 'Porta', note: 'Si apre liberamente', tone: 'var(--cad-door)', badge: null, runic: false },
    { kind: 'key', name: 'Porta a chiave', note: 'Serve una chiave', tone: 'var(--c-loot)', badge: 'tokens/padlock', runic: false },
    { kind: 'event', name: 'Porta evento', note: 'La apre un evento', tone: 'var(--c-interact)', badge: 'bolt', runic: false },
    { kind: 'red', name: 'Runica rossa', note: 'Chiave runica rossa', tone: 'var(--cad-rune-red)', badge: 'diamond', runic: true },
    { kind: 'green', name: 'Runica verde', note: 'Chiave runica verde', tone: 'var(--cad-rune-green)', badge: 'diamond', runic: true },
    { kind: 'blue', name: 'Runica blu', note: 'Chiave runica blu', tone: 'var(--cad-rune-blue)', badge: 'diamond', runic: true },
  ];
  /** Annulla e rifai (le stesse azioni di Ctrl+Z e Ctrl+Maiusc+Z), con i tasti sempre visibili. */
  readonly canUndo = input(false);
  readonly canRedo = input(false);
  readonly undo = output<void>();
  readonly redo = output<void>();

  protected readonly items = computed(() => this.tiles().map((tile) => ({ tile, preview: tilePreview(tile.def), cell: PREVIEW_CELL * Math.min(1, PREVIEW_MAX_CELLS / Math.max(tile.def.size.w, tile.def.size.h)) })));
  /** Il totale dei pezzi (o delle porte) in mappa, sul tasto dello strumento. */
  private readonly total = computed(() => Object.values(this.counts()).reduce((a, b) => a + b, 0));
  private readonly doorTotal = computed(() => Object.values(this.doorCounts()).reduce((a, b) => a + b, 0));

  protected badge(tool: Tool['id']): number {
    return tool === 'markers' || tool === 'specials' ? Object.entries(this.markerCounts()).filter(([k]) => (tool === 'specials') === ['glyph', 'glyph:active', 'start'].includes(k)).reduce((a, [, b]) => a + b, 0) : tool === 'tiles' ? this.total() : tool === 'doors' ? this.doorTotal() : tool === 'obstacles' ? Object.values(this.obstacleCounts()).reduce((a, b) => a + b, 0) : tool === 'monsters' ? Object.values(this.monsterCounts()).reduce((a, b) => a + b, 0) : tool === 'events' ? this.events().length : this.areas().length;
  }

  protected toggle(id: Tool['id']) {
    this.tool.update((cur) => (cur === id ? null : id));
    if (this.tool() !== 'areas') {
      this.hoverArea.set(null);
      this.pinnedArea.set(null);
    }
    this.toolChange.emit(this.tool());
  }
}
