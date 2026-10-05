import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseAdmin} from '@/lib/supabase-server';
import {backCashoutGross,fireballXtremeOrders,goalPressureOrders,layCashoutGross,rebackReloadedOrders,relayReloadedOrders,stakePlan,weightedAveragePrice} from '@/lib/paper-engine';

type Quote={role?:string;marketType?:string;marketId?:string;selectionId?:string;marketName?:string;selectionName?:string;selectionSide?:string;backPrice?:number|null;layPrice?:number|null};
type Payload={matchKey:string;strategyCode:string;minute:number;homeScore:number;awayScore:number;favoriteSide?:string|null;quotes?:Quote[];marketId?:string;selectionId?:string;marketName?:string;selectionName?:string;backPrice?:number;layPrice?:number};
const n=(v:any)=>Number.isFinite(Number(v))?Number(v):null;
const m2=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const side=(h:number,a:number)=>h>a?'HOME':a>h?'AWAY':'DRAW';

export async function POST(req:NextRequest){
  const expected=process.env.LIVE_LAB_INGEST_KEY;
  if(expected&&req.headers.get('x-live-lab-key')!==expected)return NextResponse.json({ok:false,error:'unauthorized'},{status:401});
  const p=(await req.json()) as Payload;
  if(!p?.matchKey||!p?.strategyCode||!Number.isFinite(Number(p.minute)))return NextResponse.json({ok:false,error:'matchKey/strategyCode/minute required'},{status:400});
  const sb=getSupabaseAdmin();if(!sb)return NextResponse.json({ok:false,error:'supabase unavailable'},{status:503});
  const {data:settings,error:se}=await sb.from('live_lab_paper_settings').select('*').eq('id',1).single();
  if(se||!settings)return NextResponse.json({ok:false,error:se?.message||'paper settings missing'},{status:500});
  if(!settings.enabled)return NextResponse.json({ok:true,paper:{enabled:false}});
  const {data:alert}=await sb.from('live_lab_alerts').select('*').eq('match_key',p.matchKey).eq('strategy_code',p.strategyCode).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!alert)return NextResponse.json({ok:false,error:'matching alert not found'},{status:404});
  if(alert.forebet_gate_status==='BLOCK'||alert.outcome==='BLOCKED')return NextResponse.json({ok:true,paper:{blocked:true}});

  const strategy=String(p.strategyCode),h=Number(p.homeScore||0),a=Number(p.awayScore||0),goals=h+a;
  const stake=stakePlan(String(alert.alert_tier||'B'),Number(alert.strategy_score||0),settings as any);
  const q=(role:string):Quote|undefined=>{
    const hit=(p.quotes||[]).find(x=>String(x.role||'').toUpperCase()===role.toUpperCase());
    if(hit)return hit;
    return role==='PRIMARY'?{role:'PRIMARY',marketId:p.marketId,selectionId:p.selectionId,marketName:p.marketName,selectionName:p.selectionName,backPrice:p.backPrice,layPrice:p.layPrice}:undefined;
  };
  let {data:trade}=await sb.from('live_lab_paper_trades').select('*').eq('match_key',p.matchKey).eq('strategy_code',strategy).maybeSingle();

  async function insertTrade(base:any,orders:any[]){
    const {data:t,error:e}=await sb.from('live_lab_paper_trades').insert({alert_id:alert.id,match_key:p.matchKey,match_date:alert.match_date,league_name:alert.league_name,home_team:alert.home_team,away_team:alert.away_team,strategy_code:strategy,strategy_label:alert.strategy_label,strategy_score:alert.strategy_score,alert_tier:alert.alert_tier,status:'OPEN',bankroll_before:Number(settings.bankroll_current),stake_pct:stake.pct,stake_total:stake.total,stake_filled:0,entry_minute:Number(p.minute),entry_home_score:h,entry_away_score:a,last_minute:Number(p.minute),last_home_score:h,last_away_score:a,...base}).select('*').single();
    if(e||!t)throw new Error(e?.message||'paper trade create failed');
    const rows=orders.map((o:any)=>({trade_id:t.id,tranche_no:o.trancheNo,target_price:o.targetPrice,stake:o.stake,status:o.status,matched_price:o.status==='MATCHED'?o.targetPrice:null,matched_at:o.status==='MATCHED'?new Date().toISOString():null,market_type:o.marketType||base.market_type||null,market_name:o.marketName||base.market_name||null,market_id:o.marketId||base.market_id||null,selection_id:o.selectionId||base.selection_id||null,selection_name:o.selectionName||base.selection_name||null,side:o.side||'BACK',role:o.role||'PRIMARY'}));
    const {error:oe}=await sb.from('live_lab_paper_orders').insert(rows);if(oe)throw new Error(oe.message);
    return t;
  }

  if(!trade){
    if(strategy==='GOAL_PRESSURE'){
      const x=q('PRIMARY'),bp=n(x?.backPrice);if(!bp)return NextResponse.json({ok:true,paper:{status:'WAITING_PRICE'}});
      const orders=goalPressureOrders(stake.total,bp,Number(settings.goal_pressure_tranches),Number(settings.goal_pressure_tick_gap)).map(o=>({...o,role:'PRIMARY',side:'BACK',marketType:'OVER_UNDER_15',marketName:x?.marketName,marketId:x?.marketId,selectionId:x?.selectionId,selectionName:x?.selectionName}));
      trade=await insertTrade({course_strategy:'FIREBALL',market_type:'OVER_UNDER_15',market_name:x?.marketName||'Over/Under 1.5 Goals',market_id:x?.marketId||null,selection_id:x?.selectionId||null,selection_name:x?.selectionName||'Over 1.5 Goals',initial_price:bp,plan_json:{course:'FIREBALL'}},orders);
    }else if(strategy==='LATE_GOAL'){
      const main=q('MAIN'),fail=q('FAILSAFE'),bp=n(main?.backPrice);if(!bp)return NextResponse.json({ok:true,paper:{status:'WAITING_PRICE',reason:'quota MAIN non disponibile'}});
      const orders=fireballXtremeOrders(stake.total,bp).map(o=>{const x=o.role==='MAIN'?main:fail;return {...o,marketType:x?.marketType,marketName:x?.marketName,marketId:x?.marketId,selectionId:x?.selectionId,selectionName:x?.selectionName};});
      trade=await insertTrade({course_strategy:'FIREBALL_XTREME',market_type:main?.marketType||null,market_name:main?.marketName||null,market_id:main?.marketId||null,selection_id:main?.selectionId||null,selection_name:main?.selectionName||null,initial_price:bp,plan_json:{course:'FIREBALL_XTREME',entryGoals:goals}},orders);
    }else if(strategy==='EQUALIZER'){
      const lead=q('LEADER'),lp=n(lead?.layPrice),leaderSide=side(h,a);if(leaderSide==='DRAW')return NextResponse.json({ok:true,paper:{status:'COURSE_ENTRY_NOT_MET',reason:'Relay Reloaded richiede una squadra avanti'}});if(!lp)return NextResponse.json({ok:true,paper:{status:'WAITING_PRICE',reason:'quota LAY leader non disponibile'}});
      const orders=relayReloadedOrders(stake.total,lp,Number(p.minute)).map(o=>({...o,marketType:'MATCH_ODDS',marketName:lead?.marketName,marketId:lead?.marketId,selectionId:lead?.selectionId,selectionName:lead?.selectionName}));
      trade=await insertTrade({course_strategy:'RELAY_RELOADED',market_type:'MATCH_ODDS',market_name:lead?.marketName||'Match Odds',market_id:lead?.marketId||null,selection_id:lead?.selectionId||null,selection_name:lead?.selectionName||null,initial_price:lp,plan_json:{course:'RELAY_RELOADED',leaderSide}},orders);
    }else if(strategy==='FAVORITE_PUSH'){
      if(h!==a)return NextResponse.json({ok:true,paper:{status:'COURSE_ENTRY_NOT_MET',reason:'Reback Reloaded: ingresso solo sul pari'}});
      const fav=q('FAVORITE'),bp=n(fav?.backPrice),favSide=String(p.favoriteSide||fav?.selectionSide||'');if(!favSide)return NextResponse.json({ok:true,paper:{status:'COURSE_ENTRY_NOT_MET',reason:'favorita non identificata'}});if(!bp)return NextResponse.json({ok:true,paper:{status:'WAITING_PRICE',reason:'quota BACK favorita non disponibile'}});
      const orders=rebackReloadedOrders(stake.total,bp).map(o=>({...o,marketType:'MATCH_ODDS',marketName:fav?.marketName,marketId:fav?.marketId,selectionId:fav?.selectionId,selectionName:fav?.selectionName}));
      trade=await insertTrade({course_strategy:'REBACK_RELOADED',market_type:'MATCH_ODDS',market_name:fav?.marketName||'Match Odds',market_id:fav?.marketId||null,selection_id:fav?.selectionId||null,selection_name:fav?.selectionName||null,initial_price:bp,plan_json:{course:'REBACK_RELOADED',favoriteSide:favSide,phase:'FAVORITE'}},orders);
    }else return NextResponse.json({ok:true,paper:{status:'WAITING_STRATEGY_RULE'}});
  }

  let orders:any[]=[];
  const reload=async()=>{const {data}=await sb.from('live_lab_paper_orders').select('*').eq('trade_id',trade.id).order('tranche_no');orders=data||[];};
  await reload();
  const entryGoals=Number(trade.entry_home_score||0)+Number(trade.entry_away_score||0);
  const pj:any=trade.plan_json||{};

  for(const o of orders.filter(x=>x.status==='PENDING')){
    const x=q(String(o.role||'PRIMARY'));if(!x)continue;const px=o.side==='LAY'?n(x.layPrice):n(x.backPrice);if(!px)continue;
    const hit=o.side==='LAY'?px<=Number(o.target_price):px>=Number(o.target_price);
    if(hit)await sb.from('live_lab_paper_orders').update({status:'MATCHED',matched_price:Number(o.target_price),matched_at:new Date().toISOString()}).eq('id',o.id);
  }
  await reload();

  async function close(grossRaw:number,reason:string,responseExtra:any={}){
    const gross=m2(grossRaw),commission=gross>0?m2(gross*Number(settings.commission_pct)/100):0,net=m2(gross-commission);
    await sb.from('live_lab_paper_orders').update({status:'CANCELLED',cancelled_at:new Date().toISOString()}).eq('trade_id',trade.id).eq('status','PENDING');
    const filled=m2(orders.filter(o=>o.status==='MATCHED').reduce((s,o)=>s+Number(o.stake||0),0)),avg=weightedAveragePrice(orders as any);
    await sb.from('live_lab_paper_trades').update({status:'CLOSED',stake_filled:filled,avg_price:avg,last_minute:p.minute,last_home_score:h,last_away_score:a,gross_pnl:gross,commission,net_pnl:net,close_reason:reason,closed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',trade.id);
    const bankrollAfter=m2(Number(settings.bankroll_current)+net);await sb.from('live_lab_paper_settings').update({bankroll_current:bankrollAfter,updated_at:new Date().toISOString()}).eq('id',1);
    return NextResponse.json({ok:true,paper:{status:'CLOSED',tradeId:trade.id,strategyCode:strategy,courseStrategy:trade.course_strategy,stakePct:Number(trade.stake_pct),stakeTotal:Number(trade.stake_total),stakeFilled:filled,avgPrice:avg,grossPnl:gross,commission,netPnl:net,bankrollAfter,closeReason:reason,...responseExtra}});
  }

  if(strategy==='GOAL_PRESSURE'){
    const lay=n(q('PRIMARY')?.layPrice),goal=goals>entryGoals,exitMinute=Number(trade.entry_minute)>=30?80:70;
    if(lay&&(goal||Number(p.minute)>=exitMinute))return close(backCashoutGross(orders.filter(o=>o.status==='MATCHED'),lay),goal?'GOAL_CASHOUT_PAPER':'COURSE_TIME_EXIT_PAPER',{exitLayPrice:lay,courseExitMinute:exitMinute});
  }
  if(strategy==='LATE_GOAL'){
    if(goals>entryGoals){const lay=n(q('MAIN')?.layPrice);if(lay){const main=orders.filter(o=>o.role==='MAIN'&&o.status==='MATCHED'),fail=orders.filter(o=>o.role==='FAILSAFE'&&o.status==='MATCHED');const g=backCashoutGross(main,lay)+fail.reduce((s,o)=>s+Number(o.stake)*(Number(o.matched_price??o.target_price)-1),0);return close(g,'FIREBALL_XTREME_GOAL',{exitLayPrice:lay});}}
    if(Number(p.minute)>=90)return close(-orders.filter(o=>o.status==='MATCHED').reduce((s,o)=>s+Number(o.stake||0),0),'FIREBALL_XTREME_NO_GOAL');
  }
  if(strategy==='EQUALIZER'){
    const back=n(q('LEADER')?.backPrice),leaderSide=String(pj.leaderSide||''),leadDiff=leaderSide==='HOME'?h-a:a-h,matched=orders.filter(o=>o.role==='LEADER'&&o.status==='MATCHED');
    if(back&&h===a)return close(layCashoutGross(matched,back),'RELAY_EQUALIZER',{exitBackPrice:back});
    if(back&&leadDiff>=2)return close(layCashoutGross(matched,back),'RELAY_LEADER_TWO_AHEAD',{exitBackPrice:back});
    if(back&&leadDiff<0)return close(matched.reduce((s,o)=>s+Number(o.stake||0),0),'RELAY_LEADER_LOST',{exitBackPrice:back});
    if(Number(p.minute)>=90){const liability=matched.reduce((s,o)=>s+(Number(o.matched_price??o.target_price)-1)*Number(o.stake||0),0);return close(-liability,'RELAY_FINAL_WHISTLE');}
  }
  if(strategy==='FAVORITE_PUSH'){
    const fav=q('FAVORITE'),draw=q('DRAW'),favSide=String(p.favoriteSide||pj.favoriteSide||''),fd=favSide==='HOME'?h-a:a-h;
    let favMatched=orders.filter(o=>o.role==='FAVORITE'&&o.status==='MATCHED'),favPending=orders.filter(o=>o.role==='FAVORITE'&&o.status==='PENDING');
    if(fd>0&&n(fav?.layPrice))return close(backCashoutGross(favMatched,n(fav?.layPrice)!), 'REBACK_FAVORITE_LEADS',{exitLayPrice:n(fav?.layPrice)});
    if(fd<0&&favPending.length){
      for(const o of favPending)await sb.from('live_lab_paper_orders').update({status:'CANCELLED',cancelled_at:new Date().toISOString()}).eq('id',o.id);
      const db=n(draw?.backPrice),remaining=m2(Number(trade.stake_total)-favMatched.reduce((s,o)=>s+Number(o.stake||0),0));
      if(db&&remaining>0)await sb.from('live_lab_paper_orders').insert({trade_id:trade.id,tranche_no:3,target_price:db,stake:remaining,status:'MATCHED',matched_price:db,matched_at:new Date().toISOString(),market_type:'MATCH_ODDS',market_name:draw?.marketName||'Match Odds',market_id:draw?.marketId||null,selection_id:draw?.selectionId||null,selection_name:draw?.selectionName||'The Draw',side:'BACK',role:'DRAW'});
      await sb.from('live_lab_paper_trades').update({plan_json:{...pj,phase:'DRAW_RECOVERY'},updated_at:new Date().toISOString()}).eq('id',trade.id);trade.plan_json={...pj,phase:'DRAW_RECOVERY'};await reload();favMatched=orders.filter(o=>o.role==='FAVORITE'&&o.status==='MATCHED');
    }
    if(String(trade.plan_json?.phase||pj.phase)==='DRAW_RECOVERY'){
      const dm=orders.filter(o=>o.role==='DRAW'&&o.status==='MATCHED'),fl=n(fav?.layPrice),dl=n(draw?.layPrice);
      if(fd===0&&fl&&dl)return close(backCashoutGross(favMatched,fl)+backCashoutGross(dm,dl),'REBACK_EQUALIZER_RECOVERY');
      if(fd<=-2&&fl&&dl)return close(backCashoutGross(favMatched,fl)+backCashoutGross(dm,dl),'REBACK_UNDERDOG_TWO_AHEAD');
    }else if(fd<0&&orders.filter(o=>o.role==='FAVORITE'&&o.status==='PENDING').length===0&&n(fav?.layPrice))return close(backCashoutGross(favMatched,n(fav?.layPrice)!),'REBACK_UNDERDOG_LEADS_AFTER_FULL');
    if(Number(p.minute)>=90&&fd<=0)return close(-orders.filter(o=>o.status==='MATCHED').reduce((s,o)=>s+Number(o.stake||0),0),'REBACK_FINAL_WHISTLE');
  }

  await reload();const matched=orders.filter(o=>o.status==='MATCHED'),filled=m2(matched.reduce((s,o)=>s+Number(o.stake||0),0)),avg=weightedAveragePrice(matched as any);
  await sb.from('live_lab_paper_trades').update({stake_filled:filled,avg_price:avg,last_minute:p.minute,last_home_score:h,last_away_score:a,updated_at:new Date().toISOString()}).eq('id',trade.id);
  return NextResponse.json({ok:true,paper:{status:'OPEN',tradeId:trade.id,strategyCode:strategy,courseStrategy:trade.course_strategy,stakePct:Number(trade.stake_pct),stakeTotal:Number(trade.stake_total),stakeFilled:filled,avgPrice:avg,orders:orders.map(o=>({tranche:o.tranche_no,role:o.role,side:o.side,stake:Number(o.stake),targetPrice:Number(o.target_price),status:o.status,marketType:o.market_type,selectionName:o.selection_name}))}});
}
