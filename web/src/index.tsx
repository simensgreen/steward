/* @refresh reload */
import { I18nProvider } from "@lingui/solid"
import { render } from "solid-js/web"
import App from "./App.tsx"
import { i18n } from "./i18n"
import "./index.css"

const root = document.getElementById("root")
if (!root) {
  throw new Error("Root element #root not found")
}

render(
  () => (
    <I18nProvider i18n={i18n}>
      <App />
    </I18nProvider>
  ),
  root,
)
