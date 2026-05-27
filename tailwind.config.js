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
        notion: {
          bg: '#ffffff',
          text: '#37352f',
          gray: '#f7f6f3',
          border: '#e9e9e7',
          hover: '#efefef',
          sidebar: '#fbfbfa',
          darkBg: '#191919',
          darkText: '#ffffff',
          darkGray: '#202020',
          darkBorder: '#373737',
        }
      }
    },
  },
  plugins: [],
}
