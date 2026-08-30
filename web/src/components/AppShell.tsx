import { Trans } from "@lingui/solid/macro"
import { A } from "@solidjs/router"
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { logout, useAuth } from "../session"

export function AppShell(props: { children: JSX.Element }) {
  const { person } = useAuth()

  return (
    <div class="min-h-screen pb-24">
      <header class="glass-panel sticky top-0 z-20 mx-auto mt-3 flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <A href="/" class="type-title text-xl tracking-tight no-underline">
          Steward
        </A>
        <Show when={person()}>
          {(p) => (
            <div class="flex items-center gap-3">
              <span class="type-footnote hidden sm:inline">{p().display_name}</span>
              <button
                type="button"
                class="btn btn-ghost btn-sm hit-target"
                onClick={() => void logout()}
              >
                <Trans>Log out</Trans>
              </button>
            </div>
          )}
        </Show>
      </header>

      <nav class="glass-panel mx-auto mt-3 flex max-w-5xl gap-1 overflow-x-auto px-2 py-2 sm:px-4">
        <A
          href="/"
          class="btn btn-ghost btn-sm hit-target whitespace-nowrap no-underline"
          activeClass="btn-active"
          end
        >
          <Trans>Home</Trans>
        </A>
        <A
          href="/households"
          class="btn btn-ghost btn-sm hit-target whitespace-nowrap no-underline"
          activeClass="btn-active"
        >
          <Trans>Households</Trans>
        </A>
        <A
          href="/stock"
          class="btn btn-ghost btn-sm hit-target whitespace-nowrap no-underline"
          activeClass="btn-active"
        >
          <Trans>Stock</Trans>
        </A>
        <A
          href="/shopping"
          class="btn btn-ghost btn-sm hit-target whitespace-nowrap no-underline"
          activeClass="btn-active"
        >
          <Trans>Shopping</Trans>
        </A>
        <A
          href="/money"
          class="btn btn-ghost btn-sm hit-target whitespace-nowrap no-underline"
          activeClass="btn-active"
        >
          <Trans>Money</Trans>
        </A>
        <A
          href="/catalog"
          class="btn btn-ghost btn-sm hit-target whitespace-nowrap no-underline"
          activeClass="btn-active"
        >
          <Trans>Catalog</Trans>
        </A>
        <A
          href="/settings"
          class="btn btn-ghost btn-sm hit-target whitespace-nowrap no-underline"
          activeClass="btn-active"
        >
          <Trans>Settings</Trans>
        </A>
      </nav>

      <main class="mx-auto mt-6 max-w-5xl px-4 pb-10 sm:px-6">{props.children}</main>
    </div>
  )
}
