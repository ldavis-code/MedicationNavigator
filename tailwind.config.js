/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Accessible color palette for patients with vision changes
      colors: {
        // High contrast text colors
        'accessible': {
          'dark': '#1e293b',      // slate-800 - for primary text
          'muted': '#374151',     // gray-700 - for secondary text (7:1 ratio)
          'secondary': '#475569', // slate-600 - for tertiary text (5.5:1 ratio)
          'light': '#f1f5f9',     // slate-100 - for text on dark backgrounds
        }
      },
      // Minimum font sizes
      fontSize: {
        'xs': ['0.875rem', { lineHeight: '1.5' }],    // 14px minimum
        'sm': ['0.9375rem', { lineHeight: '1.5' }],   // 15px minimum
        'base': ['1rem', { lineHeight: '1.6' }],      // 16px
      },
      // Touch target sizes
      minHeight: {
        'touch': '44px',
      },
      minWidth: {
        'touch': '44px',
      },
      // Improved spacing for tap targets
      spacing: {
        'touch': '44px',
      }
    },
  },
  plugins: [],
}
