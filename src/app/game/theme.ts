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
  /** Scrigni: un colore per tipo (rame, argento, oro), perché il tipo è un'informazione di gioco. Contorno, coperchio e fermaglio. */
  chest: { copper: number; silver: number; gold: number };
  /** Oggetti a terra: il vetro della pozione e il suo liquido (lilla la curativa, arancione quella di vitalità), e le monete (oro). La chiave runica a terra usa i colori `rune`. */
  potion: { glass: number; heal: number; vital: number };
  coin: number;
  /** Il contorno di una moneta, più scuro dell'oro: distingue le monete che si sovrappongono nel mucchio. */
  coinEdge: number;
  /** I colori dei dadi delle armi. */
  die: { red: number; green: number; blue: number; yellow: number; white: number; black: number };
  /** Effetti degli attacchi: la linea di un attacco a distanza (azzurro) o magico (viola), il proiettile, il numero dei danni e la scritta Mancato. */
  fx: { ranged: number; magic: number; projectile: number; damage: number; miss: number; dust: number };
  /** L'indicatore del nord: la freccia e la N, in cremisi. Solo per questo significato. */
  compass: number;
  /** Glifo acceso (bianco). Da spento ha il colore delle crepe (`lineDetail`), perché è inciso nel pavimento. */
  glyphOn: number;
  /** Le torce: gli strati della fiamma dal bordo al centro (rosso-arancio, arancio, giallo, quasi bianco) e l'alone di luce (additivo, caldo). */
  torch: { outer: number; flame: number; core: number; hot: number; glow: number };
  /** Pericolo: ciò che è ostile (anello dei mostri). `invalid`: anteprima di un piazzamento non valido. */
  danger: number;
  invalid: number;
  /** Segnaposto di un elemento che il motore non riconosce (editor): arancione, con un badge di avviso. */
  missing: number;
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
  /** Interfaccia in HTML: testo, testo secondario, bordo dei pulsanti, e il fondo nero dei contenitori (pillole e barra degli eroi). */
  ui: { text: number; textMuted: number; border: number; panel: number; panelBorder: number };
  /** Le scorte dell'eroe nella barra: movimento e fatica (armatura e pozioni sono bianche, come il testo). */
  stat: { movement: number; fatigue: number };
  /** I segnalini degli stati sulla pedina: fiamma, rete, stordimento, veleno. */
  status: { burn: number; web: number; stun: number; poison: number };
  /** Salute: i cuori carichi. Un giocatore la riconosce subito; i quarti persi e i cuori vuoti usano `ui.border` con `heartEmpty`. */
  health: number;
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
  /** Il fondo dell'acqua: lo stesso colore del bordo, quasi trasparente. */
  waterFill: number;
  /** Righe dell'acqua: opacità minima e massima (le righe pari e dispari si alternano fra le due). */
  waterTexture: number;
  waterTextureMax: number;
  stoneDetail: number;
  stoneDebris: number;
  /** Scale (elemento architettonico: usano i colori del dungeon, `linePrimary` e `lineSecondary`): il filo tratteggiato che unisce i due capi. */
  stairsLink: number;
  /** Scrigno: le linee del coperchio e l'interno (bordo del fondo e linee degli angoli). */
  chestLid: number;
  chestInside: number;
  /** Glifo acceso: il minimo e il massimo della pulsazione e l'alone attorno ai tratti. */
  glyphOnMin: number;
  glyphOnMax: number;
  glyphGlow: number;
  /** Le linee delle ragnatele. */
  scenery: number;
  /** L'opacità dell'alone di una torcia (al centro). */
  torchGlow: number;
  /** Velo sulle caselle non ancora esplorate (sul colore dello sfondo): quanto le spegne. */
  unexplored: number;
  /** Tratteggio diagonale sulle caselle non esplorate. */
  fogHatch: number;
  /** Ritratto di un eroe che non è quello attivo. */
  portraitIdle: number;
  /** Quarti di cuore persi: il cuore vuoto, appena visibile. */
  heartEmpty: number;
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
    chest: { copper: 0xb8683a, silver: 0xb8bcc2, gold: 0xd9b23a },
    potion: { glass: 0x9a9a9a, heal: 0xb48ad9, vital: 0xf0a030 },
    coin: 0xd9b23a,
    coinEdge: 0x6b6048,
    die: { red: 0xd2504a, green: 0x6cc070, blue: 0x4d8fd0, yellow: 0xe8c547, white: 0xf0f0f0, black: 0x6f6f7c }, // il nero è il dado potere: nell'interfaccia un grigio visibile sullo scuro
    fx: { ranged: 0x4d8fd0, magic: 0xa98bf0, projectile: 0xfff1b8, damage: 0xe0524f, miss: 0xd8cfc4, dust: 0x9a9a9a },
    compass: 0xdc143c,
    glyphOn: 0xf4f4f4,
    torch: { outer: 0xd0481c, flame: 0xf0a030, core: 0xffd27a, hot: 0xfff1cf, glow: 0xe08a30 },
    danger: 0x9a4a46,
    invalid: 0xff7070,
    missing: 0xf0a030,
    positive: 0x5fbf6a,
    token: { fill: 0x1d1c1a, portrait: 0x3c3a37, idle: 0x77736c },
    water: { line: 0x4a8fb0, texture: 0x4a8fb0 },
    pit: { line: 0x6a6a6a, ray: 0x8a8a8a, depth: 0x000000 },
    stone: { fill: 0x262626, line: 0x7a7a7a },
    ui: { text: 0xd8cfc4, textMuted: 0x8a8178, border: 0x3a352f, panel: 0x000000, panelBorder: 0x5a554d },
    stat: { movement: 0x6cc070, fatigue: 0xf0a030 },
    status: { burn: 0xff5a36, web: 0xcfd4de, stun: 0x8f9bff, poison: 0x7ed957 },
    health: 0xd2504a,
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
    waterFill: 0.07,
    waterTexture: 0.1,
    waterTextureMax: 0.15,
    stoneDetail: 0.45,
    stoneDebris: 0.55,
    stairsLink: 0.95,
    chestLid: 0.55,
    chestInside: 0.5,
    glyphOnMin: 0.55,
    glyphOnMax: 1,
    glyphGlow: 0.22,
    torchGlow: 0.34,
    scenery: 0.6,
    unexplored: 0.55,
    fogHatch: 0.5,
    portraitIdle: 0.7,
    heartEmpty: 0.45,
    previewValid: 0.6,
    previewInvalid: 0.3,
  },
};

