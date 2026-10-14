/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './client/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0F1A24',
        surface: '#16242F',
        'surface-2': '#1D2F3D',
        paper: '#F5F1EA',
        signal: '#22D3EE',
        caution: '#F5A524',
        urgent: '#E5484D',
        ok: '#3FB68B',
        muted: '#8DA2B3',
      },
      fontFamily: {
        heading: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
