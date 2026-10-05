import {getSupabaseAdmin} from '@/lib/supabase-server';

export const dynamic='force-dynamic';
const eur=(v:any)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0));
const pct=(v:any)=>`${Number(v||0).toFixed(1)}%`;
const n=(v:any)=>Number(v||0);
const labels:Record<string,string>={GOAL_PRESSURE:'🔥 Fireball',LATE_GOAL:'⚡ Fireball Xtreme',EQUALIZER:'🔄 Relay Reloaded',FAVORITE_PUSH:'👑 Reback Reloaded'};

export default async function ArchivioPage(){
  const sb=getSupabaseAdmin();
  let settings:any=null,trades:any[]=[],orders:any[]=[],alerts:any[]=[];
  if(sb){
    const [s,t,o,a]=await Promise.all([
      sb.from('live_lab_paper_settings').select('*').eq('id',1).maybeSingle(),
      sb.from('live_lab_paper_trades').select('*').order('created_at',{ascending:false}).limit(1000),
      sb.from('live_lab_paper_orders').select('*').order('created_at',{ascending:false}).limit(5000),
      sb.from('live_lab_alerts').select('id,match_key,strategy_code,strategy_score,alert_tier,created_at').order('created_at',{ascending:false}).limit(2000)
    ]);
    settings=s.data??null;trades=t.data??[];orders=o.data??[];alerts=a.data??[];
  }

  const closed=trades.filter(t=>t.status==='CLOSED');
  const open=trades.filter(t=>t.status==='OPEN');
  const pnl=closed.reduce((s,t)=>s+n(t.net_pnl),0);
  const stakeClosed=closed.reduce((s,t)=>s+n(t.stake_filled||t.stake_total),0);
  const wins=closed.filter(t=>n(t.net_pnl)>0).length;
  const losses=closed.filter(t=>n(t.net_pnl)<0).length;
  const pushes=closed.length-wins-losses;
  const strike=closed.length?wins/closed.length*100:0;
  const roiStake=stakeClosed?pnl/stakeClosed*100:0;
  const avgPnl=closed.length?pnl/closed.length:0;
  const avgStake=closed.length?stakeClosed/closed.length:0;

  const chrono=[...closed].sort((a,b)=>new Date(a.closed_at||a.created_at).getTime()-new Date(b.closed_at||b.created_at).getTime());
  let equity=0,peak=0,maxDd=0;
  for(const t of chrono){equity+=n(t.net_pnl);peak=Math.max(peak,equity);maxDd=Math.max(maxDd,peak-equity);}

  const byStrategy=['GOAL_PRESSURE','LATE_GOAL','EQUALIZER','FAVORITE_PUSH'].map(code=>{
    const rows=closed.filter(t=>t.strategy_code===code),all=trades.filter(t=>t.strategy_code===code);
    const sp=rows.reduce((s,t)=>s+n(t.net_pnl),0),stk=rows.reduce((s,t)=>s+n(t.stake_filled||t.stake_total),0),w=rows.filter(t=>n(t.net_pnl)>0).length;
    return {code,label:labels[code],alerts:alerts.filter(a=>a.strategy_code===code).length,trades:all.length,closed:rows.length,wins:w,losses:rows.filter(t=>n(t.net_pnl)<0).length,strike:rows.length?w/rows.length*100:0,pnl:sp,roi:stk?sp/stk*100:0,avgStake:rows.length?stk/rows.length:0};
  });

  const orderMap=new Map<string,any[]>();
  for(const o of orders){if(!orderMap.has(o.trade_id))orderMap.set(o.trade_id,[]);orderMap.get(o.trade_id)!.push(o);}
  const trancheBuckets=[1,2,3,4,5,6,7,8].map(k=>({k,count:trades.filter(t=>(orderMap.get(t.id)||[]).filter(o=>o.status==='MATCHED').length===k).length}));
  const reasonCounts=new Map<string,number>();
  for(const t of closed){const r=t.close_reason||'ALTRO';reasonCounts.set(r,(reasonCounts.get(r)||0)+1);}
  const topReasons=[...reasonCounts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);

  return <>
    <header className="header"><div><h2>Archivio & Analytics</h2><div className="muted">Storico completo Paper AUTO · strategie, stake, tranche, P/L e motivi di uscita</div></div><span className="badge"><span className="dot"/>LIVE LAB 0.7</span></header>

    <section className="cards">
      <K label="Trade archiviati" value={String(trades.length)} foot={`${open.length} aperti · ${closed.length} chiusi`}/>
      <K label="Strike rate" value={`${strike.toFixed(1)}%`} foot={`${wins} W · ${losses} L · ${pushes} pari`}/>
      <K label="P/L netto" value={`${pnl>=0?'+':''}${eur(pnl)}`} foot={`media ${eur(avgPnl)} / trade`}/>
      <K label="ROI su stake" value={`${roiStake>=0?'+':''}${roiStake.toFixed(2)}%`} foot={`stake medio ${eur(avgStake)}`}/>
      <K label="Max drawdown" value={eur(maxDd)} foot={`cassa attuale ${eur(settings?.bankroll_current)}`}/>
    </section>

    <section className="card panel" style={{marginBottom:18}}><h3>Performance per strategia</h3><div className="tableWrap"><table className="table"><thead><tr><th>Strategia</th><th>Alert</th><th>Trade</th><th>Chiusi</th><th>W/L</th><th>Strike</th><th>Stake medio</th><th>P/L</th><th>ROI</th></tr></thead><tbody>{byStrategy.map(x=><tr key={x.code}><td><strong>{x.label}</strong></td><td>{x.alerts}</td><td>{x.trades}</td><td>{x.closed}</td><td>{x.wins}/{x.losses}</td><td className={x.strike>=70?'good':x.closed?'warn':''}>{x.closed?`${x.strike.toFixed(1)}%`:'—'}</td><td>{x.closed?eur(x.avgStake):'—'}</td><td className={x.pnl>0?'good':x.pnl<0?'bad':''}>{x.closed?`${x.pnl>=0?'+':''}${eur(x.pnl)}`:'—'}</td><td className={x.roi>0?'good':x.roi<0?'bad':''}>{x.closed?`${x.roi>=0?'+':''}${x.roi.toFixed(2)}%`:'—'}</td></tr>)}</tbody></table></div></section>

    <section className="grid2">
      <div className="card panel"><h3>Quante tranche vengono realmente abbinate?</h3><div className="rules">{trancheBuckets.filter(x=>x.count>0).map(x=><R key={x.k} n={String(x.k)} t={`${x.count} trade con ${x.k} tranche abbinate`}/>)}</div>{!trancheBuckets.some(x=>x.count>0)&&<div className="empty">Dati tranche ancora insufficienti.</div>}<p className="muted" style={{fontSize:12,marginTop:12}}>Serve a capire quanto spesso Fireball/Fireball Xtreme arrivano alle tranche più alte e quanto capitale viene davvero esposto.</p></div>
      <div className="card panel"><h3>Motivi di chiusura</h3><div className="rules">{topReasons.map(([reason,count],i)=><R key={reason} n={String(i+1)} t={`${reason.replaceAll('_',' ')} · ${count}`}/>)}</div>{!topReasons.length&&<div className="empty">Nessun trade chiuso ancora.</div>}</div>
    </section>

    <section className="card panel" style={{marginTop:18}}><h3>Archivio operazioni</h3>{trades.length?<div className="tableWrap"><table className="table"><thead><tr><th>Data</th><th>Partita</th><th>Strategia</th><th>Tier</th><th>Ingresso</th><th>Stake</th><th>Tranche</th><th>Uscita</th><th>P/L netto</th></tr></thead><tbody>{trades.map(t=>{const os=orderMap.get(t.id)||[],matched=os.filter(o=>o.status==='MATCHED');return <tr key={t.id}><td>{new Date(t.created_at).toLocaleDateString('it-IT')}</td><td><strong>{t.home_team} – {t.away_team}</strong><div className="muted" style={{fontSize:11}}>{t.league_name||''}</div></td><td>{labels[t.strategy_code]||t.strategy_label||t.strategy_code}<div className="muted" style={{fontSize:11}}>{t.course_strategy||''}</div></td><td>{t.alert_tier||'—'} · {t.strategy_score??'—'}</td><td>{t.entry_minute!=null?`${t.entry_minute}'`:''} {t.entry_home_score}-{t.entry_away_score}<div className="muted" style={{fontSize:11}}>{t.initial_price?`@ ${Number(t.initial_price).toFixed(2)}`:''}</div></td><td>{eur(t.stake_filled||t.stake_total)}<div className="muted" style={{fontSize:11}}>{pct(t.stake_pct)}</div></td><td>{matched.length}/{os.length||'—'}</td><td>{t.status==='OPEN'?<span className="tag unknown">OPEN</span>:<><span className="tag pass">CLOSED</span><div className="muted" style={{fontSize:11,marginTop:4}}>{(t.close_reason||'').replaceAll('_',' ')}</div></>}</td><td className={n(t.net_pnl)>0?'good':n(t.net_pnl)<0?'bad':''}>{t.net_pnl==null?'—':`${n(t.net_pnl)>=0?'+':''}${eur(t.net_pnl)}`}</td></tr>})}</tbody></table></div>:<div className="empty">Nessuna operazione ancora registrata.</div>}</section>
  </>;
}

function K({label,value,foot}:{label:string,value:string,foot:string}){return <div className="card kpi"><div className="label">{label}</div><div className="value">{value}</div><div className="foot">{foot}</div></div>}
function R({n,t}:{n:string,t:string}){return <div className="rule"><div className="ruleNum">{n}</div><div><strong>{t}</strong></div></div>}
