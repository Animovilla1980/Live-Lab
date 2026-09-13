# Deploy rapido — Live Lab Web 0.1.0

## 1) Supabase
Usa lo stesso progetto di Forebet Lab.
Apri SQL Editor e lancia:

`supabase/migrations/001_live_lab_core.sql`

La migration crea solo tabelle/view `live_lab_*` e non modifica Forebet Lab.

## 2) GitHub
Crea un nuovo repository `live-lab` e carica il contenuto della cartella `live-lab-web-0.1.0`.

## 3) Vercel
Importa il nuovo repo e aggiungi:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `LIVE_LAB_INGEST_KEY` (scegli una stringa lunga casuale)
- `FOREBET_MATCHES_TABLE=forebet_matches`

Poi deploy.

## 4) Estensione 0.4
Solo dopo che Vercel è online:
- installa `extension/live-lab-diretta-0.4.0` da `chrome://extensions`;
- mantieni Bot Token e Chat ID già usati;
- inserisci `URL Live Lab` = URL Vercel;
- inserisci `Ingest Key` = stesso valore di `LIVE_LAB_INGEST_KEY`.

## Forebet Gate
- `0-0`, `1-0`, `0-1` -> BLOCK -> niente Telegram.
- qualunque RE con almeno 2 gol (`2-0`, `0-2`, `3-0`, `0-3`, `1-1`, ecc.) -> PASS.
- RE mancante/non trovato -> UNKNOWN -> alert consentito.

Tutti i trigger, inclusi quelli bloccati, vengono salvati in `live_lab_alerts` per confrontare in seguito l'efficacia reale del filtro.
