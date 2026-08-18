/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      'xs': '480px',
      'sm': '720px',
      'md': '720px',
      'lg': '1080px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {},
  },
  plugins: [],
}
