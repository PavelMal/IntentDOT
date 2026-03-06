/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        polkadot: {
          pink: "#E6007A",
          purple: "#552BBF",
          cyan: "#00B2FF",
          green: "#56F39A",
          dark: "#1A1A2E",
          darker: "#0F0F1A",
        },
        risk: {
          green: "#22C55E",
          yellow: "#EAB308",
          red: "#EF4444",
        },
      },
    },
  },
  plugins: [],
};
