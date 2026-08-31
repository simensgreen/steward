import { Trans } from "@lingui/solid/macro"
import { A, useLocation } from "@solidjs/router"
import type { Component, JSX } from "solid-js"
import { createSignal, For, Show } from "solid-js"
import { logout, useAuth } from "../session"
import {
  IconBudget,
  IconCalendar,
  IconCatalog,
  IconHome,
  IconMenu,
  IconSettings,
  IconShopping,
  IconStorage,
} from "./icons"

type NavItem = {
  href: string
  label: () => JSX.Element
  icon: Component<{ class?: string }>
  end?: boolean
}

const mainNav: NavItem[] = [
  { href: "/", label: () => <Trans>Overview</Trans>, icon: IconHome, end: true },
  { href: "/budget", label: () => <Trans>Budget</Trans>, icon: IconBudget },
  { href: "/storage", label: () => <Trans>Storage</Trans>, icon: IconStorage },
  { href: "/catalog", label: () => <Trans>Catalog</Trans>, icon: IconCatalog },
  { href: "/calendar", label: () => <Trans>Calendar</Trans>, icon: IconCalendar },
]

const secondaryNav: NavItem[] = [
  { href: "/shopping", label: () => <Trans>Shopping</Trans>, icon: IconShopping },
  { href: "/settings", label: () => <Trans>Settings</Trans>, icon: IconSettings },
]

function NavLink(props: NavItem & { collapsed: boolean; onNavigate?: () => void }) {
  const Icon = props.icon
  return (
    <A
      href={props.href}
      end={props.end}
      class="sidebar-link"
      activeClass="sidebar-link-active"
      onClick={props.onNavigate}
    >
      <span class="sidebar-link-icon">
        <Icon class="size-5" />
      </span>
      <Show when={!props.collapsed}>
        <span class="sidebar-link-label">{props.label()}</span>
      </Show>
    </A>
  )
}

export function AppShell(props: { children: JSX.Element }) {
  const { person } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = createSignal(false)
  const [mobileOpen, setMobileOpen] = createSignal(false)

  const closeMobile = () => setMobileOpen(false)

  return (
    <div class="app-shell">
      <Show when={mobileOpen()}>
        <button
          type="button"
          class="sidebar-backdrop"
          aria-label="Close menu"
          onClick={closeMobile}
        />
      </Show>

      <aside
        class={`sidebar ${collapsed() ? "sidebar-collapsed" : ""} ${mobileOpen() ? "sidebar-open" : ""}`}
      >
        <div class="sidebar-brand">
          <A href="/" class="sidebar-brand-link no-underline" onClick={closeMobile}>
            <span class="sidebar-brand-mark">S</span>
            <Show when={!collapsed()}>
              <span class="sidebar-brand-text">Steward</span>
            </Show>
          </A>
          <button
            type="button"
            class="sidebar-toggle btn btn-ghost btn-sm btn-square hidden lg:inline-flex"
            aria-label="Toggle sidebar"
            onClick={() => setCollapsed((v) => !v)}
          >
            <IconMenu class="size-5" />
          </button>
        </div>

        <nav class="sidebar-nav">
          <For each={mainNav}>
            {(item) => <NavLink {...item} collapsed={collapsed()} onNavigate={closeMobile} />}
          </For>
        </nav>

        <div class="sidebar-footer">
          <For each={secondaryNav}>
            {(item) => <NavLink {...item} collapsed={collapsed()} onNavigate={closeMobile} />}
          </For>
          <Show when={person()}>
            {(p) => (
              <div class="sidebar-user">
                <Show when={!collapsed()}>
                  <span class="sidebar-user-name">{p().display_name}</span>
                </Show>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm sidebar-logout"
                  onClick={() => void logout()}
                >
                  <Trans>Log out</Trans>
                </button>
              </div>
            )}
          </Show>
        </div>
      </aside>

      <div class="app-main">
        <header class="mobile-topbar lg:hidden">
          <button
            type="button"
            class="btn btn-ghost btn-square"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <IconMenu class="size-5" />
          </button>
          <span class="mobile-topbar-title">Steward</span>
        </header>

        <main class="app-content">{props.children}</main>
      </div>

      <nav class="bottom-nav lg:hidden" aria-label="Main navigation">
        <For each={mainNav}>
          {(item) => {
            const Icon = item.icon
            return (
              <A
                href={item.href}
                end={item.end}
                class="bottom-nav-link"
                activeClass="bottom-nav-link-active"
                aria-current={location.pathname === item.href ? "page" : undefined}
              >
                <span class="bottom-nav-icon">
                  <Icon class="size-5" />
                </span>
                <span class="bottom-nav-label">{item.label()}</span>
              </A>
            )
          }}
        </For>
      </nav>
    </div>
  )
}
