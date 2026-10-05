(() => {
  if (window.__LIVE_LAB_LOADED__) return;
  window.__LIVE_LAB_LOADED__ = true;

  const text = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const num = v => { const m = String(v ?? '').replace(',', '.').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : NaN; };
  const minuteFrom = s => { if (!s) return NaN; const m = s.match(/(\d{1,3})(?:\+\d+)?['’]?/); return m ? Number(m[1]) : NaN; };

  function scoreFromRow(row) {
    const homeEl = row.querySelector('.event__score--home, [class*="score--home"]');
    const awayEl = row.querySelector('.event__score--away, [class*="score--away"]');
    let h = num(text(homeEl)), a = num(text(awayEl));
    if (Number.isFinite(h) && Number.isFinite(a)) return [h, a];
    const scoreText = text(row).match(/\b(\d{1,2})\s*[-:]\s*(\d{1,2})\b/);
    return scoreText ? [Number(scoreText[1]), Number(scoreText[2])] : [NaN, NaN];
  }

  function teamName(row, side) {
    const selectors = side === 'home' ? ['.event__participant--home', '[class*="participant--home"]'] : ['.event__participant--away', '[class*="participant--away"]'];
    for (const sel of selectors) { const v = text(row.querySelector(sel)); if (v) return v; }
    return side === 'home' ? 'Casa' : 'Ospite';
  }

  function findLeague(row) {
    let n = row.previousElementSibling;
    for (let i = 0; n && i < 10; i++, n = n.previousElementSibling) {
      const t = text(n); if (t && /event__title|header|league|tournament/i.test(n.className || '')) return t.slice(0, 160);
    }
    const section = row.closest('[class*="sportName"], [class*="tournament"], [class*="league"]');
    return text(section?.querySelector('[class*="title"], [class*="league"]')) || '';
  }

  function matchUrl(row) {
    const a = row.querySelector('a[href*="/partita/"], a[href*="/match/"]') || row.closest('a[href]');
    if (a?.href) return a.href.split('#')[0];
    const overlay = row.querySelector('[href]'); return overlay?.href ? overlay.href.split('#')[0] : '';
  }

  function matchId(row) {
    const id = row.id || row.getAttribute('data-id') || ''; const m = id.match(/(?:g_\d_|event_)?([A-Za-z0-9]{6,})$/); return m ? m[1] : id;
  }

  function isRadarCandidate(minute, h, a) {
    if (minute < 20 || minute > 82) return false;
    const total = h + a, gap = Math.abs(h - a);
    const goalPressure = minute <= 45 && total <= 1;
    const lateGoal = minute >= 55 && minute <= 78 && gap <= 1;
    const equalizer = minute >= 35 && gap === 1;
    const favoritePushWindow = minute >= 45 && minute <= 76 && gap <= 1;
    return goalPressure || lateGoal || equalizer || favoritePushWindow;
  }

  function scanLiveList() {
    chrome.runtime.sendMessage({ type: 'LIVE_HEARTBEAT' });
    const rows = [...document.querySelectorAll('.event__match, [class*="event__match"]')];
    for (const row of rows) {
      const timeEl = row.querySelector('.event__stage--block, .event__stage, .event__time, [class*="event__time"], [class*="stage"]');
      const minute = minuteFrom(text(timeEl)); if (!Number.isFinite(minute)) continue;
      const [homeScore, awayScore] = scoreFromRow(row);
      if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
      const match={id:matchId(row),home:teamName(row,'home'),away:teamName(row,'away'),league:findLeague(row),minute,homeScore,awayScore,url:matchUrl(row)};
      chrome.runtime.sendMessage({type:'LIVE_SCORE',match});
      if (!isRadarCandidate(minute, homeScore, awayScore)) continue;
      chrome.runtime.sendMessage({ type: 'LIVE_CANDIDATE', match });
    }
  }

  function valueNearLabel(labelRegex) {
    const all = [...document.querySelectorAll('div, span')];
    for (const el of all) {
      const t = text(el); if (!t || t.length > 90 || !labelRegex.test(t)) continue;
      const row = el.closest('[class*="stat"], [class*="row"], [class*="category"]') || el.parentElement; if (!row) continue;
      const vals = text(row).match(/\d+(?:[.,]\d+)?/g) || []; const nums = vals.map(num).filter(Number.isFinite);
      if (nums.length >= 2) return nums.slice(0, 2);
      const kids = [...row.querySelectorAll('div, span')].map(x => num(text(x))).filter(Number.isFinite); if (kids.length >= 2) return [kids[0], kids[kids.length - 1]];
    }
    return null;
  }

  function parseHeader() {
    const home = text(document.querySelector('.duelParticipant__home .participant__participantName, [class*="duelParticipant__home"] [class*="participantName"]')) || 'Casa';
    const away = text(document.querySelector('.duelParticipant__away .participant__participantName, [class*="duelParticipant__away"] [class*="participantName"]')) || 'Ospite';
    const scoreText = text(document.querySelector('.detailScore__wrapper, [class*="detailScore"]')); const sm = scoreText.match(/(\d+)\s*[-:]\s*(\d+)/);
    const minuteText = text(document.querySelector('[class*="fixedHeaderDuel__detailStatus"], [class*="detailScore__status"], [class*="stage"]'));
    return { home, away, homeScore: sm ? Number(sm[1]) : 0, awayScore: sm ? Number(sm[2]) : 0, minute: minuteFrom(minuteText), url: location.href.split('#')[0] };
  }

  function getPair(...regexes) { for (const re of regexes) { const v = valueNearLabel(re); if (v) return v; } return null; }

  function scanMatchStats() {
    const body = document.body?.innerText || ''; if (!/Expected Goals|\bxG\b|Tiri in porta|Shots on Goal|Shots on Target/i.test(body)) return;
    const xg = getPair(/^(Expected Goals(?: \(xG\))?|xG)$/i, /Expected Goals|\bxG\b/i);
    const sot = getPair(/^(Tiri in porta|Shots on Goal|Shots on Target)$/i, /Tiri in porta|Shots on Goal|Shots on Target/i); if (!xg || !sot) return;
    const attacks = getPair(/^Attacchi$/i, /^Attacks$/i);
    const dangerous = getPair(/Attacchi pericolosi/i, /Dangerous Attacks/i);
    const reds = getPair(/Cartellini rossi/i, /Red Cards/i);
    const penalties = getPair(/^Rigori$/i, /^Penalties$/i);
    const possession = getPair(/Possesso palla/i, /Ball Possession/i, /^Possession$/i);
    const h = parseHeader();
    chrome.runtime.sendMessage({ type: 'MATCH_STATS', data: {
      ...h, xgHome:xg[0],xgAway:xg[1],xgTotal:xg[0]+xg[1],sotHome:sot[0],sotAway:sot[1],sotTotal:sot[0]+sot[1],
      attacksHome:attacks?.[0],attacksAway:attacks?.[1],dangerousHome:dangerous?.[0],dangerousAway:dangerous?.[1],
      redCardsHome:reds?.[0],redCardsAway:reds?.[1],penaltiesHome:penalties?.[0],penaltiesAway:penalties?.[1],
      possessionHome:possession?.[0],possessionAway:possession?.[1]
    }});
  }

  function clickStatsTabIfPresent() {
    const nodes = [...document.querySelectorAll('a, button, div[role="tab"]')]; const tab = nodes.find(el => /^(Statistiche|Statistics)$/i.test(text(el)));
    if (tab && !/match-statistics/.test(location.hash)) { try { tab.click(); } catch (_) {} }
  }

  setInterval(scanLiveList, 20000);
  setInterval(() => { clickStatsTabIfPresent(); scanMatchStats(); }, 3500);
  const obs = new MutationObserver(() => { clearTimeout(window.__llDebounce); window.__llDebounce = setTimeout(() => { scanLiveList(); scanMatchStats(); }, 800); });
  obs.observe(document.documentElement, { subtree:true, childList:true, characterData:true });
  scanLiveList(); setTimeout(() => { clickStatsTabIfPresent(); scanMatchStats(); }, 1800);
})();
