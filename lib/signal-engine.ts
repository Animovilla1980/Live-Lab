export const ENGINE_VERSION='0.7.0';

type Stats={minute:number;homeScore:number;awayScore:number;xgHome?:number|null;xgAway?:number|null;sotHome?:number|null;sotAway?:number|null;possessionHome?:number|null;possessionAway?:number|null;dangerousHome?:number|null;dangerousAway?:number|null};
type Forebet={predictedScore?:string|null;prediction1x2?:string|null;p1?:number|null;p2?:number|null};
export type Signal={code:string;label:string;score:number;reasons:string[];meta?:Record<string,any>};

const n=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const clamp=(v:number)=>Math.max(0,Math.min(100,Math.round(v)));
const share=(a:number,b:number)=>a+b>0?a/(a+b):0.5;

function goalPressure(c:Stats,d:any):Signal{
  const xg=n(c.xgHome)+n(c.xgAway),sot=n(c.sotHome)+n(c.sotAway); let s=0; const r:string[]=[];
  if(c.minute>=20&&c.minute<=45){s+=20;r.push('finestra 20–45');}
  if(c.homeScore+c.awayScore<=1)s+=8;
  if(xg>=0.7){s+=16;r.push(`xG ${xg.toFixed(2)}`);} if(xg>=1.1)s+=8;
  if(sot>=3){s+=15;r.push(`SOT ${sot}`);} if(sot>=5)s+=7;
  if(d.xgHome+d.xgAway>=0.22){s+=18;r.push(`ΔxG +${(d.xgHome+d.xgAway).toFixed(2)}`);}
  if(d.sotHome+d.sotAway>=1)s+=8;
  return {code:'GOAL_PRESSURE',label:'🔥 Goal Pressure',score:clamp(s),reasons:r,meta:{courseStrategy:'FIREBALL'}};
}

function lateGoal(c:Stats,d:any):Signal{
  const gap=Math.abs(c.homeScore-c.awayScore),xg=n(c.xgHome)+n(c.xgAway),sot=n(c.sotHome)+n(c.sotAway); let s=0; const r:string[]=[];
  if(c.minute>=55&&c.minute<=78){s+=25;r.push('finestra 55–78');}
  if(gap<=1){s+=15;r.push('gap ≤ 1');}
  if(xg>=1.25){s+=17;r.push(`xG ${xg.toFixed(2)}`);} if(xg>=1.8)s+=7;
  if(sot>=4){s+=15;r.push(`SOT ${sot}`);} if(sot>=7)s+=6;
  if(d.xgHome+d.xgAway>=0.25){s+=15;r.push(`ΔxG +${(d.xgHome+d.xgAway).toFixed(2)}`);}
  return {code:'LATE_GOAL',label:'⚡ Late Goal',score:clamp(s),reasons:r,meta:{courseStrategy:'FIREBALL_XTREME',currentGoals:c.homeScore+c.awayScore}};
}

function equalizer(c:Stats,d:any):Signal{
  const diff=c.homeScore-c.awayScore;if(Math.abs(diff)!==1)return {code:'EQUALIZER',label:'🔄 Equalizer',score:0,reasons:[]};
  const home=diff<0,txg=home?n(c.xgHome):n(c.xgAway),oxg=home?n(c.xgAway):n(c.xgHome),tsot=home?n(c.sotHome):n(c.sotAway),osot=home?n(c.sotAway):n(c.sotHome),poss=home?n(c.possessionHome):n(c.possessionAway),dxg=home?d.xgHome:d.xgAway;let s=0;const r:string[]=[];
  if(c.minute>=35&&c.minute<=82){s+=24;r.push('finestra rimonta');}
  if(share(txg,oxg)>=0.58){s+=20;r.push('xG favorevole a chi insegue');}
  if(tsot>=osot+2||share(tsot,osot)>=0.62){s+=20;r.push('SOT favorevoli a chi insegue');}
  if(poss>=58){s+=10;r.push(`possesso ${Math.round(poss)}%`);}
  if(dxg>=0.16){s+=20;r.push(`ΔxG +${dxg.toFixed(2)}`);}
  return {code:'EQUALIZER',label:'🔄 Equalizer',score:clamp(s),reasons:r,meta:{courseStrategy:'RELAY_RELOADED',trailingSide:home?'HOME':'AWAY',leaderSide:home?'AWAY':'HOME'}};
}

