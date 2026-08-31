const PROFILE_KEY = "steward.profile"

export type LocaleCode = "en" | "ru" | "es"
export type ThemePreference = "system" | "light" | "dark"

export type ProfilePreferences = {
  locale: LocaleCode | "system"
  theme: ThemePreference
}

const SUPPORTED: LocaleCode[] = ["en", "ru", "es"]

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function loadProfile(): ProfilePreferences {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) {
      return { locale: "system", theme: "system" }
    }
    const parsed = JSON.parse(raw) as Partial<ProfilePreferences>
    return {
      locale: parsed.locale ?? "system",
      theme: parsed.theme ?? "system",
    }
  } catch {
    return { locale: "system", theme: "system" }
  }
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function saveProfile(profile: ProfilePreferences): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function resolveLocale(preference: LocaleCode | "system"): LocaleCode {
  if (preference !== "system") {
    return preference
  }
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language ?? "en"]
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0] as LocaleCode
    if (SUPPORTED.includes(base)) {
      return base
    }
  }
  return "en"
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function resolveTheme(preference: ThemePreference): "steward-light" | "steward-dark" {
  if (preference === "light") {
    return "steward-light"
  }
  if (preference === "dark") {
    return "steward-dark"
  }
  const dark = window.matchMedia("(prefers-color-scheme: dark)").matches
  return dark ? "steward-dark" : "steward-light"
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function applyTheme(preference: ThemePreference): void {
  document.documentElement.setAttribute("data-theme", resolveTheme(preference))
}
