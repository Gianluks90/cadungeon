import { Stairs } from '../board/marker';
import { WallSegment } from '../map/walls';

/** Il lato aperto di una scala, da cui si entra, per rotazione (0 = in basso; si ruota in senso orario). */
const OPEN_SIDE: Record<NonNullable<Stairs['rotation']>, 'N' | 'E' | 'S' | 'W'> = { 0: 'S', 90: 'W', 180: 'N', 270: 'E' };

/**
 * I muri di una scala: i tre lati chiusi della sua cella (il quarto è aperto). Sono muri veri: si disegnano come gli altri
 * (e si fondono con quelli vicini) e bloccano movimento e vista come loro.
 */
export function stairsWalls(stairs: readonly Stairs[]): WallSegment[] {
  const walls: WallSegment[] = [];
  for (const s of stairs) {
    const open = OPEN_SIDE[s.rotation ?? 0];
    if (open !== 'N') walls.push({ x1: s.x, y1: s.y, x2: s.x + 1, y2: s.y });
    if (open !== 'S') walls.push({ x1: s.x, y1: s.y + 1, x2: s.x + 1, y2: s.y + 1 });
    if (open !== 'W') walls.push({ x1: s.x, y1: s.y, x2: s.x, y2: s.y + 1 });
    if (open !== 'E') walls.push({ x1: s.x + 1, y1: s.y, x2: s.x + 1, y2: s.y + 1 });
  }
  return walls;
}
