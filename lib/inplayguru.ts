export type StrategyId = '634255' | '1110278' | '1110299';
export const STRATEGIES: Record<StrategyId, {name:string; dna:string[]; operation:string}> = {
  '634255': {name:'Punta Over 1,5', dna:["23′–32′ · 0-0", 'SOT totali ≥ 1 · xG totale ≥ 0,5', 'Over 0,5 HT ≥ 1,90 · Over 1,5 FT ≥ 1,40', 'Gruppo Gol primo tempo (81) · outcome non documentato'], operation:'Over 1.5 FT · 4 BACK: corrente / +25 / +50 / +75 tick. Totale Money Management diviso in 4. Uscita manuale, possibile al gol nel primo tempo.'},
  '1110278': {name:'Goal Pressure', dna:["20′–45′ · gol totali ≤ 1 · nessuna espulsione", 'xG totale ≥ 0,6 · SOT totali ≥ 2', 'Momentum ≥ 60 e attacchi pericolosi ≥ 10 per almeno una squadra (condizioni indipendenti)', 'Tutti i campionati · outcome: prossimo gol FT'], operation:'Over +2 gol rispetto allo score attuale · 4 BACK: +10 / +35 / +60 / +85 tick. Totale Money Management; split non fissato dal riepilogo utente. Obiettivo: uscita manuale al primo gol successivo.'},
  '1110299': {name:'Late Goal', dna:["55′–72′ · gol totali ≤ 1 · nessuna espulsione", 'xG totale ≥ 1 · SOT totali ≥ 3', 'Momentum ≥ 60 e attacchi pericolosi ≥ 20 per almeno una squadra (condizioni indipendenti)', 'Tutti i campionati · outcome: prossimo gol FT'], operation:'55′–65′: Over +2 gol, 3 BACK +10 / +35 / +60 tick, split 30/30/40. 66′–75′: LAY score corrente 2.20 / 2.00 / 1.80, responsabilità 25/35/40; stake = responsabilità / (quota−1), arrotondato per difetto. Dopo 75′: salta. Uscita manuale.'}
};
export type Pick = {
  key:string; strategy:StrategyId; date:string; minute:number; home:string; away:string; league:string;
  score:string; homeScore:number; awayScore:number; strike:'WIN'|'LOSS'|'PENDING';
  xg:number|null; sot:number|null; momentum:number|null; dangerous:number|null;
  ht:string|null; ft:string|null; goals:number[]; goalDataComplete:boolean; sameMinuteGoal:boolean;
  nextGoal:number|null; delay:number|null; htOpportunity:boolean|null; market:string; mode:string; odd:number|null;
  raw:Record<string,string>; source:string;
};
export type Trade = {pick_key:string; outcome:'WIN'|'LOSS'|'VOID'|'SKIP'|'OPEN'; exposure:number|null; net_pl:number|null; closed_at:string|null; note:string};
export type Candidate = {id:string; strategy:StrategyId; label:string; filters:Filters; cutoff:string; created_at:string; status:'OBSERVATION'|'CANDIDATE'|'VALIDATED'|'REJECTED'; baseline:Stats};
export type Filters = {strategy:string; from:string; to:string; league:string; score:string; minMinute:number; maxMinute:number; minXg:number; minSot:number; minMomentum:number; minDangerous:number; minOdd:number; maxOdd:number};
export const DEFAULT_FILTERS:Filters={strategy:'',from:'',to:'',league:'',score:'',minMinute:0,maxMinute:130,minXg:0,minSot:0,minMomentum:0,minDangerous:0,minOdd:0,maxOdd:1000};

