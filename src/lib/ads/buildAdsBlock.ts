/**
 * Convierte un GoogleAdsBundle en el bloque de texto "EVIDENCIA DURA" que se inyecta al prompt.
 * Si el bundle es null (sin SERPAPI_KEY o sin IDs), devuelve '' -> el prompt queda identico al actual.
 */

import type { AdCreative, AdvertiserAds, GoogleAdsBundle } from './types';

function fmtCreative(c: AdCreative): string {
  const lines: string[] = [];
  const text = c.content.headline || c.content.description || '(creativo visual sin texto)';
  lines.push(`    • [${c.format}] ${text}`);
  const meta: string[] = [];
  if (c.content.callToAction) meta.push(`CTA: ${c.content.callToAction}`);
  const landing = c.content.landingPageUrl || c.content.visibleLink;
  if (landing) meta.push(`landing: ${landing}`);
  if (c.firstShown || c.lastShown) {
    meta.push(`activo: ${c.firstShown || '?'} -> ${c.lastShown || '?'}${c.totalDaysShown ? ` (${c.totalDaysShown}d)` : ''}`);
  }
  if (c.regions.length) meta.push(`regiones: ${c.regions.join(', ')}`);
  if (meta.length) lines.push(`      ${meta.join(' | ')}`);
  // Prueba verificable para citar en evidence
  const proof = c.detailsLink || landing;
  if (proof) lines.push(`      prueba: ${proof}`);
  return lines.join('\n');
}

function fmtAdvertiser(a: AdvertiserAds): string {
  const head = `  ${a.advertiserName} (${a.totalResults} anuncios en transparencia; se muestran ${a.creatives.length}):`;
  if (!a.creatives.length) return `${head}\n    (sin anuncios recientes)`;
  return [head, ...a.creatives.map(fmtCreative)].join('\n');
}

export function buildGoogleAdsBlock(bundle: GoogleAdsBundle | null): string {
  if (!bundle) return '';
  const hasAny =
    bundle.self.some((a) => a.creatives.length) ||
    Object.values(bundle.competitors).some((arr) => arr.some((a) => a.creatives.length));
  if (!hasAny) return '';

  const L: string[] = [];
  L.push('EVIDENCIA DURA — DATOS VERIFICADOS DE GOOGLE ADS (Centro de Transparencia de Anuncios de Google; NO inferidos):');
  L.push(
    'Esta data viene directo del Centro de Transparencia de Google. Tiene MAYOR autoridad que tu busqueda web: si algo aca contradice lo que infieras navegando, PREVALECE esta seccion. Cuando un finding se apoye en Google Ads, cita en "evidence" el anuncio real (su URL de "prueba" o su landing), nunca una URL inventada.',
  );
  L.push('');

  if (bundle.self.length) {
    L.push('NUESTRO HOTEL — lo que el hotel cliente esta pautando hoy en Google Ads:');
    for (const a of bundle.self) L.push(fmtAdvertiser(a));

    const regions = new Set<string>();
    for (const a of bundle.self) for (const c of a.creatives) for (const r of c.regions) regions.add(r);
    if (regions.size) {
      L.push('');
      L.push(`REGIONES DONDE SE MUESTRAN LOS ADS DEL HOTEL CLIENTE: ${[...regions].join(', ')}.`);
      L.push(
        'Nota estrategica: el hotel apunta a EXTRANJEROS YA EN DESTINO (Colombia). Si sus ads se muestran en muchos paises fuera de Colombia, puede ser gasto desalineado con la estrategia; evaluá si amerita un finding o una correccion.',
      );
    }
    L.push('');
  }

  const names = Object.keys(bundle.competitors);
  if (names.length) {
    L.push('COMPETIDORES — lo que estan pautando hoy en Google Ads:');
    for (const name of names) {
      L.push(` ${name}:`);
      for (const a of bundle.competitors[name]) L.push(fmtAdvertiser(a));
    }
    L.push('');
  }

  if (bundle.mode === 'fast') {
    L.push('(Modo rapido: solo listado de anuncios, sin copy ni regiones. Corré el modo profundo para el detalle completo.)');
  } else if (!bundle.detailsFetched) {
    L.push('(No se pudieron traer detalles de anuncios en esta corrida; usá el listado con cautela.)');
  }

  return L.join('\n').trim();
}
