/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#3B6EA8', 50: '#EEF4FB', 100: '#D9E6F4', 200: '#B3CCE8', 300: '#86AAD3', 400: '#5E8FC4', 500: '#3B6EA8', 600: '#2F5A8C', 700: '#254770', 800: '#1B3452', 900: '#122238' },
        secondary: { DEFAULT: '#C8553D', 50: '#FBF0ED', 100: '#F6DDD7', 200: '#EDBBB0', 300: '#E09785', 400: '#D3745D', 500: '#C8553D', 600: '#A94430', 700: '#853627' },
        accent: { DEFAULT: '#3E9B73', 50: '#EDF7F2', 100: '#D3EDE1', 200: '#A8DAC3', 300: '#7EC8A6', 400: '#5BB38C', 500: '#3E9B73', 600: '#317C5C', 700: '#265F47' },
      },
      fontFamily: { sans: ['Poppins', 'Inter', 'system-ui', 'sans-serif'] },
      boxShadow: {
        glow: '0 10px 28px -10px rgba(59,110,168,.5)',
        'glow-coral': '0 10px 28px -10px rgba(200,85,61,.5)',
        'glow-mint': '0 10px 28px -10px rgba(62,155,115,.5)',
      },
      backgroundImage: {
        'grad-hero': 'linear-gradient(135deg,#1B3452 0%,#3B6EA8 100%)',
        'grad-progress': 'linear-gradient(90deg,#3B6EA8 0%,#3E9B73 100%)',
        'grad-brand': 'linear-gradient(135deg,#1B3452,#3B6EA8 60%,#3E9B73)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } },
        gradientShift: { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        shake: { '0%,100%': { transform: 'rotate(0)' }, '20%': { transform: 'rotate(-18deg)' }, '40%': { transform: 'rotate(16deg)' }, '60%': { transform: 'rotate(-10deg)' }, '80%': { transform: 'rotate(8deg)' } },
        blink: { '50%': { opacity: 0 } },
        ripple: { to: { transform: 'scale(4)', opacity: 0 } },
        pulseRing: { '0%': { boxShadow: '0 0 0 0 rgba(59,110,168,.45)' }, '100%': { boxShadow: '0 0 0 14px rgba(59,110,168,0)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        float: 'float 4s ease-in-out infinite',
        gradient: 'gradientShift 12s ease infinite',
        shake: 'shake .8s ease-in-out',
        blink: 'blink 1s step-end infinite',
        ripple: 'ripple .6s linear forwards',
        pulseRing: 'pulseRing 1.4s ease-out infinite',
      },
    },
  },
  plugins: [],
};
