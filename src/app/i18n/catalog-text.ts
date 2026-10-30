import { translateRaw, translateRawAll } from './i18n.service';

/**
 * I testi dei cataloghi (oggetti, abilità, mostri, eroi) sono scritti in italiano nei file di `public/`: l'italiano è anche ciò che legge il motore di gioco (per esempio "Perforare 2" o
 * "+1 danno" sono parole che le regole riconoscono), quindi nei dati non si traduce. Chi mostra un testo all'utente lo passa da qui: se c'è la traduzione nella lingua di adesso la dà,
 * altrimenti restituisce il testo com'è.
 * Le traduzioni stanno in `it.json` e `en.json`: i nomi per id (`item.sword`, `skill.parry`, `monster.goblin`) e gli altri testi con una chiave ricavata dal testo stesso (`catalogKey`).
 */

/** La chiave di un testo del catalogo: le prime parole senza accenti e un breve riassunto del testo intero (due testi diversi non hanno mai la stessa chiave). */
export function catalogKey(text: string): string {
  const words = (text.normalize('NFD').replace(/\p{M}/gu, '').match(/[A-Za-z0-9]+/g) ?? []).slice(0, 5);
  const camel = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('');
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return `c.${camel}_${(h >>> 0).toString(16).padStart(8, '0').slice(-5)}`;
}

/**
 * Un testo scritto in italiano nel codice o nei dati, nella lingua di adesso: l'italiano stesso fa da chiave (`catalogKey`) e `{nome}` è un segnaposto riempito con i parametri.
 * Si usa per i messaggi delle regole di gioco e della partita (motivi, notifiche, voci dei menu) e dove il testo è una frase intera: `tr('Dai a {name}', { name })`.
 * Ogni testo passato a `tr` vuole la sua riga in `it.json` (uguale al testo) e in `en.json`, con la chiave che dà `catalogKey`; `npm run i18n:check` controlla che ci siano tutte.
 */
export function tr(text: string, params?: Record<string, string | number | undefined>): string {
  const out = translateRaw(catalogKey(text)) ?? text;
  return params ? out.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m)) : out;
}

/** Un testo del catalogo nella lingua di adesso (se non c'è la traduzione, quello dei dati). */
export function catalogText(text: string): string {
  return translateRaw(catalogKey(text)) ?? text;
}

/** Il nome di un oggetto, un'abilità o un mostro (`kind` è `item`, `skill` o `monster`) nella lingua di adesso (se non c'è la traduzione, quello dei dati). */
export function catalogName(kind: 'item' | 'skill' | 'monster' | 'overlord', id: string, fallback: string): string {
  return translateRaw(`${kind}.${id}`) ?? fallback;
}

/** Fa seguire il nome alla lingua: la proprietà `name` di una voce del catalogo diventa un getter (le copie di una voce, come `{ ...def }`, prendono il nome del momento). */
export function localizeName<T extends { id: string; name: string }>(kind: 'item' | 'skill' | 'monster' | 'overlord', def: T): T {
  const raw = def.name;
  Object.defineProperty(def, 'name', { get: () => catalogName(kind, def.id, raw), enumerable: true, configurable: true });
  return def;
}

/**
 * Il contrario di `catalogText`: se `text` è la traduzione, nella lingua di adesso, di un testo del catalogo restituisce quello dei dati (l'italiano); altrimenti lo lascia com'è.
 * Serve quando l'autore scrive un'abilità a mano: nei dati deve restare la parola che il motore riconosce (per esempio "Perforare 2" anche se ha scritto "Pierce 2").
 */
export function catalogSource(text: string): string {
  const wanted = text.trim().toLowerCase();
  for (const [key, translated] of translateRawAll('c.')) if (translated.toLowerCase() === wanted) return translateRaw(key, 'it') ?? text;
  return text;
}
