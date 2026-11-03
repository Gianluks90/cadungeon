// Controlla che ogni testo passato a `tr('…')` o al pipe `| tr` abbia la sua riga in it.json e in en.json (la chiave si ricava dal testo, come `catalogKey`).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `fileURLToPath` e le barre dritte: funziona anche su Windows e con spazi nel percorso (`pathname` dava `%20` e `C:\C:\…`).
const ROOT = fileURLToPath(new URL('../src/app/', import.meta.url)).replaceAll('\\', '/');
const it = JSON.parse(readFileSync(ROOT + 'i18n/it.json', 'utf8'));
const en = JSON.parse(readFileSync(ROOT + 'i18n/en.json', 'utf8'));

function catalogKey(text) {
  const words = (text.normalize('NFD').replace(/\p{M}/gu, '').match(/[A-Za-z0-9]+/g) ?? []).slice(0, 5);
  const camel = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join('');
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  return `c.${camel}_${(h >>> 0).toString(16).padStart(8, '0').slice(-5)}`;
}

function* files(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (p.endsWith('.ts')) yield p.replaceAll('\\', '/');
  }
}

const unescape = (s) => s.replace(/\u0001/g, "'").replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c));
let bad = 0;
const missing = new Map(); // testo -> chiave (con --json <file> li scrive, per tradurli)
const used = new Set();
for (const f of files(ROOT)) {
  if (f.includes('/i18n/')) continue; // gli esempi nei commenti non contano
  const s = readFileSync(f, 'utf8').replace(/\\\\'/g, '\u0001'); // nei template `\\'` (dentro un'espressione) è un apice
  const found = [];
  // tr('…') / tr("…") / tr(`…`) nel codice, e 'testo' | tr nei template
  for (const m of s.matchAll(/\btr\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`((?:\\.|[^`\\])*)`)/g)) found.push(m[1] ?? m[2] ?? m[3]);
  for (const m of s.matchAll(/(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)")\s*\|\s*tr\b/g)) found.push(m[1] ?? m[2]);
  // (cond ? 'testo a' : 'testo b') | tr: ogni testo tra apici dentro le parentesi
  for (const m of s.matchAll(/\(((?:[^()]|\([^()]*\))*)\)\s*\|\s*tr\b/g)) {
    for (const q of m[1].matchAll(/'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"/g)) {
      if (/[=!]==?\s*$/.test(m[1].slice(0, q.index))) continue; // un confronto (`=== 'x'`), non un testo
      if (q[1] ?? q[2]) found.push(q[1] ?? q[2]);
    }
  }
  for (const raw of found) {
    const text = unescape(raw);
    const key = catalogKey(text);
    used.add(key);
    for (const [name, file] of [['it.json', it], ['en.json', en]]) {
      if (!(key in file)) {
        bad++;
        missing.set(text, key);
        console.log(`manca in ${name}: ${key}  ${f.replace(ROOT, '')}  «${text.slice(0, 70)}»`);
      }
    }
    if (it[key] !== undefined && it[key] !== text) console.log(`attenzione: ${key} in it.json è diverso dal testo del codice (${f.replace(ROOT, '')})`);
  }
}
// Le chiavi a nome (`home.newGame`) si scrivono in inglese: una il cui ultimo pezzo ricalca le prime parole del testo italiano è nata dall'italiano.
const strip = (s) => s.normalize('NFD').replace(/\p{M}/gu, '');
for (const [key, text] of Object.entries(it)) {
  if (key.startsWith('c.') || typeof text !== 'string') continue;
  const parts = key.split('.').pop().replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(' ');
  const words = (strip(text).match(/[A-Za-z0-9]+/g) ?? []).map((w) => w.toLowerCase());
  const n = parts.length;
  if (n >= 2 && words.length >= n && parts.every((w, i) => w === words[i] || w.replace(/[0-9]+$/, '') === words[i])) {
    bad++;
    console.log(`chiave in italiano: ${key}  «${text.slice(0, 50)}» (le chiavi a nome si scrivono in inglese)`);
  }
}
const jsonArg = process.argv.indexOf('--json');
if (jsonArg > 0) writeFileSync(process.argv[jsonArg + 1], JSON.stringify([...missing.keys()], null, 1));
console.log(bad ? `${bad} chiavi mancanti` : `ok: ${used.size} testi controllati`);
process.exit(bad ? 1 : 0);
