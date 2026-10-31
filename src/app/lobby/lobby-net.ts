import Peer, { DataConnection } from 'peerjs';
import { signal } from '@angular/core';
import { StartingSkills } from '../game/heroes/hero-sheet';
import { Loadout, PartySetup, ShopData, SkillPoolCard, drawSkillCards, loadoutCost, validLoadout } from '../game/heroes/party-setup';

/** Un giocatore seduto al tavolo: gli eroi che ha scelto (uno, o due se è l'unico giocatore eroe) e se è pronto. `pid` è il suo id, che resta lo stesso se ricarica la pagina. */
export interface LobbyPlayer {
  pid: string;
  heroes: string[];
  /** Ciò che ogni suo eroe ha comprato nel negozio di prima della partita (per id dell'eroe). */
  loadouts: Record<string, Loadout>;
  /** Le carte abilità secondarie assegnate a ogni suo eroe (id del catalogo), pescate dall'host appena l'eroe è scelto. */
  skillCards: Record<string, string[]>;
  ready: boolean;
}

/** Ciò che l'host sa del gioco per controllare le scelte: gli eroi che esistono, le monete con cui parte ciascuno e il negozio. */
export interface LobbyWorld {
  heroIds: readonly string[];
  coins: (heroId: string) => number;
  shop: ShopData | null;
  /** Le carte abilità del catalogo e i punti di attributo di ogni eroe: servono a pescare le abilità secondarie. */
  skillPool: readonly SkillPoolCard[];
  heroSkills: (heroId: string) => StartingSkills;
}

/** Quanti eroi controlla ogni giocatore: con un solo giocatore eroe (più il Signore supremo, 2 persone) ne servono sempre 2; da 3 persone in poi ognuno ne ha uno. */
export const heroesPerPlayer = (heroPlayers: number) => (heroPlayers === 1 ? 2 : 1);

/** Tutto ciò che si vede nella sala d'attesa: lo decide l'host (il Signore supremo) e lo manda a tutti. */
export interface LobbyState {
  /** Quanti eroi servono (i posti per i giocatori, Signore supremo escluso). */
  heroes: number;
  /** L'avventura scelta dall'host (nome del file in `public/maps/`), se l'ha scelta. */
  map: string | null;
  players: LobbyPlayer[];
  started: boolean;
}

/** Cosa manda un giocatore all'host: sono intenzioni, l'host le valida (CLAUDE.md, "Architettura di rete"). */
type ToHost = { t: 'hello'; pid: string } | { t: 'pick'; hero: string } | { t: 'loadout'; hero: string; loadout: Loadout } | { t: 'ready'; ready: boolean };
type ToClient = { t: 'state'; state: LobbyState } | { t: 'full' };

/** Come sta la connessione, visto da chi la usa. */
export type NetStatus = 'connecting' | 'online' | 'taken' | 'offline' | 'notfound' | 'full';

const PREFIX = 'cadungeon-lobby-';
export const peerIdOf = (code: string) => PREFIX + code;
const RETRY_MS = 2500;

/** Controlla che il codice sia libero sulla rete (nessun altro host lo sta usando) provando a prenderlo e lasciandolo subito. */
export function claimCode(code: string): Promise<'ok' | 'taken' | 'offline'> {
  return new Promise((resolve) => {
    let done = false;
    const peer = new Peer(peerIdOf(code));
    const end = (r: 'ok' | 'taken' | 'offline') => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      peer.destroy();
      resolve(r);
    };
    const timer = setTimeout(() => end('offline'), 8000);
    peer.on('open', () => end('ok'));
    peer.on('error', (e) => end(e.type === 'unavailable-id' ? 'taken' : 'offline'));
  });
}

/** L'id di chi gioca: resta lo stesso se ricarica la pagina (così ritrova il suo posto), ma ogni scheda del browser ha il suo. */
export function playerId(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  try {
    let id = sessionStorage.getItem('cad-player-id');
    if (!id) sessionStorage.setItem('cad-player-id', (id = random()));
    return id;
  } catch {
    return random();
  }
}

/** Il lato dell'host: ha lo stato autoritativo della sala, valida le scelte dei giocatori e rimanda lo stato a tutti. */
export class LobbyHost {
  readonly state = signal<LobbyState>({ heroes: 0, map: null, players: [], started: false });
  readonly status = signal<NetStatus>('connecting');
  private peer?: Peer;
  private readonly conns = new Map<string, DataConnection>();
  private attempts = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  /** `heroes`: quanti posti; `validHeroes`: gli id degli eroi che si possono scegliere. */
  constructor(private readonly code: string, heroes: number, private readonly world: () => LobbyWorld, map: string | null = null) {
    this.state.set({ heroes, map, players: [], started: false });
    this.open();
  }

