// Token di stile della scena: colori e opacità per RUOLO, e la scala degli spessori di linea.
// Regola: un colore = un significato. Un tema è solo una tabella ruolo -> valore: per aggiungerne uno basta
// una nuova tabella dello stesso tipo. I valori si leggono sempre da `theme` al momento di disegnare (mai
// copiati in costanti), così `setTheme` può cambiarli a runtime.
// Le misure della geometria (passi dei tratteggi, raggi, margini...) restano in constants.ts.

/** Colori per ruolo. */
export interface ThemeColors {
  /** Sfondo della scena e dei puntini che lo punteggiano. */
  background: number;
  dots: number;
  /** Pavimento dei tile; la variante calda è il tile che si sta per agganciare (strumento di sviluppo). */
  floor: number;
  floorHighlight: number;
  /** Linea primaria: le linee chiare dei muri; `wallGap` è la striscia scura in mezzo. */
  linePrimary: number;
  wallGap: number;
  /** Linea secondaria: la griglia delle celle; `lineDetail` sono le crepe e i dettagli del pavimento. */
  lineSecondary: number;
  lineDetail: number;
  /**
   * Accenti caldi: ciò che è "vivo". Un ruolo per significato, anche se oggi hanno lo stesso valore:
   * l'eroe attivo (anello), l'area di movimento (contorno), la selezione (porta già presente nell'anteprima),
   * gli avvisi (testo) e le uscite libere dello strumento di sviluppo. `accentUiSoft`: caselle del percorso.
   */
  accentActive: number;
  accentReach: number;
  accentSelect: number;
  accentNotice: number;
  accentDev: number;
  accentUiSoft: number;
  /** Accento porte: solo le porte, perché si possono usare. `doorKey`: l'icona della chiave su una porta a chiave. */
  accentDoor: number;
  doorKey: number;
  /** Le tre chiavi runiche, e le porte che aprono: un colore per ciascuna. Solo per questo significato. */
  rune: { red: number; blue: number; green: number };
  /** Pericolo: ciò che è ostile (anello dei mostri). `invalid`: anteprima di un piazzamento non valido. */
  danger: number;
  invalid: number;
  /** Esito positivo, solo nello strumento di sviluppo (uscita che si collega a un'apertura). */
  positive: number;
  /** Pedine: fondo, segnaposto dell'immagine, anello degli eroi non attivi. */
  token: { fill: number; portrait: number; idle: number };
  /** Acqua: contorno e righe ondulate. */
  water: { line: number; texture: number };
  /** Fossa: bordo, linee di profondità, e dove finisce il gradiente (il fondo). Il gradiente parte da `floor`. */
  pit: { line: number; ray: number; depth: number };
  /** Pietra: riempimento del masso, contorno e detriti. */
  stone: { fill: number; line: number };
  /** Interfaccia in HTML: testo, testo secondario, bordo dei pulsanti. */
  ui: { text: number; textMuted: number; border: number };
}

/** Opacità per uso. */
export interface ThemeAlpha {
  dots: number;
  grid: number;
  crack: number;
  exitMarker: number;
  /** Tile che segue il puntatore senza aggancio (strumento di sviluppo). */
  ghost: number;
  reach: number;
  pathCell: number;
  doorLine: number;
  doorHatch: number;
  doorArc: number;
  doorPreview: number;
  /** Icona (chiave o runa) sulle porte bloccate. */
  doorIcon: number;
  pitLine: number;
  pitRay: number;
  waterLine: number;
  waterTexture: number;
  stoneDetail: number;
  stoneDebris: number;
  /** Velo sulle caselle non ancora esplorate (sul colore dello sfondo): quanto le spegne. */
  unexplored: number;
  /** Ritratto di un eroe che non è quello attivo. */
  portraitIdle: number;
  /** Anteprima di un ostacolo: valido, non valido. */
  previewValid: number;
  previewInvalid: number;
}

export interface Theme {
  /** Una bozza non è ancora rifinita: i valori sono proposte. */
  draft: boolean;
  color: ThemeColors;
  alpha: ThemeAlpha;
}

/**
 * Scala degli spessori di linea, in pixel. `hairline` è sempre 1 pixel a schermo a qualsiasi zoom (pixelLine),
 * come la griglia; gli altri sono in pixel del mondo e crescono con lo zoom. Non cambia da un tema all'altro.
 */
export const LINE = {
  hairline: 1,
  pebble: 1.2,
  thin: 1.5,
  medium: 2,
  strong: 3,
} as const;

