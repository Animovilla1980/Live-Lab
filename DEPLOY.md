# Aggiornare Live Lab — 0.8.0

1. Su Supabase, apri SQL Editor nel progetto già utilizzato da Live Lab e lancia il contenuto di `supabase/migrations/20261012220520_inplayguru_intelligence.sql`. Le altre migration sono già presenti per il vecchio progetto e non vanno rieseguite.
2. Estrai lo ZIP. Su GitHub, repository **Animovilla1980/Live-Lab**, carica il contenuto della cartella della release. Mantieni i file esistenti non sovrascritti.
3. Vercel esegue il deploy dal repository collegato. Framework Next.js, Build `npm run build`, Node 22.x. Non cambiare Output Directory rispetto alla configurazione Next.js.
4. Apri la Home e verifica «INPLAYGURU INTELLIGENCE · 0.8.0».
5. Per entrare usa il valore già configurato come `LIVE_LAB_INGEST_KEY`. Se vuoi una chiave separata aggiungi `LIVE_LAB_ACCESS_KEY` nelle variabili Vercel e fai redeploy. Non usare il valore `SUPABASE_SERVICE_ROLE_KEY` come password della pagina.
6. Importa i CSV InPlayGuru con anteprima e conferma. Il nome originale identifica automaticamente la strategia. Per le tre strategie insieme usa «Automatica dal nome originale».

Nessun invio Telegram e nessuna installazione di estensione sono necessari per Intelligence. Il vecchio software Exchange resta invariato.

Se compare «Database Intelligence non pronto», controlla di aver eseguito la nuova migration nel medesimo progetto indicato da `NEXT_PUBLIC_SUPABASE_URL`. Se compare «Chiave di accesso non corretta», verifica quale chiave ha precedenza: ACCESS_KEY se presente, altrimenti INGEST_KEY.

La release è stata verificata localmente. Durante la pubblicazione automatica vengono verificati anche migration e deploy nel progetto esistente.

## Configurazione automatica attuale

Il progetto Vercel esistente punta al database Supabase QSC Lab. La variabile storica `SUPABASE_SERVICE_ROLE_KEY` contiene una chiave publishable, quindi Intelligence utilizza un gateway privato gestito da Supabase: funzione `live-lab-intelligence-db`, `LIVE_LAB_BACKEND_URL` e `LIVE_LAB_BACKEND_KEY` server-side su Vercel. La funzione verifica l'hash della chiave privata e limita le operazioni ai soli oggetti `live_lab_ipg_*`; le tabelle non sono aperte a anon/authenticated. Nessuna credenziale admin è nel codice o nel browser.

La chiave di accesso della pagina è indipendente dalla chiave del gateway. Se cambi `LIVE_LAB_BACKEND_KEY`, aggiorna anche il suo hash nella funzione Supabase e ridistribuiscila. Non aprire le tabelle a anon per correggere problemi di connessione.
