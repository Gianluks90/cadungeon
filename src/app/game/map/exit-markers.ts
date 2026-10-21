import { Graphics } from 'pixi.js';
import {
  CELL_SIZE,
  EXIT_MARKER_ALPHA,
  EXIT_MARKER_BASE_PX,
  EXIT_MARKER_COLOR,
  EXIT_MARKER_CONNECTED_COLOR,
  EXIT_MARKER_HEIGHT_PX,
  EXIT_MARKER_INSET_PX,
} from '../constants';
import { PlacedTile } from './map-data';

/**
 * Triangoli che indicano le uscite di un tile, uno per apertura, rivolti verso l'esterno.
 * Sono visibili solo mentre si piazza un tile: servono a capire dove si può agganciare.
 * `connected[i]` dice se l'apertura i si collega a una già in mappa (verde) o è libera (ambra).
 */
export function drawExitMarkers(tile: PlacedTile, connected: boolean[]): Graphics {
  const { w, h } = tile.def.size;
  const W = w * CELL_SIZE;
  const H = h * CELL_SIZE;
  const base = EXIT_MARKER_BASE_PX / 2;
  const g = new Graphics();
  g.position.set(tile.x * CELL_SIZE, tile.y * CELL_SIZE);

  tile.def.openings.forEach((o, i) => {
    const m = (o.offset + o.width / 2) * CELL_SIZE; // centro dell'apertura lungo il lato
    const tip = EXIT_MARKER_INSET_PX; // punta, vicino al bordo
    const back = EXIT_MARKER_INSET_PX + EXIT_MARKER_HEIGHT_PX; // base, più dentro il tile
    switch (o.side) {
      case 'N': g.poly([m, tip, m - base, back, m + base, back]); break;
      case 'S': g.poly([m, H - tip, m - base, H - back, m + base, H - back]); break;
      case 'W': g.poly([tip, m, back, m - base, back, m + base]); break;
      case 'E': g.poly([W - tip, m, W - back, m - base, W - back, m + base]); break;
    }
    g.fill({ color: connected[i] ? EXIT_MARKER_CONNECTED_COLOR : EXIT_MARKER_COLOR, alpha: EXIT_MARKER_ALPHA });
  });
  return g;
}
