# Live Lab 0.8.0 — InPlayGuru Intelligence

Problema: la fonte degli alert è ora InPlayGuru, mentre la Home era ancora organizzata per Diretta/Radar/Paper. Ora la Home presenta import cumulativo, statistiche per strategia, ipotesi con verifica su giorni futuri e risultati Exchange registrati separatamente.

Fonte: repository GitHub Animovilla1980/Live-Lab, main 746f88c. Nessuna modifica all'estensione allegata o a QSC Markets Exchange.

## Verifiche completate

- TypeScript e build Next.js produzione: passati.
- 8 test automatici: intestazioni a gruppi, Pending, timeline ambigue/incomplete, confine Late BACK/LAY/SKIP, dati mancanti, file invalidi, P/L reale per VOID, identità stabile al variare dei secondi dell'alert.
- CSV allegati: Pressure 60 / 51 WIN / 9 LOSS; Late Goal 30 / 23 WIN / 7 LOSS.
- SQL su PostgreSQL locale (PGlite): migration, grant/RLS, import ripetuti, aggiornamenti con revisioni, protezione Pending, conservazione dei trade e rollback completo su errore.
- API Next.js reale collegata tramite adattatore locale PostgREST a PostgreSQL: accesso, preview, import 90, dedup, trade VOID, validazione input, congelamento cutoff.
- Browser Chromium: accesso, caricamento CSV, anteprima/conferma, pattern candidato, salvataggio trade, dettaglio con Escape; viewport 1440 e 390 px; nessun errore JavaScript e nessun overflow orizzontale della pagina su mobile.
- Paginazione verificata su 630 alert: metadata su due pagine, dettaglio originale su richiesta, export completo a pagine, blocco server della validazione senza campione futuro.

Le prove sono locali, con credenziali fittizie e database di test. Nessun accesso al database di produzione, nessuna migration applicata online e nessun deploy Vercel eseguito. Il runtime locale di verifica è Node 24; il progetto mantiene Node 22.x come versione Vercel. Vedi DEPLOY.md per applicare questa release.

## Confini della release

Lo strike rate non è il rendimento Exchange. La simulazione usa solo P/L ed esposizione reali inseriti dall'utente; non inventa quote, abbinamenti o uscite. Il campione Over 1,5 non è incorporato dai riepiloghi: va importato dal CSV. Le ipotesi non cambiano automaticamente le strategie.
