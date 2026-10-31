import { ItemDef, cappedSpeed, totalArmor } from '../items/item';
import { Effect } from '../state/effects';
import { SkillDef } from '../skills/skill';
import { HeroSheet } from './hero-sheet';

/** I parametri di un eroe con tutto ciò che li cambia: carte abilità e oggetti equipaggiati. */
export interface HeroStats {
  wounds: number;
  fatigue: number;
  speed: number;
  armor: number;
}

/**
 * Anteprima dei parametri di un eroe prima di partire, con le stesse regole della partita (`statBonus`, `speedOf`, `armorOf` in `state/`): i bonus `stat` delle carte abilità e degli oggetti
 * (ferite e fatica massime, velocità, armatura), il limite di velocità delle armature e l'armatura degli oggetti. I bonus che valgono solo contro un tipo di attacco non si contano: dipendono dall'attacco.
 */
export function heroStats(hero: HeroSheet, skills: readonly SkillDef[], equipped: readonly ItemDef[]): HeroStats {
  const effects = [...skills.flatMap((s) => s.effects), ...equipped.flatMap((i) => i.effects ?? [])] as readonly Effect[];
  const wearsArmor = equipped.some((i) => i.kind === 'armor');
  const bonus = (stat: string, afterCaps = false) =>
    effects.reduce((n, e) => {
      if (e.kind !== 'stat' || e.stat !== stat || e.vs) return n;
      if (e.when === 'noArmorWorn' && wearsArmor) return n;
      if (stat === 'speed' && !!e.afterCaps !== afterCaps) return n;
      return n + Number(e.amount);
    }, 0);
  const ignoresArmorCap = effects.some((e) => e.kind === 'rule' && e.rule === 'armorNoSpeedPenalty');
  const capDefs = ignoresArmorCap ? equipped.filter((i) => i.kind !== 'armor') : equipped;
  return {
    wounds: hero.wounds + bonus('wounds'),
    fatigue: hero.fatigue + bonus('fatigue'),
    speed: cappedSpeed(hero.speed + bonus('speed'), capDefs) + bonus('speed', true),
    armor: totalArmor(hero.armor, equipped) + bonus('armor'),
  };
}
