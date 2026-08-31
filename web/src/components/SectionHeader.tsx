import type { JSX } from "solid-js"
import { Show } from "solid-js"

export function SectionHeader(props: {
  icon: JSX.Element
  title: JSX.Element
  description?: JSX.Element
  accent?: "budget" | "storage" | "catalog" | "calendar" | "neutral"
  action?: JSX.Element
}) {
  const accent = () => props.accent ?? "neutral"
  return (
    <header class="section-header">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-start gap-4">
          <div class={`section-icon section-icon-${accent()}`}>{props.icon}</div>
          <div>
            <h1 class="section-title">{props.title}</h1>
            <Show when={props.description}>
              <p class="section-description">{props.description}</p>
            </Show>
          </div>
        </div>
        <Show when={props.action}>
          <div class="shrink-0">{props.action}</div>
        </Show>
      </div>
    </header>
  )
}
