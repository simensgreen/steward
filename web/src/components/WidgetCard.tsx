import { A } from "@solidjs/router"
import type { JSX } from "solid-js"
import { Show } from "solid-js"
import { IconChevronRight } from "./icons"

// skipcq: JS-0067, JS-0415 -- ESM module scope; UI nesting is intentional
export function WidgetCard(props: {
  icon: JSX.Element
  title: JSX.Element
  accent?: "budget" | "storage" | "catalog" | "calendar" | "neutral"
  href?: string
  footer?: JSX.Element
  children?: JSX.Element
}) {
  const accent = () => props.accent ?? "neutral"
  const inner = (
    <section class="widget-card">
      <div class="widget-card-header">
        <div class="flex items-center gap-3">
          <div class={`section-icon section-icon-sm section-icon-${accent()}`}>{props.icon}</div>
          <h2 class="widget-card-title">{props.title}</h2>
        </div>
        <Show when={props.href}>
          <IconChevronRight class="size-4 opacity-50" />
        </Show>
      </div>
      <Show when={props.children}>
        <div class="widget-card-body">{props.children}</div>
      </Show>
      <Show when={props.footer}>
        <div class="widget-card-footer">{props.footer}</div>
      </Show>
    </section>
  )

  const href = () => props.href
  return (
    <Show when={href()} fallback={inner}>
      {(h) => (
        <A href={h()} class="widget-card-link no-underline">
          {inner}
        </A>
      )}
    </Show>
  )
}
