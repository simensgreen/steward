import { Trans } from "@lingui/solid/macro"
import { createSignal, onMount, Show } from "solid-js"
import { activateLocale, i18n } from "../i18n"
import {
  applyTheme,
  type LocaleCode,
  loadProfile,
  type ProfilePreferences,
  resolveLocale,
  saveProfile,
  type ThemePreference,
} from "../preferences"
import { runAsync } from "../runAsync"
import { useAuth } from "../session"

type HealthPayload = { status: string }

// skipcq: JS-0067, JS-0415 -- ESM module scope; UI nesting is intentional
async function fetchHealth(): Promise<HealthPayload> {
  const response = await fetch("/health")
  if (!response.ok) {
    throw new Error(`health ${response.status}`)
  }
  return response.json() as Promise<HealthPayload>
}

// skipcq: JS-0067, JS-0415 -- ESM module scope; UI nesting is intentional
export function SettingsPage() {
  const { person } = useAuth()
  const [profile, setProfile] = createSignal<ProfilePreferences>(loadProfile())
  const [health, setHealth] = createSignal<string | null>(null)

  onMount(() => {
    applyTheme(profile().theme)
    runAsync(
      fetchHealth()
        .then((h) => setHealth(h.status))
        .catch(() => setHealth(null)),
    )
  })

  const updateProfile = (patch: Partial<ProfilePreferences>) => {
    const next = { ...profile(), ...patch }
    setProfile(next)
    saveProfile(next)
    if (patch.theme !== undefined) {
      applyTheme(next.theme)
    }
    if (patch.locale !== undefined) {
      runAsync(activateLocale(resolveLocale(next.locale)))
    }
  }

  // skipcq: JS-0415 -- intentional UI nesting
  return (
    <div class="page-stack">
      <section class="content-card">
        <h1 class="section-title">
          <Trans>Settings</Trans>
        </h1>
        <Show when={person()}>
          {(p) => (
            <p class="type-footnote mt-2">
              {p().username} · {p().default_currency}
            </p>
          )}
        </Show>
        <p class="type-footnote mt-2" aria-live="polite">
          <Show
            when={health()}
            fallback={<Trans>API unreachable — start steward-server on port 8080.</Trans>}
          >
            <Trans>API status: {health() ?? "unknown"}</Trans>
          </Show>
        </p>
      </section>

      <section class="content-card flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
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
    </div>
  )
}
