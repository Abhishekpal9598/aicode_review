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
        canvas: '#0A0D12',
        'surface-primary': '#111620',
        'surface-secondary': '#18202F',
        'surface-tertiary': '#222D42',
        'border-subtle': '#263248',
        'border-focus': '#6366F1',
        'text-primary': '#F1F5F9',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
        'brand-primary': '#6366F1',
        'brand-glow': 'rgba(99, 102, 241, 0.25)',
        'brand-accent': '#8B5CF6',
        'status-critical': '#EF4444',
        'status-critical-bg': 'rgba(239, 68, 68, 0.12)',
        'status-warning': '#F59E0B',
        'status-warning-bg': 'rgba(245, 158, 11, 0.12)',
        'status-success': '#10B981',
        'status-success-bg': 'rgba(16, 185, 129, 0.12)',
        'status-info': '#38BDF8',
        'status-info-bg': 'rgba(56, 189, 248, 0.12)'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
