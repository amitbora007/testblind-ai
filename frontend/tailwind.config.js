/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          base: '#0B1120',
          subtle: '#0F172A',
        },
        card: {
          DEFAULT: '#1E293B',
          elevated: '#243048',
          hover: '#2D3B55',
        },
        sidebar: {
          DEFAULT: '#0D1526',
          active: '#1E293B',
          hover: '#131C31',
        },
        border: {
          subtle: '#334155',
          highlight: '#475569',
          active: '#60A5FA',
        },
        brand: {
          teal: '#14B8A6',
          'teal-light': '#2DD4BF',
          'teal-dark': '#0D9488',
        },
        status: {
          passed: '#10B981',
          failed: '#EF4444',
          skipped: '#F59E0B',
          blocked: '#F97316',
          ai: '#8B5CF6',
          primary: '#3B82F6',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-primary': '0 0 15px -3px rgba(59, 130, 246, 0.3)',
        'glow-ai': '0 0 20px -2px rgba(139, 92, 246, 0.35)',
        'glow-success': '0 0 15px -3px rgba(16, 185, 129, 0.3)',
        'card-subtle': '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
      },
    },
  },
  plugins: [],
}
