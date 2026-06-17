/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eefbf3',
          100: '#d6f5e3',
          200: '#b0eac9',
          300: '#7dd8a9',
          400: '#48bf84',
          500: '#26a366',
          600: '#1a8452',
          700: '#176843',
          800: '#155337',
          900: '#12442e',
          950: '#09261a',
        },
        surface: {
          DEFAULT: '#080c12',
          card:    '#0e1420',
          border:  '#182030',
          muted:   '#1a2235',
          hover:   '#1f293d',
        },
        accent: {
          blue:   '#3b82f6',
          purple: '#8b5cf6',
          amber:  '#f59e0b',
          red:    '#ef4444',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'card': '0 0 0 1px rgba(24,32,48,1), 0 4px 16px rgba(0,0,0,0.4)',
        'card-hover': '0 0 0 1px rgba(38,163,102,0.3), 0 8px 32px rgba(0,0,0,0.5)',
        'glow-brand': '0 0 24px rgba(38,163,102,0.2)',
        'glow-red': '0 0 24px rgba(239,68,68,0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.16,1,0.3,1)',
        'shimmer': 'shimmer 1.5s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: '0', transform: 'translateX(16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
