import { DEFAULT_HERO_WOUNDS, DEFAULT_MONSTER_WOUNDS, PAWN_SPEED } from '../constants';
import { Cell } from '../board/board';

export type Team = 'hero' | 'monster';

/** Un pezzo sul tabellone (eroe o mostro), con il suo stato di gioco. */
export interface Piece {
  id: string;
  name: string;
  team: Team;
  cell: Cell;
  /** Punti movimento a inizio round. */
  speed: number;
  /** Punti movimento che restano in questo round. */
  points: number;
  /** Ferite (punti vita) che restano, e il massimo. */
  wounds: number;
  maxWounds: number;
  /** Immagine del ritratto (percorso in public/, es. characters/ferdinand.png). Senza, la pedina mostra un segnaposto. */
  portrait?: string;
}

/** Come un pezzo è scritto nella mappa: dati dell'avventura, come le porte. */
export interface PieceData {
  id: string;
  name: string;
  team: Team;
  x: number;
  y: number;
  speed?: number;
  wounds?: number;
  portrait?: string;
}

export function createPieces(data: PieceData[]): Piece[] {
  return data.map((d) => ({
    id: d.id,
    name: d.name,
    team: d.team,
    portrait: d.portrait,
    cell: { x: d.x, y: d.y },
    speed: d.speed ?? PAWN_SPEED,
    points: d.speed ?? PAWN_SPEED,
    wounds: d.wounds ?? (d.team === 'hero' ? DEFAULT_HERO_WOUNDS : DEFAULT_MONSTER_WOUNDS),
    maxWounds: d.wounds ?? (d.team === 'hero' ? DEFAULT_HERO_WOUNDS : DEFAULT_MONSTER_WOUNDS),
  }));
}
