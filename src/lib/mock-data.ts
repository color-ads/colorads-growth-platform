import { MonthlyReport, Property, ContentItem } from '@/types'

export const MOCK_PROPERTY: Property = {
  id: 'hashtag-98-uuid',
  name: 'Hashtag 98 Hotel',
  slug: 'hashtag-98',
  location: 'El Poblado, Medellín',
  logo_url: null,
  primary_color: '#0ea5e9',
  secondary_color: '#0f172a',
  success_fee_pct: 2.5,
  active: true,
  created_at: '2025-01-01',
  cloudbeds_property_id: null,
  google_ads_account_id: null,
  meta_ad_account_id: null,
}

// Real data from the spreadsheet
export const MOCK_HISTORICAL: Partial<MonthlyReport>[] = [
  { month: 1,  year: 2025, attributable_revenue: 209_642_187, total_hotel_revenue: 266_000_000, total_bookings: 142, booking_volume: 266_000_000, google_investment: 8_000_000, meta_investment: 7_000_000, content_investment: 2_500_000, fees_investment: 2_900_000, total_investment: 20_400_000, total_impressions: 122339, total_clicks: 8230, avg_cpc: 851, roas: 10.27, ad_cost_pct: 9.73 },
  { month: 2,  year: 2025, attributable_revenue: 376_761_751, total_hotel_revenue: 438_000_000, total_bookings: 198, booking_volume: 438_000_000, google_investment: 8_000_000, meta_investment: 7_000_000, content_investment: 2_500_000, fees_investment: 2_900_000, total_investment: 20_400_000, total_impressions: 47572,  total_clicks: 5021, avg_cpc: 797, roas: 18.47, ad_cost_pct: 5.41 },
  { month: 3,  year: 2025, attributable_revenue: 258_713_012, total_hotel_revenue: 357_000_000, total_bookings: 165, booking_volume: 357_000_000, google_investment: 8_000_000, meta_investment: 7_000_000, content_investment: 2_500_000, fees_investment: 2_900_000, total_investment: 20_400_000, total_impressions: 29900,  total_clicks: 2537, avg_cpc: 797, roas: 12.68, ad_cost_pct: 7.89 },
  { month: 4,  year: 2025, attributable_revenue: 164_091_437, total_hotel_revenue: 340_000_000, total_bookings: 118, booking_volume: 340_000_000, google_investment: 8_000_000, meta_investment: 7_000_000, content_investment: 2_500_000, fees_investment: 2_900_000, total_investment: 20_400_000, total_impressions: 30643,  total_clicks: 3326, avg_cpc: 797, roas: 8.04,  ad_cost_pct: 12.43 },
  { month: 5,  year: 2025, attributable_revenue: 197_934_565, total_hotel_revenue: 283_000_000, total_bookings: 134, booking_volume: 283_000_000, google_investment: 12_538_262, meta_investment: 5_000_000, content_investment: 2_500_000, fees_investment: 2_900_000, total_investment: 22_938_262, total_impressions: 30643,  total_clicks: 2653, avg_cpc: 797, roas: 8.63,  ad_cost_pct: 11.59 },
  { month: 6,  year: 2025, attributable_revenue: 276_588_516, total_hotel_revenue: 222_000_000, total_bookings: 178, booking_volume: 222_000_000, google_investment: 9_000_000, meta_investment: 2_600_000, content_investment: 2_500_000, fees_investment: 6_914_713, total_investment: 21_014_713, total_impressions: 95800,  total_clicks: 8730, avg_cpc: 2407, roas: 13.16, ad_cost_pct: 7.60 },
  { month: 7,  year: 2025, attributable_revenue: 283_825_628, total_hotel_revenue: 197_000_000, total_bookings: 186, booking_volume: 197_000_000, google_investment: 8_000_000, meta_investment: 2_698_775, content_investment: 2_500_000, fees_investment: 5_676_513, total_investment: 18_875_288, total_impressions: 1700000, total_clicks: 16400, avg_cpc: 1151, roas: 15.04, ad_cost_pct: 6.65 },
  { month: 8,  year: 2025, attributable_revenue: 296_105_298, total_hotel_revenue: 214_000_000, total_bookings: 192, booking_volume: 214_000_000, google_investment: 20_000_000, meta_investment: 2_800_000, content_investment: 4_000_000, fees_investment: 7_402_632, total_investment: 34_202_632, total_impressions: 121043,  total_clicks: 15903, avg_cpc: 2151, roas: 8.65,  ad_cost_pct: 11.55 },
  { month: 9,  year: 2025, attributable_revenue: 228_242_333, total_hotel_revenue: 232_000_000, total_bookings: 158, booking_volume: 232_000_000, google_investment: 11_000_000, meta_investment: 21_780_000, content_investment: 4_000_000, fees_investment: 4_564_847, total_investment: 41_344_847, total_impressions: 121043,  total_clicks: 15903, avg_cpc: 2600, roas: 5.52,  ad_cost_pct: 18.11 },
  { month: 10, year: 2025, attributable_revenue: 189_435_171, total_hotel_revenue: 235_000_000, total_bookings: 131, booking_volume: 235_000_000, google_investment: 11_000_000, meta_investment: 2_299_781, content_investment: 4_000_000, fees_investment: 3_788_703, total_investment: 21_088_484, total_impressions: 55034,   total_clicks: 6363, avg_cpc: 3314, roas: 8.98,  ad_cost_pct: 11.13 },
  { month: 11, year: 2025, attributable_revenue: 142_258_658, total_hotel_revenue: 211_000_000, total_bookings: 101, booking_volume: 211_000_000, google_investment: 11_000_000, meta_investment: 2_372_371, content_investment: 4_000_000, fees_investment: 2_845_173, total_investment: 20_217_544, total_impressions: 55034,   total_clicks: 6363, avg_cpc: 3177, roas: 7.04,  ad_cost_pct: 14.21 },
  { month: 12, year: 2025, attributable_revenue: 188_408_601, total_hotel_revenue: 244_000_000, total_bookings: 138, booking_volume: 244_000_000, google_investment: 8_000_000, meta_investment: 2_771_528, content_investment: 4_000_000, fees_investment: 3_768_172, total_investment: 18_539_700, total_impressions: 55034,   total_clicks: 6363, avg_cpc: 2914, roas: 10.16, ad_cost_pct: 9.84 },
  { month: 1,  year: 2026, attributable_revenue: 206_301_982, total_hotel_revenue: 330_000_000, total_bookings: 152, booking_volume: 330_000_000, google_investment: 10_000_000, meta_investment: 5_000_000, content_investment: 4_000_000, fees_investment: 5_157_550, total_investment: 24_157_550, total_impressions: 55034,   total_clicks: 6363, avg_cpc: 3797, roas: 8.54,  ad_cost_pct: 11.71 },
  { month: 2,  year: 2026, attributable_revenue: 166_972_719, total_hotel_revenue: 286_000_000, total_bookings: 128, booking_volume: 286_000_000, google_investment: 11_000_000, meta_investment: 5_000_000, content_investment: 4_000_000, fees_investment: 4_174_318, total_investment: 24_174_318, total_impressions: 55034,   total_clicks: 6363, avg_cpc: 3799, roas: 6.91,  ad_cost_pct: 14.48 },
  { month: 3,  year: 2026, attributable_revenue: 122_143_081, total_hotel_revenue: 215_000_000, total_bookings: 95,  booking_volume: 215_000_000, google_investment: 20_669_841, meta_investment: 7_500_000, content_investment: 4_000_000, fees_investment: 3_053_577, total_investment: 35_223_418, total_impressions: 55034,   total_clicks: 6363, avg_cpc: 5536, roas: 3.47,  ad_cost_pct: 28.84 },
  { month: 4,  year: 2026, attributable_revenue: 140_406_321, total_hotel_revenue: 233_000_000, total_bookings: 184, booking_volume: 233_000_000, google_investment: 13_286_063, meta_investment: 2_000_000, content_investment: 2_800_000, fees_investment: 2_800_000, total_investment: 20_886_063, total_impressions: 55034,   total_clicks: 6363, avg_cpc: 3282, roas: 6.72,  ad_cost_pct: 14.88 },
]

