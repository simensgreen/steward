const TOKEN_KEY = "steward.token"

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json")
  }
  const token = getToken()
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
  }
  const response = await fetch(path, { ...init, headers })
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const body = (await response.json()) as { error?: string }
      if (body.error) {
        message = body.error
      }
    } catch {
      // ignore
    }
    throw new ApiError(response.status, message)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

export type Person = {
  id: string
  username: string
  display_name: string
  default_currency: string
  default_household_id: string | null
}

export type AuthResponse = {
  token: string
  person: Person
}

export type Household = {
  id: string
  name: string
  owner_person_id: string
  created_at: string
  role: string | null
}

export type Product = {
  id: string
  name: string
  barcode: string | null
  purchase_unit: string
  consumption_unit: string
  unit_conversion: number
}

export type Location = {
  id: string
  household_id: string
  name: string
  kind: string
}

export type StockEntry = {
  id: string
  household_id: string
  location_id: string
  location_name: string
  product_id: string
  product_name: string
  quantity: number
  expires_on: string | null
}

export type Budget = {
  id: string
  person_id: string
  currency: string
}

export type BudgetTransaction = {
  id: string
  budget_id: string
  kind: string
  amount_minor: number
  currency: string
  memo: string | null
  created_at: string
}

export type Fund = {
  id: string
  name: string
  default_currency: string
  settlement_strategy: string
  household_id: string | null
  owner_person_id: string
  role: string | null
}

export type MemberBalance = {
  person_id: string
  display_name: string
  balance_minor: number
  balance: number
}

export type ShoppingList = {
  id: string
  name: string
  owner_kind: string
  owner_id: string
  target_household_id: string | null
}

export type ShoppingItem = {
  id: string
  shopping_list_id: string
  product_id: string
  product_name: string
  status: string
  quantity_needed: number
  quantity_purchased: number
  preferred_store_id: string | null
  last_price_minor: number | null
  last_price_currency: string | null
}

export type Store = {
  id: string
  name: string
}

export type Recipe = {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type RecipeIngredient = {
  product_id: string
  product_name: string
  quantity: number
}

export type Calendar = {
  id: string
  owner_kind: string
  owner_id: string
  name: string
  system_kind: string | null
}

export type CalendarEvent = {
  id: string
  calendar_id: string
  title: string
  starts_on: string
  ends_on?: string | null
  notes: string | null
  recipe_id?: string | null
  portions?: number | null
}
