import { translate } from '../../i18n/i18n.service';
import { TREASURE_KEYS } from '../heroes/party-setup';
import type { AdventureSetup } from '../map/map-data';

/** L'elenco (testi già tradotti) delle varianti di preparazione di un'avventura: una riga per ogni cosa che cambia. Vuoto se non cambia niente. */
export function setupBullets(setup: AdventureSetup | undefined, nameOf: (cardId: string) => string): string[] {
  if (!setup) return [];
  const out: string[] = [];
  const coins = setup.extraCoins ?? 0;
  if (coins > 0) out.push(translate('setupText.coinsMore', { n: coins }));
  else if (coins < 0) out.push(translate('setupText.coinsLess', { n: -coins }));
  if (setup.pregameTreasures?.length) out.push(translate('setupText.treasures', { tiers: setup.pregameTreasures.map((t) => translate(TREASURE_KEYS[t])).join(', ') }));
  if (setup.evilDeckRemove?.length) out.push(translate('setupText.deckRemove', { cards: cardList(setup.evilDeckRemove, nameOf) }));
  if (setup.evilStartInPlay?.length) out.push(translate('setupText.inPlay', { cards: cardList(setup.evilStartInPlay, nameOf) }));
  if (setup.evilStartHand !== undefined) out.push(translate(setup.evilStartHand === 0 ? 'setupText.handNone' : setup.evilStartHand === 1 ? 'setupText.handOne' : 'setupText.handMany', { n: setup.evilStartHand }));
  return out;
}

/** "Carta, Carta ×2": le copie ripetute si raggruppano. */
function cardList(ids: readonly string[], nameOf: (id: string) => string): string {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, n]) => (n > 1 ? `${nameOf(id)} ×${n}` : nameOf(id))).join(', ');
}

/**
 * Le regole speciali come le leggono i giocatori: il testo dell'autore e, sotto, "Inoltre" con l'elenco delle varianti di preparazione (markdown).
 * Senza testo dell'autore c'è solo l'elenco; senza niente, `undefined`.
 */
export function composeRules(rules: string | undefined, setup: AdventureSetup | undefined, nameOf: (cardId: string) => string): string | undefined {
  const text = rules?.trim() ?? '';
  const bullets = setupBullets(setup, nameOf);
  if (!bullets.length) return text || undefined;
  const list = bullets.map((b) => `- ${b}`).join('\n');
  return text ? `${text}\n\n${translate('setupText.also')}\n\n${list}` : list;
}
