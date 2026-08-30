import { Navigate, Route, Router } from "@solidjs/router"
import { createSignal, onMount, type ParentProps, Show } from "solid-js"
import { AppShell } from "./components/AppShell"
import { activateLocale } from "./i18n"
import { AuthPage } from "./pages/AuthPage"
import { CatalogPage } from "./pages/CatalogPage"
import { HomePage } from "./pages/HomePage"
import { HouseholdsPage } from "./pages/HouseholdsPage"
import { MoneyPage } from "./pages/MoneyPage"
import { SettingsPage } from "./pages/SettingsPage"
import { ShoppingPage } from "./pages/ShoppingPage"
import { StockPage } from "./pages/StockPage"
import { applyTheme, loadProfile, resolveLocale } from "./preferences"
import { bootstrapAuth, useAuth } from "./session"

function Protected(props: ParentProps) {
  const { person } = useAuth()
  return (
    <Show when={person()} fallback={<Navigate href="/auth" />}>
      <AppShell>{props.children}</AppShell>
    </Show>
  )
}

export default function App() {
  const { authReady, person } = useAuth()
  const [bootstrapped, setBootstrapped] = createSignal(false)

  onMount(() => {
    const profile = loadProfile()
    applyTheme(profile.theme)
    void activateLocale(resolveLocale(profile.locale))
    void bootstrapAuth().finally(() => setBootstrapped(true))
  })

  return (
    <Show when={authReady() && bootstrapped()} fallback={<div class="min-h-screen" />}>
      <Router>
        <Route
          path="/auth"
          component={() => (
            <Show when={!person()} fallback={<Navigate href="/" />}>
              <AuthPage />
            </Show>
          )}
        />
        <Route
          path="/settings"
          component={() => (
            <Show when={person()} fallback={<SettingsPage />}>
              <AppShell>
                <SettingsPage />
              </AppShell>
            </Show>
          )}
        />
        <Route
          path="/"
          component={() => (
            <Protected>
              <HomePage />
            </Protected>
          )}
        />
        <Route
          path="/households"
          component={() => (
            <Protected>
              <HouseholdsPage />
            </Protected>
          )}
        />
        <Route
          path="/stock"
          component={() => (
            <Protected>
              <StockPage />
            </Protected>
          )}
        />
        <Route
          path="/shopping"
          component={() => (
            <Protected>
              <ShoppingPage />
            </Protected>
          )}
        />
        <Route
          path="/money"
          component={() => (
            <Protected>
              <MoneyPage />
            </Protected>
          )}
        />
        <Route
          path="/catalog"
          component={() => (
            <Protected>
              <CatalogPage />
            </Protected>
          )}
        />
      </Router>
    </Show>
  )
}
