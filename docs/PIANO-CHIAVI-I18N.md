# Piano: nomi in inglese nel codice e nelle chiavi di traduzione

**Regola** (anche in `CLAUDE.md`): variabili, funzioni, campi, classi CSS, nomi di file e **chiavi di traduzione a nome** si scrivono in inglese. Mai italiano. Si traduce solo ciò che l'utente legge.
L'unica eccezione sono le chiavi `c.*`, che non le scrive nessuno: le ricava `catalogKey` dal testo italiano.

## Dove siamo
- Fatto: la risorsa del Maligno è `hatred` ovunque (campi, funzioni, segnaposto `{hatred:N}`, token `--c-hatred`, effetto evento `hatred`, regola `evilHatred`), e le quattro chiavi a nome che ne parlavano sono in inglese (`eventDialog.hatredPoints`, `hatredHint`, `changeHatred`, `prob.hatred`).
- Da fare: le chiavi a nome in italiano. In `it.json` ce ne sono 1016 (le altre ~900 sono `c.*`). Ne ho riconosciute almeno 174 dalle parole italiane (`editor.cancellaLaMappaASchermo`, `editor.sostituireLaMappa`, `tools.tessere`…); il numero vero è più alto e si trova con l'elenco del passo 1.
- Prima di cominciare, guardare se resta altro italiano nel codice (campi, funzioni, classi CSS): `Grep` di parole italiane comuni sui nomi.

## Come, a piccoli passi (dopo ogni passo il gioco compila e parte)
1. **Elenco**: uno script (come quelli usati per l'Odio) scrive in un file l'elenco delle chiavi a nome con la loro frase italiana. Le chiavi buone (`home.newGame`, `common.close`) restano.
2. **Nomi nuovi**: per ogni gruppo (`editor.`, `eventDialog.`, `tools.`, `validator.`… uno alla volta) si decide un nome inglese che dice a cosa serve la frase, non la traduce parola per parola (`editor.confirmReplaceMap`, non `editor.replaceTheMap`). Va rivisto da chi conosce il gioco.
3. **Applicazione**: uno script rinomina la chiave in `it.json`, `en.json` e in tutti i `.ts` che la usano. Il compilatore (`ngc`) dice se ne è rimasta una vecchia, perché il pipe `t` accetta solo chiavi che esistono.
4. **Controlli**: `ngc`, `npm run i18n:check`, e una prova a mano della schermata del gruppo.
5. Un commit per gruppo.

## Dopo
Aggiungere a `scripts/i18n-check.mjs` un controllo che segnali una chiave a nome con parole italiane riconoscibili, così non rientra.
