import type { JSX } from "solid-js"
import { Show } from "solid-js"

// skipcq: JS-0067, JS-0415 -- ESM module scope; UI nesting is intentional
export function EmptyState(props: {
  icon: JSX.Element
  title: JSX.Element
  description: JSX.Element
  action?: JSX.Element
}) {
  // skipcq: JS-0415 -- intentional UI nesting
  return (
    <div class="empty-state">
      <div class="empty-state-icon">{props.icon}</div>
      <h3 class="empty-state-title">{props.title}</h3>
      <p class="empty-state-description">{props.description}</p>
      <Show when={props.action}>
        <div class="mt-4">{props.action}</div>
      </Show>
    </div>
  )
}
