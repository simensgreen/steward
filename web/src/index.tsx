/* @refresh reload */
import { I18nProvider } from "@lingui/solid"
import { render } from "solid-js/web"
import App from "./App.tsx"
import { activateLocale, i18n } from "./i18n"
import "./index.css"
import { loadProfile, resolveLocale } from "./preferences"

const root = document.getElementById("root")
if (!root) {
  throw new Error("Root element #root not found")
}

// I18nProvider renders nothing until a locale is active, so activate the resolved
// locale before mounting; otherwise App never mounts and cannot activate it itself.
void activateLocale(resolveLocale(loadProfile().locale)).finally(() => {
  render(
    () => (
      <I18nProvider i18n={i18n}>
        <App />
      </I18nProvider>
    ),
    root,
  )
})
