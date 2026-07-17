#!/usr/bin/env node
/**
 * Genera el GOOGLE_ADS_REFRESH_TOKEN con TODOS los scopes que usa la plataforma:
 * Google Ads + GA4 (lectura y admin) + Tag Manager (lectura, edición y publicación).
 * Reemplaza a scripts/google-ads-token.mjs (mismo flujo, más scopes).
 *
 * Uso:
 *   node scripts/google-token.mjs
 *   → se abre el navegador → autorizar con la cuenta dueña de GTM/GA4/Ads → listo.
 * El token queda guardado/actualizado en .env.local (GOOGLE_ADS_REFRESH_TOKEN).
 */

import http from 'node:http';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ENV_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.local');

const PORT = 4444;
const REDIRECT_URI = `http://localhost:${PORT}`;
const SCOPE = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/analytics.edit',
  'https://www.googleapis.com/auth/tagmanager.readonly',
  'https://www.googleapis.com/auth/tagmanager.edit.containers',
  'https://www.googleapis.com/auth/tagmanager.edit.containerversions',
  'https://www.googleapis.com/auth/tagmanager.publish',
].join(' ');
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

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
  console.error('\n❌ Falta GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET en .env.local.\n');
  process.exit(1);
}

const state = crypto.randomBytes(16).toString('hex');
const authUrl = `${AUTH_URL}?${new URLSearchParams({
  client_id: CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  response_type: 'code',
  scope: SCOPE,
  access_type: 'offline',
  prompt: 'consent',
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
    res.end(`<h2>❌ Error: ${err}</h2><p>Podés cerrar esta pestaña.</p>`);
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
      const line = `GOOGLE_ADS_REFRESH_TOKEN=${tok.refresh_token}`;
      let txt = ''; try { txt = readFileSync(ENV_PATH, 'utf8'); } catch {}
      if (/^GOOGLE_ADS_REFRESH_TOKEN=.*$/m.test(txt)) {
        writeFileSync(ENV_PATH, txt.replace(/^GOOGLE_ADS_REFRESH_TOKEN=.*$/m, line));
      } else {
        appendFileSync(ENV_PATH, `\n${line}\n`);
      }
      console.log('\n✅ REFRESH_TOKEN_OK — guardado/actualizado en .env.local (no se muestra por seguridad).\n');
    } else {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h2>⚠️ No vino refresh_token.</h2><p>Revisá la terminal.</p>');
      console.error('\n⚠️ No se recibió refresh_token. Respuesta de Google:\n', JSON.stringify(tok, null, 2));
    }
  } catch (e) {
    res.writeHead(500); res.end('error');
    console.error('\n❌ Falló el intercambio del code:', e?.message || e, '\n');
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 300);
  }
});

server.listen(PORT, () => {
  console.log('\n🔑 Generador de refresh token Google (Ads + GA4 + Tag Manager)\n');
  console.log(`Redirect URI (debe estar autorizada en el OAuth client): ${REDIRECT_URI}`);
  console.log('\nAUTH_URL_BEGIN');
  console.log(authUrl);
  console.log('AUTH_URL_END\n');
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
  exec(`${opener} "${authUrl}"`, () => {});
});
