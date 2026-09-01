import { Trans } from "@lingui/solid/macro"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { api, type Household, type Location, type Product, type StockEntry } from "../api"
import { EmptyState } from "../components/EmptyState"
import { IconPlus, IconStorage } from "../components/icons"
import { SectionHeader } from "../components/SectionHeader"
import { runAsync } from "../runAsync"

// skipcq: JS-0067, JS-0415 -- ESM module scope; UI nesting is intentional
function isExpiringSoon(expiresOn: string | null): boolean {
  if (!expiresOn) {
    return false
  }
  const exp = new Date(expiresOn)
  const now = new Date()
  const diff = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 7
}

// skipcq: JS-0067, JS-0415 -- ESM module scope; UI nesting is intentional
function isExpired(expiresOn: string | null): boolean {
  if (!expiresOn) {
    return false
  }
  return new Date(expiresOn) < new Date()
}

// skipcq: JS-0067, JS-0415 -- ESM module scope; UI nesting is intentional
export function StoragePage() {
  const [households, { refetch: refetchHouseholds }] = createResource(() =>
    api<Household[]>("/api/v1/households"),
  )
  const [products] = createResource(() => api<Product[]>("/api/v1/products"))
  const [householdId, setHouseholdId] = createSignal<string>("")
  const [householdName, setHouseholdName] = createSignal("")
  const [locations] = createResource(householdId, (id) =>
    id ? api<Location[]>(`/api/v1/households/${id}/locations`) : Promise.resolve([]),
  )
  const [stock, { refetch }] = createResource(householdId, (id) =>
    id ? api<StockEntry[]>(`/api/v1/households/${id}/stock`) : Promise.resolve([]),
  )

  const [locationId, setLocationId] = createSignal("")
  const [productId, setProductId] = createSignal("")
  const [quantity, setQuantity] = createSignal("1")
  const [expiresOn, setExpiresOn] = createSignal("")
  const [consumeQty, setConsumeQty] = createSignal("1")
  const [showAddForm, setShowAddForm] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const ready = createMemo(() => householdId() && locationId() && productId())

  const groupedByLocation = createMemo(() => {
    const entries = stock() ?? []
    const groups = new Map<string, { name: string; entries: StockEntry[] }>()
    for (const entry of entries) {
      const existing = groups.get(entry.location_id)
      if (existing) {
        existing.entries.push(entry)
      } else {
        groups.set(entry.location_id, { name: entry.location_name, entries: [entry] })
      }
    }
    return [...groups.values()]
  })

  const createHousehold = async (event: Event) => {
    event.preventDefault()
    setError(null)
    try {
      const created = await api<Household>("/api/v1/households", {
        method: "POST",
        body: JSON.stringify({ name: householdName() }),
      })
      setHouseholdName("")
      await refetchHouseholds()
      setHouseholdId(created.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  const addStock = async (event: Event) => {
    event.preventDefault()
    if (!ready()) {
      return
    }
    setError(null)
    try {
      await api(`/api/v1/households/${householdId()}/stock`, {
        method: "POST",
        body: JSON.stringify({
          location_id: locationId(),
          product_id: productId(),
          quantity: Number(quantity()),
          expires_on: expiresOn() || null,
        }),
      })
      setShowAddForm(false)
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  const consume = async (productIdToConsume: string) => {
    setError(null)
    try {
      await api("/api/v1/commands/stock/consume", {
        method: "POST",
        body: JSON.stringify({
          household_id: householdId(),
          product_id: productIdToConsume,
          quantity: Number(consumeQty()),
        }),
      })
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  // skipcq: JS-0415 -- intentional UI nesting
  return (
    <div class="page-stack">
      <SectionHeader
        accent="storage"
        icon={<IconStorage class="size-6" />}
        title={<Trans>Storage</Trans>}
        description={
          <Trans>Stock lots in Household Locations. Consumption uses FEFO then FIFO.</Trans>
        }
        action={
          <Show when={householdId()}>
            <button
              type="button"
              class="btn btn-primary hit-target"
              onClick={() => setShowAddForm((v) => !v)}
            >
              <IconPlus class="size-4" />
              <Trans>Add lot</Trans>
            </button>
          </Show>
        }
      />

      <section class="content-card">
        <label class="form-control max-w-md">
          <span class="field-label">
            <Trans>Household</Trans>
          </span>
          <select
            class="select select-bordered hit-target"
            value={householdId()}
            onChange={(e) => {
              setHouseholdId(e.currentTarget.value)
              setLocationId("")
            }}
          >
            <option value="">
              <Trans>Select…</Trans>
            </option>
            <For each={households() ?? []}>{(hh) => <option value={hh.id}>{hh.name}</option>}</For>
          </select>
        </label>

        <Show when={(households() ?? []).length === 0 && !households.loading}>
          <div class="mt-6">
            <h2 class="content-card-title">
              <Trans>Create Household</Trans>
            </h2>
            <p class="content-card-description">
              <Trans>Create a Household to own Stock and system Calendars.</Trans>
            </p>
            <form
              class="mt-4 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => runAsync(createHousehold(e))}
            >
              <input
                class="input input-bordered hit-target flex-1"
                value={householdName()}
                required
                placeholder="Home"
                onInput={(e) => setHouseholdName(e.currentTarget.value)}
              />
              <button type="submit" class="btn btn-primary hit-target">
                <IconPlus class="size-4" />
                <Trans>Create Household</Trans>
              </button>
            </form>
          </div>
        </Show>
      </section>

      <Show when={showAddForm() && householdId()}>
        <section class="content-card">
          <h2 class="content-card-title">
            <Trans>Add Stock Entry</Trans>
          </h2>
          <form class="form-grid mt-4" onSubmit={(e) => runAsync(addStock(e))}>
            <select
              class="select select-bordered hit-target"
              value={locationId()}
              required
              onChange={(e) => setLocationId(e.currentTarget.value)}
            >
              <option value="">
                <Trans>Location</Trans>
              </option>
              <For each={locations() ?? []}>
                {(loc) => (
                  <option value={loc.id}>
                    {loc.name} ({loc.kind})
                  </option>
                )}
              </For>
            </select>
            <select
              class="select select-bordered hit-target"
              value={productId()}
              required
              onChange={(e) => setProductId(e.currentTarget.value)}
            >
              <option value="">
                <Trans>Product</Trans>
              </option>
              <For each={products() ?? []}>{(p) => <option value={p.id}>{p.name}</option>}</For>
            </select>
            <input
              class="input input-bordered hit-target"
              type="number"
              min="0.01"
              step="any"
              value={quantity()}
              required
              onInput={(e) => setQuantity(e.currentTarget.value)}
            />
            <input
              class="input input-bordered hit-target"
              type="date"
              value={expiresOn()}
              onInput={(e) => setExpiresOn(e.currentTarget.value)}
            />
            <button type="submit" class="btn btn-primary hit-target sm:col-span-2">
              <Trans>Add to Stock</Trans>
            </button>
          </form>
        </section>
      </Show>

      <Show when={householdId()}>
        <section class="content-card">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <h2 class="content-card-title">
              <Trans>On hand</Trans>
            </h2>
            <label class="form-control">
              <span class="field-label">
                <Trans>Consume quantity</Trans>
              </span>
              <input
                class="input input-bordered hit-target input-sm max-w-28"
                type="number"
                min="0.01"
                step="any"
                value={consumeQty()}
                onInput={(e) => setConsumeQty(e.currentTarget.value)}
              />
            </label>
          </div>

          <Show
            when={!stock.loading}
            fallback={
              <p class="stat-muted mt-4">
                <Trans>Loading…</Trans>
              </p>
            }
          >
            <Show
              when={groupedByLocation().length > 0}
              fallback={
                <EmptyState
                  icon={<IconStorage class="size-8" />}
                  title={<Trans>No Stock Entries yet</Trans>}
                  description={<Trans>Add products to Locations in your Household.</Trans>}
                  action={
                    <button
                      type="button"
                      class="btn btn-primary hit-target"
                      onClick={() => setShowAddForm(true)}
                    >
                      <IconPlus class="size-4" />
                      <Trans>Add lot</Trans>
                    </button>
                  }
                />
              }
            >
              <div class="location-groups mt-4">
                <For each={groupedByLocation()}>
                  {(group) => (
                    <div class="location-group">
                      <h3 class="location-group-title">{group.name}</h3>
                      <ul class="stock-grid">
                        <For each={group.entries}>
                          {(entry) => (
                            <li
                              class={`stock-card ${isExpired(entry.expires_on) ? "stock-card-expired" : isExpiringSoon(entry.expires_on) ? "stock-card-soon" : ""}`}
                            >
                              <p class="stock-card-name">{entry.product_name}</p>
                              <p class="stock-card-qty">{entry.quantity}</p>
                              <Show when={entry.expires_on}>
                                <p class="stock-card-exp">
                                  <Trans>Exp {entry.expires_on}</Trans>
                                </p>
                              </Show>
                              <button
                                type="button"
                                class="btn btn-outline btn-sm hit-target mt-2 w-full"
                                onClick={() => runAsync(consume(entry.product_id))}
                              >
                                <Trans>Consume</Trans>
                              </button>
                            </li>
                          )}
                        </For>
                      </ul>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </section>
      </Show>

      <Show when={error()}>
        <p class="text-error type-footnote">{error()}</p>
      </Show>
    </div>
  )
}
