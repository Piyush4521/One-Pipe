/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFBF7',
          100: '#FAF7EE',
          200: '#F5F2E9',
          300: '#EFECE3',
          400: '#E2DFD6',
        },
        pipeyellow: {
          DEFAULT: '#EAB308',
          hover: '#CA8A04',
          highlight: '#FACC15',
          subtle: '#FEF9C3',
        },
        pipeorange: {
          DEFAULT: '#EA580C',
          hover: '#C2410C',
          subtle: '#FFEDD5',
        },
        pipeblack: {
          DEFAULT: '#18181B',
          soft: '#27272A',
          muted: '#52525B',
          subtle: '#71717A',
        },
        pipestatus: {
          healthy: '#16A34A',
          'healthy-bg': '#F0FDF4',
          'healthy-border': '#86EFAC',
          warning: '#D97706',
          'warning-bg': '#FFFBEB',
          'warning-border': '#FDE68A',
          critical: '#DC2626',
          'critical-bg': '#FEF2F2',
          'critical-border': '#FECACA',
          offline: '#71717A',
          'offline-bg': '#F4F4F5',
          'offline-border': '#D4D4D8',
        },
        pipeborder: {
          DEFAULT: '#D6D3D1',
          strong: '#18181B',
          subtle: '#E7E5E4',
          focus: '#EAB308',
        },
      },
      boxShadow: {
        'industrial-sm': '1px 1px 0px 0px #18181B',
        'industrial': '2px 2px 0px 0px #18181B',
        'industrial-subtle': '2px 2px 0px 0px #D6D3D1',
      },
      borderRadius: {
        DEFAULT: '2px',
        none: '0px',
        sm: '2px',
        md: '4px',
        lg: '6px',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'Consolas',
          'Monaco',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
};

