import {getSupabaseAdmin} from '@/lib/supabase-server';

export const dynamic='force-dynamic';
const eur=(v:any)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(Number(v||0));
const pct=(v:any)=>`${Number(v||0).toFixed(1)}%`;

export default async function PaperPage(){
  const sb=getSupabaseAdmin();
  let settings:any=null,trades:any[]=[];
  if(sb){
    const [s,t]=await Promise.all([
      sb.from('live_lab_paper_settings').select('*').eq('id',1).maybeSingle(),
      sb.from('live_lab_paper_trades').select('*').order('created_at',{ascending:false}).limit(100)
    ]);
    settings=s.data??null;trades=t.data??[];
  }
  const open=trades.filter(x=>x.status==='OPEN');
  const closed=trades.filter(x=>x.status==='CLOSED');
  const pnl=closed.reduce((a,x)=>a+Number(x.net_pnl||0),0);
  const start=Number(settings?.bankroll_start||0),bank=Number(settings?.bankroll_current||0);
  const roi=start?100*pnl/start:0;
  const wins=closed.filter(x=>Number(x.net_pnl||0)>0).length;
  const losses=closed.filter(x=>Number(x.net_pnl||0)<0).length;
  return <>
    <header className="header"><div><h2>Paper Exchange</h2><div className="muted">AUTO · nessun ordine reale inviato a Betfair</div></div><span className="badge"><span className="dot"/>PAPER AUTO 0.6.0</span></header>
    <section className="cards">
      <K label="Cassa paper" value={eur(bank)} foot={`iniziale ${eur(start)}`}/>
      <K label="P/L netto" value={`${pnl>=0?'+':''}${eur(pnl)}`} foot={`ROI ${roi>=0?'+':''}${roi.toFixed(2)}%`}/>
      <K label="Posizioni aperte" value={String(open.length)} foot="Goal Pressure AUTO"/>
      <K label="Chiuse" value={String(closed.length)} foot={`${wins} win · ${losses} loss`}/>
    </section>

    <section className="grid2">
      <div className="card panel"><h3>Money management</h3><div className="rules">
        <R n="B" t={`Tier B · ${pct(settings?.tier_b_pct)} della cassa`}/>
        <R n="A" t={`Tier A · ${pct(settings?.tier_a_pct)} della cassa`}/>
        <R n="A+" t={`Tier A score ≥ ${settings?.tier_a_strong_score??95} · ${pct(settings?.tier_a_strong_pct)}`}/>
        <R n="MAX" t={`Tetto assoluto · ${pct(settings?.max_stake_pct)} per operazione`}/>
      </div></div>
      <div className="card panel"><h3>🔥 Goal Pressure · esecuzione</h3><div className="rules">
        <R n="1" t="1/4 dello stake alla quota Exchange dell'alert"/>
        <R n="2" t={`2ª tranche a +${settings?.goal_pressure_tick_gap??25} tick`}/>
        <R n="3" t={`3ª tranche a +${2*Number(settings?.goal_pressure_tick_gap??25)} tick`}/>
        <R n="4" t={`4ª tranche a +${3*Number(settings?.goal_pressure_tick_gap??25)} tick`}/>
      </div><p className="muted" style={{fontSize:12,marginTop:12}}>Le tranche non abbinate vengono cancellate al gol. Il P/L paper usa la quota lay disponibile dopo il gol e applica commissione {pct(settings?.commission_pct)}.</p></div>
    </section>

    <section className="card panel"><h3>Operazioni paper</h3>{trades.length?<div className="tableWrap"><table className="table"><thead><tr><th>Stato</th><th>Partita</th><th>Strategia</th><th>Tier</th><th>Stake</th><th>Quota media</th><th>P/L</th></tr></thead><tbody>{trades.map(t=><tr key={t.id}><td>{t.status}</td><td>{t.home_team} – {t.away_team}</td><td>{t.strategy_label||t.strategy_code}</td><td>{t.alert_tier} · {t.strategy_score}/100</td><td>{eur(t.stake_filled||t.stake_total)} <span className="muted">({pct(t.stake_pct)})</span></td><td>{t.avg_price?Number(t.avg_price).toFixed(2):t.initial_price?Number(t.initial_price).toFixed(2):'—'}</td><td>{t.net_pnl==null?'—':`${Number(t.net_pnl)>=0?'+':''}${eur(t.net_pnl)}`}</td></tr>)}</tbody></table></div>:<div className="empty">Nessuna operazione paper ancora registrata.</div>}</section>
  </>;
}
function K({label,value,foot}:{label:string,value:string,foot:string}){return <div className="card kpi"><div className="label">{label}</div><div className="value">{value}</div><div className="foot">{foot}</div></div>}
function R({n,t}:{n:string,t:string}){return <div className="rule"><div className="ruleNum">{n}</div><div><strong>{t}</strong></div></div>}
