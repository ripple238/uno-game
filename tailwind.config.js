/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        neon: {
          red: 'var(--color-neon-red)',
          blue: 'var(--color-neon-blue)',
          green: 'var(--color-neon-green)',
          yellow: 'var(--color-neon-yellow)',
          purple: 'var(--color-neon-purple)',
          pink: 'var(--color-neon-pink)',
        },
        card: {
          red: 'var(--color-card-red)',
          blue: 'var(--color-card-blue)',
          green: 'var(--color-card-green)',
          yellow: 'var(--color-card-yellow)',
          black: 'var(--color-card-black)',
        }
      }
    },
  },
  plugins: [],
}
