import { DEFAULT_WHITELIST, LEGACY_OVERALL, LEGACY_LEAGUE_STATS } from './league-data.js';

const $=s=>document.querySelector(s);
const DEFAULTS={enabled:true,whitelist:DEFAULT_WHITELIST,alerts:[],lastLiveHeartbeat:null,telegramBotToken:'',telegramChatId:'',telegramLastError:'',liveLabApiUrl:'',liveLabIngestKey:'',apiLastError:'',paperAuto:true,betfairAppKey:'',betfairLastError:''};
let selectedLeagues=new Set(DEFAULT_WHITELIST);
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function fmtTime(ts){return ts?new Date(ts).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'';}

function renderLeagueList(filter=''){
  const q=filter.trim().toLowerCase(),leagues=DEFAULT_WHITELIST.filter(x=>!q||x.toLowerCase().includes(q));
  $('#leagueList').innerHTML=leagues.map(name=>{const st=LEGACY_LEAGUE_STATS[name];return `<label class="leagueitem"><input type="checkbox" data-league="${esc(name)}" ${selectedLeagues.has(name)?'checked':''}><span><b>${esc(name)}</b>${st?`<small>${st.strike}% · ${st.picks} pick</small>`:'<small>storico N/D</small>'}</span></label>`;}).join('')||'<div class="empty">Nessun campionato trovato.</div>';
  $('#leagueCount').textContent=`${selectedLeagues.size} / ${DEFAULT_WHITELIST.length} attivi`;
  document.querySelectorAll('[data-league]').forEach(cb=>cb.addEventListener('change',()=>{if(cb.checked)selectedLeagues.add(cb.dataset.league);else selectedLeagues.delete(cb.dataset.league);$('#leagueCount').textContent=`${selectedLeagues.size} / ${DEFAULT_WHITELIST.length} attivi`;}));
}

async function load(){
  const s={...DEFAULTS,...await chrome.storage.local.get(DEFAULTS)};selectedLeagues=new Set(Array.isArray(s.whitelist)&&s.whitelist.length?s.whitelist:DEFAULT_WHITELIST);
  $('#enabled').checked=s.enabled;$('#paperAuto').checked=s.paperAuto;$('#betfairAppKey').value=s.betfairAppKey||'';$('#telegramBotToken').value=s.telegramBotToken||'';$('#telegramChatId').value=s.telegramChatId||'';$('#liveLabApiUrl').value=s.liveLabApiUrl||'';$('#liveLabIngestKey').value=s.liveLabIngestKey||'';
  $('#overallStat').textContent=`baseline storico ${LEGACY_OVERALL.strike}% · il nuovo radar costruirà statistiche proprie`;
  const fresh=s.lastLiveHeartbeat&&Date.now()-s.lastLiveHeartbeat<90000;$('#dot').className=`dot ${fresh?'ok':'warn'}`;$('#status').textContent=fresh?'Diretta rilevata · scanner attivo':'Apri Diretta.it in una scheda';
  $('#telegramStatus').textContent=s.telegramLastError?`Ultimo errore: ${s.telegramLastError}`:(s.telegramBotToken&&s.telegramChatId?'Telegram configurato ✓':'Inserisci Bot Token e Chat ID.');
  $('#apiStatus').textContent=s.apiLastError?`Ultimo errore API: ${s.apiLastError}`:(s.liveLabApiUrl?'Motore Live Lab configurato ✓':'Inserisci URL Live Lab + Ingest Key.');
  $('#betfairStatus').textContent=s.betfairLastError?`Ultimo errore Betfair: ${s.betfairLastError}`:(s.betfairAppKey?'App Key salvata · accedi a Betfair in Chrome e fai Test Betfair.':'Inserisci Betfair App Key; la sessione viene letta dal login Betfair aperto in Chrome.');
  renderLeagueList($('#leagueSearch').value);
  const alerts=(s.alerts||[]).slice(0,8);$('#alerts').innerHTML=alerts.length?alerts.map(a=>{const p=a.engine?.primary||{},paper=a.paper;const extra=paper?.status==='OPEN'?` · paper €${Number(paper.stakeTotal||0).toFixed(2)}`:paper?.status==='CLOSED'?` · P/L ${Number(paper.netPnl)>=0?'+':''}€${Number(paper.netPnl||0).toFixed(2)}`:'';return `<div class="alert"><div class="top">${esc(p.label||'🚨 Signal')} ${p.score??''}/100 · ${esc(a.home)} - ${esc(a.away)}</div><div class="meta">${esc(a.canonicalLeague||a.league||'')} · ${fmtTime(a.ts)} · ${a.minute}' · ${esc(a.score||'')} · tier ${esc(a.engine?.tier||'—')}${extra}</div></div>`;}).join(''):'<div class="empty">Nessun segnale registrato.</div>';
}

async function saveSettings(){await chrome.storage.local.set({enabled:$('#enabled').checked,paperAuto:$('#paperAuto').checked,betfairAppKey:$('#betfairAppKey').value.trim(),whitelist:[...selectedLeagues],whitelistCustomized:true,whitelistSeedVersion:1,telegramBotToken:$('#telegramBotToken').value.trim(),telegramChatId:$('#telegramChatId').value.trim(),telegramLastError:'',liveLabApiUrl:$('#liveLabApiUrl').value.trim().replace(/\/$/,''),liveLabIngestKey:$('#liveLabIngestKey').value.trim(),apiLastError:''});}

$('#leagueSearch').addEventListener('input',e=>renderLeagueList(e.target.value));
$('#selectAll').addEventListener('click',()=>{DEFAULT_WHITELIST.forEach(x=>selectedLeagues.add(x));renderLeagueList($('#leagueSearch').value)});
$('#selectNone').addEventListener('click',()=>{selectedLeagues.clear();renderLeagueList($('#leagueSearch').value)});
$('#save').addEventListener('click',async()=>{await saveSettings();$('#save').textContent='Salvato ✓';setTimeout(()=>$('#save').textContent='Salva',1000);load();});
$('#enabled').addEventListener('change',()=>chrome.storage.local.set({enabled:$('#enabled').checked}));
$('#paperAuto').addEventListener('change',()=>chrome.storage.local.set({paperAuto:$('#paperAuto').checked}));
$('#test').addEventListener('click',async()=>{await saveSettings();$('#test').textContent='Invio…';const r=await chrome.runtime.sendMessage({type:'TEST_TELEGRAM'});$('#test').textContent=r?.ok?'Ricevuto? ✓':'Errore';setTimeout(()=>{$('#test').textContent='Test Telegram';load();},1800);});
$('#testBetfair').addEventListener('click',async()=>{await saveSettings();$('#testBetfair').textContent='Test…';const r=await chrome.runtime.sendMessage({type:'TEST_BETFAIR'});$('#testBetfair').textContent=r?.ok?'Betfair OK ✓':'Errore';setTimeout(()=>{$('#testBetfair').textContent='Test Betfair';load();},2200);});
load();
