import { ADVANCE_ATTACKS, DEFAULT_HERO_WOUNDS, DEFAULT_MONSTER_WOUNDS, PAWN_SPEED } from '../constants';
import { Cell } from '../board/board';
import { PotionKind } from '../board/marker';
import { AttackDice, HeroSheet, StartingSkills } from '../heroes/hero-sheet';
import { ItemDef, fitsEquipment } from '../items/item';

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
  /** Immagine del ritratto (percorso in public/, es. characters/ferdinand.webp). Senza, la pedina mostra un segnaposto. */
  portrait?: string;
  /** L'immagine a figura intera (dalla scheda), per i pannelli dell'eroe. */
  portraitFull?: string;
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
  /** Le monete dell'eroe (personali: ogni eroe ha le sue). */
  coins: number;
  /** Gli oggetti equipaggiati e quelli nello zaino (id di public/items/). */
  equipped: string[];
  backpack: string[];
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
  /** Le pozioni, le monete e gli oggetti con cui parte (se mancano, quelli della scheda). */
  potions?: PotionKind[];
  coins?: number;
  items?: string[];
}

export function createPieces(data: PieceData[], sheets: ReadonlyMap<string, HeroSheet> = new Map(), items: ReadonlyMap<string, ItemDef> = new Map()): Piece[] {
  return data.map((d) => {
    const sheet = d.hero ? sheets.get(d.hero) : undefined;
    const speed = d.speed ?? sheet?.speed ?? PAWN_SPEED;
    const wounds = d.wounds ?? sheet?.wounds ?? (d.team === 'hero' ? DEFAULT_HERO_WOUNDS : DEFAULT_MONSTER_WOUNDS);
    // Gli oggetti comprati prima di partire: si equipaggiano finché ci stanno, il resto va nello zaino; il prezzo si toglie dalle monete.
    const bought = d.items ?? sheet?.items ?? [];
    const equipped: string[] = [];
    const backpack: string[] = [];
    for (const id of bought) {
      const def = items.get(id);
      if (def && fitsEquipment(equipped.map((e) => items.get(e)!), def)) equipped.push(id);
      else backpack.push(id);
    }
    const spent = bought.reduce((n, id) => n + (items.get(id)?.price ?? 0), 0);
    return {
      id: d.id,
      name: d.name ?? sheet?.name ?? d.id,
      team: d.team,
      portrait: d.portrait ?? sheet?.portrait,
      portraitFull: sheet?.portraitFull,
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
      coins: d.coins ?? Math.max(0, (sheet?.coins ?? 0) - spent),
      equipped,
      backpack,
      armor: sheet?.armor ?? 0,
      fatigue: sheet?.fatigue ?? 0,
      value: sheet?.value ?? 0,
      skills: sheet ? { ...sheet.skills } : { combat: 0, cunning: 0, magic: 0 },
      dice: sheet ? { ...sheet.dice } : { melee: 0, ranged: 0, magic: 0 },
      ability: sheet?.ability ?? '',
    };
  });
}
