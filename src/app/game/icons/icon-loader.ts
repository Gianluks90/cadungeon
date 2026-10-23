import { Container, Graphics } from 'pixi.js';

/**
 * Icone di Google Material Symbols, usate come SVG scaricati (mai come font): un file per icona in
 * public/icons/<nome>.svg (un nome con una cartella, come `tokens/potion`, è un file di public/ a parte). Si disegnano come vettori, con il colore di un ruolo del tema (mai colori scritti a mano).
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
        const res = await fetch(name.includes('/') ? `${name}.svg` : `icons/${name}.svg`);
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

/** Un numero di un path (anche nella forma compatta di certi file, come "-159.99.1" = -159.99 e .1). */
const NUM = '-?(?:\\d*\\.\\d+|\\d+\\.?)(?:e[-+]?\\d+)?';
/** Il primo comando di movimento di un contorno: M o m e le sue due coordinate. */
const FIRST_MOVE = new RegExp(`^([Mm])\\s*(${NUM})[\\s,]*(${NUM})`);

/**
 * I contorni di un'icona fatta di un solo path, ognuno come path a sé con partenza assoluta (null se il file manca).
 * Si dividono dopo ogni chiusura (z); un movimento relativo iniziale (m) si converte in assoluto, perché da solo non
 * saprebbe da dove partire (dopo una chiusura parte dall'inizio del contorno precedente).
 */
function subpaths(name: string): string[] | null {
  const src = sources.get(name);
  const d = src ? /\sd\s*=\s*"([^"]+)"/i.exec(src.svg)?.[1] : undefined;
  if (!d) return null;
  const starts: [number, number][] = [];
  return d.split(/(?<=[zZ])\s*(?=[Mm])/).map((p, i) => {
    const text = p.trim();
    const m = FIRST_MOVE.exec(text)!;
    const dx = Number(m[2]);
    const dy = Number(m[3]);
    const prev = starts[i - 1];
    starts.push(m[1] === 'm' && prev ? [prev[0] + dx, prev[1] + dy] : [dx, dy]);
    const rest = text.slice(m[0].length);
    const implicit = /^\s*[-\d.]/.test(rest) ? 'l' : ''; // coppie senza comando dopo un moveto sono linee relative
    return `M${starts[i][0]} ${starts[i][1]}${implicit}${rest}`;
  });
}

/** Un livello colorato di un'icona: solo i contorni `paths`, centrato sull'origine e alto/largo `size`. */
function layer(name: string, size: number, paths: readonly string[], color: number): Graphics {
  const src = sources.get(name)!;
  const g = new Graphics();
  const k = size / Math.max(src.w, src.h);
  g.svg(src.svg.replace(/(\sd\s*=\s*")[^"]+(")/i, `$1${paths.join('')}$2`));
  g.scale.set(k);
  g.position.set(-(src.x + src.w / 2) * k, -(src.y + src.h / 2) * k);
  g.tint = color;
  return g;
}

/**
 * Come createIcon per un'icona fatta di un solo path, ma con più colori: ogni gruppo di `groups` (indici dei contorni del
 * path) prende il suo colore in `colors`; i contorni che non stanno in nessun gruppo prendono `restColor`.
 * Se il file manca (o non ha contorni abbastanza), l'icona è di un solo colore (`restColor`).
 */
export function createMultiToneIcon(
  name: string,
  size: number,
  groups: readonly (readonly number[])[],
  colors: readonly number[],
  restColor: number,
): Container {
  const paths = subpaths(name);
  if (!paths || groups.some((g) => g.some((i) => i >= paths.length))) return createIcon(name, size, restColor);
  const root = new Container();
  const used = new Set(groups.flat());
  const rest = paths.filter((_, i) => !used.has(i));
  if (rest.length) root.addChild(layer(name, size, rest, restColor));
  groups.forEach((g, k) => root.addChild(layer(name, size, g.map((i) => paths[i]), colors[k])));
  return root;
}

/** Due colori: l'ULTIMO contorno del path (il liquido di una boccetta) prende `lastColor`, tutti gli altri `bodyColor`. */
export function createTwoToneIcon(name: string, size: number, bodyColor: number, lastColor: number): Container {
  const n = subpaths(name)?.length ?? 0;
  return createMultiToneIcon(name, size, n > 1 ? [[n - 1]] : [], [lastColor], bodyColor);
}

/** Forme semplici di riserva, a tratto sottile, per le icone senza file: una chiave, una boccetta e un rombo. */
function fallback(g: Graphics, name: string, size: number) {
  const r = size / 2;
  const w = Math.max(1, size / 14);
  if (name.endsWith('key') && !name.endsWith('rune_key')) {
    // Anello, asta e due denti.
    g.circle(-r * 0.45, 0, r * 0.38).stroke({ width: w, color: 0xffffff });
    g.moveTo(-r * 0.07, 0).lineTo(r * 0.9, 0).moveTo(r * 0.6, 0).lineTo(r * 0.6, r * 0.38).moveTo(r * 0.9, 0).lineTo(r * 0.9, r * 0.3);
    g.stroke({ width: w, color: 0xffffff, cap: 'round', join: 'round' });
  } else if (name.endsWith('padlock')) {
    // Lucchetto: corpo e arco.
    g.rect(-r * 0.6, -r * 0.1, r * 1.2, r * 0.9).stroke({ width: w, color: 0xffffff, join: 'round' });
    g.moveTo(-r * 0.38, -r * 0.1).lineTo(-r * 0.38, -r * 0.45).arc(0, -r * 0.45, r * 0.38, Math.PI, 0).lineTo(r * 0.38, -r * 0.1);
    g.stroke({ width: w, color: 0xffffff, cap: 'round', join: 'round' });
  } else if (name.endsWith('potion')) {
    // Boccetta: corpo tondo e collo.
    g.circle(0, r * 0.25, r * 0.7).stroke({ width: w, color: 0xffffff });
    g.moveTo(-r * 0.22, -r * 0.4).lineTo(-r * 0.22, -r).lineTo(r * 0.22, -r).lineTo(r * 0.22, -r * 0.4);
    g.stroke({ width: w, color: 0xffffff, cap: 'round', join: 'round' });
  } else {
    // Rombo (la runa).
    g.poly([0, -r, r * 0.7, 0, 0, r, -r * 0.7, 0]).stroke({ width: w, color: 0xffffff, join: 'round' });
  }
}
