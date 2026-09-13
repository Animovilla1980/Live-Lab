# Live Lab Web 0.1.0

Prima base GitHub/Vercel/Supabase di Live Lab, separata da QSC Lab e Forebet Lab ma pensata per usare lo **stesso progetto Supabase di Forebet Lab**.

## Funzioni incluse
- Dashboard nello stile approvato: KPI, ultimo alert, trend, top campionati e strategia attiva.
- Storico trigger con stato Forebet Gate.
- 81 campionati della whitelist iniziale.
- Baseline InPlayGuru: 106 pick, 101 risolti, 75 hit, 26 miss, strike 74%; storico league precaricato dove disponibile.
- Forebet Gate corretto per Over 1.5:
  - **BLOCK:** 0-0, 1-0, 0-1.
  - **PASS:** qualsiasi RE con almeno 2 gol totali, inclusi NoGol come 2-0, 0-2, 3-0, 0-3.
  - **UNKNOWN:** RE Forebet non disponibile -> alert consentito.
- API `POST /api/ingest` pronta per l'estensione Chrome.
- Migrazione Supabase versionata: `supabase/migrations/001_live_lab_core.sql`.
- Logo Live Lab incluso in alta risoluzione.

## Ordine di installazione
1. **Prima Supabase:** apri SQL Editor del progetto Supabase già usato da Forebet Lab e applica `supabase/migrations/001_live_lab_core.sql`.
2. Crea un nuovo repository GitHub, ad esempio `live-lab`.
3. Carica il contenuto di questa cartella nel repository.
4. In Vercel crea un nuovo progetto dal repo.
5. Aggiungi le variabili ambiente da `.env.example`.
6. Deploy.
7. Dopo che Vercel è `Ready / Production / Latest`, installa l'estensione `extension/live-lab-diretta-0.4.0` e imposta l'URL Vercel + la stessa `LIVE_LAB_INGEST_KEY`.

## Supabase condiviso con Forebet Lab
La migration crea solo oggetti `live_lab_*` e non modifica le tabelle Forebet. L'API legge la tabella Forebet esistente `forebet_matches` usando i campi già previsti dal progetto: `home_team`, `away_team`, `kickoff`, `league_name`, `predicted_score`.

Se nell'ultima release Forebet Lab il nome della tabella è diverso, basta cambiare `FOREBET_MATCHES_TABLE` su Vercel senza toccare il codice.

## Sicurezza
- `SUPABASE_SERVICE_ROLE_KEY` resta solo server-side su Vercel.
- Bot Token Telegram e Chat ID restano nell'estensione Chrome e non vengono salvati su Supabase.
- `/api/ingest` può essere protetta con `LIVE_LAB_INGEST_KEY`.