export const THEMES = { dark } as const;
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

/**
 * Ruoli che hanno un token in src/styles/tokens.css: il CSS è la fonte, qui si leggono al momento di disegnare.
 * I ruoli che non compaiono qui (porte, scrigni, pozioni, rune...) restano nelle tabelle dei temi.
 */
const TOKEN_ROLES: [path: string, cssVar: string][] = [
  ['background', '--c-bg'],
  ['dots', '--c-dot'],
  ['floor', '--c-tile'],
  ['linePrimary', '--c-wall'],
  ['lineSecondary', '--c-line'],
  ['lineDetail', '--c-line'],
  ['accentActive', '--c-interact'],
  ['accentReach', '--c-interact'],
  ['accentSelect', '--c-interact'],
  ['accentNotice', '--c-interact'],
  ['accentDev', '--c-interact'],
  ['accentUiSoft', '--c-interact'],
  ['invalid', '--c-danger'],
  ['missing', '--c-stamina'],
  ['water.line', '--c-water'],
  ['water.texture', '--c-water'],
  ['health', '--c-life'],
  ['danger', '--c-faction-overlord'],
  ['token.idle', '--c-faction-ally'],
  ['coin', '--c-loot'],
  ['doorKey', '--c-loot'],
  ['potion.heal', '--c-life'],
  ['potion.vital', '--c-stamina'],
  ['die.red', '--c-die-melee'],
  ['die.green', '--c-die-ranged'],
  ['stat.movement', '--c-speed'],
  ['stat.fatigue', '--c-stamina'],
  ['status.burn', '--c-burn'],
  ['status.web', '--c-web'],
  ['status.stun', '--c-stun'],
  ['status.poison', '--c-poison'],
  ['ui.text', '--c-text'],
  ['ui.textMuted', '--c-text-dim'],
  ['ui.border', '--c-line'],
  ['ui.panel', '--c-surface'],
  ['ui.panelBorder', '--c-line-strong'],
];

