import { Assets, Texture } from 'pixi.js';
import type { TokenLook } from '../board/marker';

/** Un'immagine che si può dare a un gettone (public/tokens/portraits/<file>, elencata in `index.json`): `file` è il gettone tondo e, se c'è, `portrait` la carta a figura intera (si può mostrare accanto a un testo, come le regole speciali). */
export interface TokenImage {
  id: string;
  name: string;
  file: string;
  portrait?: string;
}

const MANIFEST_URL = 'tokens/portraits/index.json';
let images: TokenImage[] | null = null;
let loading: Promise<TokenImage[]> | null = null;
const textures = new Map<string, Texture>();

/**
 * Carica l'elenco delle immagini dei gettoni e le loro texture (una volta sola: poi sono in memoria). Le immagini che non si caricano restano fuori e il gettone usa l'icona di riserva.
 * Si chiama prima di disegnare la mappa, in partita e nell'editor.
 */
export function loadTokenImages(): Promise<TokenImage[]> {
  if (images) return Promise.resolve(images);
  loading ??= (async () => {
    let list: TokenImage[] = [];
    try {
      const res = await fetch(MANIFEST_URL);
      if (res.ok) list = ((await res.json()) as { images?: TokenImage[] }).images ?? [];
    } catch {
      console.warn('Elenco delle immagini dei gettoni non trovato');
    }
    await Promise.all(list.map(async (img) => {
      try {
        const texture: Texture = await Assets.load({ src: `tokens/portraits/${img.file}`, data: { autoGenerateMipmaps: true } });
        texture.source.scaleMode = 'linear';
        textures.set(img.id, texture);
      } catch {
        console.warn(`Immagine del gettone non trovata: ${img.file}`);
      }
    }));
    images = list;
    return list;
  })();
  return loading;
}

/** La texture di un'immagine dei gettoni, se è già caricata. */
export const tokenTexture = (id: string): Texture | undefined => textures.get(id);

/** Un'immagine della raccolta, se l'elenco è già caricato. */
export const tokenImage = (id: string): TokenImage | undefined => images?.find((i) => i.id === id);

/** L'indirizzo della carta a figura intera, se l'immagine ce l'ha. */
export const tokenPortraitUrl = (img: TokenImage): string | null => (img.portrait ? `tokens/portraits/${img.portrait}` : null);

/** L'indirizzo dell'immagine, per le anteprime in HTML. */
export const tokenImageUrl = (img: TokenImage): string => `tokens/portraits/${img.file}`;

/** Il valore di una select dell'aspetto: `image:<id>`, `icon:<nome>` o vuoto (nessun aspetto). */
export function lookChoice(look: TokenLook | undefined): string {
  return look?.image ? `image:${look.image}` : look?.icon ? `icon:${look.icon}` : '';
}

/** Dal valore della select e dal titolo all'aspetto salvato (senza campi vuoti); undefined se non c'è niente. */
export function lookFrom(choice: string, title: string): TokenLook | undefined {
  const image = choice.startsWith('image:') ? choice.slice(6) : '';
  const icon = choice.startsWith('icon:') ? choice.slice(5) : '';
  const t = title.trim();
  if (!image && !icon && !t) return undefined;
  return { ...(image ? { image } : {}), ...(icon ? { icon } : {}), ...(t ? { title: t } : {}) };
}