  private open() {
    const peer = new Peer(peerIdOf(this.code));
    this.peer = peer;
    peer.on('open', () => this.status.set('online'));
    peer.on('connection', (conn) => this.accept(conn));
    peer.on('error', (e) => {
      if (this.destroyed) return;
      // Subito dopo averlo controllato il codice può risultare ancora occupato per un attimo: si riprova qualche volta prima di arrendersi.
      if (e.type === 'unavailable-id' && this.attempts++ < 4) {
        peer.destroy();
        this.timer = setTimeout(() => this.open(), 1200);
        return;
      }
      this.status.set(e.type === 'unavailable-id' ? 'taken' : 'offline');
    });
    peer.on('disconnected', () => {
      if (!this.destroyed && this.status() === 'online') {
        this.status.set('connecting');
        peer.reconnect();
      }
    });
  }

  private accept(conn: DataConnection) {
    let pid: string | null = null;
    conn.on('data', (raw) => {
      const msg = raw as ToHost;
      if (msg?.t === 'hello' && typeof msg.pid === 'string' && !pid) {
        pid = msg.pid;
        this.join(pid, conn);
      } else if (pid && msg?.t === 'pick' && typeof msg.hero === 'string') this.pick(pid, msg.hero);
      else if (pid && msg?.t === 'loadout') this.setLoadout(pid, msg.hero, msg.loadout);
      else if (pid && msg?.t === 'ready') this.setReady(pid, !!msg.ready);
    });
    const left = () => {
      if (!pid || this.conns.get(pid) !== conn) return;
      this.conns.delete(pid);
      // Chi esce libera il suo posto (e il suo eroe), a meno che la partita sia già cominciata.
      if (!this.state().started) this.update((s) => ({ ...s, players: s.players.filter((p) => p.pid !== pid) }));
    };
    conn.on('close', left);
    conn.on('error', left);
  }

  private join(pid: string, conn: DataConnection) {
    const known = this.state().players.some((p) => p.pid === pid);
    if (!known && this.state().players.length >= this.state().heroes) {
      conn.send({ t: 'full' } satisfies ToClient);
      setTimeout(() => conn.close(), 300);
      return;
    }
    this.conns.get(pid)?.close(); // una scheda più vecchia dello stesso giocatore
    this.conns.set(pid, conn);
    this.update((s) => (known ? s : { ...s, players: [...s.players, { pid, heroes: [], loadouts: {}, skillCards: {}, ready: false }] }));
  }

  /** Tocca un eroe: se è già suo lo toglie; altrimenti lo prende, se è libero (con più eroi da scegliere, quando i posti sono pieni il più vecchio lascia il posto al nuovo). */
  private pick(pid: string, hero: string) {
    const s = this.state();
    if (s.started || !this.world().heroIds.includes(hero)) return;
    const me = s.players.find((p) => p.pid === pid);
    if (!me) return;
    // Un eroe già preso da un altro: la scelta non vale e il giocatore riceve lo stato com'è (così vede chi l'ha preso).
    if (!me.heroes.includes(hero) && s.players.some((p) => p.heroes.includes(hero))) return this.send(pid);
    const max = heroesPerPlayer(s.heroes);
    const next = me.heroes.includes(hero) ? me.heroes.filter((h) => h !== hero) : [...me.heroes, hero].slice(-max);
    // Le carte abilità di un eroe appena scelto si pescano subito (senza quelle già date agli altri eroi); quelle di chi esce tornano nel mazzo.
    const w = this.world();
    const taken = new Set(s.players.flatMap((p) => Object.values(p.skillCards).flat()));
    const skillCards = Object.fromEntries(next.map((h) => [h, me.skillCards[h] ?? (() => { const c = drawSkillCards(w.heroSkills(h), w.skillPool, taken); c.forEach((id) => taken.add(id)); return c; })()]));
    this.update((st) => ({ ...st, players: st.players.map((p) => (p.pid === pid ? { ...p, heroes: next, skillCards, loadouts: Object.fromEntries(Object.entries(p.loadouts).filter(([h]) => next.includes(h))), ready: false } : p)) }));
  }

