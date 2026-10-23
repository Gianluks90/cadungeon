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
