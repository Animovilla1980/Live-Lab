const EXPECTED_HASH="55b45afd1012c8af1233035edbf5b0ce85625599a986af0cb1298efa4bd6ebaf";
const allowed=new Set(['live_lab_ipg_picks','live_lab_ipg_imports','live_lab_ipg_revisions','live_lab_ipg_trades','live_lab_ipg_candidates']);
const deny=(message,status)=>new Response(JSON.stringify({message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
Deno.serve(async(req)=>{
  if(req.method!=='POST')return deny('Method not allowed',405);
  const supplied=req.headers.get('x-live-lab-backend-key')||'';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(supplied));
  const actual=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  let difference=0;for(let i=0;i<EXPECTED_HASH.length;i++)difference|=actual.charCodeAt(i)^EXPECTED_HASH.charCodeAt(i);
  if(difference)return deny('Unauthorized',401);
  try{
    const text=await req.text();if(new TextEncoder().encode(text).length>3500000)return deny('Body too large',413);
    const b=JSON.parse(text);const match=typeof b.path==='string'?b.path.match(/^\/rest\/v1\/(live_lab_ipg_[a-z]+|rpc\/live_lab_ipg_import)$/):null;
    const object=match?.[1];
    if(!object||!allowed.has(object)&&object!=='rpc/live_lab_ipg_import')return deny('Resource not allowed',403);
    const methods=object==='rpc/live_lab_ipg_import'?['POST']:object==='live_lab_ipg_trades'?['GET','POST']:object==='live_lab_ipg_candidates'?['GET','POST','PATCH']:['GET'];
    if(!methods.includes(b.method))return deny('Operation not allowed',403);
    const base=Deno.env.get('SUPABASE_URL'),admin=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!base||!admin)return deny('Managed backend unavailable',503);
    const target=new URL(b.path,base);
    if(typeof b.query!=='string'||b.query.length>8000||b.query&&!b.query.startsWith('?'))return deny('Invalid query',400);
    target.search=b.query;
    const headers=new Headers({'apikey':admin,'Authorization':'Bearer '+admin});
    for(const name of ['accept','prefer','range','range-unit','content-type'])if(typeof b.headers?.[name]==='string')headers.set(name,b.headers[name]);
    const result=await fetch(target,{method:b.method,headers,body:b.method==='GET'?undefined:JSON.stringify(b.body)});
    const responseHeaders=new Headers({'Cache-Control':'no-store'});
    for(const name of ['content-type','content-range','range-unit']){const value=result.headers.get(name);if(value)responseHeaders.set(name,value);}
    return new Response(result.body,{status:result.status,headers:responseHeaders});
  }catch{return deny('Invalid request',400);}
});
