import { DEFAULT_WHITELIST, LEGACY_OVERALL, LEGACY_LEAGUE_STATS, findCanonicalLeague } from './league-data.js';

const DEFAULTS = {
  enabled: true,
  minMinute: 23,
  maxMinute: 32,
  maxGoals: 0,
  minSot: 1,
  minXg: 0.50,
  whitelist: DEFAULT_WHITELIST,
  whitelistSeedVersion: 1,
  whitelistCustomized: false,
  alerts: [],
  candidates: {},
  lastLiveHeartbeat: null,
  telegramBotToken: '',
  telegramChatId: '',
  liveLabApiUrl: '',
  liveLabIngestKey: '',
  apiLastError: '',
  chromeNotification: true,
  telegramLastError: ''
};

async function cfg() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...s };
}

async function saveAlert(alert) {
  const s = await cfg();
  const alerts = [alert, ...(s.alerts || [])].slice(0, 500);
  await chrome.storage.local.set({ alerts });
}

function keyOf(m) {
  return m.id || `${m.home}|${m.away}`.toLowerCase().replace(/\s+/g, '-');
}

async function notifyChrome(title, message, id = `ll-${Date.now()}`) {
  const s = await cfg();
  if (!s.chromeNotification) return;
  await chrome.notifications.create(id, {
    type: 'basic', iconUrl: 'icons/icon128.png', title, message, priority: 2, requireInteraction: true
  });
}

