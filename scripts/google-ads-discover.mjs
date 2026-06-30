#!/usr/bin/env node
/**
 * Descubrimiento: lista las cuentas hijas del MCC para ubicar customer IDs (ej. AgoraTech).
 * Solo lectura. No instala nada. Lee credenciales de .env.local.
 *   node scripts/google-ads-discover.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ENV_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local');
function envFile() {
  const out = {};
  try {
    for (const line of readFileSync(ENV_PATH, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  } catch {}
  return out;
}
const E = { ...envFile(), ...process.env };
const API = 'v21';
const MCC = (E.GOOGLE_ADS_MCC_ID || '').replace(/-/g, '');

async function token() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: E.GOOGLE_ADS_CLIENT_ID, client_secret: E.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: E.GOOGLE_ADS_REFRESH_TOKEN, grant_type: 'refresh_token',
    }).toString(),
  });
  const j = await res.json();
  if (!res.ok || !j.access_token) throw new Error('oauth ' + res.status + ' ' + JSON.stringify(j).slice(0, 300));
  return j.access_token;
}

async function gaql(query, customerId, t) {
  const res = await fetch(`https://googleads.googleapis.com/${API}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${t}`, 'developer-token': E.GOOGLE_ADS_DEVELOPER_TOKEN,
      'login-customer-id': MCC, 'content-type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error('gads ' + res.status + ': ' + JSON.stringify(j).slice(0, 500));
  return j.results || [];
}

(async () => {
  console.log('MCC en uso:', MCC || '(VACÍO)');
  const t = await token();
  console.log('✔ OAuth OK (access token obtenido)\n');
  const rows = await gaql(
    `SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager,
            customer_client.level, customer_client.status, customer_client.currency_code,
            customer_client.time_zone
     FROM customer_client
     WHERE customer_client.status = 'ENABLED'
     ORDER BY customer_client.descriptive_name`,
    MCC, t,
  );
  console.log(`Cuentas hijas ENABLED bajo el MCC: ${rows.length}\n`);
  const fmt = (r) => {
    const c = r.customerClient || {};
    return `${c.manager ? '📁 MCC ' : '   '}${String(c.id).padEnd(12)} | ${(c.descriptiveName || '(sin nombre)').padEnd(38)} | ${c.currencyCode || '?'} | L${c.level}`;
  };
  rows.forEach((r) => console.log(fmt(r)));
  const agora = rows.filter((r) => /agora/i.test(r.customerClient?.descriptiveName || ''));
  console.log('\n=== Coincidencias "Agora" ===');
  if (agora.length) agora.forEach((r) => console.log('>>> ' + fmt(r), '\n    customer_id (sin guiones):', r.customerClient?.id));
  else console.log('(ninguna — revisá la lista de arriba)');
})().catch((e) => { console.error('\n❌', e.message); process.exit(1); });
