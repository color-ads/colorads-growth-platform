/**
 * Tipos para datos de Google Ads Transparency Center (via SerpAPI).
 * Shapes adaptados de lionkiii/gads-transparency-mcp (MIT).
 */

export type AdFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'UNKNOWN';

export interface AdContent {
  headline?: string;
  description?: string;
  callToAction?: string;
  visibleLink?: string;
  landingPageUrl?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export interface AdCreative {
  id: string; // ad_creative_id
  advertiserId: string;
  format: AdFormat;
  firstShown: string | null; // ISO date (YYYY-MM-DD)
  lastShown: string | null; // ISO date (YYYY-MM-DD)
  totalDaysShown: number | null;
  regions: string[]; // region_name[] (solo si se trajo el detalle)
  detailsLink: string | null; // adstransparency.google.com/.../creative/...
  content: AdContent;
}

export interface AdvertiserAds {
  advertiserId: string;
  advertiserName: string;
  totalResults: number;
  creatives: AdCreative[];
}

/** Mapa resuelto que vive en properties.ad_advertiser_ids */
export interface AdvertiserMap {
  self: string[];
  competitors: Record<string, string[]>;
}

export interface GoogleAdsBundle {
  self: AdvertiserAds[];
  competitors: Record<string, AdvertiserAds[]>;
  fetchedAt: string;
  mode: 'fast' | 'deep';
  detailsFetched: number; // cuantos detalles se trajeron efectivamente
}

/** Snapshot de tarifa/posicionamiento desde Google Hotels (SerpAPI engine google_hotels). */
export interface HotelSnapshot {
  label: string; // 'self' o nombre del competidor (como se configuro)
  name: string; // nombre del hotel segun Google
  ratePerNight: number | null;
  currency: string | null;
  rating: number | null;
  reviews: number | null;
  hotelClass: string | null;
  amenities: string[];
  image: string | null;
  link: string | null;
}
