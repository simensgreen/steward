import type { JSX } from "solid-js"

type IconProps = { class?: string }

// skipcq: JS-0067 -- ESM module scope, not a browser global
function Svg(props: { class?: string; children: JSX.Element }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={props.class ?? "size-5"}
      aria-hidden="true"
    >
      {props.children}
    </svg>
  )
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function IconHome(props: IconProps) {
  return (
    <Svg class={props.class}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </Svg>
  )
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function IconBudget(props: IconProps) {
  return (
    <Svg class={props.class}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h.01" />
      <path d="M11 15h2" />
    </Svg>
  )
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function IconStorage(props: IconProps) {
  return (
    <Svg class={props.class}>
      <path d="M4 7h16v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
      <path d="M4 7 12 3l8 4" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </Svg>
  )
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function IconCatalog(props: IconProps) {
  return (
    <Svg class={props.class}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h10" />
      <circle cx="18" cy="18" r="3" />
    </Svg>
  )
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function IconCalendar(props: IconProps) {
  return (
    <Svg class={props.class}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </Svg>
  )
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function IconShopping(props: IconProps) {
  return (
    <Svg class={props.class}>
      <path d="M6 6h15l-1.5 9h-12z" />
      <path d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </Svg>
  )
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function IconSettings(props: IconProps) {
  return (
    <Svg class={props.class}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  )
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function IconMenu(props: IconProps) {
  return (
    <Svg class={props.class}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Svg>
  )
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function IconPlus(props: IconProps) {
  return (
    <Svg class={props.class}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

// skipcq: JS-0067 -- ESM module scope, not a browser global
export function IconChevronRight(props: IconProps) {
  return (
    <Svg class={props.class}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  )
}