// RFC4180: BOM, quoted commas/newlines, doubled quotes, CRLF, semicolon exports.
export function csvRows(text:string):string[][] {
  text=text.replace(/^\uFEFF/,'');
  const first=text.split(/\r?\n/,1)[0]; const delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {const c=text[i];
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else throw new Error('CSV: virgolette non valide');}
    else if(c===delimiter&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('CSV incompleto: virgolette non chiuse');
  row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;
}
const num=(s:string|undefined):number|null=>{if(!s?.trim())return null;const n=Number(s.trim().replace(',','.'));return Number.isFinite(n)?n:null;};
export function minuteValue(s:string):number|null {const m=s.trim().match(/^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?['′]?$/);return m?Number(m[1])+Number(m[2]||0):null;}
function scoreValue(s:string):[number,number]|null {const m=s?.match(/^(\d+)\s*[-:]\s*(\d+)$/);return m?[Number(m[1]),Number(m[2])]:null;}
const sum=(a:number|null,b:number|null)=>a===null||b===null?null:a+b;
const max=(a:number|null,b:number|null)=>a===null||b===null?null:Math.max(a,b);
const norm=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
export function operationalMode(id:StrategyId,minute:number,goals:number) {
  if(id==='1110299'&&minute>75)return {mode:'SKIP',market:'—'};
  if(id==='1110299'&&minute>=66)return {mode:'LAY',market:'Correct Score corrente'};
  return {mode:'BACK',market:`Over ${id==='634255'?1.5:goals+1.5} FT`};
}
export function parsePicks(text:string,filename:string,override?:StrategyId):{picks:Pick[];warnings:string[];strategy:StrategyId} {
  const detected=filename.match(/Strategy_(\d+)_/i)?.[1];const id=override||detected;
  if(!id||!(id in STRATEGIES))throw new Error('Strategia non riconosciuta: scegli la strategia corretta per questo CSV.');
  const strategy=id as StrategyId;const rows=csvRows(text);
  if(rows.length<2)throw new Error('CSV vuoto o senza intestazioni');
  const groups=rows[0],headers=rows[1];let group='';const keys=headers.map((h,i)=>{if(groups[i]?.trim())group=groups[i].trim();return `${group}|${h.trim()}`;});
  const required=['Match Data|Date','Match Data|Timer','Match Data|Strike','Match Data|Home','Match Data|Away','Alert Time Stats|H Score','Alert Time Stats|A Score'];
  for(const k of required)if(!keys.includes(k))throw new Error(`Formato CSV non supportato: manca ${k}`);
  const picks:Pick[]=[],warnings:string[]=[];
  for(let index=2;index<rows.length;index++){
    const r=rows[index];if(r.length!==headers.length)throw new Error(`Riga ${index+1}: ${r.length} colonne invece di ${headers.length}`);
    const raw=Object.fromEntries(keys.map((k,i)=>[k,r[i].trim()]));const get=(g:string,h:string)=>raw[`${g}|${h}`]||'';
    const date=get('Match Data','Date'),home=get('Match Data','Home'),away=get('Match Data','Away'),league=get('Match Data','League');
    const minute=minuteValue(get('Match Data','Timer')),hs=num(get('Alert Time Stats','H Score')),as=num(get('Alert Time Stats','A Score'));
    const d=date.slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(date)||!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d||!home||!away||minute===null||minute>130||hs===null||as===null||!Number.isInteger(hs)||!Number.isInteger(as)||hs<0||as<0)throw new Error(`Riga ${index+1}: identità, data, minuto o score non validi`);
    const strikeText=get('Match Data','Strike').toUpperCase();
    if(!['TRUE','FALSE','','PENDING'].includes(strikeText))throw new Error(`Riga ${index+1}: Strike sconosciuto (${strikeText})`);
    const strike=strikeText==='TRUE'?'WIN':strikeText==='FALSE'?'LOSS':'PENDING';
    const ht=get('Summary','HT Score')||null,ft=get('Summary','FT Score')||null;const htS=scoreValue(ht||''),ftS=scoreValue(ft||'');
    const tokens=[get('Goal Times','Home'),get('Goal Times','Away')].flatMap(x=>x?x.split(','):[]);
    const parsed=tokens.map(x=>minuteValue(x));const goals=parsed.filter((x):x is number=>x!==null).sort((a,b)=>a-b);
    const goalDataComplete=!!ftS&&parsed.every(x=>x!==null)&&goals.length===ftS[0]+ftS[1]&&ftS[0]>=hs&&ftS[1]>=as;
    const sameMinuteGoal=goals.includes(minute);const nextGoal=goalDataComplete&&!sameMinuteGoal?(goals.find(x=>x>minute)??null):null;
    if(!goalDataComplete)warnings.push(`${home} – ${away}: minuti gol incompleti, tempo al gol non calcolato.`);
    if(sameMinuteGoal)warnings.push(`${home} – ${away}: gol nello stesso minuto dell’alert, sequenza non determinabile.`);
    const {mode,market}=operationalMode(strategy,minute,hs+as);const line=strategy==='634255'?1.5:hs+as+1.5;
    const odd=mode==='BACK'?num(get('Live Odds (Alert Time)',`Over ${line} Goals`)):null;
    picks.push({key:JSON.stringify([strategy,d,norm(league),norm(home),norm(away),minute]),strategy,date,minute,home,away,league,homeScore:hs,awayScore:as,score:`${hs}-${as}`,strike,
      xg:sum(num(get('Alert Time Stats','H xG')),num(get('Alert Time Stats','A xG'))),sot:sum(num(get('Alert Time Stats','H SOT')),num(get('Alert Time Stats','A SOT'))),
      momentum:max(num(get('Alert Time Stats','H Momentum')),num(get('Alert Time Stats','A Momentum'))),dangerous:max(num(get('Alert Time Stats','H Dn Attacks')),num(get('Alert Time Stats','A Dn Attacks'))),
      ht,ft,goals,goalDataComplete,sameMinuteGoal,nextGoal,delay:nextGoal===null?null:nextGoal-minute,htOpportunity:minute<=45&&htS?htS[0]+htS[1]>hs+as:null,market,mode,odd:odd!==null&&odd>1?odd:null,raw,source:filename});
  }
  if(!picks.length)throw new Error('Il CSV non contiene alert');return {picks,warnings,strategy};
}
export function filterPicks(picks:Pick[],f:Filters):Pick[] {return picks.filter(p=>(!f.strategy||p.strategy===f.strategy)&&(!f.from||p.date.slice(0,10)>=f.from)&&(!f.to||p.date.slice(0,10)<=f.to)&&(!f.league||p.league===f.league)&&(!f.score||p.score===f.score)&&p.minute>=f.minMinute&&p.minute<=f.maxMinute&&[[p.xg,f.minXg],[p.sot,f.minSot],[p.momentum,f.minMomentum],[p.dangerous,f.minDangerous],[p.odd,f.minOdd]].every(([v,min])=>min===0||(v!==null&&v>=min!))&&(f.maxOdd===1000||(p.odd!==null&&p.odd<=f.maxOdd)));}
export type Stats={total:number;wins:number;losses:number;pending:number;resolved:number;rate:number|null;wilson:[number,number]|null;meanOdd:number|null;goalCoverage:number;within5:number;within10:number;within15:number;medianDelay:number|null;maxWin:number;maxLoss:number};
export function stats(picks:Pick[]):Stats {
  const wins=picks.filter(p=>p.strike==='WIN').length,losses=picks.filter(p=>p.strike==='LOSS').length,n=wins+losses;
  let wilson:[number,number]|null=null;if(n){const z=1.96,ph=wins/n,den=1+z*z/n,mid=(ph+z*z/(2*n))/den,half=z*Math.sqrt(ph*(1-ph)/n+z*z/(4*n*n))/den;wilson=[(mid-half)*100,(mid+half)*100];}
  const odds=picks.flatMap(p=>p.odd===null?[]:[p.odd]);const delays=picks.flatMap(p=>p.delay===null?[]:[p.delay]).sort((a,b)=>a-b);
  let w=0,l=0,maxWin=0,maxLoss=0;for(const p of [...picks].sort((a,b)=>a.date.localeCompare(b.date)||a.key.localeCompare(b.key))){if(p.strike==='PENDING'){w=0;l=0;continue;}w=p.strike==='WIN'?w+1:0;l=p.strike==='LOSS'?l+1:0;maxWin=Math.max(maxWin,w);maxLoss=Math.max(maxLoss,l);}
  const valid=picks.filter(p=>p.goalDataComplete&&!p.sameMinuteGoal);
  return {total:picks.length,wins,losses,pending:picks.length-n,resolved:n,rate:n?wins/n*100:null,wilson,meanOdd:odds.length?odds.reduce((a,b)=>a+b,0)/odds.length:null,goalCoverage:valid.length,within5:valid.filter(p=>p.delay!==null&&p.delay<=5).length,within10:valid.filter(p=>p.delay!==null&&p.delay<=10).length,within15:valid.filter(p=>p.delay!==null&&p.delay<=15).length,medianDelay:delays.length?(delays[Math.floor((delays.length-1)/2)]+delays[Math.floor(delays.length/2)])/2:null,maxWin,maxLoss};
}
export function segments(picks:Pick[],field:'league'|'minute'|'score'|'xg'|'momentum'|'mode') {
  const groups=new Map<string,Pick[]>();for(const p of picks){const label=field==='minute'?`${Math.floor(p.minute/5)*5}–${Math.floor(p.minute/5)*5+4}′`:field==='xg'?(p.xg===null?'N/D':`${(Math.floor(p.xg*2)/2).toFixed(1)}–${(Math.floor(p.xg*2)/2+.49).toFixed(2)}`):field==='momentum'?(p.momentum===null?'N/D':`${Math.floor(p.momentum/10)*10}–${Math.floor(p.momentum/10)*10+9}`):p[field];groups.set(label,[...(groups.get(label)||[]),p]);}
  return [...groups].map(([label,rows])=>({label,...stats(rows)})).sort((a,b)=>b.total-a.total||a.label.localeCompare(b.label));
}
export function simulate(picks:Pick[],trades:Trade[],initial:number,amount:number,percent:boolean){
  if(initial<=0||amount<=0||percent&&amount>100)throw new Error('Cassa/stake non validi');
  const keys=new Set(picks.map(p=>p.key));const usable=trades.filter(t=>keys.has(t.pick_key)&&t.net_pl!==null&&t.exposure!==null&&t.exposure>0&&t.closed_at&&['WIN','LOSS','VOID'].includes(t.outcome)).sort((a,b)=>a.closed_at!.localeCompare(b.closed_at!)||a.pick_key.localeCompare(b.pick_key));
  let bank=initial,peak=bank,dd=0,exposure=0;const curve=[{date:'Inizio',bank}];
  for(const t of usable){if(bank<=0)break;const stake=Math.min(bank,percent?bank*amount/100:amount);bank+=stake*t.net_pl!/t.exposure!;exposure+=stake;peak=Math.max(peak,bank);dd=Math.max(dd,(peak-bank)/peak*100);curve.push({date:t.closed_at!,bank});}
  return {bank,profit:bank-initial,roi:exposure?(bank-initial)/exposure*100:null,dd,curve,count:curve.length-1,excluded:picks.length-usable.length};
}
