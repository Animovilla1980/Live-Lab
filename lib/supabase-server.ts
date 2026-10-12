import { createClient } from '@supabase/supabase-js';
export function getSupabaseAdmin(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key) return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}

// Intelligence can use a scoped private gateway backed by Supabase's managed
// server credentials. It never grants public clients access to the tables.
export function getSupabaseIntelligenceAdmin(){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const gateway=process.env.LIVE_LAB_BACKEND_URL;
  const privateKey=process.env.LIVE_LAB_BACKEND_KEY;
  if(!gateway)return getSupabaseAdmin();
  if(!url||!key||!privateKey)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input,init)=>{
    const target=new URL(typeof input==='string'?input:input instanceof URL?input.toString():input.url);
    const headers=new Headers(init?.headers);
    const safeHeaders:Record<string,string>={};
    for(const name of ['accept','prefer','range','range-unit','content-type']){const value=headers.get(name);if(value)safeHeaders[name]=value;}
    return fetch(gateway,{method:'POST',headers:{'Content-Type':'application/json','x-live-lab-backend-key':privateKey},body:JSON.stringify({path:target.pathname,query:target.search,method:init?.method||'GET',headers:safeHeaders,body:init?.body?JSON.parse(String(init.body)):null})});
  }}});
}
