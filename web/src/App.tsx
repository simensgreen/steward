import { Navigate, Route, Router } from "@solidjs/router"
import { createSignal, onMount, type ParentProps, Show } from "solid-js"
import { AppShell } from "./components/AppShell"
import { activateLocale } from "./i18n"
import { AuthPage } from "./pages/AuthPage"
import { BudgetPage } from "./pages/BudgetPage"
import { CalendarPage } from "./pages/CalendarPage"
import { CatalogPage } from "./pages/CatalogPage"
import { HomePage } from "./pages/HomePage"
import { SettingsPage } from "./pages/SettingsPage"
import { ShoppingPage } from "./pages/ShoppingPage"
import { StoragePage } from "./pages/StoragePage"
import { applyTheme, loadProfile, resolveLocale } from "./preferences"
import { runAsync } from "./runAsync"
import { bootstrapAuth, useAuth } from "./session"

// skipcq: JS-0067 -- ESM module scope, not a browser global
function Protected(props: ParentProps) {
  const { person } = useAuth()
  return (
    <Show when={person()} fallback={<Navigate href="/auth" />}>
      <AppShell>{props.children}</AppShell>
    </Show>
  )
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
function Redirect(props: { href: string }) {
  return <Navigate href={props.href} />
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export default function App() {
  const { authReady, person } = useAuth()
  const [bootstrapped, setBootstrapped] = createSignal(false)

  onMount(() => {
    const profile = loadProfile()
    applyTheme(profile.theme)
    runAsync(activateLocale(resolveLocale(profile.locale)))
    runAsync(bootstrapAuth().finally(() => setBootstrapped(true)))
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
          path="/budget"
          component={() => (
            <Protected>
              <BudgetPage />
            </Protected>
          )}
        />
        <Route
          path="/storage"
          component={() => (
            <Protected>
              <StoragePage />
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
        <Route
          path="/calendar"
          component={() => (
            <Protected>
              <CalendarPage />
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
        <Route path="/money" component={() => <Redirect href="/budget" />} />
        <Route path="/stock" component={() => <Redirect href="/storage" />} />
        <Route path="/households" component={() => <Redirect href="/storage" />} />
      </Router>
    </Show>
  )
}
