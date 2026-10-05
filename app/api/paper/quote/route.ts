import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseAdmin} from '@/lib/supabase-server';
import {goalPressureOrders,stakePlan,weightedAveragePrice} from '@/lib/paper-engine';

type Payload={
  alertId?:string;matchKey:string;strategyCode:string;marketId?:string;selectionId?:string;marketName?:string;selectionName?:string;
  backPrice?:number;layPrice?:number;minute:number;homeScore:number;awayScore:number
};
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):null;
const money=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;

export async function POST(req:NextRequest){
  const expected=process.env.LIVE_LAB_INGEST_KEY;
  if(expected&&req.headers.get('x-live-lab-key')!==expected)return NextResponse.json({ok:false,error:'unauthorized'},{status:401});
  const p=(await req.json()) as Payload;
  if(!p?.matchKey||!p?.strategyCode||!Number.isFinite(Number(p.minute)))return NextResponse.json({ok:false,error:'matchKey/strategyCode/minute required'},{status:400});
  const sb=getSupabaseAdmin();if(!sb)return NextResponse.json({ok:false,error:'supabase unavailable'},{status:503});

  const {data:settings,error:settingsError}=await sb.from('live_lab_paper_settings').select('*').eq('id',1).single();
  if(settingsError||!settings)return NextResponse.json({ok:false,error:settingsError?.message||'paper settings missing'},{status:500});
  if(!settings.enabled)return NextResponse.json({ok:true,paper:{enabled:false}});

  const {data:alert}=await sb.from('live_lab_alerts').select('*').eq('match_key',p.matchKey).eq('strategy_code',p.strategyCode).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!alert)return NextResponse.json({ok:false,error:'matching alert not found'},{status:404});
  if(alert.forebet_gate_status==='BLOCK'||alert.outcome==='BLOCKED')return NextResponse.json({ok:true,paper:{blocked:true}});
  if(p.strategyCode!=='GOAL_PRESSURE')return NextResponse.json({ok:true,paper:{status:'WAITING_STRATEGY_RULE',strategyCode:p.strategyCode}});

  const existing=await sb.from('live_lab_paper_trades').select('*').eq('match_key',p.matchKey).eq('strategy_code',p.strategyCode).maybeSingle();
  let trade:any=existing.data??null;
  const back=num(p.backPrice),lay=num(p.layPrice);

  if(!trade){
    if(!back)return NextResponse.json({ok:true,paper:{status:'WAITING_PRICE',reason:'quota Exchange non disponibile'}});
    const plan=stakePlan(String(alert.alert_tier||'B'),Number(alert.strategy_score||0),settings as any);
    const {data:created,error:createError}=await sb.from('live_lab_paper_trades').insert({
      alert_id:alert.id,match_key:p.matchKey,match_date:alert.match_date,league_name:alert.league_name,home_team:alert.home_team,away_team:alert.away_team,
      strategy_code:p.strategyCode,strategy_label:alert.strategy_label,strategy_score:alert.strategy_score,alert_tier:alert.alert_tier,
      market_type:'OVER_UNDER_15',market_name:p.marketName||'Over/Under 1.5 Goals',market_id:p.marketId||null,selection_id:p.selectionId||null,
      selection_name:p.selectionName||'Over 1.5 Goals',status:'OPEN',bankroll_before:Number(settings.bankroll_current),stake_pct:plan.pct,stake_total:plan.total,
      stake_filled:0,initial_price:back,entry_minute:p.minute,entry_home_score:p.homeScore,entry_away_score:p.awayScore,last_price:back,last_minute:p.minute,
      last_home_score:p.homeScore,last_away_score:p.awayScore
    }).select('*').single();
    if(createError||!created)return NextResponse.json({ok:false,error:createError?.message||'paper trade create failed'},{status:500});
    trade=created as any;
    const orders=goalPressureOrders(plan.total,back,Number(settings.goal_pressure_tranches),Number(settings.goal_pressure_tick_gap));
    const rows=orders.map(o=>({trade_id:trade.id,tranche_no:o.trancheNo,target_price:o.targetPrice,stake:o.stake,status:o.status,matched_price:o.status==='MATCHED'?o.targetPrice:null,matched_at:o.status==='MATCHED'?new Date().toISOString():null}));
    const {error:ordersError}=await sb.from('live_lab_paper_orders').insert(rows);if(ordersError)return NextResponse.json({ok:false,error:ordersError.message},{status:500});
  }

  const {data:ordersData}=await sb.from('live_lab_paper_orders').select('*').eq('trade_id',trade.id).order('tranche_no');
  const orders:any[]=ordersData??[];
  const entryGoals=Number(trade.entry_home_score||0)+Number(trade.entry_away_score||0),nowGoals=Number(p.homeScore||0)+Number(p.awayScore||0);

  if(trade.status==='OPEN'&&nowGoals===entryGoals&&back){
    for(const o of orders.filter((x:any)=>x.status==='PENDING'&&Number(x.target_price)<=back)){
      await sb.from('live_lab_paper_orders').update({status:'MATCHED',matched_price:Number(o.target_price),matched_at:new Date().toISOString()}).eq('id',o.id);
    }
  }

  const {data:freshData}=await sb.from('live_lab_paper_orders').select('*').eq('trade_id',trade.id).order('tranche_no');
  const freshOrders:any[]=freshData??[];
  const matched=freshOrders.filter((o:any)=>o.status==='MATCHED');
  const filled=money(matched.reduce((a:number,o:any)=>a+Number(o.stake||0),0));
  const avg=weightedAveragePrice(freshOrders as any);

  const entryMinute=Number(trade.entry_minute||0);
  const courseExitMinute=entryMinute>=30?80:70;
  const goalExit=nowGoals>entryGoals;
  const timeExit=nowGoals===entryGoals&&Number(p.minute)>=courseExitMinute;

  if(trade.status==='OPEN'&&(goalExit||timeExit)&&lay&&filled>0&&avg){
    const gross=money(filled*(avg/lay-1));
    const commission=gross>0?money(gross*Number(settings.commission_pct)/100):0;
    const net=money(gross-commission);
    const closeReason=goalExit?'GOAL_CASHOUT_PAPER':'COURSE_TIME_EXIT_PAPER';
    await sb.from('live_lab_paper_orders').update({status:'CANCELLED',cancelled_at:new Date().toISOString()}).eq('trade_id',trade.id).eq('status','PENDING');
    await sb.from('live_lab_paper_trades').update({status:'CLOSED',stake_filled:filled,avg_price:avg,last_price:lay,last_minute:p.minute,last_home_score:p.homeScore,last_away_score:p.awayScore,gross_pnl:gross,commission,net_pnl:net,close_reason:closeReason,closed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',trade.id);
    const bankrollAfter=money(Number(settings.bankroll_current)+net);
    await sb.from('live_lab_paper_settings').update({bankroll_current:bankrollAfter,updated_at:new Date().toISOString()}).eq('id',1);
    return NextResponse.json({ok:true,paper:{status:'CLOSED',tradeId:trade.id,stakePct:Number(trade.stake_pct),stakeTotal:Number(trade.stake_total),stakeFilled:filled,avgPrice:avg,exitLayPrice:lay,grossPnl:gross,commission,netPnl:net,bankrollAfter,closeReason,courseExitMinute}});
  }

  await sb.from('live_lab_paper_trades').update({stake_filled:filled,avg_price:avg,last_price:back??trade.last_price,last_minute:p.minute,last_home_score:p.homeScore,last_away_score:p.awayScore,updated_at:new Date().toISOString()}).eq('id',trade.id);
  return NextResponse.json({ok:true,paper:{status:trade.status,tradeId:trade.id,stakePct:Number(trade.stake_pct),stakeTotal:Number(trade.stake_total),stakeFilled:filled,avgPrice:avg,courseExitMinute,orders:freshOrders.map((o:any)=>({tranche:o.tranche_no,stake:Number(o.stake),targetPrice:Number(o.target_price),status:o.status}))}});
}