/** Il tema attuale, come è oggi: nero caldo, grigi neutri, ambra per ciò che è vivo. */
const dark: Theme = {
  draft: false,
  color: {
    background: 0x0c0a08,
    dots: 0x6b635a,
    floor: 0x151515,
    floorHighlight: 0x2a2318,
    linePrimary: 0x646464,
    wallGap: 0x101010,
    lineSecondary: 0x585858,
    lineDetail: 0x484848,
    accentActive: 0xe0a040,
    accentReach: 0xe0a040,
    accentSelect: 0xe0a040,
    accentNotice: 0xe0a040,
    accentDev: 0xe0a040,
    accentUiSoft: 0xf0d060,
    accentDoor: 0x6b4a33,
    doorKey: 0xb08d5f,
    rune: { red: 0xc4574d, blue: 0x4d8fd0, green: 0x5fae6a },
    danger: 0x9a4a46,
    invalid: 0xff7070,
    positive: 0x5fbf6a,
    token: { fill: 0x1d1c1a, portrait: 0x3c3a37, idle: 0x77736c },
    water: { line: 0x4a8fb0, texture: 0x4a8fb0 },
    pit: { line: 0x6a6a6a, ray: 0x8a8a8a, depth: 0x000000 },
    stone: { fill: 0x262626, line: 0x7a7a7a },
    ui: { text: 0xd8cfc4, textMuted: 0x8a8178, border: 0x3a352f },
  },
  alpha: {
    dots: 0.55,
    grid: 0.55,
    crack: 0.75,
    exitMarker: 0.9,
    ghost: 0.35,
    reach: 0.55,
    pathCell: 0.15,
    doorLine: 0.8,
    doorHatch: 0.4,
    doorArc: 0.35,
    doorPreview: 0.9,
    doorIcon: 0.95,
    pitLine: 0.5,
    pitRay: 0.5,
    waterLine: 0.85,
    waterTexture: 0.1,
    stoneDetail: 0.45,
    stoneDebris: 0.55,
    unexplored: 0.55,
    portraitIdle: 0.7,
    previewValid: 0.6,
    previewInvalid: 0.3,
  },
};

/**
 * BOZZA: cianotipia. Fondo blu, linee bianche a opacità diverse (primaria piena, secondarie più tenui), fosse
 * che sfumano verso un blu scuro, accento UI giallo pallido, un solo colore caldo per il pericolo.
 * Tutti i valori sono proposte da verificare a schermo (vedi docs/style-guide.md).
 */
const blueprint: Theme = {
  draft: true,
  color: {
    background: 0x0a2a4d,
    dots: 0xbcd6f5,
    floor: 0x0f3b6b,
    floorHighlight: 0x1a5694,
    linePrimary: 0xf2f6ff,
    wallGap: 0x0a2f57,
    lineSecondary: 0xdbe9ff,
    lineDetail: 0xdbe9ff,
    accentActive: 0xffe9a0,
    accentReach: 0xffe9a0,
    accentSelect: 0xffe9a0,
    accentNotice: 0xffe9a0,
    accentDev: 0xffe9a0,
    accentUiSoft: 0xfff3c4,
    accentDoor: 0xc9b48a,
    doorKey: 0xe6d6b0,
    rune: { red: 0xff7a6b, blue: 0x7fb8ff, green: 0x8fe0a0 },
    danger: 0xff6b4a,
    invalid: 0xff6b4a,
    positive: 0x9fe3ff,
    token: { fill: 0x0a2a4d, portrait: 0x1a4a7e, idle: 0xdbe9ff },
    water: { line: 0x9fd8ff, texture: 0x9fd8ff },
    pit: { line: 0xdbe9ff, ray: 0xdbe9ff, depth: 0x06213f },
    stone: { fill: 0x0f3b6b, line: 0xf2f6ff },
    ui: { text: 0xf2f6ff, textMuted: 0xbcd6f5, border: 0x3a6a9e },
  },
  alpha: {
    dots: 0.3,
    grid: 0.3,
    crack: 0.4,
    exitMarker: 0.9,
    ghost: 0.35,
    reach: 0.7,
    pathCell: 0.18,
    doorLine: 0.9,
    doorHatch: 0.5,
    doorArc: 0.4,
    doorPreview: 0.9,
    doorIcon: 0.95,
    pitLine: 0.6,
    pitRay: 0.5,
    waterLine: 0.85,
    waterTexture: 0.14,
    stoneDetail: 0.5,
    stoneDebris: 0.6,
    unexplored: 0.55,
    portraitIdle: 0.7,
    previewValid: 0.6,
    previewInvalid: 0.3,
  },
};

export const THEMES = { dark, blueprint } as const;
export type ThemeName = keyof typeof THEMES;

/** Il tema in uso. Si legge al momento di disegnare; `setTheme` ne sostituisce i valori. */
export const theme: Theme = JSON.parse(JSON.stringify(dark));
let currentName: ThemeName = 'dark';
const listeners = new Set<() => void>();

/** Copia i valori di `src` dentro `dst` (stessa forma), senza sostituire gli oggetti: chi li ha in mano li vede cambiare. */
function copyInto(dst: any, src: any) {
  for (const key of Object.keys(src)) {
    if (typeof src[key] === 'object') copyInto(dst[key], src[key]);
    else dst[key] = src[key];
  }
}

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** I colori dell'interfaccia in HTML passano da variabili CSS, così cambiano insieme al tema. */
function applyCssVariables() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  const c = theme.color;
  root.setProperty('--cad-bg', css(c.background));
  root.setProperty('--cad-ui-text', css(c.ui.text));
  root.setProperty('--cad-ui-text-muted', css(c.ui.textMuted));
  root.setProperty('--cad-ui-border', css(c.ui.border));
  root.setProperty('--cad-notice', css(c.accentNotice));
}

/** Cambia il tema a runtime e avvisa chi ha chiesto di ridisegnarsi (`onThemeChange`). Nessuna UI per ora. */
export function setTheme(name: ThemeName) {
  if (!(name in THEMES)) return;
  currentName = name;
  copyInto(theme, THEMES[name]);
  applyCssVariables();
  for (const cb of listeners) cb();
}

export const themeName = () => currentName;

/** Chiede di essere chiamato quando il tema cambia. Restituisce la funzione per smettere. */
export function onThemeChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

applyCssVariables();
