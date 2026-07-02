import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(err)
  }
)

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post('/auth/register', { email, password, name }),
}

// User / Portfolio
export const userApi = {
  getMe: () => api.get('/user/me'),
  addToPortfolio: (entry: object) => api.post('/user/portfolio', entry),
  removeFromPortfolio: (ticker: string) => api.delete(`/user/portfolio/${ticker}`),
  linkTelegram: (chatId: string, botToken: string) => api.post('/user/telegram', { chat_id: chatId, bot_token: botToken }),
  testTelegram: () => api.post('/user/telegram/test'),
  getPortfolioPerformance: () => api.get('/user/portfolio/performance'),
  getWatchlist: () => api.get('/user/watchlist'),
  addToWatchlist: (ticker: string) => api.post('/user/watchlist', { ticker }),
  removeFromWatchlist: (ticker: string) => api.delete(`/user/watchlist/${ticker}`),
}

// Stock
export const stockApi = {
  get: (ticker: string) => api.get(`/stock/${ticker}`),
  search: (q: string) => api.get(`/stock/search?q=${q}`),
  getHistory: (ticker: string) => api.get(`/stock/${ticker}/history`),
  getIndices: () => api.get('/stock/market/indices'),
  getNews: (tickers?: string) => api.get(`/stock/market/news${tickers ? '?tickers=' + tickers : ''}`),
  getAnalysis: (ticker: string) => api.get(`/stock/${ticker}/analysis`),
  getTerminalResearch: (ticker: string) => api.get(`/stock/${ticker}/terminal-research`),
}

// Alerts
export const alertApi = {
  list: () => api.get('/alerts/'),
  create: (alert: object) => api.post('/alerts/', alert),
  delete: (id: string) => api.delete(`/alerts/${id}`),
  toggle: (id: string) => api.patch(`/alerts/${id}/toggle`),
}

// Copilot
export const copilotApi = {
  getSessions: () => api.get('/copilot/chat/sessions'),
  createSession: (title: string) => api.post('/copilot/chat/sessions', { title }),
  getSessionMessages: (id: string) => api.get(`/copilot/chat/sessions/${id}`),
  deleteSession: (id: string) => api.delete(`/copilot/chat/sessions/${id}`),
  getPortfolioAnalysis: () => api.get('/copilot/portfolio-analysis'),
  runWhatIf: (scenario: string, details?: object) => api.post('/copilot/what-if', { scenario, details }),
  runScreener: (type: string) => api.post('/copilot/screener', { screener_type: type }),
  getEarnings: (ticker: string) => api.get(`/copilot/earnings/${ticker}`),
  getRecommendations: () => api.get('/copilot/recommendations'),
  getInvestAssistant: (ticker: string) => api.get(`/copilot/invest-assistant/${ticker}`),
}

// Quant
export const quantApi = {
  backtest: (payload: { ticker: string; indicators: any[]; logic?: string; initial_capital?: number; range?: string }) =>
    api.post('/quant/backtest', payload),
  parameterSweep: (payload: { ticker: string; indicators: any[]; logic?: string; initial_capital?: number; range?: string }) =>
    api.post('/quant/parameter-sweep', payload),
  optimize: (tickers: string[], range?: string) =>
    api.post('/quant/optimize', { tickers, range }),
  correlation: (tickers: string[], range?: string) =>
    api.post('/quant/correlation', { tickers, range }),
  factors: (ticker: string) =>
    api.post('/quant/factors', { ticker }),
  monteCarlo: (payload: { tickers: string[]; weights: Record<string, number>; initial_value?: number; days?: number; simulations?: number; range?: string }) =>
    api.post('/quant/monte-carlo', payload),
  stressTest: (payload: { tickers: string[]; weights: Record<string, number>; scenario: string; initial_value?: number; days?: number; simulations?: number; range?: string }) =>
    api.post('/quant/stress-test', payload),
  rebalance: (payload: { holdings: any[]; target_weights: Record<string, number> }) =>
    api.post('/quant/rebalance', payload),
  getMarketplace: () => api.get('/quant/marketplace'),
  getMarketplaceRegime: () => api.get('/quant/marketplace/regime'),
  saveStrategy: (payload: { name: string; description?: string; indicators: any[]; logic?: string }) =>
    api.post('/quant/marketplace', payload),
  generateStrategy: (prompt: string) =>
    api.post('/quant/generate-strategy', { prompt }),
  upvote: (id: string) =>
    api.post(`/quant/marketplace/${id}/upvote`),
}

// Market Intelligence
export const intelApi = {
  getMarkets: () => api.get('/intel/markets'),
  getSectors: () => api.get('/intel/sectors'),
  getEconomicCalendar: () => api.get('/intel/calendar/economic'),
  getCorporateCalendar: () => api.get('/intel/calendar/corporate'),
  getInsiders: () => api.get('/intel/insiders'),
  getNews: () => api.get('/intel/news'),
  getBriefing: () => api.get('/intel/briefing'),
  getYields: () => api.get('/intel/yields'),
  getBlockDeals: () => api.get('/intel/blockdeals'),
}

