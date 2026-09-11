import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202A",
        muted: "#65727E",
        brand: "#2563EB",
        canvas: "#F5F7FA",
      },
    },
  },
  plugins: [],
} satisfies Config;
