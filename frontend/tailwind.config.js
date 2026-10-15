/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#09090B', surface: '#18181B', elevated: '#27272A', sidebar: '#0A0A0B',
        foreground: '#FAFAFA', muted: '#A1A1AA', subtle: '#52525B',
        accent: 'oklch(0.55 0.22 275)', 'accent-hover': 'oklch(0.64 0.20 275)',
        success: '#4ADE80', danger: '#F87171', warning: '#FBBF24', info: '#60A5FA',
      },
      borderRadius: { button: '6px', card: '8px', dialog: '12px' },
      fontFamily: { sans: ['Inter Variable', 'Inter', 'sans-serif'] },
      transitionTimingFunction: {
        'ios-ease': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        'spring-smooth': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        'fade-in-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'slide-in-right': { '0%': { opacity: '0', transform: 'translateX(10px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
      },
      animation: {
        shimmer: 'shimmer 1.55s linear infinite',
        'fade-in-up': 'fade-in-up .24s ease-out both',
        'scale-in': 'scale-in .2s ease-out both',
        'slide-in-right': 'slide-in-right .22s ease-out both',
      },
    },
  },
  plugins: [],
}
