import { Trans } from "@lingui/solid/macro"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { api, type Household, type Location, type Product, type StockEntry } from "../api"

export function StockPage() {
  const [households] = createResource(() => api<Household[]>("/api/v1/households"))
  const [products] = createResource(() => api<Product[]>("/api/v1/products"))
  const [householdId, setHouseholdId] = createSignal<string>("")
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
  const [error, setError] = createSignal<string | null>(null)

  const ready = createMemo(() => householdId() && locationId() && productId())

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

  return (
    <div class="flex flex-col gap-6">
      <section class="glass-panel p-6">
        <h1 class="type-title text-2xl">
          <Trans>Stock</Trans>
        </h1>
        <p class="type-body mt-2">
          <Trans>Lots in Household Locations. Consumption uses FEFO then FIFO.</Trans>
        </p>
        <label class="form-control mt-4 max-w-md">
          <span class="type-footnote mb-2">
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
      </section>

      <Show when={householdId()}>
        <section class="glass-panel p-6">
          <h2 class="type-title text-lg">
            <Trans>Add Stock Entry</Trans>
          </h2>
          <form class="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => void addStock(e)}>
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

        <section class="glass-panel p-6">
          <div class="mb-4 flex flex-wrap items-end gap-3">
            <h2 class="type-title text-lg">
              <Trans>On hand</Trans>
            </h2>
            <label class="form-control">
              <span class="type-footnote mb-1">
                <Trans>Consume quantity</Trans>
              </span>
              <input
                class="input input-bordered hit-target input-sm"
                type="number"
                min="0.01"
                step="any"
                value={consumeQty()}
                onInput={(e) => setConsumeQty(e.currentTarget.value)}
              />
            </label>
          </div>
          <Show when={!stock.loading} fallback={<Trans>Loading…</Trans>}>
            <ul class="flex flex-col gap-2">
              <For each={stock() ?? []}>
                {(entry) => (
                  <li class="flex flex-wrap items-center justify-between gap-2 border-b border-base-300/30 py-2">
                    <div>
                      <p class="font-medium">{entry.product_name}</p>
                      <p class="type-footnote">
                        {entry.quantity} · {entry.location_name}
                        <Show when={entry.expires_on}> · exp {entry.expires_on}</Show>
                      </p>
                    </div>
                    <button
                      type="button"
                      class="btn btn-outline btn-sm hit-target"
                      onClick={() => void consume(entry.product_id)}
                    >
                      <Trans>Consume</Trans>
                    </button>
                  </li>
                )}
              </For>
              <Show when={(stock() ?? []).length === 0}>
                <p class="type-footnote">
                  <Trans>No Stock Entries yet.</Trans>
                </p>
              </Show>
            </ul>
          </Show>
        </section>
      </Show>

      <Show when={error()}>
        <p class="text-error type-footnote">{error()}</p>
      </Show>
    </div>
  )
}