export const MOCK_CURRENT_REPORT: Partial<MonthlyReport> = {
  ...MOCK_HISTORICAL[MOCK_HISTORICAL.length - 1],
  id: 'current-report-uuid',
  property_id: 'hashtag-98-uuid',
  period_start: '2026-04-01',
  period_end: '2026-04-30',
  total_guests: 7000,
  total_nights: 9900,
  avg_ticket: 762_000,
  avg_stay: 1.4,
  ad_cost_pct: 14.88,
  campaign_breakdown: [
    { campaign_name: 'Search Brand', campaign_type: 'search_brand', investment: 4_500_000, impressions: 18000, clicks: 2100, roas: 12.4, cpc: 2143 },
    { campaign_name: 'Broad Category', campaign_type: 'broad_category', investment: 5_200_000, impressions: 22000, clicks: 2800, roas: 7.8, cpc: 1857 },
    { campaign_name: 'Narrow Category', campaign_type: 'narrow_category', investment: 2_100_000, impressions: 9000, clicks: 1100, roas: 5.1, cpc: 1909 },
    { campaign_name: 'Pmax · Display', campaign_type: 'pmax', investment: 1_486_063, impressions: 6034, clicks: 363, roas: 4.2, cpc: 4094 },
  ],
  geo_breakdown: [
    { country: 'Estados Unidos', country_code: 'US', revenue: 1_909_000_000, bookings: 64, pct: 35 },
    { country: 'Colombia', country_code: 'CO', revenue: 790_000_000, bookings: 44, pct: 19 },
    { country: 'Puerto Rico', country_code: 'PR', revenue: 548_000_000, bookings: 35, pct: 14 },
    { country: 'México', country_code: 'MX', revenue: 226_000_000, bookings: 18, pct: 7 },
    { country: 'Rep. Dominicana', country_code: 'DO', revenue: 173_000_000, bookings: 13, pct: 5 },
    { country: 'Venezuela', country_code: 'VE', revenue: 85_000_000, bookings: 10, pct: 3 },
    { country: 'Otros', country_code: 'XX', revenue: 675_000_000, bookings: 0, pct: 17 },
  ],
  source_breakdown: [
    { source_name: 'Sitio web / motor', revenue: 87_051_919, bookings: 114, pct: 62, is_attributable: true },
    { source_name: 'Central de reservas', revenue: 33_697_517, bookings: 44, pct: 24, is_attributable: true },
    { source_name: 'Walk-in digital', revenue: 19_656_885, bookings: 26, pct: 14, is_attributable: false },
  ],
  room_category_breakdown: [
    { category_name: 'Hab. M Superior 1', revenue: 658_900_000, bookings: 89, pct: 19.1 },
    { category_name: 'Hab. XL', revenue: 181_900_000, bookings: 24, pct: 5.3 },
    { category_name: 'Hab. L Superior c/ bañera', revenue: 148_300_000, bookings: 20, pct: 4.3 },
    { category_name: 'Tarifa con desayuno', revenue: 146_800_000, bookings: 19, pct: 4.3 },
    { category_name: 'Hab. cama extragrande', revenue: 142_200_000, bookings: 19, pct: 4.1 },
    { category_name: 'Hab. L Superior sofacama', revenue: 134_700_000, bookings: 18, pct: 3.9 },
    { category_name: 'Hab. M Superior 3', revenue: 120_300_000, bookings: 16, pct: 3.5 },
    { category_name: 'Hab. S Superior', revenue: 104_100_000, bookings: 14, pct: 3.0 },
    { category_name: 'Hab. M Estándar balcón', revenue: 99_800_000, bookings: 13, pct: 2.9 },
    { category_name: 'Hab. M Superior 2', revenue: 96_600_000, bookings: 13, pct: 2.8 },
  ],
  booking_status_breakdown: [
    { status: 'Checked out', count: 100, pct: 54.5 },
    { status: 'Confirmado', count: 35, pct: 19.2 },
    { status: 'Cancelado', count: 30, pct: 16.3 },
    { status: 'No show', count: 9, pct: 4.9 },
    { status: 'Hospedado', count: 10, pct: 5.1 },
  ],
  booking_lead_time_breakdown: [
    { range: '30 días o más', count: 99, pct: 53.8 },
    { range: '10 a 30 días', count: 25, pct: 13.8 },
    { range: '6 a 9 días', count: 26, pct: 14.2 },
    { range: '1 a 5 días', count: 24, pct: 13.2 },
    { range: 'Último minuto', count: 10, pct: 5.0 },
  ],
  milestones: [
    { id: '1', title: 'ROAS objetivo 7× — superado', subtitle: 'Logrado 6.72× · recuperación post-marzo', status: 'completed', type: 'achievement' },
    { id: '2', title: '5 reels + 3 carruseles publicados', subtitle: '100% del plan de contenidos entregado', status: 'completed', type: 'achievement' },
    { id: '3', title: 'Google Hotel Ads activo — KAYAK y Trivago', subtitle: 'Precio directo visible en metasearch', status: 'completed', type: 'achievement' },
    { id: '4', title: '4 influenciadores — 3/4 confirmados', subtitle: 'Último canje en gestión · cierre 7 mayo', status: 'in_progress', type: 'warning' },
    { id: '5', title: 'TripAdvisor posición #8 Medellín', subtitle: '+2 posiciones · 47 reseñas nuevas', status: 'completed', type: 'highlight' },
  ],
  ai_insights: {
    positive: [
      { title: 'Recuperación sólida post-marzo', body: 'Abril cerró con $140M atribuible, +14.9% vs marzo. La campaña Search Brand mantuvo 12.4× ROAS y el segmento USA+PR representó el 54% de facturación.' },
    ],
    attention: [
      { title: 'Marzo mostró el valle más profundo del año', body: 'La inversión de $35M en marzo generó el ROAS más bajo (3.47×). La recuperación de abril confirma que fue temporal, pero hay que evitar sobreinversión en temporada baja.' },
    ],
    strategic: [
      { title: 'Oportunidad: Meta Ads con headroom significativo', body: 'Meta en $2M representa solo el 10% de la inversión total. El target nómadas digitales + foodies tiene CTR potencial del 10%+. Propuesta junio: +$1.5M en Meta para capturar temporada alta.' },
    ],
    executive_summary: 'Abril 2026 mostró recuperación con $140M en facturación atribuible y ROAS de 6.72×, superando el objetivo mensual. El canal directo representa el 62% de la facturación total del hotel.',
    next_month_recommendation: 'Para mayo se recomienda mantener inversión en Google Search Brand ($13M) y aumentar Meta Ads a $3.5M para capturar la temporada alta de visitantes internacionales.',
    generated_at: new Date().toISOString(),
  },
  status: 'published',
}

