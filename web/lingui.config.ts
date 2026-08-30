import { formatter } from "@lingui/format-po"
import { defineConfig as defineLinguiConfig } from "@lingui/solid/config"

export default defineLinguiConfig({
  sourceLocale: "en",
  locales: ["en", "ru", "es"],
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: ["src"],
    },
  ],
  format: formatter({ lineNumbers: false }),
  compileNamespace: "es",
})
