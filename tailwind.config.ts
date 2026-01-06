import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // === DESIGN SYSTEM TOKENS ===
      spacing: {
        'system-xs': '4px',
        'system-sm': '8px',
        'system-md': '12px',
        'system-lg': '24px',
        'system-xl': '48px',
      },
      borderRadius: {
        'system-sm': '12px',
        'system-lg': '24px',
      },
      opacity: {
        'low': '0.25',
        'medium': '0.50',
        'high': '0.75',
      },
      fontFamily: {
        game: ['"Press Start 2P"', 'monospace'],
        mono: ['"Space Mono"', 'Consolas', 'Monaco', 'monospace'],
      },
      fontSize: {
        // Extreme size jumps (1.5x-3x between levels) for distinctive hierarchy
        'xs-game': ['10px', { lineHeight: '1.4', letterSpacing: '0.04em' }],
        'sm-game': ['11px', { lineHeight: '1.4', letterSpacing: '0.04em' }],
        'base-game': ['12px', { lineHeight: '1.5', letterSpacing: '0.04em' }],
        'lg-game': ['16px', { lineHeight: '1.5', letterSpacing: '0.03em' }],
        'xl-game': ['20px', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        '2xl-game': ['32px', { lineHeight: '1.3', letterSpacing: '0.01em' }],
        '3xl-game': ['48px', { lineHeight: '1.2', letterSpacing: '0' }],
        // Modern mono sizes (better readability)
        'xs-mono': ['12px', { lineHeight: '1.5' }],
        'sm-mono': ['13px', { lineHeight: '1.5' }],
        'base-mono': ['14px', { lineHeight: '1.6' }],
        'lg-mono': ['16px', { lineHeight: '1.6' }],
        'xl-mono': ['18px', { lineHeight: '1.5' }],
      },
      colors: {
        fantasy: {
          // Reduced to 5 core purple shades (was 8+)
          bg: '#0a0217',           // Base dark
          surface: '#1a0d35',      // Surface (darker, higher contrast)
          card: '#2d1854',         // Cards (more saturated)
          border: '#6b3dcc',       // Borders (brighter, more visible)

          // Text colors (high contrast)
          primary: '#ffffff',      // Pure white for max readability
          muted: '#c4b5fd',        // Light purple (higher contrast than before)

          // Accent colors (bolder, more saturated)
          accent: '#ff2dd7',       // Hot pink (was #ff7fe6 - now more punchy)
          accentHover: '#ff5ce3',  // Lighter hot pink
          highlight: '#00ffff',    // Pure cyan (was #7af0ff - now more electric)

          // Status colors (keep distinct)
          danger: '#ff1a75',       // Brighter danger red
          success: '#00ff9f',      // Brighter success green
        },
        combat: {
          // Battle colors (keep high energy)
          red: '#ff2d2d',          // Brighter red
          orange: '#ff8c38',       // Keep
          amber: '#ffb946',        // Keep
          cyan: '#00ffff',         // Pure cyan (match highlight)
          blue: '#4d9eff',         // Keep
          border: '#ff2dd7',       // Match new accent
        },
      },
    },
  },
  plugins: [],
} satisfies Config
