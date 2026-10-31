import type { Cell } from '../board/board';
import type { Marker } from '../board/marker';

/**
 * La scheda di un famiglio (public/familiars/<id>.json, elencate in index.json): per ora il nome, la velocità (spazi che percorre ogni volta che si sposta), l'immagine del segnalino
 * e l'abilità, come per gli eroi. Le regole comuni a tutti i famigli sono in docs/REGOLE.md, sezione 2g.
 */
export interface FamiliarDef {
  id: string;
  name: string;
  /** Se è un famiglio "portato" (Zanna): l'id dell'oggetto trasportato (`ItemDef.carried`) che lo rappresenta. Non ha un segnalino suo: compare accanto alla pedina di chi lo porta. */
  item?: string;
  /** Quanti spazi percorre al massimo quando si sposta (dopo il turno del padrone). */
  speed: number;
  /** L'immagine del segnaposto (percorso in public/); senza, il segnalino ha un'icona. */
  image?: string;
  /** L'immagine grande per le card del catalogo (due famigli possono condividerla, come Ying e Yang); senza, quella del segnalino. */
  portrait?: string;
  /** Le eccezioni alle regole comuni, a dati: `summonSight` (la sua vista conta per l'evocazione), `fly` (sorvola tutto), `weaken` (i nemici vicini: `armor` in meno, `noDodge`, `noAim`), `carry` (porta un oggetto). */
  effects?: { kind: string; [key: string]: unknown }[];
  /** Il nome e la descrizione dell'abilità (markdown, tono come quello degli eroi). Senza, il famiglio segue e basta. */
  abilityName?: string;
  ability?: string;
}

/** Un famiglio in partita: di chi è, e dove sta (indipendentemente da dov'è il padrone). Non è una pedina: non blocca, non si attacca, non conta come eroe. */
export interface Familiar {
  /** Lo stesso id della scheda: ogni famiglio c'è una volta sola in partita. */
  id: string;
  owner: string;
  cell: Cell;
  /** L'oggetto che porta (un segnalino raccolto da terra), se ne porta uno: solo i famigli con `carry`. */
  carried?: Marker;
}

/** I famigli che una scheda eroe dà (effetto `familiar` in `effects`): per mostrarli già nella scelta degli eroi. */
export function familiarsOfSheet(sheet: { effects?: readonly { kind: string; [key: string]: unknown }[] }, defs: ReadonlyMap<string, FamiliarDef>): FamiliarDef[] {
  const ids = (sheet.effects ?? []).flatMap((e) => (e.kind === 'familiar' && Array.isArray(e['ids']) ? (e['ids'] as string[]) : []));
  return ids.flatMap((id) => defs.get(id) ?? []);
}

/** Carica le schede dei famigli elencate in public/familiars/index.json (`{ "familiars": ["id", ...] }`). */
export async function loadFamiliarCatalog(): Promise<Map<string, FamiliarDef>> {
  const defs = new Map<string, FamiliarDef>();
  try {
    const res = await fetch('familiars/index.json');
    if (!res.ok) return defs;
    const { familiars }: { familiars: string[] } = await res.json();
    await Promise.all(
      familiars.map(async (id) => {
        try {
          const r = await fetch(`familiars/${id}.json`);
          if (r.ok) defs.set(id, (await r.json()) as FamiliarDef);
        } catch {
          console.warn(`Scheda del famiglio "${id}" non trovata`);
        }
      }),
    );
  } catch {
    console.warn('Catalogo dei famigli non trovato');
  }
  // Nell'ordine dell'elenco, non in quello in cui sono arrivate le risposte.
  return defs;
}
