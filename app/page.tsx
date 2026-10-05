import {getSupabaseAdmin} from '@/lib/supabase-server';
import {LEGACY_OVERALL,WHITELIST} from '@/lib/data';

export const dynamic='force-dynamic';
const LABELS:Record<string,string>={GOAL_PRESSURE:'🔥 Goal Pressure',LATE_GOAL:'⚡ Late Goal',EQUALIZER:'🔄 Equalizer',FAVORITE_PUSH:'👑 Favorite Push'};

export default async function Dashboard(){
  const sb=getSupabaseAdmin();
  const today=new Date().toISOString().slice(0,10);
  let todayCount=0,totalAlerts=0,totalSnapshots=0,latest:any=null,recent:any[]=[],paper:any=null;
  if(sb){
    const [t,all,snap,last,r,p]=await Promise.all([
      sb.from('live_lab_alerts').select('id',{count:'exact',head:true}).eq('match_date',today),
      sb.from('live_lab_alerts').select('id',{count:'exact',head:true}),
      sb.from('live_lab_snapshots').select('id',{count:'exact',head:true}),
      sb.from('live_lab_alerts').select('*').order('created_at',{ascending:false}).limit(1).maybeSingle(),
      sb.from('live_lab_alerts').select('strategy_code,strategy_score,alert_tier,forebet_gate_status,outcome').order('created_at',{ascending:false}).limit(500),
      sb.from('live_lab_paper_settings').select('bankroll_current').eq('id',1).maybeSingle()
    ]);
    todayCount=t.count??0;totalAlerts=all.count??0;totalSnapshots=snap.count??0;latest=last.data??null;recent=r.data??[];paper=p.data??null;
  }
  const counts=recent.reduce((acc:any,x:any)=>{const k=x.strategy_code||'LEGACY';acc[k]=(acc[k]||0)+1;return acc;},{});
  const active=Object.entries(counts).filter(([k])=>k!=='LEGACY').sort((a:any,b:any)=>b[1]-a[1]);
  return <>
    <header className="header"><div><h2>Live Lab</h2><div className="muted">Strategy Radar · Paper Exchange AUTO</div></div><span className="badge"><span className="dot"/>Engine 0.6.0 · Forebet + Betfair Paper</span></header>
    <section className="cards"><K label="Segnali oggi" value={String(todayCount)} foot="tier A/B registrati"/><K label="Snapshot live" value={String(totalSnapshots)} foot="base per ΔxG e pressione"/><K label="Alert totali" value={String(totalAlerts)} foot="storico Live Lab"/><K label="Cassa paper" value={paper?`€ ${Number(paper.bankroll_current).toFixed(2)}`:'—'} foot="AUTO, nessun ordine reale"/><K label="Baseline legacy" value={`${LEGACY_OVERALL.strike}%`} foot="solo confronto, non edge del nuovo radar"/></section>

    <section className="grid2"><div className="card panel"><h3>Ultimo segnale</h3>{latest?<div className="alertbox"><div className="matchrow"><div><div className="muted">{latest.league_name||'Campionato'}</div><div className="teams">{latest.home_team} – {latest.away_team}</div></div><div className="score">{latest.home_score}-{latest.away_score}</div></div><div className="stats"><div className="stat"><span>Minuto</span><strong>{latest.alert_minute}'</strong></div><div className="stat"><span>Score</span><strong>{latest.strategy_score??'—'}/100</strong></div><div className="stat"><span>Tier</span><strong>{latest.alert_tier??'—'}</strong></div></div><div className="sr">{latest.strategy_label||LABELS[latest.strategy_code]||'Segnale legacy'} · Forebet {latest.forebet_gate_status}</div></div>:<div className="empty">Nessun segnale Strategy Radar ancora registrato.</div>}</div>
      <div className="card panel"><h3>Logica alert</h3><div className="rules"><R n="A" t="Score ≥ 88 oppure convergenza di almeno 2 radar ≥ 80"/><R n="B" t="Score ≥ 80"/><R n="W" t="65–79: WATCH, salvato come snapshot ma niente Telegram"/><R n="×" t="Forebet RE < 2 gol: blocco del segnale HOT"/></div></div></section>

    <section className="grid2"><div className="card panel"><h3>Radar attivi</h3><div className="rules"><R n="🔥" t="Goal Pressure · pressione offensiva 20'–45'"/><R n="⚡" t="Late Goal · partita aperta 55'–78'"/><R n="🔄" t="Equalizer · squadra sotto ma in pressione"/><R n="👑" t="Favorite Push · favorita bloccata/sotto di uno"/></div><p className="muted" style={{fontSize:12,marginTop:12}}>Paper AUTO 0.6.0 è attivo per Goal Pressure. Snowball e strategie Under sono escluse.</p></div>
      <div className="card panel"><h3>Segnali per strategia · ultimi 500</h3>{active.length?<div className="tableWrap"><table className="table"><thead><tr><th>Strategia</th><th>Segnali</th></tr></thead><tbody>{active.map(([k,v]:any)=><tr key={k}><td>{LABELS[k]||k}</td><td>{v}</td></tr>)}</tbody></table></div>:<div className="empty">Il nuovo storico si popolerà automaticamente.</div>}</div></section>
  </>;
}
function K({label,value,foot}:{label:string,value:string,foot:string}){return <div className="card kpi"><div className="label">{label}</div><div className="value">{value}</div><div className="foot">{foot}</div></div>}
function R({n,t}:{n:string,t:string}){return <div className="rule"><div className="ruleNum">{n}</div><div><strong>{t}</strong></div></div>}
