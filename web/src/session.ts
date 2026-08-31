import { createSignal } from "solid-js"
import { type AuthResponse, api, getToken, type Person, setToken } from "./api"

const [person, setPerson] = createSignal<Person | null>(null)
const [authReady, setAuthReady] = createSignal(false)

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function useAuth() {
  return { person, authReady }
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export async function bootstrapAuth(): Promise<void> {
  const token = getToken()
  if (!token) {
    setPerson(null)
    setAuthReady(true)
    return
  }
  try {
    const me = await api<Person>("/api/v1/me")
    setPerson(me)
  } catch {
    setToken(null)
    setPerson(null)
  } finally {
    setAuthReady(true)
  }
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export async function register(
  username: string,
  password: string,
  displayName?: string,
  currency?: string,
): Promise<Person> {
  const body: Record<string, string> = { username, password }
  if (displayName) {
    body.display_name = displayName
  }
  if (currency) {
    body.default_currency = currency
  }
  const res = await api<AuthResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  })
  setToken(res.token)
  setPerson(res.person)
  return res.person
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export async function login(username: string, password: string): Promise<Person> {
  const res = await api<AuthResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })
  setToken(res.token)
  setPerson(res.person)
  return res.person
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export async function logout(): Promise<void> {
  try {
    await api("/api/v1/auth/logout", { method: "POST" })
  } catch {
    // ignore
  }
  setToken(null)
  setPerson(null)
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
  }).format(amountMinor / 100)
}
