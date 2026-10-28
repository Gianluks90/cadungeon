import { Assets, Texture } from 'pixi.js';

/**
 * Carica le immagini dei ritratti (public/characters/...). Quelle che non si caricano restano fuori dalla mappa:
 * la pedina usa allora il segnaposto. Le immagini sono più grandi della pedina, quindi si usano i mipmap, perché
 * restino nitide anche quando si rimpicciolisce lo zoom.
 */
export async function loadPortraits(urls: (string | undefined)[]): Promise<Map<string, Texture>> {
  const result = new Map<string, Texture>();
  await Promise.all(
    [...new Set(urls.filter((u): u is string => !!u))].map(async (url) => {
      try {
        const texture: Texture = await Assets.load({ src: url, data: { autoGenerateMipmaps: true } });
        texture.source.scaleMode = 'linear';
        result.set(url, texture);
      } catch {
        console.warn(`Ritratto non trovato: ${url}`);
      }
    }),
  );
  return result;
}

/**
 * Come mettere l'immagine di una pedina nella sua forma (con raggi `a` e `b`, orizzontale e verticale): un'immagine allungata (la salamandra è in verticale) ruota di 90° quando la
 * pedina è girata dall'altra parte, e la scala la fa coprire tutta la forma. È la stessa regola in partita e nell'editor, così la miniatura e l'immagine seguono la stessa rotazione.
 */
export function fitPortrait(width: number, height: number, a: number, b: number): { rotation: number; scale: number } {
  const turned = height !== width && height > width !== b > a && a !== b;
  const [w, h] = turned ? [height, width] : [width, height];
  return { rotation: turned ? -Math.PI / 2 : 0, scale: Math.max((2 * a) / w, (2 * b) / h) };
}
