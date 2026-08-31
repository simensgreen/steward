import { Trans } from "@lingui/solid/macro"
import { createResource, For, Show } from "solid-js"
import {
  api,
  type Budget,
  type BudgetTransaction,
  type Household,
  type Product,
  type ShoppingList,
  type StockEntry,
} from "../api"
import { IconBudget, IconCalendar, IconCatalog, IconStorage } from "../components/icons"
import { WidgetCard } from "../components/WidgetCard"
import { formatMoney, useAuth } from "../session"

// skipcq: JS-0067, JS-0415 -- ESM module scope; UI nesting is intentional
function balanceFromTransactions(transactions: BudgetTransaction[]): number {
  return transactions.reduce((sum, tx) => sum + tx.amount_minor, 0)
}

// skipcq: JS-0067, JS-0415 -- ESM module scope; UI nesting is intentional
export function HomePage() {
  const { person } = useAuth()
  const [households] = createResource(() => api<Household[]>("/api/v1/households"))
  const [budget] = createResource(() => api<Budget>("/api/v1/budgets/me"))
  const [transactions] = createResource(
    () => budget()?.id,
    (id) =>
      id ? api<BudgetTransaction[]>(`/api/v1/budgets/${id}/transactions`) : Promise.resolve([]),
  )
  const [lists] = createResource(() => api<ShoppingList[]>("/api/v1/shopping-lists"))
  const [products] = createResource(() => api<Product[]>("/api/v1/products"))
  const defaultHouseholdId = () => person()?.default_household_id ?? households()?.[0]?.id ?? ""
  const [stock] = createResource(defaultHouseholdId, (id) =>
    id ? api<StockEntry[]>(`/api/v1/households/${id}/stock`) : Promise.resolve([]),
  )
  const [calendars] = createResource(defaultHouseholdId, (id) =>
    id
      ? api<{ id: string; name: string }[]>(`/api/v1/households/${id}/calendars`)
      : Promise.resolve([]),
  )

  const balance = () => balanceFromTransactions(transactions() ?? [])

  // skipcq: JS-0415 -- intentional UI nesting
  return (
    <div class="page-stack">
      <section class="hero-card">
        <p class="hero-eyebrow">
          <Trans>Overview</Trans>
        </p>
        <h1 class="hero-title">
          <Trans>Welcome, {person()?.display_name ?? ""}</Trans>
        </h1>
        <p class="hero-description">
          <Trans>
            Your household at a glance: Budget, Storage, Catalog, and Calendar in one place.
          </Trans>
        </p>
      </section>

      <div class="widget-grid">
        <WidgetCard
          href="/budget"
          accent="budget"
          icon={<IconBudget class="size-5" />}
          title={<Trans>Budget</Trans>}
        >
          <Show
            when={budget()}
            fallback={
              <p class="stat-muted">
                <Trans>Loading…</Trans>
              </p>
            }
          >
            {(b) => (
              <>
                <p class="stat-value">{formatMoney(balance(), b().currency)}</p>
                <p class="stat-muted">
                  <Trans>{transactions()?.length ?? 0} transactions</Trans>
                </p>
              </>
            )}
          </Show>
        </WidgetCard>

        <WidgetCard
          href="/storage"
          accent="storage"
          icon={<IconStorage class="size-5" />}
          title={<Trans>Storage</Trans>}
        >
          <Show
            when={!stock.loading}
            fallback={
              <p class="stat-muted">
                <Trans>Loading…</Trans>
              </p>
            }
          >
            <p class="stat-value">
              <Trans>{stock()?.length ?? 0} lots</Trans>
            </p>
            <p class="stat-muted">
              <Trans>{households()?.length ?? 0} Households</Trans>
            </p>
          </Show>
        </WidgetCard>

        <WidgetCard
          href="/catalog"
          accent="catalog"
          icon={<IconCatalog class="size-5" />}
          title={<Trans>Catalog</Trans>}
        >
          <Show
            when={!products.loading}
            fallback={
              <p class="stat-muted">
                <Trans>Loading…</Trans>
              </p>
            }
          >
            <p class="stat-value">
              <Trans>{products()?.length ?? 0} Products</Trans>
            </p>
          </Show>
        </WidgetCard>

        <WidgetCard
          href="/calendar"
          accent="calendar"
          icon={<IconCalendar class="size-5" />}
          title={<Trans>Calendar</Trans>}
        >
          <Show
            when={!calendars.loading}
            fallback={
              <p class="stat-muted">
                <Trans>Loading…</Trans>
              </p>
            }
          >
            <p class="stat-value">
              <Trans>{calendars()?.length ?? 0} calendars</Trans>
            </p>
          </Show>
        </WidgetCard>
      </div>

      <Show when={(lists() ?? []).length > 0}>
        <section class="content-card">
          <h2 class="content-card-title">
            <Trans>Shopping Lists</Trans>
          </h2>
          <ul class="item-list">
            <For each={lists()}>
              {(list) => (
                <li class="item-row">
                  <span>{list.name}</span>
                  <span class="item-meta">{list.owner_kind}</span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </div>
  )
}
