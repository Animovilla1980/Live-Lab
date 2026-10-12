# Live Lab 0.8.0 — InPlayGuru Intelligence

Web app Next.js per lo studio cumulativo dei CSV InPlayGuru, nel repository Live-Lab esistente. La nuova Home sostituisce il Radar come flusso principale. Il vecchio Radar, lo storico Diretta e Paper Exchange restano sotto «Archivio precedente», separati dai nuovi alert.

## Aggiornamento dell'app esistente

1. Esegui su Supabase SQL Editor **solo** `supabase/migrations/20261012220520_inplayguru_intelligence.sql`.
2. Carica nel repository GitHub Live-Lab i file di questa cartella, mantenendo il collegamento Vercel esistente. Non caricare lo ZIP come singolo file: estrailo e caricane il contenuto.
3. Attendi il deploy Vercel. Le variabili già utilizzate restano `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LIVE_LAB_INGEST_KEY`. Il server usa la service role; non inserirla mai nella pagina di accesso.
4. Apri Live Lab. Inserisci la chiave `LIVE_LAB_INGEST_KEY` per aprire Intelligence. Puoi facoltativamente impostare `LIVE_LAB_ACCESS_KEY` su Vercel come chiave privata distinta: se presente ha precedenza.
5. In «Importa CSV», seleziona i file originali InPlayGuru, clicca «Controlla importazione», poi «Conferma e salva storico».

La migration aggiunge esclusivamente oggetti `live_lab_ipg_*`, con RLS e GRANT espliciti per service_role. Non modifica Forebet, le tabelle precedenti o QSC Markets Exchange. Nessun nuovo costo API AI.

## Funzioni

- Import multi-CSV, identificazione strategia dal nome originale e scelta manuale per file rinominati. Anteprima e conferma. Max 10 file / 2,5 MB per gruppo.
- Lettura delle due righe di intestazioni InPlayGuru: mantiene distinti dati all'alert, HT, FT, quote live/pre-match e minuti gol. Dati originali disponibili nel dettaglio.
- Storico Supabase cumulativo e revisioni dei picks. Identità: strategia + giorno CSV + campionato + squadre + minuto. Reimport senza duplicati; aggiornamenti dei risultati consentiti; esiti definitivi protetti dal ritorno a Pending. I trade manuali non vengono sovrascritti dall'import.
- Statistiche per strategia, periodo e campionato: WIN/LOSS/Pending, strike rate, intervallo Wilson 95%, quota media del mercato operativo, serie e andamento giornaliero.
- Tempo al primo gol: minuti approssimati; timeline incompleta o gol nello stesso minuto non genera un delay inventato. Le frequenze entro 5/10/15 minuti mostrano il loro denominatore di copertura. HT usa lo score dell'intervallo.
- Pattern Lab: segmenti per minuto, score, campionato, xG, momentum, modalità operativa; filtri combinati per xG, SOT, momentum, attacchi pericolosi e quota. I filtri usano esclusivamente informazioni disponibili all'alert.
- Ipotesi persistenti congelate: discovery snapshot e cutoff all'ultimo giorno già importato della strategia. Verifica solo su giorni successivi. Nessuna approvazione automatica; validazione manuale abilitata dopo almeno 50 esiti futuri, soglia amministrativa e non garanzia statistica.
- Registro trade: esito operativo distinto dal CSV, esposizione realmente abbinata, P/L netto e data di chiusura. VOID può avere P/L non zero; Pending CSV non diventa automaticamente VOID o LOSS.
- Simulazione sequenziale da rendimenti reali per unità di esposizione: fisso o percentuale di cassa, equity e drawdown. Nessuna ricostruzione fittizia di abbinamenti o cashout da Strike.
- Strategy DNA: baseline e operatività ufficiale delle tre strategie. Nessuna modifica a ordini, stake o strategie esterne.
- Export JSON completo con dati originali CSV, trade, ipotesi e import recenti. È un archivio esportabile; questa release non contiene un ripristino JSON con un clic. Conserva anche i CSV originali.

## Limiti da tenere presenti

Le quote nel CSV non sono necessariamente quote Exchange e non provano che un ordine sia stato abbinato. Il tracciamento dei gol e l'esito InPlayGuru sono distinti dal tuo risultato economico. Non vengono calcolati ROI teorici usando il WIN «prossimo gol» sul mercato operativo Over +2 gol.

I CSV osservano soltanto gli alert che hanno superato i filtri attuali: è possibile valutare restrizioni, non ampliamenti a partite assenti. I pattern sono esplorativi e soffrono di selezione e confronti multipli. La simulazione riutilizza la frazione netta di P/L dei trade registrati, in ordine di chiusura, senza esposizioni simultanee, liquidità o quote nel tempo.

Le date CSV vengono mantenute nel fuso della fonte, non dichiarato dal file. Le chiusure trade sono inserite esplicitamente in UTC. Storico caricato in pagine; dettagli originali solo su richiesta. Importa export aggiornati: il file non dichiara una versione di ogni esito, quindi una correzione WIN/LOSS proveniente da un export vecchio non è riconoscibile automaticamente.

La baseline Over 1,5 è configurata, ma i suoi 129 alert devono essere importati dal CSV effettivo: non sono ricostruiti dai riepiloghi della chat. Pressure e Late Goal vanno anch'essi importati dalla pagina dopo il deploy.

## Sviluppo

Node 22.x, `npm ci`, `npm run dev`, `npm test`, `npm run lint`, `npm run build`. Nessuna credenziale inclusa nel pacchetto. Le chiamate Intelligence richiedono la chiave privata e falliscono se non configurata. L'accesso in UI è mantenuto solo in memoria.

Fonte tecnica: main GitHub `746f88c` (Paper Exchange per tutte le strategie), aggiornato nella release 0.8.0. Le funzionalità legacy mantengono il proprio comportamento precedente.
