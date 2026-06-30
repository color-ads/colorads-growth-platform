#!/usr/bin/env node
/** Probe de AgoraTech: rango de fechas con datos + totales lifetime. Solo lectura. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ENV_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
function envFile(){const o={};try{for(const l of readFileSync(ENV_PATH,'utf8').split('\n')){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(m)o[m[1]]=m[2].replace(/^["']|["']$/g,'').trim();}}catch{}return o;}
const E={...envFile(),...process.env};
const API='v21';const MCC=(E.GOOGLE_ADS_MCC_ID||'').replace(/-/g,'');
const CID='7084697923'; // AgoraTech
async function token(){const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:E.GOOGLE_ADS_CLIENT_ID,client_secret:E.GOOGLE_ADS_CLIENT_SECRET,refresh_token:E.GOOGLE_ADS_REFRESH_TOKEN,grant_type:'refresh_token'}).toString()});const j=await r.json();if(!r.ok||!j.access_token)throw new Error('oauth '+r.status);return j.access_token;}
async function gaql(q,t){const r=await fetch(`https://googleads.googleapis.com/${API}/customers/${CID}/googleAds:search`,{method:'POST',headers:{authorization:`Bearer ${t}`,'developer-token':E.GOOGLE_ADS_DEVELOPER_TOKEN,'login-customer-id':MCC,'content-type':'application/json'},body:JSON.stringify({query:q})});const j=await r.json();if(!r.ok)throw new Error('gads '+r.status+': '+JSON.stringify(j).slice(0,400));return j.results||[];}
(async()=>{
  const t=await token();
  // Rango de fechas con datos (ordenado asc y desc para min/max)
  const asc=await gaql(`SELECT segments.date, metrics.impressions FROM customer WHERE segments.date BETWEEN '2018-01-01' AND '2026-06-19' AND metrics.impressions > 0 ORDER BY segments.date ASC LIMIT 1`,t);
  const desc=await gaql(`SELECT segments.date, metrics.impressions FROM customer WHERE segments.date BETWEEN '2018-01-01' AND '2026-06-19' AND metrics.impressions > 0 ORDER BY segments.date DESC LIMIT 1`,t);
  const min=asc[0]?.segments?.date, max=desc[0]?.segments?.date;
  console.log('AgoraTech (7084697923) — rango con datos:', min||'(sin datos)', '→', max||'(sin datos)');
  if(!min){console.log('No hay impresiones en el rango. Quizá la cuenta es nueva o sin actividad.');return;}
  // Totales lifetime
  const tot=await gaql(`SELECT metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM customer WHERE segments.date BETWEEN '${min}' AND '${max}'`,t);
  const m=tot[0]?.metrics||{};
  console.log('Totales lifetime → impresiones:',Number(m.impressions||0).toLocaleString(),'| clicks:',Number(m.clicks||0).toLocaleString(),'| costo COP:',Math.round(Number(m.costMicros||0)/1e6).toLocaleString(),'| conv:',Number(m.conversions||0));
  // Campañas (top)
  const camps=await gaql(`SELECT campaign.name, campaign.advertising_channel_type, metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${min}' AND '${max}' AND metrics.impressions > 0 ORDER BY metrics.cost_micros DESC LIMIT 15`,t);
  console.log(`\nCampañas con actividad: ${camps.length}`);
  camps.forEach(r=>{const c=r.campaign||{},mm=r.metrics||{};console.log('  •',(c.name||'').padEnd(40),'|',c.advertisingChannelType||'?','| impr',Number(mm.impressions||0).toLocaleString(),'| costo',Math.round(Number(mm.costMicros||0)/1e6).toLocaleString());});
})().catch(e=>{console.error('❌',e.message);process.exit(1);});
