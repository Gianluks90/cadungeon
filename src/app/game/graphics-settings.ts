import { signal } from '@angular/core';

/** Quanto è nitido il canvas: `low` 1 pixel per pixel, `normal` al massimo 1,5, `high` quanto lo schermo (su Retina 2 o 3). */
export type GraphicsResolution = 'low' | 'normal' | 'high';

/** Le scelte di grafica: ognuna toglie lavoro a CPU, GPU e memoria. Valgono dalla prossima scena che si apre (la lingua e queste si cambiano dalla home). */
export interface GraphicsOptions {
  resolution: GraphicsResolution;
  /** Bordi smussati: costa GPU. */
  antialias: boolean;
  /** Le linee oblique fuori dai muri perimetrali. */
  hatch: boolean;
  /** Ragnatele, sassi e detriti sul pavimento. */
  scenery: boolean;
  /** Acqua che scorre e glifi che pulsano. */
  animations: boolean;
}

export type GraphicsPreset = 'low' | 'normal' | 'high';

export const GRAPHICS_PRESETS: Record<GraphicsPreset, GraphicsOptions> = {
  low: { resolution: 'low', antialias: false, hatch: false, scenery: false, animations: false },
  normal: { resolution: 'normal', antialias: true, hatch: true, scenery: true, animations: true },
  high: { resolution: 'high', antialias: true, hatch: true, scenery: true, animations: true },
};

/** Risoluzione massima della modalità `normal` (sugli schermi Retina i pixel da riempire sarebbero 4 volte di più). */
const NORMAL_MAX_RESOLUTION = 1.5;

const STORAGE_KEY = 'cad-graphics';

function load(): GraphicsOptions {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<GraphicsOptions> | null;
    if (raw && typeof raw === 'object') {
      const base = GRAPHICS_PRESETS.normal;
      return {
        resolution: raw.resolution === 'low' || raw.resolution === 'high' ? raw.resolution : 'normal',
        antialias: typeof raw.antialias === 'boolean' ? raw.antialias : base.antialias,
        hatch: typeof raw.hatch === 'boolean' ? raw.hatch : base.hatch,
        scenery: typeof raw.scenery === 'boolean' ? raw.scenery : base.scenery,
        animations: typeof raw.animations === 'boolean' ? raw.animations : base.animations,
      };
    }
  } catch {
    // localStorage non disponibile o dati rovinati: valgono le scelte di base
  }
  return { ...GRAPHICS_PRESETS.normal };
}

/** Le scelte di grafica di adesso. */
export const graphics = signal<GraphicsOptions>(load());

export function setGraphics(options: GraphicsOptions) {
  graphics.set({ ...options });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // niente salvataggio: la scelta vale fino alla chiusura della pagina
  }
}

/** Il preset che coincide con le scelte, o `custom` se sono state regolate a mano. */
export function presetOf(o: GraphicsOptions): GraphicsPreset | 'custom' {
  return (Object.keys(GRAPHICS_PRESETS) as GraphicsPreset[]).find((k) => JSON.stringify(GRAPHICS_PRESETS[k]) === JSON.stringify(o)) ?? 'custom';
}

/** La risoluzione da dare a Pixi. */
export function renderResolution(): number {
  const dpr = window.devicePixelRatio || 1;
  const r = graphics().resolution;
  return r === 'low' ? 1 : r === 'normal' ? Math.min(dpr, NORMAL_MAX_RESOLUTION) : dpr;
}

/** Meno movimento: lo chiede il sistema o lo sceglie l'utente spegnendo le animazioni. */
export function reducedMotion(): boolean {
  return (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) || !graphics().animations;
}
