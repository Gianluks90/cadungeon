# Piano: nomi in inglese nel codice e nelle chiavi di traduzione

**Regola** (anche in `CLAUDE.md`): variabili, funzioni, campi, classi CSS, nomi di file e **chiavi di traduzione a nome** si scrivono in inglese. Mai italiano. Si traduce solo ciò che l'utente legge.
L'unica eccezione sono le chiavi `c.*`, che non le scrive nessuno: le ricava `catalogKey` dal testo italiano.

## Dove siamo
- **Fatto**: tutte le chiavi a nome sono in inglese (editor, dialog dell'editor, tools, monsterDialog, eventDialog, zoom, immunity, behavior, common) e la risorsa del Maligno è `hatred` ovunque. I rinomina si fanno con uno script che cambia la chiave in `it.json`, `en.json` e nel codice, e il compilatore controlla che non ne resti una vecchia.
- **Controllo**: `npm run i18n:check` segnala una chiave a nome il cui ultimo pezzo ricalca le prime parole del testo italiano (così non rientra).
- **Da verificare ancora**: se resta altro italiano nel codice (campi, funzioni, classi CSS): `Grep` di parole italiane comuni sui nomi. Non l'ho ancora fatto.

## Come, a piccoli passi (dopo ogni passo il gioco compila e parte)
1. **Elenco**: uno script (come quelli usati per l'Odio) scrive in un file l'elenco delle chiavi a nome con la loro frase italiana. Le chiavi buone (`home.newGame`, `common.close`) restano.
2. **Nomi nuovi**: per ogni gruppo (`editor.`, `eventDialog.`, `tools.`, `validator.`… uno alla volta) si decide un nome inglese che dice a cosa serve la frase, non la traduce parola per parola (`editor.confirmReplaceMap`, non `editor.replaceTheMap`). Va rivisto da chi conosce il gioco.
3. **Applicazione**: uno script rinomina la chiave in `it.json`, `en.json` e in tutti i `.ts` che la usano. Il compilatore (`ngc`) dice se ne è rimasta una vecchia, perché il pipe `t` accetta solo chiavi che esistono.
4. **Controlli**: `ngc`, `npm run i18n:check`, e una prova a mano della schermata del gruppo.
5. Un commit per gruppo.

## Dopo
Aggiungere a `scripts/i18n-check.mjs` un controllo che segnali una chiave a nome con parole italiane riconoscibili, così non rientra.
