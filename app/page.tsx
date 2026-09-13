import {getSupabaseAdmin} from '@/lib/supabase-server';
import {LEGACY_OVERALL,LEGACY_LEAGUE_STATS,WHITELIST} from '@/lib/data';

export const dynamic='force-dynamic';
export default async function Dashboard(){
  const sb=getSupabaseAdmin();
  const today=new Date().toISOString().slice(0,10);
  let todayCount=0,totalLive=0,latest:any=null,liveResolved=0,liveHits=0;
  if(sb){
    const [t,all,last,resolved,hits]=await Promise.all([
      sb.from('live_lab_alerts').select('id',{count:'exact',head:true}).eq('match_date',today),
      sb.from('live_lab_alerts').select('id',{count:'exact',head:true}),
      sb.from('live_lab_alerts').select('*').order('created_at',{ascending:false}).limit(1).maybeSingle(),
      sb.from('live_lab_alerts').select('id',{count:'exact',head:true}).in('outcome',['HIT','MISS']),
      sb.from('live_lab_alerts').select('id',{count:'exact',head:true}).eq('outcome','HIT')
    ]);
    todayCount=t.count??0; totalLive=all.count??0; latest=last.data??null; liveResolved=resolved.count??0; liveHits=hits.count??0;
  }
  const liveStrike=liveResolved?Math.round((liveHits/liveResolved)*100):null;
  const displayStrike=liveStrike??LEGACY_OVERALL.strike;
  const top=Object.entries(LEGACY_LEAGUE_STATS).sort((a,b)=>b[1].strike-a[1].strike||b[1].picks-a[1].picks).slice(0,5);
  return <><header className="header"><div><h2>Live Lab</h2><div className="muted">Monitoraggio strategia Over 1,5</div></div><span className="badge"><span className="dot"/>Forebet Gate attivo</span></header>
  <section className="cards"><K label="Alert oggi" value={String(todayCount)} foot="trigger Live Lab registrati"/><K label="Strike Rate" value={`${displayStrike}%`} foot={liveStrike!==null?`${liveHits}/${liveResolved} Live Lab`:`baseline InPlayGuru ${LEGACY_OVERALL.hits}/${LEGACY_OVERALL.resolved}`}/><K label="Campionati attivi" value={String(WHITELIST.length)} foot="whitelist iniziale"/><K label="Trigger Live Lab" value={String(totalLive)} foot="inclusi quelli bloccati"/><K label="Fair Odd baseline" value={LEGACY_OVERALL.fairOdd.toFixed(2)} foot="storico InPlayGuru"/></section>
  <section className="grid2"><div className="card panel"><h3>Ultimo Alert</h3>{latest?<div className="alertbox"><div className="matchrow"><div><div className="muted">{latest.league_name||'Campionato'}</div><div className="teams">{latest.home_team} – {latest.away_team}</div></div><div className="score">{latest.home_score}-{latest.away_score}</div></div><div className="stats"><div className="stat"><span>Minuto</span><strong>{latest.alert_minute}'</strong></div><div className="stat"><span>xG totale</span><strong>{latest.xg_total??'—'}</strong></div><div className="stat"><span>SOT totale</span><strong>{latest.sot_total??'—'}</strong></div></div><div className="sr">🎯 Gate {latest.forebet_gate_status} · 🔮 Forebet RE: {latest.forebet_predicted_score||'N/D'}</div></div>:<div className="empty">Nessun trigger reale ancora registrato.</div>}</div>
  <div className="card panel"><h3>Andamento ultimi segnali</h3><div className="chart"><svg viewBox="0 0 600 220" preserveAspectRatio="none"><defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#9ad8b5" stopOpacity=".55"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient></defs><path d="M0 180 L45 150 L90 165 L135 125 L180 140 L225 100 L270 115 L315 85 L360 100 L405 70 L450 88 L495 55 L540 72 L600 38 L600 220 L0 220 Z" fill="url(#g)"/><path d="M0 180 L45 150 L90 165 L135 125 L180 140 L225 100 L270 115 L315 85 L360 100 L405 70 L450 88 L495 55 L540 72 L600 38" fill="none" stroke="#2e8b57" strokeWidth="4"/></svg></div><p className="muted" style={{fontSize:12}}>Il grafico dinamico verrà alimentato dagli esiti HIT/MISS salvati in Live Lab.</p></div></section>
  <section className="grid2"><div className="card panel"><h3>Top Campionati · baseline InPlayGuru</h3><div className="tableWrap"><table className="table"><thead><tr><th>Campionato</th><th>Pick</th><th>Strike</th><th>Fair Odd</th></tr></thead><tbody>{top.map(([l,s])=><tr key={l}><td>{l}</td><td>{s.picks}</td><td className={s.strike>=75?'good':s.strike<60?'bad':'warn'}>{s.strike}%</td><td>{s.fairOdd?.toFixed(2)??'—'}</td></tr>)}</tbody></table></div></div><div className="card panel"><h3>Strategia Attiva</h3><div className="rules"><R n="1" t="Minuto 23–32"/><R n="2" t="Risultato 0-0"/><R n="3" t="SOT totale ≥ 1"/><R n="4" t="xG totale ≥ 0,50"/><R n="5" t="Forebet Gate: blocca solo RE con < 2 gol"/><R n="6" t="Un solo alert Telegram"/></div></div></section></>}
function K({label,value,foot}:{label:string,value:string,foot:string}){return <div className="card kpi"><div className="label">{label}</div><div className="value">{value}</div><div className="foot">{foot}</div></div>}
function R({n,t}:{n:string,t:string}){return <div className="rule"><div className="ruleNum">{n}</div><div><strong>{t}</strong></div></div>}
