import {NextRequest,NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
import {getSupabaseAdmin} from '@/lib/supabase-server';
import {parsePicks,STRATEGIES,filterPicks,stats,DEFAULT_FILTERS, type StrategyId,type Pick,type Filters} from '@/lib/inplayguru';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function allPicks(sb:NonNullable<ReturnType<typeof getSupabaseAdmin>>){
  const result:Pick[]=[];
  for(let start=0;;start+=500){const {data,error}=await sb.from('live_lab_ipg_picks').select('payload').order('pick_key').range(start,start+499);if(error)throw new Error(error.message);result.push(...(data||[]).map(x=>x.payload as Pick));if(!data||data.length<500)break;if(result.length>100000)throw new Error('Archivio oltre 100.000 alert: serve paginazione analitica server.');}return result;
}
export async function POST(req:NextRequest){
  const expected=process.env.LIVE_LAB_ACCESS_KEY||process.env.LIVE_LAB_INGEST_KEY;
  if(!expected)return json({error:'Imposta LIVE_LAB_ACCESS_KEY su Vercel (oppure riusa LIVE_LAB_INGEST_KEY).'},503);
  const supplied=req.headers.get('x-live-lab-key')||'';
  const hash=(s:string)=>createHash('sha256').update(s).digest();
  if(!timingSafeEqual(hash(supplied),hash(expected)))return json({error:'Chiave di accesso non corretta.'},401);
  const sb=getSupabaseAdmin();if(!sb)return json({error:'Configurazione Supabase mancante su Vercel.'},503);
  try {
    // Limit before JSON parsing: Vercel also enforces its own body limit.
    const body=await req.text();if(Buffer.byteLength(body)>3000000)return json({error:'Import troppo grande (massimo 3 MB): suddividi i CSV.'},413);
    const b=JSON.parse(body);
    if(b.action==='health'){
      const {error}=await sb.from('live_lab_ipg_picks').select('pick_key').limit(1);
      const configuredKey=process.env.SUPABASE_SERVICE_ROLE_KEY!;let configuredRole='unknown';try{configuredRole=JSON.parse(Buffer.from(configuredKey.split('.')[1]||'','base64url').toString()).role||'unknown';}catch{configuredRole=configuredKey.startsWith('sb_publishable_')?'publishable':configuredKey.startsWith('sb_secret_')?'secret':'unknown';}
      return json({databaseHost:new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname,configuredRole,ready:!error,error:error?.message??null});
    }
    if(b.action==='load'){
      const offset=Number(b.offset||0),limit=b.includeRaw?250:500;
      if(!Number.isInteger(offset)||offset<0||offset>100000)return json({error:'Pagina non valida'},400);
      const page=await sb.from('live_lab_ipg_picks').select('payload').order('pick_key').range(offset,offset+limit-1);
      if(page.error)throw new Error(page.error.message);
      const picks=(page.data||[]).map(x=>b.includeRaw?x.payload:{...x.payload,raw:{}});
      if(offset>0||b.includeRaw)return json({picks,hasMore:picks.length===limit,nextOffset:offset+limit});
      const [t,c,i]=await Promise.all([sb.from('live_lab_ipg_trades').select('*').order('pick_key').range(0,999),sb.from('live_lab_ipg_candidates').select('*').order('created_at',{ascending:false}),sb.from('live_lab_ipg_imports').select('*').order('created_at',{ascending:false}).limit(30)]);
      if(t.error||c.error||i.error)throw new Error(t.error?.message||c.error?.message||i.error?.message);
      // Trade pagination must not silently truncate the real-economic denominator.
      const trades=t.data||[];for(let start=1000;trades.length===start;start+=1000){const r=await sb.from('live_lab_ipg_trades').select('*').order('pick_key').range(start,start+999);if(r.error)throw new Error(r.error.message);trades.push(...(r.data||[]));if(!r.data?.length)break;}
      return json({picks,trades,candidates:c.data,imports:i.data,hasMore:picks.length===limit,nextOffset:offset+limit});
    }
    if(b.action==='detail'){
      if(typeof b.key!=='string')return json({error:'Alert non valido'},400);
      const {data,error}=await sb.from('live_lab_ipg_picks').select('payload').eq('pick_key',b.key).single();
      if(error||!data)throw new Error('Alert non trovato');
      return json({pick:data.payload});
    }
    if(b.action==='preview'||b.action==='import'){
      if(!Array.isArray(b.files)||!b.files.length||b.files.length>10)return json({error:'Seleziona da 1 a 10 CSV.'},400);
      const files=b.files.map((f:{name:string;text:string;strategy?:StrategyId})=>{
        if(typeof f.name!=='string'||f.name.length>250||typeof f.text!=='string'||f.strategy&&!(f.strategy in STRATEGIES))throw new Error('File non valido');
        const parsed=parsePicks(f.text,f.name,f.strategy);if(parsed.picks.length>10000)throw new Error('Massimo 10.000 alert per CSV');return {...parsed,name:f.name,hash:createHash('sha256').update(f.text).digest('hex')};
      });
      if(b.action==='preview'){
        const existing=new Map((await allPicks(sb)).map(p=>[p.key,p]));
        return json({preview:files.map((f:{name:string;picks:Pick[];warnings:string[];strategy:StrategyId})=>{
          let added=0,updated=0,unchanged=0,protectedCount=0;
          for(const p of f.picks){const old=existing.get(p.key);if(!old)added++;else if(old.strike!=='PENDING'&&p.strike==='PENDING')protectedCount++;else if(JSON.stringify({...old,source:''})===JSON.stringify({...p,source:''}))unchanged++;else updated++;if(!old||!(old.strike!=='PENDING'&&p.strike==='PENDING'))existing.set(p.key,p);}
          return {name:f.name,strategy:f.strategy,...stats(f.picks),added,updated,unchanged,protected:protectedCount,warnings:f.warnings};})});
      }
      const {data,error}=await sb.rpc('live_lab_ipg_import',{files:files.map((f:{name:string;strategy:StrategyId;hash:string;picks:Pick[]})=>({name:f.name,strategy:f.strategy,hash:f.hash,picks:f.picks}))});if(error)throw new Error(error.message);return json({reports:data});
    }
    if(b.action==='trade'){
      const t=b.trade;
      if(!t||typeof t.pick_key!=='string'||!['WIN','LOSS','VOID','SKIP','OPEN'].includes(t.outcome)||typeof t.note!=='string'||t.note.length>3000)return json({error:'Trade non valido'},400);
      const closed=['WIN','LOSS','VOID'].includes(t.outcome);
      if(closed&&(!Number.isFinite(t.exposure)||t.exposure<=0||!Number.isFinite(t.net_pl)||t.net_pl < -t.exposure||!t.closed_at||!Number.isFinite(Date.parse(t.closed_at))))return json({error:'Indica esposizione positiva, P/L netto e data di chiusura. La perdita non può superare l’esposizione.'},400);
      const {error}=await sb.from('live_lab_ipg_trades').upsert({pick_key:t.pick_key,outcome:t.outcome,exposure:closed?t.exposure:null,net_pl:closed?t.net_pl:null,closed_at:closed?t.closed_at:null,note:t.note,updated_at:new Date().toISOString()},{onConflict:'pick_key'});if(error)throw new Error(error.message);return json({ok:true});
    }
    if(b.action==='candidate'){
      if(!(b.strategy in STRATEGIES)||typeof b.label!=='string'||!b.label.trim()||b.label.length>200)return json({error:'Scegli una strategia e un nome per il candidato.'},400);
      const f={...DEFAULT_FILTERS,...b.filters,strategy:b.strategy,from:'',to:''} as Filters;
      for(const k of ['minMinute','maxMinute','minXg','minSot','minMomentum','minDangerous','minOdd','maxOdd'] as const)if(!Number.isFinite(f[k])||f[k]<0)throw new Error('Filtri non validi');
      const all=(await allPicks(sb)).filter(p=>p.strategy===b.strategy);if(!all.length)throw new Error('Importa prima gli alert di questa strategia.');
      const cutoff=all.map(p=>p.date.slice(0,10)).sort().at(-1)!;
      const baseline=stats(filterPicks(all,f));
      const {error}=await sb.from('live_lab_ipg_candidates').insert({strategy:b.strategy,label:b.label.trim(),filters:f,cutoff,baseline,status:baseline.resolved>=30?'CANDIDATE':'OBSERVATION'});if(error)throw new Error(error.message);return json({ok:true});
    }
    if(b.action==='candidate-status'){
      if(!['VALIDATED','REJECTED','CANDIDATE','OBSERVATION'].includes(b.status))return json({error:'Stato non valido'},400);
      if(b.status==='VALIDATED'){
        const {data:c,error}=await sb.from('live_lab_ipg_candidates').select('*').eq('id',b.id).single();
        if(error||!c)throw new Error('Candidato non trovato');
        const future=(await allPicks(sb)).filter(p=>p.strategy===c.strategy&&p.date.slice(0,10)>c.cutoff);
        if(stats(filterPicks(future,c.filters)).resolved<50)return json({error:'Servono almeno 50 esiti su date future prima della validazione manuale.'},400);
      }
      const {error}=await sb.from('live_lab_ipg_candidates').update({status:b.status}).eq('id',b.id);if(error)throw new Error(error.message);return json({ok:true});
    }
    return json({error:'Azione non supportata'},400);
  }catch(e){const message=e instanceof Error?e.message:'Errore sconosciuto';return json({error:message.includes('live_lab_ipg')||message.includes('schema cache')?`Database Intelligence non pronto: esegui la nuova migration SQL inclusa nella release. Dettaglio: ${message}`:message},400);}
}
