import { Application, Container, Graphics } from 'pixi.js';
import { Board } from '../game/board/board';
import type { Marker } from '../game/board/marker';
import { CELL_SIZE, START_MARK } from '../game/constants';
import { theme } from '../game/theme';
import { preloadIcons } from '../game/icons/icon-loader';
import { ChestView } from '../game/markers/chest-view';
import { PickupView } from '../game/markers/pickup-view';
import { MarkerView } from '../game/markers/marker-view';
import type { TileDef } from '../game/map/tile';

/** I segnalini che l'editor mostra nelle schede, con la chiave con cui si trovano (`markerKey`). */
export const SAMPLE_MARKERS: { key: string; marker: Marker }[] = [
  { key: 'potion:heal', marker: { type: 'potion', kind: 'heal', x: 1, y: 1 } },
  { key: 'potion:vital', marker: { type: 'potion', kind: 'vital', x: 1, y: 1 } },
  { key: 'coins', marker: { type: 'coins', x: 1, y: 1 } },
  { key: 'chest:copper', marker: { type: 'chest', tier: 'copper', x: 1, y: 1 } },
  { key: 'chest:silver', marker: { type: 'chest', tier: 'silver', x: 1, y: 1 } },
  { key: 'chest:gold', marker: { type: 'chest', tier: 'gold', x: 1, y: 1 } },
  { key: 'rune:red', marker: { type: 'rune', color: 'red', x: 1, y: 1 } },
  { key: 'rune:blue', marker: { type: 'rune', color: 'blue', x: 1, y: 1 } },
  { key: 'rune:green', marker: { type: 'rune', color: 'green', x: 1, y: 1 } },
  { key: 'glyph', marker: { type: 'glyph', x: 1, y: 1 } },
  { key: 'glyph:active', marker: { type: 'glyph', x: 1, y: 1, active: true } },
];

/**
 * Le immagini delle schede degli oggetti: ogni segnalino si disegna con le stesse viste della mappa (`ChestView`, `PickupView`) su una casella e si trasforma in un'immagine,
 * così nelle schede c'è esattamente ciò che si vede in mappa (non un'icona o una copia fatta a mano). Restituisce un URL dati per ogni chiave.
 */
export async function renderMarkerSamples(app: Application, seed: number): Promise<Record<string, string>> {
  await preloadIcons(['tokens/potion', 'tokens/rune_key', 'tokens/little_key', 'tokens/gold_pile']);
  const floor: TileDef = { id: 'sample', size: { w: 3, h: 3 }, openings: [] };
  const out: Record<string, string> = {};
  for (const { key, marker } of SAMPLE_MARKERS) {
    const board = new Board([{ def: floor, x: 0, y: 0 }], [], [], [{ ...marker }]);
    const chests = new ChestView();
    const pickups = new PickupView(seed);
    const glyphs = new MarkerView(seed);
    chests.redraw(board);
    pickups.redraw(board);
    glyphs.redraw(board);
    // Un glifo acceso arriva al bianco pieno dopo la sua animazione: la si fa scorrere tutta prima di fotografarlo.
    for (let i = 0; i < 8; i++) glyphs.tick(1000 * (i + 1), 600);
    const holder = new Container();
    // La casella (1, 1) sta in (0, 0): il riquadro dell'immagine è la casella (un rettangolo invisibile ne fissa le misure), senza pavimento: solo il segnalino, su fondo trasparente.
    const cell = new Container();
    cell.position.set(-CELL_SIZE, -CELL_SIZE);
    cell.addChild(glyphs.container, chests.container, pickups.container);
    holder.addChild(new Graphics().rect(0, 0, CELL_SIZE, CELL_SIZE).fill({ color: 0x000000, alpha: 0 }), cell);
    out[key] = await app.renderer.extract.base64({ target: holder, frame: undefined, resolution: 2, antialias: true, clearColor: [0, 0, 0, 0] });
    holder.destroy({ children: true });
  }
  // Le caselle di partenza non sono un segnalino: un cerchio giallo a trattini, come sulla mappa.
  const start = new Container();
  const ring = new Graphics();
  const r = START_MARK.radius * CELL_SIZE;
  const step = (Math.PI * 2) / START_MARK.dashes;
  for (let i = 0; i < START_MARK.dashes; i++) {
    ring.moveTo(CELL_SIZE / 2 + r * Math.cos(i * step), CELL_SIZE / 2 + r * Math.sin(i * step));
    ring.arc(CELL_SIZE / 2, CELL_SIZE / 2, r, i * step, i * step + step * START_MARK.dashFill);
  }
  ring.stroke({ width: START_MARK.line + 0.5, color: theme.color.accentReach, cap: 'round' });
  start.addChild(new Graphics().rect(0, 0, CELL_SIZE, CELL_SIZE).fill({ color: 0x000000, alpha: 0 }), ring);
  out['start'] = await app.renderer.extract.base64({ target: start, frame: undefined, resolution: 2, antialias: true, clearColor: [0, 0, 0, 0] });
  start.destroy({ children: true });
  return out;
}