  /** Un giocatore cambia ciò che ha comprato per uno dei suoi eroi: vale solo se è valido (monete, posto, copie ancora in vendita, comuni a tutta la squadra). */
  private setLoadout(pid: string, hero: string, loadout: Loadout) {
    const s = this.state();
    const w = this.world();
    const me = s.players.find((p) => p.pid === pid);
    if (s.started || !me || !me.heroes.includes(hero) || !w.shop) return;
    const others = s.players.flatMap((p) => Object.entries(p.loadouts).filter(([h]) => h !== hero).map(([, l]) => l));
    if (!validLoadout(loadout, w.coins(hero), w.shop, others)) return this.send(pid);
    const clean: Loadout = { items: [...loadout.items], potions: [...loadout.potions] };
    this.update((st) => ({ ...st, players: st.players.map((p) => (p.pid === pid ? { ...p, loadouts: { ...p.loadouts, [hero]: clean }, ready: false } : p)) }));
  }

  private setReady(pid: string, ready: boolean) {
    const s = this.state();
    if (s.started) return;
    this.update((st) => ({ ...st, players: st.players.map((p) => (p.pid === pid ? { ...p, ready: ready && p.heroes.length === heroesPerPlayer(s.heroes) } : p)) }));
  }

  /** L'host sceglie l'avventura. */
  setMap(map: string | null) {
    this.update((s) => ({ ...s, map }));
  }

  /** Tutti i posti sono pieni, ognuno con il suo eroe e pronto, e l'avventura è scelta. */
  readonly canStart = () => {
    const s = this.state();
    return !s.started && !!s.map && s.players.length === s.heroes && s.players.every((p) => p.heroes.length === heroesPerPlayer(s.heroes) && p.ready);
  };

  /** Gli acquisti di tutti gli eroi, con le monete che restano a ciascuno: passano alla partita. */
  setup(): PartySetup {
    const w = this.world();
    const out: PartySetup = {};
    for (const p of this.state().players) {
      for (const hero of p.heroes) {
        const l = p.loadouts[hero] ?? { items: [], potions: [] };
        out[hero] = { ...l, coins: w.coins(hero) - (w.shop ? loadoutCost(l, w.shop) : 0), skillCards: p.skillCards[hero] ?? [] };
      }
    }
    return out;
  }

  /** Chiude la sala: da qui la partita comincia. Restituisce gli eroi nell'ordine dei posti. */
  start(): string[] | null {
    if (!this.canStart()) return null;
    this.update((s) => ({ ...s, started: true }));
    return this.state().players.flatMap((p) => p.heroes);
  }

  private update(f: (s: LobbyState) => LobbyState) {
    this.state.update(f);
    for (const pid of this.conns.keys()) this.send(pid);
  }

  private send(pid: string) {
    const c = this.conns.get(pid);
    if (c?.open) c.send({ t: 'state', state: this.state() } satisfies ToClient);
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.timer);
    this.peer?.destroy();
  }
}

/** Il lato di chi gioca un eroe: si collega all'host con il codice, manda le sue scelte e mostra lo stato che riceve. Se la connessione cade, riprova da sola. */
export class LobbyClient {
  readonly state = signal<LobbyState | null>(null);
  readonly status = signal<NetStatus>('connecting');
  readonly pid = playerId();
  private peer?: Peer;
  private conn?: DataConnection;
  private timer?: ReturnType<typeof setTimeout>;
  private destroyed = false;

  constructor(private readonly code: string) {
    this.connect();
  }

  private connect() {
    if (this.destroyed) return;
    this.peer?.destroy();
    const peer = new Peer();
    this.peer = peer;
    peer.on('open', () => {
      const conn = peer.connect(peerIdOf(this.code), { reliable: true });
      this.conn = conn;
      conn.on('open', () => conn.send({ t: 'hello', pid: this.pid } satisfies ToHost));
      conn.on('data', (raw) => {
        const msg = raw as ToClient;
        if (msg?.t === 'state') {
          this.state.set(msg.state);
          this.status.set('online');
        } else if (msg?.t === 'full') this.status.set('full');
      });
      conn.on('close', () => this.lost('offline'));
    });
    peer.on('error', (e) => this.lost(e.type === 'peer-unavailable' ? 'notfound' : 'offline'));
  }

  private lost(status: NetStatus) {
    if (this.destroyed || this.status() === 'full') return;
    this.status.set(status);
    this.state.set(status === 'notfound' ? null : this.state());
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), RETRY_MS);
  }

  /** Tocca un eroe: lo prende o, se è già suo, lo lascia. */
  pick(hero: string) {
    this.send({ t: 'pick', hero });
  }

  /** Cambia gli acquisti di uno dei miei eroi. */
  setLoadout(hero: string, loadout: Loadout) {
    this.send({ t: 'loadout', hero, loadout });
  }

  setReady(ready: boolean) {
    this.send({ t: 'ready', ready });
  }

  private send(msg: ToHost) {
    if (this.conn?.open) this.conn.send(msg);
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.timer);
    this.peer?.destroy();
  }
}
