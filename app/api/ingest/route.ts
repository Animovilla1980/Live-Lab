import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseAdmin} from '@/lib/supabase-server';
import {evaluateForebetGate} from '@/lib/forebet-gate';
import {sameTeam} from '@/lib/normalize';

type Payload={matchKey?:string;matchDate?:string;league?:string;home:string;away:string;minute:number;homeScore?:number;awayScore?:number;xgHome?:number;xgAway?:number;sotHome?:number;sotAway?:number;sourceUrl?:string};
export async function POST(req:NextRequest){
  const expected=process.env.LIVE_LAB_INGEST_KEY;
  if(expected && req.headers.get('x-live-lab-key')!==expected) return NextResponse.json({ok:false,error:'unauthorized'},{status:401});
  const p=(await req.json()) as Payload;
  if(!p?.home||!p?.away) return NextResponse.json({ok:false,error:'home/away required'},{status:400});
  const sb=getSupabaseAdmin();
  if(!sb){const gate=evaluateForebetGate(null);return NextResponse.json({ok:true,mode:'demo',gate,shouldAlert:true});}

  const day=p.matchDate??new Date().toISOString().slice(0,10);
  const center=new Date(`${day}T12:00:00.000Z`); const start=new Date(center.getTime()-36*3600_000).toISOString(),end=new Date(center.getTime()+36*3600_000).toISOString();
  const forebetTable=process.env.FOREBET_MATCHES_TABLE||'forebet_matches';
  let predictedScore:string|null=null,forebetMatchId:string|null=null;
  const {data:rows,error:forebetError}=await sb.from(forebetTable).select('id,league_name,home_team,away_team,kickoff,predicted_score').gte('kickoff',start).lte('kickoff',end).limit(500);
  if(!forebetError && rows){const hit=rows.find((r:any)=>sameTeam(p.home,r.home_team)&&sameTeam(p.away,r.away_team));if(hit){predictedScore=hit.predicted_score??null;forebetMatchId=String(hit.id)}}
  const gate=evaluateForebetGate(predictedScore);
  const shouldAlert=gate.status!=='BLOCK';
  const xgTotal=Number(p.xgHome??0)+Number(p.xgAway??0),sotTotal=Number(p.sotHome??0)+Number(p.sotAway??0);
  const {data:inserted,error:insertError}=await sb.from('live_lab_alerts').upsert({match_key:p.matchKey??`${day}|${p.home}|${p.away}`,match_date:day,league_name:p.league??null,home_team:p.home,away_team:p.away,alert_minute:p.minute,home_score:p.homeScore??0,away_score:p.awayScore??0,xg_home:p.xgHome??null,xg_away:p.xgAway??null,xg_total:xgTotal,sot_home:p.sotHome??null,sot_away:p.sotAway??null,sot_total:sotTotal,source_url:p.sourceUrl??null,forebet_match_id:forebetMatchId,forebet_predicted_score:gate.predictedScore,forebet_gate_status:gate.status,forebet_gate_reason:gate.reason,telegram_allowed:shouldAlert,telegram_sent:false},{onConflict:'match_key,alert_minute'}).select('id').single();
  if(insertError) return NextResponse.json({ok:false,error:insertError.message,gate,shouldAlert},{status:500});
  return NextResponse.json({ok:true,id:inserted?.id,gate,shouldAlert,forebetLookupError:forebetError?.message??null});
}
