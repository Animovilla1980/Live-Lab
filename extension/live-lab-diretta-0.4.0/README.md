# Live Lab Diretta Watch 0.4.0

Questa estensione sostituisce la 0.3 dopo il deploy di Live Lab Web 0.1.0.

Novità:
- invia lo snapshot live a `/api/ingest`;
- Live Lab Web cerca la stessa partita in `forebet_matches`;
- Forebet Gate: BLOCK solo per 0-0, 1-0, 0-1; PASS per qualsiasi RE con almeno 2 gol, inclusi 2-0/0-2/3-0/0-3; UNKNOWN lascia passare;
- salva localmente anche i trigger bloccati;
- Telegram resta un solo alert per partita;
- nell’alert compare `Forebet RE`.

Configurazione nuova nel popup: URL Live Lab Vercel + `LIVE_LAB_INGEST_KEY`.
