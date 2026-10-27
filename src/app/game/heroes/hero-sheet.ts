import { PotionKind } from '../board/marker';
import type { SkillEffect } from '../skills/skill';

/** Quanti dadi extra ha un eroe per ognuno dei tre tipi di attacco. */
export interface AttackDice {
  melee: number;
  ranged: number;
  magic: number;
}

/** Punti di abilità iniziali, nei tre rami. */
export interface StartingSkills {
  combat: number;
  cunning: number;
  magic: number;
}

/**
 * La scheda di un eroe: un archetipo pronto (public/heroes/<id>.json). Le regole stanno in docs/REGOLE.md, sezione 10.
 * Le quattro caratteristiche (forza, conoscenza, volontà, percezione) sono in pausa e non fanno parte della scheda.
 */
export interface HeroSheet {
  id: string;
  name: string;
  /** La classe, a parole (druido, ranger, ...): è il sottotitolo dell'eroe. */
  class: string;
  /** L'archetipo, a parole (guerriero, arciere, mago, ibrido, ...): serve a chi costruisce la scheda, non si mostra. */
  archetype: string;
  /** Immagine del ritratto (percorso in public/). */
  portrait?: string;
  /** L'immagine a figura intera (alta), per i pannelli dell'eroe. */
  portraitFull?: string;
  /** Ferite: sempre multipli di 4 (un cuore = 4 ferite). */
  wounds: number;
  /** Fatica (per ora solo dato: la fatica è fuori scope). */
  fatigue: number;
  /** Armatura fissa: si sottrae al danno. */
  armor: number;
  /** Velocità: punti movimento a inizio turno. */
  speed: number;
  /** Il valore dell'eroe: la Conquista che il gruppo perde se muore. Più è robusto, più vale. */
  value: number;
  skills: StartingSkills;
  dice: AttackDice;
  /** Le monete con cui parte (300 nel regolamento) e ciò che ha comprato prima di partire: gli oggetti (id di public/items/, equipaggiati se ci stanno) e le pozioni; il loro prezzo si toglie dalle monete. */
  coins: number;
  items: string[];
  potions: PotionKind[];
  /** L'abilità dell'eroe, a parole (per ora un segnaposto, da mostrare nell'interfaccia). */
  ability: string;
  /** L'abilità dell'eroe nella forma che il gioco legge (gli stessi effetti delle carte): per esempio una reazione quando subisce ferite. */
  effects?: SkillEffect[];
}

/** Controlla che una scheda segua i pattern dei riferimenti; si limita ad avvisare (i valori sono da bilanciare). */
function check(s: HeroSheet) {
  const sum = (o: object) => Object.values(o).reduce((a: number, b: number) => a + b, 0);
  if (s.wounds % 4 !== 0) console.warn(`Eroe "${s.id}": le ferite (${s.wounds}) dovrebbero essere un multiplo di 4`);
  if (sum(s.dice) !== 3) console.warn(`Eroe "${s.id}": i dadi dei tre attacchi di solito sommano 3 (qui ${sum(s.dice)})`);
  if (sum(s.skills) !== 3) console.warn(`Eroe "${s.id}": le abilità iniziali di solito sommano 3 (qui ${sum(s.skills)})`);
}

/** Carica le schede che servono (una per id, senza ripetizioni). Quelle che mancano si saltano: la pedina usa i valori di riserva. */
export async function loadHeroSheets(ids: readonly (string | undefined)[]): Promise<Map<string, HeroSheet>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const sheets = new Map<string, HeroSheet>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const res = await fetch(`heroes/${id}.json`);
        if (!res.ok) throw new Error(String(res.status));
        const sheet: HeroSheet = await res.json();
        check(sheet);
        sheets.set(id, sheet);
      } catch {
        console.warn(`Scheda dell'eroe "${id}" non trovata`);
      }
    }),
  );
  return sheets;
}

/** Carica tutte le schede degli eroi elencate in public/heroes/index.json (per il catalogo dei componenti). */
export async function loadAllHeroSheets(): Promise<HeroSheet[]> {
  try {
    const res = await fetch('heroes/index.json');
    if (!res.ok) return [];
    const { heroes }: { heroes: string[] } = await res.json();
    return [...(await loadHeroSheets(heroes)).values()];
  } catch {
    return [];
  }
}
