import { Trans } from "@lingui/solid/macro"
import { createResource, createSignal, For, Show } from "solid-js"
import { api, type Product, type Store } from "../api"

export function CatalogPage() {
  const [products, { refetch: refetchProducts }] = createResource(() =>
    api<Product[]>("/api/v1/products"),
  )
  const [stores, { refetch: refetchStores }] = createResource(() => api<Store[]>("/api/v1/stores"))
  const [productName, setProductName] = createSignal("")
  const [storeName, setStoreName] = createSignal("")
  const [storeId, setStoreId] = createSignal("")
  const [priceProductId, setPriceProductId] = createSignal("")
  const [priceAmount, setPriceAmount] = createSignal("")
  const [error, setError] = createSignal<string | null>(null)

  const addProduct = async (event: Event) => {
    event.preventDefault()
    setError(null)
    try {
      await api("/api/v1/products", {
        method: "POST",
        body: JSON.stringify({ name: productName() }),
      })
      setProductName("")
      await refetchProducts()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  const addStore = async (event: Event) => {
    event.preventDefault()
    setError(null)
    try {
      await api("/api/v1/stores", {
        method: "POST",
        body: JSON.stringify({ name: storeName() }),
      })
      setStoreName("")
      await refetchStores()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  const setPrice = async (event: Event) => {
    event.preventDefault()
    if (!storeId() || !priceProductId()) {
      return
    }
    setError(null)
    try {
      await api(`/api/v1/stores/${storeId()}/prices`, {
        method: "POST",
        body: JSON.stringify({
          product_id: priceProductId(),
          currency: "USD",
          amount: Number(priceAmount()),
        }),
      })
      setPriceAmount("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  return (
    <div class="flex flex-col gap-6">
      <section class="glass-panel p-6">
        <h1 class="type-title text-2xl">
          <Trans>Catalog</Trans>
        </h1>
        <p class="type-body mt-2">
          <Trans>Instance-wide Products and Stores with Store Prices.</Trans>
        </p>
      </section>

      <section class="glass-panel p-6">
        <h2 class="type-title text-lg">
          <Trans>Products</Trans>
        </h2>
        <form class="mt-3 flex gap-3" onSubmit={(e) => void addProduct(e)}>
          <input
            class="input input-bordered hit-target flex-1"
            value={productName()}
            required
            onInput={(e) => setProductName(e.currentTarget.value)}
          />
          <button type="submit" class="btn btn-primary hit-target">
            <Trans>Add Product</Trans>
          </button>
        </form>
        <ul class="mt-4 flex flex-col gap-1">
          <For each={products() ?? []}>
            {(p) => (
              <li class="border-b border-base-300/30 py-2">
                {p.name}
                <span class="type-footnote ml-2">
                  {p.purchase_unit}/{p.consumption_unit}
                </span>
              </li>
            )}
          </For>
        </ul>
      </section>

      <section class="glass-panel p-6">
        <h2 class="type-title text-lg">
          <Trans>Stores</Trans>
        </h2>
        <form class="mt-3 flex gap-3" onSubmit={(e) => void addStore(e)}>
          <input
            class="input input-bordered hit-target flex-1"
            value={storeName()}
            required
            onInput={(e) => setStoreName(e.currentTarget.value)}
          />
          <button type="submit" class="btn btn-primary hit-target">
            <Trans>Add Store</Trans>
          </button>
        </form>
        <ul class="mt-4 flex flex-col gap-1">
          <For each={stores() ?? []}>{(s) => <li class="py-1">{s.name}</li>}</For>
        </ul>

        <h3 class="type-title mt-6 text-base">
          <Trans>Set Store Price</Trans>
        </h3>
        <form class="mt-3 grid gap-3 sm:grid-cols-3" onSubmit={(e) => void setPrice(e)}>
          <select
            class="select select-bordered hit-target"
            value={storeId()}
            required
            onChange={(e) => setStoreId(e.currentTarget.value)}
          >
            <option value="">
              <Trans>Store</Trans>
            </option>
            <For each={stores() ?? []}>{(s) => <option value={s.id}>{s.name}</option>}</For>
          </select>
          <select
            class="select select-bordered hit-target"
            value={priceProductId()}
            required
            onChange={(e) => setPriceProductId(e.currentTarget.value)}
          >
            <option value="">
              <Trans>Product</Trans>
            </option>
            <For each={products() ?? []}>{(p) => <option value={p.id}>{p.name}</option>}</For>
          </select>
          <input
            class="input input-bordered hit-target"
            type="number"
            min="0"
            step="0.01"
            required
            value={priceAmount()}
            onInput={(e) => setPriceAmount(e.currentTarget.value)}
          />
          <button type="submit" class="btn btn-outline hit-target sm:col-span-3">
            <Trans>Save price</Trans>
          </button>
        </form>
      </section>

      <Show when={error()}>
        <p class="text-error type-footnote">{error()}</p>
      </Show>
    </div>
  )
}