export const MOCK_CONTENT: ContentItem[] = [
  { id: '1', property_id: 'hashtag-98-uuid', title: 'Reel — Rooftop sunset experience', description: 'Video del atardecer desde el rooftop con experiencia gastronómica', content_type: 'reel', status: 'pending', media_url: null, thumbnail_url: null, scheduled_date: '2026-05-05', platform: 'instagram', month: 5, year: 2026, approval_comment: null, approved_by: null, approved_at: null, created_by: 'gp-uuid', created_at: '2026-04-28T10:00:00Z', updated_at: '2026-04-28T10:00:00Z' },
  { id: '2', property_id: 'hashtag-98-uuid', title: 'Carrusel — Habitaciones y experiencias', description: 'Tour visual por las habitaciones principales', content_type: 'carousel', status: 'approved', media_url: null, thumbnail_url: null, scheduled_date: '2026-05-10', platform: 'instagram', month: 5, year: 2026, approval_comment: null, approved_by: 'client-uuid', approved_at: '2026-04-29T14:00:00Z', created_by: 'gp-uuid', created_at: '2026-04-27T09:00:00Z', updated_at: '2026-04-29T14:00:00Z' },
  { id: '3', property_id: 'hashtag-98-uuid', title: 'Reel — Gastronomía y vida nocturna', description: 'Reel mostrando la oferta gastronómica y el bar', content_type: 'reel', status: 'pending', media_url: null, thumbnail_url: null, scheduled_date: '2026-05-18', platform: 'instagram', month: 5, year: 2026, approval_comment: null, approved_by: null, approved_at: null, created_by: 'gp-uuid', created_at: '2026-04-30T11:00:00Z', updated_at: '2026-04-30T11:00:00Z' },
  { id: '4', property_id: 'hashtag-98-uuid', title: 'Story — Testimonio huésped USA', description: 'Repost de review de huésped de Estados Unidos', content_type: 'story', status: 'approved', media_url: null, thumbnail_url: null, scheduled_date: '2026-05-12', platform: 'instagram', month: 5, year: 2026, approval_comment: null, approved_by: 'client-uuid', approved_at: '2026-04-30T16:00:00Z', created_by: 'gp-uuid', created_at: '2026-04-29T08:00:00Z', updated_at: '2026-04-30T16:00:00Z' },
  { id: '5', property_id: 'hashtag-98-uuid', title: 'Reel — Arte urbano El Poblado', description: 'Conexión del hotel con el arte y cultura del barrio', content_type: 'reel', status: 'pending', media_url: null, thumbnail_url: null, scheduled_date: '2026-05-22', platform: 'instagram', month: 5, year: 2026, approval_comment: null, approved_by: null, approved_at: null, created_by: 'gp-uuid', created_at: '2026-05-01T10:00:00Z', updated_at: '2026-05-01T10:00:00Z' },
]
