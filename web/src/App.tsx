import { Trans } from "@lingui/solid/macro"
import { createResource, createSignal, onCleanup, onMount, Show } from "solid-js"
import { activateLocale, i18n } from "./i18n"
import {
  applyTheme,
  type LocaleCode,
  loadProfile,
  type ProfilePreferences,
  resolveLocale,
  saveProfile,
  type ThemePreference,
} from "./preferences"

type HealthPayload = { status: string }

async function fetchHealth(): Promise<HealthPayload> {
  const response = await fetch("/health")
  if (!response.ok) {
    throw new Error(`health ${response.status}`)
  }
  return response.json() as Promise<HealthPayload>
}

export default function App() {
  const [profile, setProfile] = createSignal<ProfilePreferences>(loadProfile())
  const [ready, setReady] = createSignal(false)
  const [health] = createResource(fetchHealth)

  onMount(() => {
    const current = profile()
    applyTheme(current.theme)
    void activateLocale(resolveLocale(current.locale)).then(() => setReady(true))

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onSchemeChange = () => {
      if (profile().theme === "system") {
        applyTheme("system")
      }
    }
    media.addEventListener("change", onSchemeChange)
    onCleanup(() => media.removeEventListener("change", onSchemeChange))
  })

  const updateProfile = (patch: Partial<ProfilePreferences>) => {
    const next = { ...profile(), ...patch }
    setProfile(next)
    saveProfile(next)
    if (patch.theme !== undefined) {
      applyTheme(next.theme)
    }
    if (patch.locale !== undefined) {
      void activateLocale(resolveLocale(next.locale))
    }
  }

  return (
    <Show when={ready()} fallback={<div class="min-h-screen" />}>
      <main class="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-6 py-16">
        <section class="glass-panel flex flex-col gap-4 p-8 sm:p-10">
          <p class="type-footnote tracking-wide uppercase">Steward</p>
          <h1 class="type-title">Steward</h1>
          <p class="type-body max-w-xl">
            <Trans>Household stewardship in one place: stock, shopping, and money.</Trans>
          </p>
          <p class="type-footnote" aria-live="polite">
            <Show
              when={!health.loading && !health.error}
              fallback={
                <Show
                  when={health.loading}
                  fallback={<Trans>API unreachable — start steward-server on port 8080.</Trans>}
                >
                  <Trans>Checking API…</Trans>
                </Show>
              }
            >
              <Trans>API status: {health()?.status ?? "unknown"}</Trans>
            </Show>
          </p>
        </section>

        <section class="glass-panel flex flex-col gap-6 p-6 sm:flex-row sm:items-end sm:justify-between">
          <label class="form-control w-full max-w-xs">
            <span class="type-footnote mb-2">
              <Trans>Language</Trans>
            </span>
            <select
              class="select select-bordered hit-target w-full"
              value={profile().locale}
              onChange={(event) =>
                updateProfile({
                  locale: event.currentTarget.value as LocaleCode | "system",
                })
              }
            >
              <option value="system">{i18n._({ id: "locale.system", message: "System" })}</option>
              <option value="en">English</option>
              <option value="ru">Русский</option>
              <option value="es">Español</option>
            </select>
          </label>

          <label class="form-control w-full max-w-xs">
            <span class="type-footnote mb-2">
              <Trans>Appearance</Trans>
            </span>
            <select
              class="select select-bordered hit-target w-full"
              value={profile().theme}
              onChange={(event) =>
                updateProfile({
                  theme: event.currentTarget.value as ThemePreference,
                })
              }
            >
              <option value="system">{i18n._({ id: "theme.system", message: "System" })}</option>
              <option value="light">{i18n._({ id: "theme.light", message: "Light" })}</option>
              <option value="dark">{i18n._({ id: "theme.dark", message: "Dark" })}</option>
            </select>
          </label>
        </section>
      </main>
    </Show>
  )
}