async function sendTelegram(text) {
  const s = await cfg();
  if (!s.telegramBotToken || !s.telegramChatId) throw new Error('Telegram non configurato: inserisci Bot Token e Chat ID.');
  const response = await fetch(`https://api.telegram.org/bot${s.telegramBotToken}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: s.telegramChatId, text, disable_web_page_preview: true })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) throw new Error(data?.description || `Telegram HTTP ${response.status}`);
  return data;
}

function n(v, digits = 1) { return Number.isFinite(Number(v)) ? Number(v).toFixed(digits) : null; }
function pair(a, b, digits = 0) {
  if (!Number.isFinite(Number(a)) || !Number.isFinite(Number(b))) return null;
  return `${Number(a).toFixed(digits)} - ${Number(b).toFixed(digits)}`;
}
function optionalLine(label, value) { return value ? `${label}: ${value}` : ''; }

function flagForLeague(league = '') {
  const x = league.toLowerCase();
  const map = [
    [/australia/, '🇦🇺'],[/austria/, '🇦🇹'],[/belgium/, '🇧🇪'],[/bosnia/, '🇧🇦'],[/bulgaria/, '🇧🇬'],[/chile/, '🇨🇱'],[/croatia/, '🇭🇷'],
    [/czech/, '🇨🇿'],[/denmark/, '🇩🇰'],[/estonia/, '🇪🇪'],[/finland/, '🇫🇮'],[/france/, '🇫🇷'],[/germany/, '🇩🇪'],[/greece/, '🇬🇷'],
    [/hungary/, '🇭🇺'],[/iceland/, '🇮🇸'],[/india/, '🇮🇳'],[/indonesia/, '🇮🇩'],[/northern ireland/, '🇬🇧'],[/israel/, '🇮🇱'],[/italy|itália/, '🇮🇹'],
    [/japan/, '🇯🇵'],[/latvia/, '🇱🇻'],[/netherlands/, '🇳🇱'],[/norway/, '🇳🇴'],[/peru/, '🇵🇪'],[/poland/, '🇵🇱'],[/portugal/, '🇵🇹'],
    [/romania/, '🇷🇴'],[/saudi arabia/, '🇸🇦'],[/serbia/, '🇷🇸'],[/slovakia/, '🇸🇰'],[/south korea/, '🇰🇷'],[/spain/, '🇪🇸'],[/sweden/, '🇸🇪'],
    [/switzerland/, '🇨🇭'],[/tunisia/, '🇹🇳'],[/england|scotland|wales/, '🇬🇧'],[/afc|fifa|world cup/, '🌐']
  ];
  for (const [re, flag] of map) if (re.test(x)) return flag;
  return '⚽';
}

async function checkForebetGate(m) {
  const s = await cfg();
  if (!s.liveLabApiUrl) {
    return { status: 'UNKNOWN', predictedScore: null, reason: 'Live Lab Web non configurato', shouldAlert: true };
  }
  try {
    const response = await fetch(`${s.liveLabApiUrl.replace(/\/$/, '')}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(s.liveLabIngestKey ? { 'x-live-lab-key': s.liveLabIngestKey } : {})
      },
      body: JSON.stringify({
        matchKey: m.key,
        matchDate: (()=>{const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`})(),
        league: m.canonicalLeague || m.league,
        home: m.home,
        away: m.away,
        minute: m.minute,
        homeScore: m.homeScore ?? 0,
        awayScore: m.awayScore ?? 0,
        xgHome: m.xgHome,
        xgAway: m.xgAway,
        sotHome: m.sotHome,
        sotAway: m.sotAway,
        sourceUrl: m.url || ''
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.ok === false) throw new Error(data?.error || `Live Lab HTTP ${response.status}`);
    await chrome.storage.local.set({ apiLastError: '' });
    return { ...(data.gate || {}), shouldAlert: data.shouldAlert !== false };
  } catch (err) {
    await chrome.storage.local.set({ apiLastError: String(err?.message || err) });
    return { status: 'UNKNOWN', predictedScore: null, reason: 'Forebet non verificabile: fail-open', shouldAlert: true };
  }
}

function buildTelegramAlert(m) {
  const lines = [];
  lines.push('🔔 Punta OVER 1,5!');
  lines.push('');
  lines.push(`${flagForLeague(m.canonicalLeague || m.league)} ${m.canonicalLeague || m.league || 'Campionato'}`);
  lines.push(`${m.home} vs ${m.away}`);
  lines.push('');
  lines.push(`Timer: ${m.minute}'`);
  lines.push('Last Goal: None');
  lines.push('');
  lines.push(`Goals: ${m.homeScore ?? 0} - ${m.awayScore ?? 0}`);

  const values = [
    optionalLine('xG', pair(m.xgHome, m.xgAway, 1)),
    optionalLine('Shots On Target', pair(m.sotHome, m.sotAway, 0)),
    optionalLine('Attacks', pair(m.attacksHome, m.attacksAway, 0)),
    optionalLine('Dangerous Attacks', pair(m.dangerousHome, m.dangerousAway, 0)),
    optionalLine('Red Cards', pair(m.redCardsHome, m.redCardsAway, 0)),
    optionalLine('Penalties', pair(m.penaltiesHome, m.penaltiesAway, 0)),
    pair(m.possessionHome, m.possessionAway, 0) ? `Possession %: ${pair(m.possessionHome, m.possessionAway, 0)}` : ''
  ].filter(Boolean);
  values.forEach(x => lines.push(x));

  lines.push('');
  const leagueStats = LEGACY_LEAGUE_STATS[m.canonicalLeague];
  if (leagueStats) {
    lines.push(`🎯 Strike Rate: ${LEGACY_OVERALL.strike}% overall · ${leagueStats.strike}% league`);
    lines.push(`📊 League sample: ${leagueStats.picks} picks`);
  } else {
    lines.push(`🎯 Strike Rate: ${LEGACY_OVERALL.strike}% overall · N/D league`);
    lines.push('📊 League sample: nessuno storico importato');
  }
  if (m.forebetGate?.predictedScore) {
    lines.push(`🔮 Forebet RE: ${m.forebetGate.predictedScore} ${m.forebetGate.status === 'PASS' ? '✅' : ''}`);
  } else {
    lines.push('🔮 Forebet RE: N/D');
  }
  lines.push('');
  lines.push('Controlla manualmente la quota Over 1,5.');
  return lines.join('\n');
}

async function handleLiveCandidate(m) {
  const s = await cfg();
  if (!s.enabled) return;
  const canonicalLeague = findCanonicalLeague(m.league, s.whitelist || DEFAULT_WHITELIST);
  if (!canonicalLeague) return;
  if (m.minute < s.minMinute || m.minute > s.maxMinute) return;
  if ((m.homeScore + m.awayScore) > s.maxGoals) return;

  const key = keyOf(m);
  const existing = s.candidates?.[key];
  const now = Date.now();
  if (existing && now - existing.firstSeen < 90 * 60 * 1000) return;

  const candidate = { ...m, canonicalLeague, key, firstSeen: now, status: 'checking-stats' };
  const candidates = { ...(s.candidates || {}), [key]: candidate };
  await chrome.storage.local.set({ candidates, lastLiveHeartbeat: now });

  if (m.url) {
    const statsUrl = m.url.includes('#') ? m.url : `${m.url}#/match-summary/match-statistics/0`;
    const tab = await chrome.tabs.create({ url: statsUrl, active: false });
    await chrome.storage.session.set({ [`tab:${tab.id}`]: { key, createdAt: now } });
    setTimeout(async () => { try { await chrome.tabs.remove(tab.id); } catch (_) {} }, 25000);
  }
}

async function handleStats(payload, sender) {
  const s = await cfg();
  if (!s.enabled) return;

  let key = payload.key;
  if (!key && sender?.tab?.id) {
    const sess = await chrome.storage.session.get(`tab:${sender.tab.id}`);
    key = sess?.[`tab:${sender.tab.id}`]?.key;
  }
  if (!key) key = keyOf(payload);

  const candidate = s.candidates?.[key] || payload;
  if (!candidate || candidate.status === 'signal') return;

  const xg = Number(payload.xgTotal), sot = Number(payload.sotTotal);
  if (!Number.isFinite(xg) || !Number.isFinite(sot)) return;
  const passed = xg >= s.minXg && sot >= s.minSot;
  const updated = { ...candidate, ...payload, canonicalLeague: candidate.canonicalLeague, key, checkedAt: Date.now(), status: passed ? 'signal' : 'rejected' };
  const candidates = { ...(s.candidates || {}), [key]: updated };
  await chrome.storage.local.set({ candidates });
  if (!passed) return;

  const forebetGate = await checkForebetGate(updated);
  const gated = { ...updated, forebetGate };
  const text = buildTelegramAlert(gated);
  const alert = {
    type: forebetGate.status === 'BLOCK' ? 'BLOCKED' : 'SIGNAL', ts: Date.now(), key,
    forebetGate,
    home: updated.home, away: updated.away, league: updated.league, canonicalLeague: updated.canonicalLeague,
    minute: updated.minute, score: `${updated.homeScore ?? 0}-${updated.awayScore ?? 0}`,
    xgHome: updated.xgHome, xgAway: updated.xgAway, xg,
    sotHome: updated.sotHome, sotAway: updated.sotAway, sot,
    legacyLeagueStats: LEGACY_LEAGUE_STATS[updated.canonicalLeague] || null,
    url: updated.url || payload.url || '', text
  };
  await saveAlert(alert);

  if (forebetGate.status === 'BLOCK' || forebetGate.shouldAlert === false) {
    await notifyChrome('🚫 Live Lab — alert bloccato da Forebet', `${updated.home} - ${updated.away}\nRE Forebet ${forebetGate.predictedScore || 'N/D'} · incompatibile con Over 1,5`);
    return;
  }

  let telegramOk = false;
  try { await sendTelegram(text); telegramOk = true; }
  catch (err) { await chrome.storage.local.set({ telegramLastError: String(err?.message || err) }); }

  await notifyChrome(
    telegramOk ? '🔔 Live Lab — alert inviato su iPhone' : '⚠️ Live Lab — Telegram non inviato',
    telegramOk ? `${updated.home} - ${updated.away}\n${updated.minute}' · xG ${xg.toFixed(2)} · SOT ${sot}` : 'Apri Live Lab e controlla la configurazione Telegram.'
  );
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(null);
  const shouldSeedWhitelist = !current.whitelistCustomized && (!Array.isArray(current.whitelist) || current.whitelist.length === 0 || !current.whitelistSeedVersion);
  await chrome.storage.local.set({ ...DEFAULTS, ...current, ...(shouldSeedWhitelist ? { whitelist: DEFAULT_WHITELIST, whitelistSeedVersion: 1 } : {}) });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'LIVE_HEARTBEAT') chrome.storage.local.set({ lastLiveHeartbeat: Date.now() });
  if (msg?.type === 'LIVE_CANDIDATE') handleLiveCandidate(msg.match, sender);
  if (msg?.type === 'MATCH_STATS') handleStats(msg.data, sender);
  if (msg?.type === 'TEST_TELEGRAM') {
    sendTelegram(`🔔 Live Lab — test\n\nTelegram è configurato correttamente.\nWhitelist: 81 campionati.\nStrike Rate storico: ${LEGACY_OVERALL.strike}% overall.\nForebet Gate: attivo.`)
      .then(() => { chrome.storage.local.set({ telegramLastError: '' }); sendResponse({ ok: true }); })
      .catch(err => { chrome.storage.local.set({ telegramLastError: String(err?.message || err) }); sendResponse({ ok: false, error: String(err?.message || err) }); });
    return true;
  }
});

chrome.notifications.onClicked.addListener(async () => {
  const s = await cfg();
  const latest = (s.alerts || []).find(a => a.url);
  if (latest?.url) chrome.tabs.create({ url: latest.url, active: true });
});
