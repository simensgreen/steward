import { Trans } from "@lingui/solid/macro"
import { createResource, createSignal, For, Show } from "solid-js"
import { api, type Calendar, type CalendarEvent, type Household } from "../api"

export function HouseholdsPage() {
  const [name, setName] = createSignal("")
  const [error, setError] = createSignal<string | null>(null)
  const [households, { refetch }] = createResource(() => api<Household[]>("/api/v1/households"))
  const [selected, setSelected] = createSignal<string | null>(null)
  const [calendars] = createResource(selected, (id) =>
    id ? api<Calendar[]>(`/api/v1/households/${id}/calendars`) : Promise.resolve([]),
  )
  const [eventsByCal, setEventsByCal] = createSignal<Record<string, CalendarEvent[]>>({})

  const create = async (event: Event) => {
    event.preventDefault()
    setError(null)
    try {
      await api("/api/v1/households", {
        method: "POST",
        body: JSON.stringify({ name: name() }),
      })
      setName("")
      await refetch()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  const loadEvents = async (calendarId: string) => {
    const events = await api<CalendarEvent[]>(`/api/v1/calendars/${calendarId}/events`)
    setEventsByCal((prev) => ({ ...prev, [calendarId]: events }))
  }

  return (
    <div class="flex flex-col gap-6">
      <section class="glass-panel p-6">
        <h1 class="type-title text-2xl">
          <Trans>Households</Trans>
        </h1>
        <p class="type-body mt-2">
          <Trans>Create a Household to own Stock and system Calendars.</Trans>
        </p>
        <form class="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => void create(e)}>
          <input
            class="input input-bordered hit-target flex-1"
            placeholder="Home"
            value={name()}
            required
            onInput={(e) => setName(e.currentTarget.value)}
          />
          <button type="submit" class="btn btn-primary hit-target">
            <Trans>Create Household</Trans>
          </button>
        </form>
        <Show when={error()}>
          <p class="text-error type-footnote mt-2">{error()}</p>
        </Show>
      </section>

      <section class="glass-panel p-6">
        <Show when={!households.loading} fallback={<Trans>Loading…</Trans>}>
          <ul class="flex flex-col gap-3">
            <For each={households() ?? []}>
              {(hh) => (
                <li class="rounded-box border border-base-300/30 p-4">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between text-left"
                    onClick={() => setSelected(hh.id)}
                  >
                    <span class="font-medium">{hh.name}</span>
                    <span class="type-footnote">{hh.role}</span>
                  </button>
                  <Show when={selected() === hh.id}>
                    <div class="mt-3">
                      <p class="type-footnote mb-2">
                        <Trans>Calendars</Trans>
                      </p>
                      <For each={calendars() ?? []}>
                        {(cal) => (
                          <div class="mb-2">
                            <button
                              type="button"
                              class="btn btn-ghost btn-sm"
                              onClick={() => void loadEvents(cal.id)}
                            >
                              {cal.name}
                              <Show when={cal.system_kind}>
                                <span class="type-footnote ml-2">({cal.system_kind})</span>
                              </Show>
                            </button>
                            <For each={eventsByCal()[cal.id] ?? []}>
                              {(ev) => (
                                <p class="type-footnote pl-4">
                                  {ev.starts_on}: {ev.title}
                                </p>
                              )}
                            </For>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </section>
    </div>
  )
}
