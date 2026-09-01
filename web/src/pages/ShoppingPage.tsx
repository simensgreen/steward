import { Trans } from "@lingui/solid/macro"
import { createResource, createSignal, For, Show } from "solid-js"
import {
  api,
  type Budget,
  type Fund,
  type Product,
  type ShoppingItem,
  type ShoppingList,
  type Store,
} from "../api"
import { runAsync } from "../runAsync"

// skipcq: JS-0067, JS-0415 -- ESM module scope; UI nesting is intentional
export function ShoppingPage() {
  const [lists, { refetch: refetchLists }] = createResource(() =>
    api<ShoppingList[]>("/api/v1/shopping-lists"),
  )
  const [budget] = createResource(() => api<Budget>("/api/v1/budgets/me"))
  const [funds] = createResource(() => api<Fund[]>("/api/v1/funds"))
  const [products] = createResource(() => api<Product[]>("/api/v1/products"))
  const [stores] = createResource(() => api<Store[]>("/api/v1/stores"))

  const [listId, setListId] = createSignal("")
  const [items, { refetch: refetchItems }] = createResource(listId, (id) =>
    id ? api<ShoppingItem[]>(`/api/v1/shopping-lists/${id}/items`) : Promise.resolve([]),
  )

  const [listName, setListName] = createSignal("")
  const [ownerKind, setOwnerKind] = createSignal<"budget" | "fund">("budget")
  const [fundId, setFundId] = createSignal("")
  const [productId, setProductId] = createSignal("")
  const [qty, setQty] = createSignal("1")
  const [purchasePrice, setPurchasePrice] = createSignal("")
  const [purchaseStoreId, setPurchaseStoreId] = createSignal("")
  const [error, setError] = createSignal<string | null>(null)

  const createList = async (event: Event) => {
    event.preventDefault()
    setError(null)
    try {
      const owner_id = ownerKind() === "budget" ? budget()?.id : fundId() || funds()?.[0]?.id
      if (!owner_id) {
        throw new Error("Create a Fund first or wait for Budget")
      }
      await api("/api/v1/shopping-lists", {
        method: "POST",
        body: JSON.stringify({
          name: listName(),
          owner_kind: ownerKind(),
          owner_id,
        }),
      })
      setListName("")
      await refetchLists()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  const addItem = async (event: Event) => {
    event.preventDefault()
    if (!listId() || !productId()) {
      return
    }
    setError(null)
    try {
      await api(`/api/v1/shopping-lists/${listId()}/items`, {
        method: "POST",
        body: JSON.stringify({
          product_id: productId(),
          quantity_needed: Number(qty()),
          preferred_store_id: purchaseStoreId() || stores()?.[0]?.id || null,
        }),
      })
      await refetchItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  const setInCart = async (itemId: string) => {
    await api("/api/v1/commands/shopping/set-in-cart", {
      method: "POST",
      body: JSON.stringify({ item_id: itemId }),
    })
    await refetchItems()
  }

  const purchase = async (item: ShoppingItem) => {
    setError(null)
    try {
      const remaining = item.quantity_needed - item.quantity_purchased
      const body: Record<string, unknown> = {
        item_id: item.id,
        quantity: remaining,
        idempotency_key: crypto.randomUUID(),
      }
      if (purchaseStoreId() || item.preferred_store_id) {
        body.store_id = purchaseStoreId() || item.preferred_store_id
      }
      if (purchasePrice()) {
        body.price = Number(purchasePrice())
      }
      await api("/api/v1/commands/shopping/purchase", {
        method: "POST",
        body: JSON.stringify(body),
      })
      await refetchItems()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  // skipcq: JS-0415 -- intentional UI nesting
  return (
    <div class="page-stack">
      <section class="content-card">
        <h1 class="type-title text-2xl">
          <Trans>Shopping</Trans>
        </h1>
        <p class="type-body mt-2">
          <Trans>Lists hang off a Budget or Fund. Items go needed → In Cart → Purchased.</Trans>
        </p>
        <form class="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => runAsync(createList(e))}>
          <input
            class="input input-bordered hit-target"
            placeholder="Weekly groceries"
            value={listName()}
            required
            onInput={(e) => setListName(e.currentTarget.value)}
          />
          <select
            class="select select-bordered hit-target"
            value={ownerKind()}
            onChange={(e) => setOwnerKind(e.currentTarget.value as "budget" | "fund")}
          >
            <option value="budget">
              <Trans>Personal Budget</Trans>
            </option>
            <option value="fund">
              <Trans>Fund</Trans>
            </option>
          </select>
          <Show when={ownerKind() === "fund"}>
            <select
              class="select select-bordered hit-target sm:col-span-2"
              value={fundId()}
              onChange={(e) => setFundId(e.currentTarget.value)}
            >
              <For each={funds() ?? []}>{(f) => <option value={f.id}>{f.name}</option>}</For>
            </select>
          </Show>
          <button type="submit" class="btn btn-primary hit-target sm:col-span-2">
            <Trans>Create Shopping List</Trans>
          </button>
        </form>
      </section>

      <section class="content-card">
        <label class="form-control max-w-md">
          <span class="type-footnote mb-2">
            <Trans>Open list</Trans>
          </span>
          <select
            class="select select-bordered hit-target"
            value={listId()}
            onChange={(e) => setListId(e.currentTarget.value)}
          >
            <option value="">
              <Trans>Select…</Trans>
            </option>
            <For each={lists() ?? []}>
              {(list) => (
                <option value={list.id}>
                  {list.name} ({list.owner_kind})
                </option>
              )}
            </For>
          </select>
        </label>
      </section>

      <Show when={listId()}>
        <section class="content-card">
          <h2 class="type-title text-lg">
            <Trans>Add item</Trans>
          </h2>
          <form class="mt-3 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => runAsync(addItem(e))}>
            <select
              class="select select-bordered hit-target flex-1"
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
              class="input input-bordered hit-target w-28"
              type="number"
              min="0.01"
              step="any"
              value={qty()}
              onInput={(e) => setQty(e.currentTarget.value)}
            />
            <button type="submit" class="btn btn-primary hit-target">
              <Trans>Add</Trans>
            </button>
          </form>

          <label class="form-control mt-4 max-w-xs">
            <span class="type-footnote mb-1">
              <Trans>Store for purchase</Trans>
            </span>
            <select
              class="select select-bordered hit-target"
              value={purchaseStoreId()}
              onChange={(e) => setPurchaseStoreId(e.currentTarget.value)}
            >
              <option value="">
                <Trans>Cheapest known price</Trans>
              </option>
              <For each={stores() ?? []}>{(s) => <option value={s.id}>{s.name}</option>}</For>
            </select>
          </label>

          <label class="form-control mt-4 max-w-xs">
            <span class="type-footnote mb-1">
              <Trans>Price when Purchasing (if unknown)</Trans>
            </span>
            <input
              class="input input-bordered hit-target"
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice()}
              onInput={(e) => setPurchasePrice(e.currentTarget.value)}
            />
          </label>

          <ul class="mt-6 flex flex-col gap-2">
            <For each={items() ?? []}>
              {(item) => (
                <li class="flex flex-wrap items-center justify-between gap-2 border-b border-base-300/30 py-3">
                  <div>
                    <p class="font-medium">{item.product_name}</p>
                    <p class="type-footnote">
                      {item.status} · {item.quantity_purchased}/{item.quantity_needed}
                    </p>
                  </div>
                  <div class="flex gap-2">
                    <Show when={item.status === "needed"}>
                      <button
                        type="button"
                        class="btn btn-outline btn-sm hit-target"
                        onClick={() => runAsync(setInCart(item.id))}
                      >
                        <Trans>In Cart</Trans>
                      </button>
                    </Show>
                    <Show when={item.status !== "purchased"}>
                      <button
                        type="button"
                        class="btn btn-primary btn-sm hit-target"
                        onClick={() => runAsync(purchase(item))}
                      >
                        <Trans>Purchase</Trans>
                      </button>
                    </Show>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>

      <Show when={error()}>
        <p class="text-error type-footnote">{error()}</p>
      </Show>
    </div>
  )
}
