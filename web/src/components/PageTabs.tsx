import type { JSX } from "solid-js"
import { For } from "solid-js"

export type TabItem = {
  id: string
  label: JSX.Element
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function PageTabs(props: {
  tabs: TabItem[]
  active: string
  onChange: (id: string) => void
}) {
  return (
    <div class="page-tabs" role="tablist">
      <For each={props.tabs}>
        {(tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={props.active === tab.id}
            class={`page-tab ${props.active === tab.id ? "page-tab-active" : ""}`}
            onClick={() => props.onChange(tab.id)}
          >
            {tab.label}
          </button>
        )}
      </For>
    </div>
  )
}
