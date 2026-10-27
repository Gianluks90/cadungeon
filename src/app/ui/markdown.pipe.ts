import { Pipe, PipeTransform } from '@angular/core';

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Il formato dentro una riga: grassetto, corsivo, barrato, codice e collegamenti http(s). Il testo è già "escapato": l'HTML scritto dall'autore non passa mai. */
function inline(text: string): string {
  const codes: string[] = [];
  let t = text.replace(/`([^`]+)`/g, (_, c: string) => `\u0000${codes.push(`<code>${c}</code>`) - 1}\u0000`);
  t = t
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a: string, b: string) => `<strong>${a ?? b}</strong>`)
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)|(^|[^_\w])_([^_\s][^_]*?)_(?![_\w])/g, (_, p1: string, a: string, p2: string, b: string) => `${p1 ?? p2}<em>${a ?? b}</em>`)
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codes[Number(i)]);
}

/**
 * Il markdown dei testi dell'avventura (introduzione, obiettivo), reso in HTML sicuro: titoli (#, ##, ###), elenchi puntati e numerati, citazioni (>), linee (---),
 * grassetto, corsivo, barrato, codice e collegamenti. Un a capo semplice resta un a capo (i testi scritti prima della formattazione vanno avanti a funzionare);
 * una riga vuota separa i paragrafi. Tutto ciò che non è markdown viene "escapato", quindi l'HTML scritto dall'autore si vede come testo. Si usa con `[innerHTML]`.
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(source: string | null | undefined): string {
    const lines = escapeHtml(source ?? '').replace(/\r\n?/g, '\n').split('\n');
    const out: string[] = [];
    let paragraph: string[] = [];
    let list: { tag: 'ul' | 'ol'; items: string[] } | null = null;
    let quote: string[] = [];
    const flush = () => {
      if (paragraph.length) out.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
      if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`);
      if (quote.length) out.push(`<blockquote>${quote.map(inline).join('<br>')}</blockquote>`);
      paragraph = [];
      list = null;
      quote = [];
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      let m: RegExpMatchArray | null;
      if (!line.trim()) flush();
      else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
        flush();
        out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
        flush();
        out.push('<hr>');
      } else if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
        if (!list || list.tag !== 'ul') { flush(); list = { tag: 'ul', items: [] }; }
        list.items.push(m[1]);
      } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        if (!list || list.tag !== 'ol') { flush(); list = { tag: 'ol', items: [] }; }
        list.items.push(m[1]);
      } else if ((m = line.match(/^&gt;\s?(.*)$/))) {
        if (!quote.length) flush();
        quote.push(m[1]);
      } else {
        if (list || quote.length) flush();
        paragraph.push(line.trim());
      }
    }
    flush();
    return out.join('');
  }
}
