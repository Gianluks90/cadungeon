import { Container, Graphics } from 'pixi.js';

/**
 * Icone di Google Material Symbols, usate come SVG scaricati (mai come font): un file per icona in
 * public/icons/<nome>.svg. Si disegnano come vettori, con il colore di un ruolo del tema (mai colori scritti a mano).
 * Se un file manca, al suo posto compare una forma semplice, così il gioco funziona anche senza.
 */
interface IconSource {
  svg: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const sources = new Map<string, IconSource | null>();

/** Il file SVG pronto da colorare: riempimento bianco (il colore si applica dopo) e il suo viewBox. */
function parse(text: string): IconSource | null {
  if (!/<svg[\s>]/i.test(text)) return null; // es. il server ha risposto con una pagina HTML
  const vb = /viewBox\s*=\s*"([^"]+)"/i.exec(text)?.[1].trim().split(/[\s,]+/).map(Number);
  const [x, y, w, h] = vb && vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, 24, 24];
  const svg = text
    .replace(/\sfill\s*=\s*"[^"]*"/gi, '')
    .replace(/<svg/i, '<svg fill="#ffffff"');
  return { svg, x, y, w, h };
}

/** Scarica le icone che servono. Da chiamare prima di disegnare; non fallisce mai (le mancanti usano la forma di riserva). */
export async function preloadIcons(names: readonly string[]): Promise<void> {
  await Promise.all(
    names.map(async (name) => {
      if (sources.has(name)) return;
      try {
        const res = await fetch(`icons/${name}.svg`);
        sources.set(name, res.ok ? parse(await res.text()) : null);
      } catch {
        sources.set(name, null);
      }
    }),
  );
}

/** C'è il file SVG di questa icona? (Utile per dire cosa manca.) */
export const hasIcon = (name: string): boolean => !!sources.get(name);

/**
 * Un'icona centrata sull'origine, alta/larga `size` pixel, del colore `color`.
 * Va ricreata solo quando cambia il disegno, non a ogni frame.
 */
export function createIcon(name: string, size: number, color: number): Container {
  const root = new Container();
  const src = sources.get(name);
  const g = new Graphics();
  if (src) {
    // Il viewBox di Material Symbols parte da y negativo: lo sposto al centro e scalo alla dimensione voluta.
    const k = size / Math.max(src.w, src.h);
    g.svg(src.svg);
    g.scale.set(k);
    g.position.set(-(src.x + src.w / 2) * k, -(src.y + src.h / 2) * k);
  } else {
    fallback(g, name, size);
  }
  g.tint = color;
  root.addChild(g);
  return root;
}

/** Forme semplici di riserva, a tratto sottile, per le icone senza file: una chiave e un rombo. */
function fallback(g: Graphics, name: string, size: number) {
  const r = size / 2;
  const w = Math.max(1, size / 14);
  if (name === 'key') {
    // Anello, asta e due denti.
    g.circle(-r * 0.45, 0, r * 0.38).stroke({ width: w, color: 0xffffff });
    g.moveTo(-r * 0.07, 0).lineTo(r * 0.9, 0).moveTo(r * 0.6, 0).lineTo(r * 0.6, r * 0.38).moveTo(r * 0.9, 0).lineTo(r * 0.9, r * 0.3);
    g.stroke({ width: w, color: 0xffffff, cap: 'round', join: 'round' });
  } else {
    // Rombo (la runa).
    g.poly([0, -r, r * 0.7, 0, 0, r, -r * 0.7, 0]).stroke({ width: w, color: 0xffffff, join: 'round' });
  }
}
