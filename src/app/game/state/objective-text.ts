/** Il testo lungo dell'obiettivo: la descrizione dell'avventura, o il testo breve con la maiuscola e il punto. */
export function objectiveText(state: { objective?: { description?: string; text?: string } | null }): string {
  const o = state.objective;
  if (!o) return '';
  if (o.description) return o.description;
  const t = o.text?.trim() ?? '';
  return t ? t.charAt(0).toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? '' : '.') : '';
}
