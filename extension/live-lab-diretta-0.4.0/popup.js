import { DEFAULT_WHITELIST, LEGACY_OVERALL, LEGACY_LEAGUE_STATS } from './league-data.js';

const $ = s => document.querySelector(s);
const DEFAULTS = {enabled:true,minMinute:23,maxMinute:32,minXg:.5,minSot:1,whitelist:DEFAULT_WHITELIST,alerts:[],lastLiveHeartbeat:null,telegramBotToken:'',telegramChatId:'',telegramLastError:'',liveLabApiUrl:'',liveLabIngestKey:'',apiLastError:''};
let selectedLeagues = new Set(DEFAULT_WHITELIST);
function esc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function fmtTime(ts){return ts?new Date(ts).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'';}

function renderLeagueList(filter='') {
  const q=filter.trim().toLowerCase();
  const leagues=DEFAULT_WHITELIST.filter(x=>!q||x.toLowerCase().includes(q));
  $('#leagueList').innerHTML=leagues.map(name=>{
    const st=LEGACY_LEAGUE_STATS[name];
    return `<label class="leagueitem"><input type="checkbox" data-league="${esc(name)}" ${selectedLeagues.has(name)?'checked':''}><span><b>${esc(name)}</b>${st?`<small>${st.strike}% · ${st.picks} pick</small>`:'<small>storico N/D</small>'}</span></label>`;
  }).join('') || '<div class="empty">Nessun campionato trovato.</div>';
  $('#leagueCount').textContent=`${selectedLeagues.size} / ${DEFAULT_WHITELIST.length} attivi`;
  document.querySelectorAll('[data-league]').forEach(cb=>cb.addEventListener('change',()=>{
    if(cb.checked) selectedLeagues.add(cb.dataset.league); else selectedLeagues.delete(cb.dataset.league);
    $('#leagueCount').textContent=`${selectedLeagues.size} / ${DEFAULT_WHITELIST.length} attivi`;
  }));
}

async function load(){
  const s={...DEFAULTS,...await chrome.storage.local.get(DEFAULTS)};
  selectedLeagues=new Set(Array.isArray(s.whitelist)&&s.whitelist.length?s.whitelist:DEFAULT_WHITELIST);
  $('#enabled').checked=s.enabled; $('#minMinute').value=s.minMinute; $('#maxMinute').value=s.maxMinute;
  $('#minXg').value=s.minXg; $('#minSot').value=s.minSot;
  $('#telegramBotToken').value=s.telegramBotToken||''; $('#telegramChatId').value=s.telegramChatId||''; $('#liveLabApiUrl').value=s.liveLabApiUrl||''; $('#liveLabIngestKey').value=s.liveLabIngestKey||'';
  $('#overallStat').textContent=`${LEGACY_OVERALL.strike}% overall · ${LEGACY_OVERALL.hits}/${LEGACY_OVERALL.resolved} risolti`;
  const fresh=s.lastLiveHeartbeat && Date.now()-s.lastLiveHeartbeat<90000;
  $('#dot').className=`dot ${fresh?'ok':'warn'}`;
  $('#status').textContent=fresh?'Diretta rilevata · scanner attivo':'Apri Diretta.it in una scheda';
  $('#telegramStatus').textContent=s.telegramLastError?`Ultimo errore: ${s.telegramLastError}`:(s.telegramBotToken&&s.telegramChatId?'Telegram configurato ✓':'Inserisci Bot Token e Chat ID.'); $('#apiStatus').textContent=s.apiLastError?`Ultimo errore API: ${s.apiLastError}`:(s.liveLabApiUrl?'Live Lab Web configurato ✓':'Inserisci URL Live Lab + Ingest Key dopo il deploy Vercel.');
  renderLeagueList($('#leagueSearch').value);
  const alerts=(s.alerts||[]).slice(0,8);
  $('#alerts').innerHTML=alerts.length?alerts.map(a=>{const st=a.legacyLeagueStats;return `<div class="alert"><div class="top">🔔 ${esc(a.home)} - ${esc(a.away)}</div><div class="meta">${esc(a.canonicalLeague||a.league||'')} · ${fmtTime(a.ts)} · ${a.minute}' · xG ${Number(a.xg).toFixed(2)} · SOT ${a.sot}${st?` · SR ${st.strike}%`:''}</div></div>`}).join(''):'<div class="empty">Nessun alert registrato.</div>';
}

$('#leagueSearch').addEventListener('input',e=>renderLeagueList(e.target.value));
$('#selectAll').addEventListener('click',()=>{DEFAULT_WHITELIST.forEach(x=>selectedLeagues.add(x));renderLeagueList($('#leagueSearch').value)});
$('#selectNone').addEventListener('click',()=>{selectedLeagues.clear();renderLeagueList($('#leagueSearch').value)});
$('#save').addEventListener('click',async()=>{
  await chrome.storage.local.set({
    enabled:$('#enabled').checked,minMinute:Number($('#minMinute').value),maxMinute:Number($('#maxMinute').value),
    minXg:Number($('#minXg').value),minSot:Number($('#minSot').value),whitelist:[...selectedLeagues],whitelistCustomized:true,whitelistSeedVersion:1,
    telegramBotToken:$('#telegramBotToken').value.trim(),telegramChatId:$('#telegramChatId').value.trim(),telegramLastError:'',liveLabApiUrl:$('#liveLabApiUrl').value.trim().replace(/\/$/,''),liveLabIngestKey:$('#liveLabIngestKey').value.trim(),apiLastError:''
  });
  $('#save').textContent='Salvato ✓'; setTimeout(()=>$('#save').textContent='Salva',1000); load();
});
$('#enabled').addEventListener('change',()=>chrome.storage.local.set({enabled:$('#enabled').checked}));
$('#test').addEventListener('click',async()=>{
  // Salva prima le credenziali, così il test usa subito i valori appena incollati.
  await chrome.storage.local.set({telegramBotToken:$('#telegramBotToken').value.trim(),telegramChatId:$('#telegramChatId').value.trim(),telegramLastError:'',liveLabApiUrl:$('#liveLabApiUrl').value.trim().replace(/\/$/,''),liveLabIngestKey:$('#liveLabIngestKey').value.trim(),apiLastError:''});
  $('#test').textContent='Invio…';
  const r=await chrome.runtime.sendMessage({type:'TEST_TELEGRAM'});
  $('#test').textContent=r?.ok?'Ricevuto? ✓':'Errore';
  setTimeout(()=>{$('#test').textContent='Test Telegram';load();},1800);
});
load();
