import { Trans } from "@lingui/solid/macro"
import { A, useNavigate } from "@solidjs/router"
import { createSignal, Show } from "solid-js"
import { login, register } from "../session"

export function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = createSignal<"login" | "register">("login")
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [displayName, setDisplayName] = createSignal("")
  const [currency, setCurrency] = createSignal("USD")
  const [error, setError] = createSignal<string | null>(null)
  const [busy, setBusy] = createSignal(false)

  const submit = async (event: Event) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode() === "login") {
        await login(username(), password())
      } else {
        await register(username(), password(), displayName() || undefined, currency())
      }
      navigate("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main class="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <section class="glass-panel flex flex-col gap-3 p-8 sm:p-10">
        <p class="type-footnote tracking-wide uppercase">Steward</p>
        <h1 class="type-title">Steward</h1>
        <p class="type-body">
          <Trans>Household stewardship in one place: stock, shopping, and money.</Trans>
        </p>
      </section>

      <section class="glass-panel p-6 sm:p-8">
        <div class="mb-6 flex gap-2">
          <button
            type="button"
            class={`btn hit-target flex-1 ${mode() === "login" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("login")}
          >
            <Trans>Log in</Trans>
          </button>
          <button
            type="button"
            class={`btn hit-target flex-1 ${mode() === "register" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("register")}
          >
            <Trans>Register</Trans>
          </button>
        </div>

        <form class="flex flex-col gap-4" onSubmit={(e) => void submit(e)}>
          <label class="form-control">
            <span class="type-footnote mb-2">
              <Trans>Username</Trans>
            </span>
            <input
              class="input input-bordered hit-target w-full"
              value={username()}
              required
              autocomplete="username"
              onInput={(e) => setUsername(e.currentTarget.value)}
            />
          </label>
          <label class="form-control">
            <span class="type-footnote mb-2">
              <Trans>Password</Trans>
            </span>
            <input
              class="input input-bordered hit-target w-full"
              type="password"
              value={password()}
              required
              minLength={8}
              autocomplete={mode() === "login" ? "current-password" : "new-password"}
              onInput={(e) => setPassword(e.currentTarget.value)}
            />
          </label>
          <Show when={mode() === "register"}>
            <label class="form-control">
              <span class="type-footnote mb-2">
                <Trans>Display name</Trans>
              </span>
              <input
                class="input input-bordered hit-target w-full"
                value={displayName()}
                onInput={(e) => setDisplayName(e.currentTarget.value)}
              />
            </label>
            <label class="form-control">
              <span class="type-footnote mb-2">
                <Trans>Default Currency</Trans>
              </span>
              <input
                class="input input-bordered hit-target w-full"
                value={currency()}
                maxlength={3}
                onInput={(e) => setCurrency(e.currentTarget.value.toUpperCase())}
              />
            </label>
          </Show>
          <Show when={error()}>
            <p class="text-error type-footnote" role="alert">
              {error()}
            </p>
          </Show>
          <button type="submit" class="btn btn-primary hit-target" disabled={busy()}>
            <Show when={mode() === "login"} fallback={<Trans>Create Person</Trans>}>
              <Trans>Continue</Trans>
            </Show>
          </button>
        </form>
        <p class="type-footnote mt-4">
          <A href="/settings" class="link">
            <Trans>Language and appearance</Trans>
          </A>
        </p>
      </section>
    </main>
  )
}