function favoritePush(c:Stats,d:any,f:Forebet):Signal{
  const p1=n(f.p1),p2=n(f.p2);let fav:'home'|'away'|null=Math.abs(p1-p2)>=8?(p1>p2?'home':'away'):null;const p=String(f.prediction1x2||'').toUpperCase();if(!fav&&p==='1')fav='home';if(!fav&&p==='2')fav='away';if(!fav)return {code:'FAVORITE_PUSH',label:'👑 Favorite Push',score:0,reasons:[]};
  const diff=c.homeScore-c.awayScore,fd=fav==='home'?diff:-diff;if(fd>0||fd<-1)return {code:'FAVORITE_PUSH',label:'👑 Favorite Push',score:0,reasons:[]};
  const fxg=fav==='home'?n(c.xgHome):n(c.xgAway),oxg=fav==='home'?n(c.xgAway):n(c.xgHome),fsot=fav==='home'?n(c.sotHome):n(c.sotAway),osot=fav==='home'?n(c.sotAway):n(c.sotHome),poss=fav==='home'?n(c.possessionHome):n(c.possessionAway),dxg=fav==='home'?d.xgHome:d.xgAway;let s=0;const r:string[]=[];
  if(c.minute>=45&&c.minute<=76){s+=23;r.push('finestra 2° tempo');}
  s+=fd===0?15:8;if(fd===0)r.push('favorita bloccata sul pari');
  if(share(fxg,oxg)>=0.64){s+=20;r.push('dominio xG favorita');}
  if(fsot>=osot+2||share(fsot,osot)>=0.65){s+=18;r.push('dominio SOT favorita');}
  if(poss>=60){s+=10;r.push(`possesso ${Math.round(poss)}%`);}
  if(dxg>=0.18){s+=18;r.push(`ΔxG +${dxg.toFixed(2)}`);}
  return {code:'FAVORITE_PUSH',label:'👑 Favorite Push',score:clamp(s),reasons:r,meta:{courseStrategy:'REBACK_RELOADED',favoriteSide:fav==='home'?'HOME':'AWAY',favoriteGoalDiff:fd,courseEntryEligible:fd===0}};
}

export function evaluateSignals(c:Stats,p:Stats|null,f:Forebet={}){
  const d={xgHome:Math.max(0,n(c.xgHome)-n(p?.xgHome)),xgAway:Math.max(0,n(c.xgAway)-n(p?.xgAway)),sotHome:Math.max(0,n(c.sotHome)-n(p?.sotHome)),sotAway:Math.max(0,n(c.sotAway)-n(p?.sotAway))};
  const signals=[goalPressure(c,d),lateGoal(c,d),equalizer(c,d),favoritePush(c,d,f)].sort((a,b)=>b.score-a.score);
  const primary=signals[0]?.score?signals[0]:null,strong=signals.filter(x=>x.score>=80);let tier:'A'|'B'|'WATCH'|'NONE'='NONE';if(primary){if(primary.score>=88||strong.length>=2)tier='A';else if(primary.score>=80)tier='B';else if(primary.score>=65)tier='WATCH';}
  const m=String(f.predictedScore||'').match(/(\d+)\D+(\d+)/);const blocked=!!m&&(Number(m[1])+Number(m[2])<2);
  return {version:ENGINE_VERSION,tier,notify:!blocked&&(tier==='A'||tier==='B'),blocked,primary,signals,delta:d};
}
