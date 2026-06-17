export interface User {
  id: string
  email: string
  name: string
  telegram_linked: boolean
  portfolio: PortfolioEntry[]
  watchlist?: string[]
}

export interface PortfolioEntry {
  ticker: string
  exchange: string
  buy_price: number
  quantity: number
  buy_date?: string
  notes?: string
  current_price?: number
  pnl?: number
  pnl_percent?: number
  sector?: string
  industry?: string
  stock_pe?: number | null
  roe?: number | null
  roce?: number | null
  high?: number | null
  low?: number | null
}

export interface PredictionItem {
  volatility_est: number
  expected_change_pct: number
  range_68: [number, number]
  range_95: [number, number]
}

export interface AnalyticsCard {
  status: string
  score: 'Positive' | 'Neutral' | 'Caution' | string
  desc: string
}

export interface StockData {
  ticker: string
  exchange: string
  current_price: number | null
  previous_close: number | null
  market_cap: number | null
  high: number | null
  low: number | null
  stock_pe: number | null
  dividend_yield: number | null
  roce: number | null
  roe: number | null
  face_value: number | null
  sector?: string
  industry?: string
  rsi?: number | null
  rsi_signal?: string | null
  sma_50?: number | null
  sma_50_signal?: string | null
  last_updated: string | null
  from_cache?: boolean
  week_52_high?: number | null
  week_52_low?: number | null
  volume?: number | null
  avg_volume?: number | null
  book_value?: number | null
  eps?: number | null
  
  predictions?: {
    days_7?: PredictionItem
    days_30?: PredictionItem
    days_90?: PredictionItem
  } | null
  analytics?: {
    valuation?: AnalyticsCard
    efficiency?: AnalyticsCard
    dividend?: AnalyticsCard
    range_position?: {
      percentile: number
      dist_high_pct: number
      dist_low_pct: number
    } | null
  } | null
}

export interface Alert {
  id: string
  ticker: string
  exchange: string
  buy_price?: number
  target_price?: number
  stop_loss?: number
  note?: string
  is_active: boolean
  triggered_at?: string
  created_at: string
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface SearchResult {
  ticker: string
  current_price: number | null
  exchange: string
  company_name?: string
  change_pct?: number | null
}

export interface MarketIndex {
  symbol: string
  name: string
  price: number
  prev_close: number
  change: number
  change_percent: number
}

export interface NewsArticle {
  ticker: string
  title: string
  link: string
  pub_date: string
  source: string
}

export interface PerformancePoint {
  date: string
  portfolio_value: number
  portfolio_return: number
  nifty_return: number
  cost_basis: number
}

export interface PortfolioPerformance {
  timeline: PerformancePoint[]
  risk: {
    beta: number
    var_95: number
    volatility: number
    concentration_score: number
  }
  audit: {
    weighted_pe: number | null
    weighted_roe: number | null
    est_annual_dividend: number
  }
}

