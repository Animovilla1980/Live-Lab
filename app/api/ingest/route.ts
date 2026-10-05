import {NextRequest,NextResponse} from 'next/server';
import {getSupabaseAdmin} from '@/lib/supabase-server';
import {evaluateForebetGate} from '@/lib/forebet-gate';
import {sameTeam} from '@/lib/normalize';
import {evaluateSignals} from '@/lib/signal-engine';

type Payload={
  matchKey?:string;matchDate?:string;league?:string;home:string;away:string;minute:number;
  homeScore?:number;awayScore?:number;xgHome?:number;xgAway?:number;sotHome?:number;sotAway?:number;
  attacksHome?:number;attacksAway?:number;dangerousHome?:number;dangerousAway?:number;
  possessionHome?:number;possessionAway?:number;redCardsHome?:number;redCardsAway?:number;sourceUrl?:string
};

export async function POST(req:NextRequest){
  const expected=process.env.LIVE_LAB_INGEST_KEY;
  if(expected && req.headers.get('x-live-lab-key')!==expected) return NextResponse.json({ok:false,error:'unauthorized'},{status:401});
  const p=(await req.json()) as Payload;
  if(!p?.home||!p?.away||!Number.isFinite(Number(p.minute))) return NextResponse.json({ok:false,error:'home/away/minute required'},{status:400});

  const current={
    minute:Number(p.minute),homeScore:Number(p.homeScore??0),awayScore:Number(p.awayScore??0),
    xgHome:p.xgHome??null,xgAway:p.xgAway??null,sotHome:p.sotHome??null,sotAway:p.sotAway??null,
    attacksHome:p.attacksHome??null,attacksAway:p.attacksAway??null,dangerousHome:p.dangerousHome??null,dangerousAway:p.dangerousAway??null,
    possessionHome:p.possessionHome??null,possessionAway:p.possessionAway??null,redCardsHome:p.redCardsHome??null,redCardsAway:p.redCardsAway??null
  };
  const sb=getSupabaseAdmin();
  if(!sb){const gate=evaluateForebetGate(null);const engine=evaluateSignals(current,null,{});return NextResponse.json({ok:true,mode:'demo',gate,engine,shouldAlert:engine.notify});}

  const day=p.matchDate??new Date().toISOString().slice(0,10);
  const matchKey=p.matchKey??`${day}|${p.home}|${p.away}`;
  const center=new Date(`${day}T12:00:00.000Z`);
  const start=new Date(center.getTime()-36*3600_000).toISOString(),end=new Date(center.getTime()+36*3600_000).toISOString();

  let forebet:any=null;
  const {data:rows,error:forebetError}=await sb.from('forebet_archive_view')
    .select('match_id,league_name,home_team,away_team,kickoff_at,predicted_score,prediction_1x2,p1,px,p2,over_prob,ou_prediction')
    .gte('kickoff_at',start).lte('kickoff_at',end).limit(600);
  if(!forebetError&&rows){forebet=rows.find((r:any)=>sameTeam(p.home,r.home_team)&&sameTeam(p.away,r.away_team))??null;}

  const gate=evaluateForebetGate(forebet?.predicted_score??null);
  const {data:previousRow}=await sb.from('live_lab_snapshots').select('*').eq('match_key',matchKey).lt('minute',current.minute).order('minute',{ascending:false}).limit(1).maybeSingle();
  const previous=previousRow?{
    minute:Number(previousRow.minute),homeScore:Number(previousRow.home_score??0),awayScore:Number(previousRow.away_score??0),
    xgHome:previousRow.xg_home,xgAway:previousRow.xg_away,sotHome:previousRow.sot_home,sotAway:previousRow.sot_away,
    dangerousHome:previousRow.dangerous_home,dangerousAway:previousRow.dangerous_away,
    possessionHome:previousRow.possession_home,possessionAway:previousRow.possession_away
  }:null;

  const engine=evaluateSignals(current,previous,{
    predictedScore:forebet?.predicted_score??null,prediction1x2:forebet?.prediction_1x2??null,
    p1:forebet?.p1??null,p2:forebet?.p2??null
  });

  const snapshot={
    match_key:matchKey,match_date:day,league_name:p.league??null,home_team:p.home,away_team:p.away,minute:current.minute,
    home_score:current.homeScore,away_score:current.awayScore,xg_home:p.xgHome??null,xg_away:p.xgAway??null,
    sot_home:p.sotHome??null,sot_away:p.sotAway??null,attacks_home:p.attacksHome??null,attacks_away:p.attacksAway??null,
    dangerous_home:p.dangerousHome??null,dangerous_away:p.dangerousAway??null,possession_home:p.possessionHome??null,
    possession_away:p.possessionAway??null,red_cards_home:p.redCardsHome??null,red_cards_away:p.redCardsAway??null,source_url:p.sourceUrl??null
  };
  const {error:snapshotError}=await sb.from('live_lab_snapshots').upsert(snapshot,{onConflict:'match_key,minute'});

  let alertId:string|null=null,duplicate=false;
  if((engine.tier==='A'||engine.tier==='B')&&engine.primary){
    const {data:prior}=await sb.from('live_lab_alerts').select('id').eq('match_key',matchKey).eq('strategy_code',engine.primary.code).limit(1).maybeSingle();
    duplicate=!!prior;
    if(!duplicate){
      const xgTotal=Number(p.xgHome??0)+Number(p.xgAway??0),sotTotal=Number(p.sotHome??0)+Number(p.sotAway??0);
      const {data:inserted,error:insertError}=await sb.from('live_lab_alerts').insert({
        match_key:matchKey,match_date:day,league_name:p.league??null,home_team:p.home,away_team:p.away,alert_minute:current.minute,
        home_score:current.homeScore,away_score:current.awayScore,xg_home:p.xgHome??null,xg_away:p.xgAway??null,xg_total:xgTotal,
        sot_home:p.sotHome??null,sot_away:p.sotAway??null,sot_total:sotTotal,source_url:p.sourceUrl??null,
        forebet_match_id:forebet?.match_id?String(forebet.match_id):null,forebet_predicted_score:gate.predictedScore,
        forebet_gate_status:gate.status,forebet_gate_reason:gate.reason,telegram_allowed:engine.notify,telegram_sent:false,
        strategy_code:engine.primary.code,strategy_label:engine.primary.label,strategy_score:engine.primary.score,alert_tier:engine.tier,
        strategy_scores:engine.signals,pressure_delta:engine.delta,engine_version:engine.version,
        outcome:engine.blocked?'BLOCKED':null
      }).select('id').single();
      if(insertError) return NextResponse.json({ok:false,error:insertError.message,gate,engine},{status:500});
      alertId=inserted?.id??null;
    }
  }

  return NextResponse.json({ok:true,id:alertId,gate,engine,shouldAlert:engine.notify&&!duplicate,duplicate,snapshotError:snapshotError?.message??null,forebetLookupError:forebetError?.message??null});
}
