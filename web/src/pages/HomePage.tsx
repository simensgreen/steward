import { Trans } from "@lingui/solid/macro"
import { A } from "@solidjs/router"
import { createResource, For, Show } from "solid-js"
import { api, type Household, type ShoppingList } from "../api"
import { useAuth } from "../session"

export function HomePage() {
  const { person } = useAuth()
  const [households] = createResource(() => api<Household[]>("/api/v1/households"))
  const [lists] = createResource(() => api<ShoppingList[]>("/api/v1/shopping-lists"))

  return (
    <div class="flex flex-col gap-8">
      <section class="glass-panel p-8">
        <p class="type-footnote tracking-wide uppercase">Steward</p>
        <h1 class="type-title mt-2">
          <Trans>Welcome, {person()?.display_name ?? ""}</Trans>
        </h1>
        <p class="type-body mt-3 max-w-2xl">
          <Trans>
            Manage Stock in your Household, Shopping Lists on your Budget or Fund, and shared money
            balances.
          </Trans>
        </p>
      </section>

      <section class="grid gap-4 sm:grid-cols-3">
        <A href="/stock" class="glass-panel block p-6 no-underline transition hover:opacity-90">
          <h2 class="type-title text-lg">
            <Trans>Stock</Trans>
          </h2>
          <p class="type-footnote mt-2">
            <Show when={!households.loading} fallback={<Trans>Loading…</Trans>}>
              <Trans>{households()?.length ?? 0} Households</Trans>
            </Show>
          </p>
        </A>
        <A href="/shopping" class="glass-panel block p-6 no-underline transition hover:opacity-90">
          <h2 class="type-title text-lg">
            <Trans>Shopping</Trans>
          </h2>
          <p class="type-footnote mt-2">
            <Show when={!lists.loading} fallback={<Trans>Loading…</Trans>}>
              <Trans>{lists()?.length ?? 0} lists</Trans>
            </Show>
          </p>
        </A>
        <A href="/money" class="glass-panel block p-6 no-underline transition hover:opacity-90">
          <h2 class="type-title text-lg">
            <Trans>Money</Trans>
          </h2>
          <p class="type-footnote mt-2">
            <Trans>Budget and Funds</Trans>
          </p>
        </A>
      </section>

      <Show when={(households() ?? []).length > 0}>
        <section class="glass-panel p-6">
          <h2 class="type-title text-lg">
            <Trans>Your Households</Trans>
          </h2>
          <ul class="mt-4 flex flex-col gap-2">
            <For each={households()}>
              {(hh) => (
                <li class="flex items-center justify-between border-b border-base-300/40 py-2 last:border-0">
                  <span>{hh.name}</span>
                  <span class="type-footnote">{hh.role}</span>
                </li>
              )}
            </For>
          </ul>
        </section>
      </Show>
    </div>
  )
}
