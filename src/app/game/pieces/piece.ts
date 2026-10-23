import { ADVANCE_ATTACKS, DEFAULT_HERO_WOUNDS, DEFAULT_MONSTER_WOUNDS, PAWN_SPEED } from '../constants';
import { Cell } from '../board/board';
import { PotionKind } from '../board/marker';
import { AttackDice, HeroSheet, StartingSkills } from '../heroes/hero-sheet';

export type Team = 'hero' | 'monster';

/** L'azione scelta per il turno: Avanzare è quella di partenza (nessun comando). */
export type HeroAction = 'advance' | 'run' | 'fight';

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
  /** Attacchi che restano in questo round. */
  attacks: number;
  /** L'azione scelta, e quanto si è già speso (servono per sapere se si può cambiare azione). */
  action: HeroAction;
  pointsUsed: number;
  attacksUsed: number;
  /** Ha finito il suo turno (ha passato). */
  done: boolean;
  /** Ferite (punti vita) che restano, e il massimo. */
  wounds: number;
  maxWounds: number;
  /** Immagine del ritratto (percorso in public/, es. characters/ferdinand.png). Senza, la pedina mostra un segnaposto. */
  portrait?: string;
  /** La scheda da cui viene (public/heroes/), se è un eroe. */
  sheet?: string;
  /** Armatura fissa, fatica, valore (il Progresso che si perde se muore), abilità iniziali, dadi dei tre attacchi, abilità a parole. */
  armor: number;
  fatigue: number;
  value: number;
  /** La classe a parole (dalla scheda): il sottotitolo dell'eroe. */
  heroClass: string;
  /** Le pozioni che porta (al massimo POTION_LIMIT): ogni eroe ha le sue. */
  potions: PotionKind[];
  skills: StartingSkills;
  dice: AttackDice;
  ability: string;
}

/** Come un pezzo è scritto nella mappa: dati dell'avventura, come le porte. */
export interface PieceData {
  id: string;
  /** Il nome: se manca, quello della scheda dell'eroe. */
  name?: string;
  team: Team;
  /** La scheda dell'eroe (id di public/heroes/<id>.json): da lì vengono nome, ritratto, ferite, velocità e il resto. I campi scritti qui li sostituiscono. */
  hero?: string;
  x: number;
  y: number;
  speed?: number;
  wounds?: number;
  portrait?: string;
  /** Le pozioni con cui parte (se manca, quelle della scheda). */
  potions?: PotionKind[];
}

export function createPieces(data: PieceData[], sheets: ReadonlyMap<string, HeroSheet> = new Map()): Piece[] {
  return data.map((d) => {
    const sheet = d.hero ? sheets.get(d.hero) : undefined;
    const speed = d.speed ?? sheet?.speed ?? PAWN_SPEED;
    const wounds = d.wounds ?? sheet?.wounds ?? (d.team === 'hero' ? DEFAULT_HERO_WOUNDS : DEFAULT_MONSTER_WOUNDS);
    return {
      id: d.id,
      name: d.name ?? sheet?.name ?? d.id,
      team: d.team,
      portrait: d.portrait ?? sheet?.portrait,
      sheet: sheet?.id,
      cell: { x: d.x, y: d.y },
      speed,
      points: speed,
      attacks: ADVANCE_ATTACKS,
      action: 'advance' as HeroAction,
      pointsUsed: 0,
      attacksUsed: 0,
      done: false,
      wounds,
      maxWounds: wounds,
      heroClass: sheet?.class ?? '',
      potions: [...(d.potions ?? sheet?.potions ?? [])],
      armor: sheet?.armor ?? 0,
      fatigue: sheet?.fatigue ?? 0,
      value: sheet?.value ?? 0,
      skills: sheet ? { ...sheet.skills } : { combat: 0, cunning: 0, magic: 0 },
      dice: sheet ? { ...sheet.dice } : { melee: 0, ranged: 0, magic: 0 },
      ability: sheet?.ability ?? '',
    };
  });
}
