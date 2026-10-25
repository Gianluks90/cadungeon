/** I tre rami delle carte abilità (gli stessi di `StartingSkills` nelle schede degli eroi). */
export type SkillSchool = 'combat' | 'cunning' | 'magic';

export const SKILL_SCHOOLS: readonly SkillSchool[] = ['combat', 'cunning', 'magic'];

/** I nomi dei rami, per l'interfaccia. */
export const SKILL_SCHOOL_NAMES: Record<SkillSchool, string> = { combat: 'Combattimento', cunning: 'Sotterfugio', magic: 'Magia' };

/** Un effetto di una carta, nel vocabolario di docs/cards/abilities.md (sezione 9). Per ora sono solo dati: nessuno li legge ancora. */
export interface SkillEffect {
  kind: string;
  [key: string]: unknown;
}

/** Una carta abilità (public/skills/catalog.json). */
export interface SkillDef {
  id: string;
  name: string;
  school: SkillSchool;
  /** Il testo da mostrare. */
  text: string;
  effects: SkillEffect[];
}

/** Carica il catalogo delle carte abilità: un solo file, public/skills/catalog.json (`{ skills: [...] }`). Se manca, è vuoto. */
export async function loadSkillCatalog(): Promise<Map<string, SkillDef>> {
  const skills = new Map<string, SkillDef>();
  try {
    const res = await fetch('skills/catalog.json');
    if (!res.ok) return skills;
    const file: { skills: SkillDef[] } = await res.json();
    for (const s of file.skills) skills.set(s.id, s);
  } catch {
    console.warn('Catalogo delle abilità non trovato');
  }
  return skills;
}
