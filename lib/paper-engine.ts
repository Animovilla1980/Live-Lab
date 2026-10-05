export type PaperSettings={
  enabled:boolean;mode:string;bankroll_current:number;max_stake_pct:number;tier_b_pct:number;tier_a_pct:number;
  tier_a_strong_pct:number;tier_a_strong_score:number;commission_pct:number;goal_pressure_tranches:number;goal_pressure_tick_gap:number
};

const r2=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;

export function stakePct(tier:string,score:number,s:PaperSettings){
  const raw=tier==='B'?Number(s.tier_b_pct):score>=Number(s.tier_a_strong_score)?Number(s.tier_a_strong_pct):Number(s.tier_a_pct);
  return Math.min(Number(s.max_stake_pct),Math.max(0,raw));
}

export function stakePlan(tier:string,score:number,s:PaperSettings){
  const pct=stakePct(tier,score,s);
  const total=r2(Number(s.bankroll_current)*pct/100);
  return {pct,total};
}

export function splitStake(total:number,count:number){
  const n=Math.max(1,Math.floor(count));
  const base=Math.floor((total/n)*100)/100;
  const out=Array.from({length:n},()=>base);
  out[n-1]=r2(total-base*(n-1));
  return out;
}

export function betfairTickSize(price:number){
  if(price<2)return .01;if(price<3)return .02;if(price<4)return .05;if(price<6)return .1;
  if(price<10)return .2;if(price<20)return .5;if(price<30)return 1;if(price<50)return 2;if(price<100)return 5;return 10;
}

export function moveTicks(start:number,ticks:number){
  let p=Math.min(1000,Math.max(1.01,Number(start)));
  for(let i=0;i<ticks;i++) p=Math.min(1000,r2(p+betfairTickSize(p)));
  return p;
}

export function validBetfairPrice(target:number,direction:'UP'|'DOWN'='UP'){
  const t=Math.min(1000,Math.max(1.01,Number(target)));
  let p=1.01,last=1.01;
  while(p<1000){
    if(p>=t)return direction==='UP'?r2(p):r2(last);
    last=p;p=r2(p+betfairTickSize(p));
  }
  return 1000;
}

export function goalPressureOrders(total:number,initialPrice:number,tranches=4,gap=25){
  const stakes=splitStake(total,tranches);
  return stakes.map((stake,i)=>({trancheNo:i+1,stake,targetPrice:i===0?r2(initialPrice):moveTicks(initialPrice,gap*i),status:i===0?'MATCHED':'PENDING'}));
}

export function fireballXtremeOrders(total:number,initialMainPrice:number){
  const halves=splitStake(total,2),mainStakes=splitStake(halves[0],4),failStakes=splitStake(halves[1],4);
  const main=mainStakes.map((stake,i)=>({trancheNo:i+1,role:'MAIN',side:'BACK',stake,targetPrice:i===0?r2(initialMainPrice):validBetfairPrice(initialMainPrice+(2*i),'UP'),status:i===0?'MATCHED':'PENDING'}));
  const fixed=[2,3,4,5];
  const fail=failStakes.map((stake,i)=>({trancheNo:i+5,role:'FAILSAFE',side:'BACK',stake,targetPrice:fixed[i],status:'PENDING'}));
  return [...main,...fail];
}

export function relayReloadedOrders(total:number,initialLay:number,minute:number){
  if(minute>60&&initialLay<=1.40)return [{trancheNo:1,role:'LEADER',side:'LAY',stake:r2(total),targetPrice:r2(initialLay),status:'MATCHED'}];
  const stakes=splitStake(total,2);
  const relayTarget=validBetfairPrice(1+(initialLay-1)/2,'DOWN');
  return [
    {trancheNo:1,role:'LEADER',side:'LAY',stake:stakes[0],targetPrice:r2(initialLay),status:'MATCHED'},
    {trancheNo:2,role:'LEADER',side:'LAY',stake:stakes[1],targetPrice:relayTarget,status:'PENDING'}
  ];
}

export function rebackReloadedOrders(total:number,initialBack:number){
  const stakes=splitStake(total,2);
  return [
    {trancheNo:1,role:'FAVORITE',side:'BACK',stake:stakes[0],targetPrice:r2(initialBack),status:'MATCHED'},
    {trancheNo:2,role:'FAVORITE',side:'BACK',stake:stakes[1],targetPrice:validBetfairPrice((2*initialBack)-1,'UP'),status:'PENDING'}
  ];
}

export function weightedAveragePrice(orders:{stake:number;matched_price?:number|null;target_price?:number|null;status:string}[]){
  const matched=orders.filter(o=>o.status==='MATCHED'&&Number(o.matched_price??o.target_price)>0);
  const stake=matched.reduce((a,o)=>a+Number(o.stake),0);
  if(!stake)return null;
  return matched.reduce((a,o)=>a+Number(o.stake)*Number(o.matched_price??o.target_price),0)/stake;
}

export function backCashoutGross(orders:any[],exitLay:number){
  return orders.filter(o=>o.status==='MATCHED'&&o.side!=='LAY').reduce((a,o)=>a+Number(o.stake)*(Number(o.matched_price??o.target_price)/exitLay-1),0);
}

export function layCashoutGross(orders:any[],exitBack:number){
  return orders.filter(o=>o.status==='MATCHED'&&o.side==='LAY').reduce((a,o)=>a+Number(o.stake)*(1-Number(o.matched_price??o.target_price)/exitBack),0);
}

export function paperMarketFor(strategyCode:string,currentGoals:number){
  if(strategyCode==='GOAL_PRESSURE')return {marketType:'OVER_UNDER_15',selectionName:'Over 1.5 Goals'};
  if(strategyCode==='LATE_GOAL')return {marketType:`OVER_UNDER_${String((currentGoals+1)*10+5).padStart(2,'0')}`,selectionName:`Over ${currentGoals+1.5} Goals`};
  if(strategyCode==='EQUALIZER')return {marketType:'MATCH_ODDS',selectionName:'LEADER'};
  if(strategyCode==='FAVORITE_PUSH')return {marketType:'MATCH_ODDS',selectionName:'FAVOURITE'};
  return {marketType:'MATCH_ODDS',selectionName:'UNKNOWN'};
}
