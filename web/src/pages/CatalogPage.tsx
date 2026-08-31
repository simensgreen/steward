import { Trans } from "@lingui/solid/macro"
import { createResource, createSignal, For, Show } from "solid-js"
import { api, type Product, type Recipe, type RecipeIngredient, type Store } from "../api"
import { EmptyState } from "../components/EmptyState"
import { IconCatalog, IconPlus } from "../components/icons"
import { PageTabs, type TabItem } from "../components/PageTabs"
import { SectionHeader } from "../components/SectionHeader"

export function CatalogPage() {
  const [tab, setTab] = createSignal("products")
  const tabs: TabItem[] = [
    { id: "products", label: <Trans>Products</Trans> },
    { id: "recipes", label: <Trans>Recipes</Trans> },
    { id: "stores", label: <Trans>Stores</Trans> },
  ]

  const [products, { refetch: refetchProducts }] = createResource(() =>
    api<Product[]>("/api/v1/products"),
  )
  const [recipes, { refetch: refetchRecipes }] = createResource(() =>
    api<Recipe[]>("/api/v1/recipes"),
  )
  const [stores, { refetch: refetchStores }] = createResource(() => api<Store[]>("/api/v1/stores"))

  const [productName, setProductName] = createSignal("")
  const [storeName, setStoreName] = createSignal("")
  const [recipeName, setRecipeName] = createSignal("")
  const [recipeProductId, setRecipeProductId] = createSignal("")
  const [recipeQty, setRecipeQty] = createSignal("1")
  const [recipeIngredients, setRecipeIngredients] = createSignal<
    { product_id: string; quantity: number }[]
  >([])

  const [storeId, setStoreId] = createSignal("")
  const [priceProductId, setPriceProductId] = createSignal("")
  const [priceAmount, setPriceAmount] = createSignal("")

  const [expandedRecipe, setExpandedRecipe] = createSignal<string | null>(null)
  const [ingredientsCache, setIngredientsCache] = createSignal<Record<string, RecipeIngredient[]>>(
    {},
  )

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

  const addRecipeIngredient = () => {
    if (!recipeProductId()) {
      return
    }
    setRecipeIngredients((prev) => [
      ...prev,
      { product_id: recipeProductId(), quantity: Number(recipeQty()) },
    ])
    setRecipeProductId("")
    setRecipeQty("1")
  }

  const createRecipe = async (event: Event) => {
    event.preventDefault()
    setError(null)
    try {
      await api("/api/v1/recipes", {
        method: "POST",
        body: JSON.stringify({
          name: recipeName(),
          ingredients: recipeIngredients(),
        }),
      })
      setRecipeName("")
      setRecipeIngredients([])
      await refetchRecipes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  const loadIngredients = async (recipeId: string) => {
    if (ingredientsCache()[recipeId]) {
      setExpandedRecipe(expandedRecipe() === recipeId ? null : recipeId)
      return
    }
    const items = await api<RecipeIngredient[]>(`/api/v1/recipes/${recipeId}/ingredients`)
    setIngredientsCache((prev) => ({ ...prev, [recipeId]: items }))
    setExpandedRecipe(recipeId)
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
    <div class="page-stack">
      <SectionHeader
        accent="catalog"
        icon={<IconCatalog class="size-6" />}
        title={<Trans>Catalog</Trans>}
        description={<Trans>Instance-wide Products, Recipes, and Stores with Store Prices.</Trans>}
      />

      <PageTabs tabs={tabs} active={tab()} onChange={setTab} />

      <Show when={tab() === "products"}>
        <section class="content-card">
          <form class="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => void addProduct(e)}>
            <input
              class="input input-bordered hit-target flex-1"
              value={productName()}
              required
              placeholder="Milk"
              onInput={(e) => setProductName(e.currentTarget.value)}
            />
            <button type="submit" class="btn btn-primary hit-target">
              <IconPlus class="size-4" />
              <Trans>Add Product</Trans>
            </button>
          </form>
          <Show
            when={(products() ?? []).length > 0}
            fallback={
              <EmptyState
                icon={<IconCatalog class="size-8" />}
                title={<Trans>No Products yet</Trans>}
                description={<Trans>Add Products to use in Stock, Recipes, and Shopping.</Trans>}
              />
            }
          >
            <ul class="catalog-grid mt-6">
              <For each={products() ?? []}>
                {(p) => (
                  <li class="catalog-card">
                    <p class="catalog-card-name">{p.name}</p>
                    <p class="catalog-card-meta">
                      {p.purchase_unit}/{p.consumption_unit}
                    </p>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>
      </Show>

      <Show when={tab() === "recipes"}>
        <section class="content-card">
          <h2 class="content-card-title">
            <Trans>Create Recipe</Trans>
          </h2>
          <form class="mt-4 flex flex-col gap-4" onSubmit={(e) => void createRecipe(e)}>
            <input
              class="input input-bordered hit-target"
              value={recipeName()}
              required
              placeholder="Pasta"
              onInput={(e) => setRecipeName(e.currentTarget.value)}
            />
            <div class="flex flex-col gap-3 sm:flex-row">
              <select
                class="select select-bordered hit-target flex-1"
                value={recipeProductId()}
                onChange={(e) => setRecipeProductId(e.currentTarget.value)}
              >
                <option value="">
                  <Trans>Ingredient Product</Trans>
                </option>
                <For each={products() ?? []}>{(p) => <option value={p.id}>{p.name}</option>}</For>
              </select>
              <input
                class="input input-bordered hit-target max-w-28"
                type="number"
                min="0.01"
                step="any"
                value={recipeQty()}
                onInput={(e) => setRecipeQty(e.currentTarget.value)}
              />
              <button
                type="button"
                class="btn btn-outline hit-target"
                onClick={addRecipeIngredient}
              >
                <Trans>Add ingredient</Trans>
              </button>
            </div>
            <Show when={recipeIngredients().length > 0}>
              <ul class="item-list">
                <For each={recipeIngredients()}>
                  {(ing) => {
                    const product = () => products()?.find((p) => p.id === ing.product_id)
                    return (
                      <li class="item-row">
                        <span>{product()?.name ?? ing.product_id}</span>
                        <span class="item-meta">{ing.quantity}</span>
                      </li>
                    )
                  }}
                </For>
              </ul>
            </Show>
            <button type="submit" class="btn btn-primary hit-target self-start">
              <IconPlus class="size-4" />
              <Trans>Save Recipe</Trans>
            </button>
          </form>
        </section>

        <section class="content-card">
          <h2 class="content-card-title">
            <Trans>Recipes</Trans>
          </h2>
          <Show
            when={(recipes() ?? []).length > 0}
            fallback={
              <EmptyState
                icon={<IconCatalog class="size-8" />}
                title={<Trans>No Recipes yet</Trans>}
                description={<Trans>Create Recipes from Products for meal planning.</Trans>}
              />
            }
          >
            <ul class="item-list mt-4">
              <For each={recipes() ?? []}>
                {(recipe) => (
                  <li class="recipe-item">
                    <button
                      type="button"
                      class="recipe-item-header"
                      onClick={() => void loadIngredients(recipe.id)}
                    >
                      <span>{recipe.name}</span>
                      <span class="item-meta">{expandedRecipe() === recipe.id ? "−" : "+"}</span>
                    </button>
                    <Show when={expandedRecipe() === recipe.id}>
                      <ul class="recipe-ingredients">
                        <For each={ingredientsCache()[recipe.id] ?? []}>
                          {(ing) => (
                            <li>
                              {ing.product_name} · {ing.quantity}
                            </li>
                          )}
                        </For>
                      </ul>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>
      </Show>

      <Show when={tab() === "stores"}>
        <section class="content-card">
          <form class="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => void addStore(e)}>
            <input
              class="input input-bordered hit-target flex-1"
              value={storeName()}
              required
              onInput={(e) => setStoreName(e.currentTarget.value)}
            />
            <button type="submit" class="btn btn-primary hit-target">
              <IconPlus class="size-4" />
              <Trans>Add Store</Trans>
            </button>
          </form>
          <ul class="catalog-grid mt-6">
            <For each={stores() ?? []}>{(s) => <li class="catalog-card">{s.name}</li>}</For>
          </ul>

          <h3 class="content-card-title mt-8">
            <Trans>Set Store Price</Trans>
          </h3>
          <form class="form-grid mt-4" onSubmit={(e) => void setPrice(e)}>
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
      </Show>

      <Show when={error()}>
        <p class="text-error type-footnote">{error()}</p>
      </Show>
    </div>
  )
}
