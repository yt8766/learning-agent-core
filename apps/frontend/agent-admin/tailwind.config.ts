import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f6f7ff',
          100: '#eceeff',
          200: '#d8dcff',
          300: '#b7bfff',
          400: '#8e98ff',
          500: '#6675ff',
          600: '#4d56f5',
          700: '#3f44d8',
          800: '#3438af',
          900: '#2f3389'
        },
        sand: {
          50: '#fbf7f1',
          100: '#f4ede2',
          200: '#e8dac5',
          300: '#d9be99',
          400: '#c89c68',
          500: '#bc8248',
          600: '#ad703d',
          700: '#905a35',
          800: '#744933',
          900: '#5f3d2d'
        }
      },
      fontFamily: {
        sans: ['Bahnschrift', 'Trebuchet MS', 'Segoe UI', 'sans-serif']
      },
      boxShadow: {
        panel: '0 24px 48px rgba(15, 23, 42, 0.08)'
      },
      borderRadius: {
        '4xl': '2rem'
      }
    }
  }
} satisfies Config;