/** Legge i token dal CSS (con `data-theme` già applicato) dentro `theme.color`. Un valore non esadecimale si ignora. */
export function readTokens() {
  if (typeof document === 'undefined') return;
  const style = getComputedStyle(document.documentElement);
  for (const [path, cssVar] of TOKEN_ROLES) {
    const m = /^#([0-9a-f]{6})$/i.exec(style.getPropertyValue(cssVar).trim());
    if (!m) continue;
    const keys = path.split('.');
    const leaf = keys.pop()!;
    const target = keys.reduce((o: any, k) => o[k], theme.color);
    target[leaf] = parseInt(m[1], 16);
  }
}

/** Le variabili `--cad-*` restano solo per i ruoli senza token in tokens.css (gli altri colori dell'interfaccia sono `--c-*`). */
function applyCssVariables() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  const c = theme.color;
  root.setProperty('--cad-coin', css(c.coin));
  root.setProperty('--cad-coin-edge', css(c.coinEdge));
  for (const [name, value] of Object.entries(c.die)) root.setProperty(`--cad-die-${name}`, css(value));
  root.setProperty('--cad-compass', css(c.compass));
  root.setProperty('--cad-potion-heal', css(c.potion.heal));
  root.setProperty('--cad-potion-vital', css(c.potion.vital));
  root.setProperty('--cad-rune-red', css(c.rune.red));
  root.setProperty('--cad-rune-blue', css(c.rune.blue));
  root.setProperty('--cad-rune-green', css(c.rune.green));
  // Colori della mappa, (un tempo servivano alla Legenda, tolta).
  root.setProperty('--cad-floor', css(c.floor));
  root.setProperty('--cad-wall', css(c.linePrimary));
  root.setProperty('--cad-wall-gap', css(c.wallGap));
  root.setProperty('--cad-grid', css(c.lineSecondary));
  root.setProperty('--cad-crack', css(c.lineDetail));
  root.setProperty('--cad-door', css(c.accentDoor));
  root.setProperty('--cad-water', css(c.water.line));
  root.setProperty('--cad-stone-fill', css(c.stone.fill));
  root.setProperty('--cad-stone-line', css(c.stone.line));
  root.setProperty('--cad-pit-line', css(c.pit.line));
  root.setProperty('--cad-pit-ray', css(c.pit.ray));
  root.setProperty('--cad-glyph-on', css(c.glyphOn));
  root.setProperty('--cad-torch-outer', css(c.torch.outer));
  root.setProperty('--cad-torch-flame', css(c.torch.flame));
  root.setProperty('--cad-torch-core', css(c.torch.core));
  root.setProperty('--cad-torch-hot', css(c.torch.hot));
  root.setProperty('--cad-torch-glow', css(c.torch.glow));
  for (const [tier, value] of Object.entries(c.chest)) root.setProperty(`--cad-chest-${tier}`, css(value));
  root.setProperty('--cad-heart-empty-alpha', String(theme.alpha.heartEmpty));
}

/** Cambia il tema a runtime e avvisa chi ha chiesto di ridisegnarsi (`onThemeChange`). */
export function setTheme(name: ThemeName) {
  if (!(name in THEMES)) return;
  currentName = name;
  copyInto(theme, THEMES[name]);
  readTokens();
  applyCssVariables();
  for (const cb of listeners) cb();
}

export const themeName = () => currentName;

/** Chiede di essere chiamato quando il tema cambia. Restituisce la funzione per smettere. */
export function onThemeChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

readTokens();
applyCssVariables();
