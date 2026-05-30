export type UserRole = 'super_admin' | 'growth_partner' | 'client'

export type ContentStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'published'

export type ContentType = 'reel' | 'carousel' | 'story' | 'post' | 'other'

export type AlertType = 'roas_drop' | 'budget_alert' | 'content_pending' | 'cpc_spike' | 'booking_drop'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  avatar_url: string | null
  created_at: string
}

export interface Property {
  id: string
  name: string
  slug: string
  location: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  success_fee_pct: number
  active: boolean
  created_at: string
  cloudbeds_property_id: string | null
  google_ads_account_id: string | null
  meta_ad_account_id: string | null
}

export interface PropertyAccess {
  id: string
  user_id: string
  property_id: string
  property?: Property
  profile?: Profile
}

export interface BookingSource {
  id: string
  property_id: string
  source_name: string
  is_attributable: boolean
  created_at: string
}

export interface MonthlyReport {
  id: string
  property_id: string
  period_start: string
  period_end: string
  month: number
  year: number
  // KPIs hero
  total_guests: number
  total_nights: number
  total_investment: number
  ad_cost_pct: number
  // Facturación
  attributable_revenue: number
  total_hotel_revenue: number
  // Reservas
  total_bookings: number
  booking_volume: number
  avg_ticket: number
  avg_stay: number
  // Marketing metrics
  roas: number
  google_investment: number
  meta_investment: number
  content_investment: number
  fees_investment: number
  total_impressions: number
  total_clicks: number
  avg_cpc: number
  // Channels breakdown (JSON)
  campaign_breakdown: CampaignBreakdown[]
  geo_breakdown: GeoBreakdown[]
  source_breakdown: SourceBreakdown[]
  room_category_breakdown: RoomCategoryBreakdown[]
  booking_status_breakdown: BookingStatusBreakdown[]
  booking_lead_time_breakdown: LeadTimeBreakdown[]
  // AI insights
  ai_insights: AIInsights | null
  milestones: Milestone[]
  // Metadata
  status: 'draft' | 'published'
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface CampaignBreakdown {
  campaign_name: string
  campaign_type: 'search_brand' | 'broad_category' | 'narrow_category' | 'pmax' | 'other'
  investment: number
  impressions: number
  clicks: number
  roas: number
  cpc: number
}

export interface GeoBreakdown {
  country: string
  country_code: string
  revenue: number
  bookings: number
  pct: number
}

export interface SourceBreakdown {
  source_name: string
  revenue: number
  bookings: number
  pct: number
  is_attributable: boolean
}

export interface RoomCategoryBreakdown {
  category_name: string
  revenue: number
  bookings: number
  pct: number
}

export interface BookingStatusBreakdown {
  status: string
  count: number
  pct: number
}

export interface LeadTimeBreakdown {
  range: string
  count: number
  pct: number
}

export interface AIInsights {
  positive: InsightItem[]
  attention: InsightItem[]
  strategic: InsightItem[]
  executive_summary: string
  next_month_recommendation: string
  generated_at: string
}

export interface InsightItem {
  title: string
  body: string
}

export interface Milestone {
  id: string
  title: string
  subtitle: string
  status: 'completed' | 'in_progress' | 'pending'
  type: 'achievement' | 'warning' | 'highlight'
}

export interface ContentItem {
  id: string
  property_id: string
  title: string
  description: string | null
  content_type: ContentType
  status: ContentStatus
  media_url: string | null
  thumbnail_url: string | null
  scheduled_date: string
  platform: 'instagram' | 'facebook' | 'tiktok' | 'other'
  month: number
  year: number
  approval_comment: string | null
  approved_by: string | null
  approved_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Alert {
  id: string
  property_id: string
  type: AlertType
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical'
  read: boolean
  created_at: string
}

export interface DashboardData {
  property: Property
  currentReport: MonthlyReport | null
  historicalReports: MonthlyReport[]
  pendingContent: ContentItem[]
  alerts: Alert[]
}
