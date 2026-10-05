import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseAdmin} from '@/lib/supabase-server';
import {backCashoutGross,fireballXtremeOrders,goalPressureOrders,layCashoutGross,rebackReloadedOrders,relayReloadedOrders,stakePlan,weightedAveragePrice} from '@/lib/paper-engine';

type Quote={role?:string;marketType?:string;marketId?:string;selectionId?:string;marketName?:string;selectionName?:string;side?:'BACK'|'LAY';backPrice?:number|null;layPrice?:number|null};
type Payload={alertId?:string;matchKey:string;strategyCode:string;marketId?:string;selectionId?:string;marketName?:string;selectionName?:string;backPrice?:number;layPrice?:number;minute:number;homeScore:number;awayScore:number;quotes?:Quote[]};
const num=(v:any)=>Number.isFinite(Number(v))?Number(v):null;
const money=(v:number)=>Math.round((v+Number.EPSILON)*100)/100;
const qRole=(p:Payload,role:string)=>{
  const q=(p.quotes||[]).find(x=>String(x.role||'').toUpperCase()===role.toUpperCase());
  if(q)return q;
  return role==='PRIMARY'?{role:'PRIMARY',marketId:p.marketId,selectionId:p.selectionId,marketName:p.marketName,selectionName:p.selectionName,backPrice:p.backPrice,layPrice:p.layPrice}:undefined;
};
const scoreSide=(h:number,a:number)=>h>a?'HOME':a>h?'AWAY':'DRAW';

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

  const existing=await sb.from('live_lab_paper_trades').select('*').eq('match_key',p.matchKey).eq('strategy_code',p.strategyCode).maybeSingle();
  let trade:any=existing.data??null;
  const plan=stakePlan(String(alert.alert_tier||'B'),Number(alert.strategy_score||0),settings as any);
  const strategy=String(p.strategyCode);
  const nowH=Number(p.homeScore||0),nowA=Number(p.awayScore||0),nowGoals=nowH+nowA;

  async function createTrade(base:any,orders:any[]){
    const {data:created,error:createError}=await sb.from('live_lab_paper_trades').insert({
      alert_id:alert.id,match_key:p.matchKey,match_date:alert.match_date,league_name:alert.league_name,home_team:alert.home_team,away_team:alert.away_team,
      strategy_code:strategy,strategy_label:alert.strategy_label,strategy_score:alert.strategy_score,alert_tier:alert.alert_tier,
      status:'OPEN',bankroll_before:Number(settings.bankroll_current),stake_pct:plan.pct,stake_total:plan.total,stake_filled:0,
      entry_minute:Number(p.minute),entry_home_score:nowH,entry_away_score:nowA,last_minute:Number(p.minute),last_home_score:nowH,last_away_score:nowA,
      ...base
    }).select('*').single();
    if(createError||!created)throw new Error(createError?.message||'paper trade create failed');
    const rows=orders.map((o:any)=>({trade_id:created.id,tranche_no:o.trancheNo,target_price:o.targetPrice,stake:o.stake,status:o.status,matched_price:o.status==='MATCHED'?o.targetPrice:null,matched_at:o.status==='MATCHED'?new Date().toISOString():null,market_type:o.marketType||base.market_type||null,market_name:o.marketName||base.market_name||null,market_id:o.marketId||base.market_id||null,selection_id:o.selectionId||base.selection_id||null,selection_name:o.selectionName||base.selection_name||null,side:o.side||'BACK',role:o.role||'PRIMARY'}));
    const {error:ordersError}=await sb.from('live_lab_paper_orders').insert(rows);if(ordersError)throw new Error(ordersError.message);
    return created;
  }

  if(!trade){
    if(strategy==='GOAL_PRESSURE'){
      const q=qRole(p,'PRIMARY');const back=num(q?.backPrice);if(!back)return NextResponse.json({ok:true,paper:{status:'WAITING_PRICE'}});
      trade=await createTrade({course_strategy:'FIREBALL',market_type:'OVER_UNDER_15',market_name:q?.marketName||'Over/Under 1.5 Goals',market_id:q?.marketId||null,selection_id:q?.selectionId||null,selection_name:q?.selectionName||'Over 1.5 Goals',initial_price:back,plan_json:{course:'FIREBALL'}},goalPressureOrders(plan.total,back,Number(settings.goal_pressure_tranches),Number(settings.goal_pressure_tick_gap)).map(o=>({...o,role:'PRIMARY',side:'BACK',marketType:'OVER_UNDER_15',marketName:q?.marketName,marketId:q?.marketId,selectionId:q?.selectionId,selectionName:q?.selectionName})));
    }else if(strategy==='LATE_GOAL'){
      const main=qRole(p,'MAIN'),fail=qRole(p,'FAILSAFE');const back=num(main?.backPrice);if(!back)return NextResponse.json({ok:true,paper:{status:'WAITING_PRICE',reason:'quota MAIN Fireball Xtreme non disponibile'}});
      const raw=fireballXtremeOrders(plan.total,back).map(o=>{const q=o.role==='MAIN'?main:fail;return {...o,marketType:q?.marketType,marketName:q?.marketName,marketId:q?.marketId,selectionId:q?.selectionId,selectionName:q?.selectionName};});
      trade=await createTrade({course_strategy:'FIREBALL_XTREME',market_type:main?.marketType||null,market_name:main?.marketName||null,market_id:main?.marketId||null,selection_id:main?.selectionId||null,selection_name:main?.selectionName||null,initial_price:back,plan_json:{course:'FIREBALL_XTREME',entryGoals:nowGoals}},raw);
    }else if(strategy==='EQUALIZER'){
      const lead=qRole(p,'LEADER');const lay=num(lead?.layPrice);if(!lay)return NextResponse.json({ok:true,paper:{status:'WAITING_PRICE',reason:'quota LAY squadra in vantaggio non disponibile'}});
      const leaderSide=scoreSide(nowH,nowA);if(leaderSide==='DRAW')return NextResponse.json({ok:true,paper:{status:'COURSE_ENTRY_NOT_MET',reason:'Relay Reloaded richiede una squadra avanti di un gol'}});
      const orders=relayReloadedOrders(plan.total,lay,Number(p.minute)).map(o=>({...o,marketType:'MATCH_ODDS',marketName:lead?.marketName,marketId:lead?.marketId,selectionId:lead?.selectionId,selectionName:lead?.selectionName}));
      trade=await createTrade({course_strategy:'RELAY_RELOADED',market_type:'MATCH_ODDS',market_name:lead?.marketName||'Match Odds',market_id:lead?.marketId||null,selection_id:lead?.selectionId||null,selection_name:lead?.selectionName||null,initial_price:lay,plan_json:{course:'RELAY_RELOADED',leaderSide}},orders);
    }else if(strategy==='FAVORITE_PUSH'){
      const fav=qRole(p,'FAVORITE');const back=num(fav?.backPrice);const favSide=String((p.quotes||[]).find(q=>q.role==='FAVORITE')?.selectionName||'');
      if(nowH!==nowA)return NextResponse.json({ok:true,paper:{status:'COURSE_ENTRY_NOT_MET',reason:'Reback Reloaded: ingresso solo sul pari nel secondo tempo'}});
      if(!back)return NextResponse.json({ok:true,paper:{status:'WAITING_PRICE',reason:'quota BACK favorita non disponibile'}});
      const favoriteSide=(p.quotes||[]).find(q=>q.role==='FAVORITE')?.selectionId===undefined?null:(p.quotes||[]).find(q=>q.role==='FAVORITE')?.sideHint;
      const side=(fav as any)?.selectionSide||((fav as any)?.sideHint)||null;
      const orders=rebackReloadedOrders(plan.total,back).map(o=>({...o,marketType:'MATCH_ODDS',marketName:fav?.marketName,marketId:fav?.marketId,selectionId:fav?.selectionId,selectionName:fav?.selectionName}));
      trade=await createTrade({course_strategy:'REBACK_RELOADED',market_type:'MATCH_ODDS',market_name:fav?.marketName||'Match Odds',market_id:fav?.marketId||null,selection_id:fav?.selectionId||null,selection_name:fav?.selectionName||favSide,initial_price:back,plan_json:{course:'REBACK_RELOADED',favoriteSide:(p as any).favoriteSide||side||null,phase:'FAVORITE'}},orders);
    }else return NextResponse.json({ok:true,paper:{status:'WAITING_STRATEGY_RULE',strategyCode:strategy}});
  }

  const {data:ordersData}=await sb.from('live_lab_paper_orders').select('*').eq('trade_id',trade.id).order('tranche_no');
  let orders:any[]=ordersData??[];
  const entryH=Number(trade.entry_home_score||0),entryA=Number(trade.entry_away_score||0),entryGoals=entryH+entryA;
  const planJson:any=trade.plan_json||{};

  const quoteForOrder=(o:any)=>qRole(p,String(o.role||'PRIMARY'));
  if(trade.status==='OPEN'){
    for(const o of orders.filter((x:any)=>x.status==='PENDING')){
      const q=quoteForOrder(o);if(!q)continue;
      const marketPrice=o.side==='LAY'?num(q.layPrice):num(q.backPrice);if(!marketPrice)continue;
      const shouldMatch=o.side==='LAY'?marketPrice<=Number(o.target_price):marketPrice>=Number(o.target_price);
      if(shouldMatch)await sb.from('live_lab_paper_orders').update({status:'MATCHED',matched_price:Number(o.target_price),matched_at:new Date().toISOString()}).eq('id',o.id);
    }
  }
  const reloadOrders=async()=>{const {data}=await sb.from('live_lab_paper_orders').select('*').eq('trade_id',trade.id).order('tranche_no');orders=data??[];};
  await reloadOrders();

  async function closeTrade(grossRaw:number,reason:string,extra:any={}){
    const gross=money(grossRaw),commission=gross>0?money(gross*Number(settings.commission_pct)/100):0,net=money(gross-commission);
    await sb.from('live_lab_paper_orders').update({status:'CANCELLED',cancelled_at:new Date().toISOString()}).eq('trade_id',trade.id).eq('status','PENDING');
    const filled=money(orders.filter(o=>o.status==='MATCHED').reduce((a,o)=>a+Number(o.stake||0),0));
    const avg=weightedAveragePrice(orders as any);
    await sb.from('live_lab_paper_trades').update({status:'CLOSED',stake_filled:filled,avg_price:avg,last_minute:p.minute,last_home_score:nowH,last_away_score:nowA,gross_pnl:gross,commission,net_pnl:net,close_reason:reason,closed_at:new Date().toISOString(),updated_at:new Date().toISOString(),...extra}).eq('id',trade.id);
    const bankrollAfter=money(Number(settings.bankroll_current)+net);await sb.from('live_lab_paper_settings').update({bankroll_current:bankrollAfter,updated_at:new Date().toISOString()}).eq('id',1);
    return NextResponse.json({ok:true,paper:{status:'CLOSED',tradeId:trade.id,strategyCode:strategy,courseStrategy:trade.course_strategy,stakePct:Number(trade.stake_pct),stakeTotal:Number(trade.stake_total),stakeFilled:filled,avgPrice:avg,grossPnl:gross,commission,netPnl:net,bankrollAfter,closeReason:reason,...extra}});
  }

  if(strategy==='GOAL_PRESSURE'){
    const q=qRole(p,'PRIMARY');const lay=num(q?.layPrice),goal=nowGoals>entryGoals,courseExitMinute=Number(trade.entry_minute||0)>=30?80:70,timeExit=!goal&&Number(p.minute)>=courseExitMinute;
    if((goal||timeExit)&&lay){const matched=orders.filter(o=>o.status==='MATCHED');return closeTrade(backCashoutGross(matched,lay),goal?'GOAL_CASHOUT_PAPER':'COURSE_TIME_EXIT_PAPER',{exitLayPrice:lay,courseExitMinute});}
  }

  if(strategy==='LATE_GOAL'){
    const main=qRole(p,'MAIN'),goal=nowGoals>entryGoals;
    if(goal){
      const mainLay=num(main?.layPrice);if(mainLay){
        const mainOrders=orders.filter(o=>o.role==='MAIN'&&o.status==='MATCHED'),failOrders=orders.filter(o=>o.role==='FAILSAFE'&&o.status==='MATCHED');
        const mainGross=backCashoutGross(mainOrders,mainLay);const failGross=failOrders.reduce((a,o)=>a+Number(o.stake)*(Number(o.matched_price??o.target_price)-1),0);
        return closeTrade(mainGross+failGross,'FIREBALL_XTREME_GOAL',{exitLayPrice:mainLay});
      }
    }else if(Number(p.minute)>=90){return closeTrade(-orders.filter(o=>o.status==='MATCHED').reduce((a,o)=>a+Number(o.stake||0),0),'FIREBALL_XTREME_NO_GOAL');}
  }

  if(strategy==='EQUALIZER'){
    const lead=qRole(p,'LEADER'),exitBack=num(lead?.backPrice),leaderSide=String(planJson.leaderSide||'');const currentLeader=scoreSide(nowH,nowA);
    if(exitBack){
      const matched=orders.filter(o=>o.status==='MATCHED'&&o.role==='LEADER');
      if(currentLeader==='DRAW')return closeTrade(layCashoutGross(matched,exitBack),'RELAY_EQUALIZER',{exitBackPrice:exitBack});
      const leadNow=leaderSide==='HOME'?nowH-nowA:nowA-nowH;
      if(leadNow>=2)return closeTrade(layCashoutGross(matched,exitBack),'RELAY_LEADER_TWO_AHEAD',{exitBackPrice:exitBack});
      if(leadNow<0)return closeTrade(matched.reduce((a,o)=>a+Number(o.stake||0),0),'RELAY_LEADER_LOST',{exitBackPrice:exitBack});
    }
    if(Number(p.minute)>=90){const matched=orders.filter(o=>o.status==='MATCHED');const liability=matched.reduce((a,o)=>a+(Number(o.matched_price??o.target_price)-1)*Number(o.stake||0),0);return closeTrade(-liability,'RELAY_FINAL_WHISTLE');}
  }

  if(strategy==='FAVORITE_PUSH'){
    const fav=qRole(p,'FAVORITE'),draw=qRole(p,'DRAW'),favoriteSide=String((p as any).favoriteSide||planJson.favoriteSide||'');
    const fd=favoriteSide==='HOME'?nowH-nowA:favoriteSide==='AWAY'?nowA-nowH:0;
    const favMatched=orders.filter(o=>o.role==='FAVORITE'&&o.status==='MATCHED');const favPending=orders.filter(o=>o.role==='FAVORITE'&&o.status==='PENDING');
    if(fd>0&&num(fav?.layPrice))return closeTrade(backCashoutGross(favMatched,num(fav?.layPrice)!), 'REBACK_FAVORITE_LEADS',{exitLayPrice:num(fav?.layPrice)});
    if(fd<0&&favPending.length){
      for(const o of favPending)await sb.from('live_lab_paper_orders').update({status:'CANCELLED',cancelled_at:new Date().toISOString()}).eq('id',o.id);
      const drawBack=num(draw?.backPrice);if(drawBack){
        const remaining=money(Number(trade.stake_total)-favMatched.reduce((a,o)=>a+Number(o.stake||0),0));
        if(remaining>0)await sb.from('live_lab_paper_orders').insert({trade_id:trade.id,tranche_no:3,target_price:drawBack,stake:remaining,status:'MATCHED',matched_price:drawBack,matched_at:new Date().toISOString(),market_type:'MATCH_ODDS',market_name:draw?.marketName||'Match Odds',market_id:draw?.marketId||null,selection_id:draw?.selectionId||null,selection_name:draw?.selectionName||'The Draw',side:'BACK',role:'DRAW'});
        await sb.from('live_lab_paper_trades').update({plan_json:{...planJson,phase:'DRAW_RECOVERY'},updated_at:new Date().toISOString()}).eq('id',trade.id);trade.plan_json={...planJson,phase:'DRAW_RECOVERY'};await reloadOrders();
      }
    }
    if(String(trade.plan_json?.phase||planJson.phase)==='DRAW_RECOVERY'){
      const drawMatched=orders.filter(o=>o.role==='DRAW'&&o.status==='MATCHED');
      if(fd===0&&num(fav?.layPrice)&&num(draw?.layPrice))return closeTrade(backCashoutGross(favMatched,num(fav?.layPrice)!)+backCashoutGross(drawMatched,num(draw?.layPrice)!),'REBACK_EQUALIZER_RECOVERY');
      if(fd<=-2&&num(fav?.layPrice)&&num(draw?.layPrice))return closeTrade(backCashoutGross(favMatched,num(fav?.layPrice)!)+backCashoutGross(drawMatched,num(draw?.layPrice)!),'REBACK_UNDERDOG_TWO_AHEAD');
    }else if(fd<0&&favPending.length===0&&num(fav?.layPrice))return closeTrade(backCashoutGross(favMatched,num(fav?.layPrice)!),'REBACK_UNDERDOG_LEADS_AFTER_FULL');
    if(Number(p.minute)>=90&&fd<=0)return closeTrade(-orders.filter(o=>o.status==='MATCHED').reduce((a,o)=>a+Number(o.stake||0),0),'REBACK_FINAL_WHISTLE');
  }

  await reloadOrders();const matched=orders.filter(o=>o.status==='MATCHED'),filled=money(matched.reduce((a,o)=>a+Number(o.stake||0),0)),avg=weightedAveragePrice(matched as any);
  await sb.from('live_lab_paper_trades').update({stake_filled:filled,avg_price:avg,last_minute:p.minute,last_home_score:nowH,last_away_score:nowA,updated_at:new Date().toISOString()}).eq('id',trade.id);
  return NextResponse.json({ok:true,paper:{status:'OPEN',tradeId:trade.id,strategyCode:strategy,courseStrategy:trade.course_strategy,stakePct:Number(trade.stake_pct),stakeTotal:Number(trade.stake_total),stakeFilled:filled,avgPrice:avg,orders:orders.map(o=>({tranche:o.tranche_no,role:o.role,side:o.side,stake:Number(o.stake),targetPrice:Number(o.target_price),status:o.status,marketType:o.market_type,selectionName:o.selection_name}))}});
}
