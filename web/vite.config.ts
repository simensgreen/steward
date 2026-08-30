import { lingui } from "@lingui/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import solid from "vite-plugin-solid"

export default defineConfig({
  plugins: [
    solid({
      babel: {
        plugins: ["@lingui/babel-plugin-lingui-macro"],
      },
    }),
    lingui(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Steward",
        short_name: "Steward",
        description: "Household stewardship",
        theme_color: "#f5f5f7",
        background_color: "#f5f5f7",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/health": "http://127.0.0.1:8080",
      "/api": "http://127.0.0.1:8080",
    },
  },
})
