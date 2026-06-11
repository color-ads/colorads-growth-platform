#!/usr/bin/env node
/**
 * Helper para generar el GOOGLE_ADS_REFRESH_TOKEN (una sola vez).
 *
 * Uso:
 *   1. Tene un OAuth client tipo "Desktop app" (o "Web app" con redirect http://localhost:4444)
 *      en Google Cloud Console, con la Google Ads API habilitada.
 *   2. Pone en .env.local (o exporta) GOOGLE_ADS_CLIENT_ID y GOOGLE_ADS_CLIENT_SECRET.
 *      Tambien podes pasarlos como args:  node scripts/google-ads-token.mjs <client_id> <client_secret>
 *   3. Corre:  node scripts/google-ads-token.mjs
 *   4. Se abre el navegador -> logueate con la cuenta Google que tiene acceso a la MCC -> aceptar.
 *   5. El script imprime tu GOOGLE_ADS_REFRESH_TOKEN. Copialo a .env.local y a Vercel.
 *
 * No instala nada: usa solo modulos nativos de Node.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { readFileSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ENV_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local');

const PORT = 4444;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = 'https://www.googleapis.com/auth/adwords';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ── Leer client id/secret: args > env > .env.local ────────────────────────────
function fromEnvFile() {
  try {
    const txt = readFileSync(ENV_PATH, 'utf8');
    const out = {};
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
    return out;
  } catch { return {}; }
}

const envFile = fromEnvFile();
const CLIENT_ID = process.argv[2] || process.env.GOOGLE_ADS_CLIENT_ID || envFile.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.argv[3] || process.env.GOOGLE_ADS_CLIENT_SECRET || envFile.GOOGLE_ADS_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌ Falta GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET.');
  console.error('   Ponelos en .env.local o pasalos: node scripts/google-ads-token.mjs <client_id> <client_secret>\n');
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');
const authUrl = `${AUTH_URL}?${new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline',
  prompt: 'consent', // fuerza refresh_token siempre
  state,
}).toString()}`;

async function exchangeCode(code) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }).toString(),
  });
  return res.json();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  if (!url.searchParams.has('code') && !url.searchParams.has('error')) {
    res.writeHead(204); res.end(); return;
  }
  const err = url.searchParams.get('error');
  if (err) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<h2>❌ Error: ${err}</h2><p>Podes cerrar esta pestaña.</p>`);
    console.error('\n❌ OAuth error:', err, '\n');
    server.close(); process.exit(1);
  }
  if (url.searchParams.get('state') !== state) {
    res.writeHead(400); res.end('state mismatch'); return;
  }
  const code = url.searchParams.get('code');
  try {
    const tok = await exchangeCode(code);
    if (tok.refresh_token) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h2>✅ Listo. Ya podés cerrar esta pestaña y volver a Claude.</h2>');
      appendFileSync(ENV_PATH, `\nGOOGLE_ADS_REFRESH_TOKEN=${tok.refresh_token}\n`);
      console.log('\n✅ REFRESH_TOKEN_OK — guardado en .env.local (no se muestra por seguridad).\n');
    } else {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h2>⚠️ No vino refresh_token.</h2><p>Revisá la terminal.</p>');
      console.error('\n⚠️ No se recibió refresh_token. Respuesta de Google:\n', JSON.stringify(tok, null, 2));
      console.error('\nTip: si ya autorizaste antes, revocá el acceso en https://myaccount.google.com/permissions y reintentá (prompt=consent ya está forzado).\n');
    }
  } catch (e) {
    res.writeHead(500); res.end('error');
    console.error('\n❌ Fallo el intercambio del code:', e?.message || e, '\n');
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 300);
  }
});

server.listen(PORT, () => {
  console.log('\n🔑 Generador de refresh token de Google Ads\n');
  console.log(`Redirect URI (debe estar autorizada en tu OAuth client): ${REDIRECT_URI}`);
  console.log('\nAbriendo el navegador para que autorices...\n');
  console.log('Si no se abre solo, pegá esta URL en el navegador:\n');
  console.log(authUrl + '\n');
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
  exec(`${opener} "${authUrl}"`, () => {});
});
