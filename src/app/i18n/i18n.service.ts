import { Injectable, signal } from '@angular/core';
import en from './en.json';
import it from './it.json';

/** Le lingue dell'interfaccia: il codice e il nome nella propria lingua (si legge uguale in tutte). Per aggiungerne una: un file `<codice>.json` con le stesse chiavi e una voce qui. */
export const LANGUAGES = [
  { code: 'it', label: 'Italiano' },
  { code: 'en', label: 'English' },
] as const;

export type Lang = (typeof LANGUAGES)[number]['code'];

/** Tutte le chiavi dei testi: quelle di `it.json`, la lingua di partenza. */
export type MessageKey = keyof typeof it;
type Messages = Record<MessageKey, string>;

/** Un file con una chiave in meno di `it.json` non compila: i testi stanno sempre in tutte le lingue. */
const MESSAGES: Record<Lang, Messages> = { it, en };

const STORAGE_KEY = 'cad-lang';

/** La lingua all'avvio: l'ultima scelta, altrimenti quella del browser se c'è, altrimenti l'italiano. */
function initialLang(): Lang {
  const known = (c: string | null | undefined): Lang | null => LANGUAGES.find((l) => l.code === c?.slice(0, 2).toLowerCase())?.code ?? null;
  try {
    const stored = known(localStorage.getItem(STORAGE_KEY));
    if (stored) return stored;
  } catch {
    // niente storage: si parte dalla lingua del browser
  }
  return known(typeof navigator === 'undefined' ? null : navigator.language) ?? 'it';
}

/** La lingua di adesso: un segnale unico, letto dal servizio, dal pipe e da `translate`. */
const currentLang = signal<Lang>(initialLang());

/**
 * Il testo nella lingua di adesso (se manca, quello italiano) con i segnaposto `{nome}` sostituiti. Serve al codice che non ha l'iniezione (regole, validatore, funzioni pure): legge il
 * segnale della lingua, quindi dentro un template o un `computed` si aggiorna da solo.
 */
export function translate(key: MessageKey, params?: Record<string, string | number>): string {
  const text = MESSAGES[currentLang()][key] ?? MESSAGES.it[key] ?? key;
  return params ? text.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m)) : text;
}

/** Un testo cercato per chiave scritta a mano (chiavi calcolate, come quelle dei cataloghi): nella lingua di adesso, o in italiano, o `undefined` se la chiave non esiste. Con `lang` si sceglie la lingua. */
export function translateRaw(key: string, lang: Lang = currentLang()): string | undefined {
  return (MESSAGES[lang] as Record<string, string>)[key] ?? (MESSAGES.it as Record<string, string>)[key];
}

/** Tutti i testi della lingua di adesso le cui chiavi iniziano con `prefix`, come coppie chiave e testo. */
export function translateRawAll(prefix: string): [string, string][] {
  return Object.entries(MESSAGES[currentLang()] as Record<string, string>).filter(([k]) => k.startsWith(prefix));
}

/**
 * La lingua dell'interfaccia e la traduzione dei testi (`t`, o il pipe `t` nei template). Cambiando lingua i testi si aggiornano subito, senza ricaricare la pagina.
 * I testi sono in `it.json` e `en.json` (chiavi piatte a punti, `home.newGame`); `{nome}` nel testo è un segnaposto che si riempie con i parametri.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly languages = LANGUAGES;
  readonly lang = currentLang.asReadonly();

  constructor() {
    document.documentElement.lang = currentLang();
  }

  setLang(lang: Lang) {
    currentLang.set(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // la scelta vale finché la pagina resta aperta
    }
  }

  /** Come `translate`, per chi ha il servizio. */
  t(key: MessageKey, params?: Record<string, string | number>): string {
    return translate(key, params);
  }
}
