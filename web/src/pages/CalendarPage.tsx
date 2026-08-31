import { Trans } from "@lingui/solid/macro"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { api, type Calendar, type CalendarEvent, type Household } from "../api"
import { EmptyState } from "../components/EmptyState"
import { IconCalendar, IconPlus } from "../components/icons"
import { SectionHeader } from "../components/SectionHeader"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0).getDate()
  const startOffset = (first.getDay() + 6) % 7
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) {
    cells.push(null)
  }
  for (let d = 1; d <= lastDay; d++) {
    cells.push(d)
  }
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }
  return cells
}

export function CalendarPage() {
  const today = new Date()
  const [viewYear, setViewYear] = createSignal(today.getFullYear())
  const [viewMonth, setViewMonth] = createSignal(today.getMonth())
  const [selectedDate, setSelectedDate] = createSignal(
    toIsoDate(today.getFullYear(), today.getMonth(), today.getDate()),
  )

  const [households] = createResource(() => api<Household[]>("/api/v1/households"))
  const [householdId, setHouseholdId] = createSignal("")
  const [personCalendars] = createResource(() => api<Calendar[]>("/api/v1/calendars/me"))
  const [householdCalendars] = createResource(householdId, (id) =>
    id ? api<Calendar[]>(`/api/v1/households/${id}/calendars`) : Promise.resolve([]),
  )

  const allCalendars = createMemo(() => [
    ...(personCalendars() ?? []),
    ...(householdCalendars() ?? []),
  ])

  const [calendarId, setCalendarId] = createSignal("")
  const [events, { refetch: refetchEvents }] = createResource(calendarId, (id) =>
    id ? api<CalendarEvent[]>(`/api/v1/calendars/${id}/events`) : Promise.resolve([]),
  )

  const [eventTitle, setEventTitle] = createSignal("")
  const [eventNotes, setEventNotes] = createSignal("")
  const [showAddEvent, setShowAddEvent] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  const monthCells = createMemo(() => buildMonthGrid(viewYear(), viewMonth()))

  const eventsByDate = createMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events() ?? []) {
      const list = map.get(ev.starts_on) ?? []
      list.push(ev)
      map.set(ev.starts_on, list)
    }
    return map
  })

  const selectedEvents = createMemo(() => eventsByDate().get(selectedDate()) ?? [])

  const monthLabel = createMemo(() => {
    const monthDate = new Date(viewYear(), viewMonth(), 1)
    return monthDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })
  })

  const prevMonth = () => {
    if (viewMonth() === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (viewMonth() === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const selectDay = (day: number) => {
    setSelectedDate(toIsoDate(viewYear(), viewMonth(), day))
  }

  const createEvent = async (event: Event) => {
    event.preventDefault()
    if (!calendarId()) {
      return
    }
    setError(null)
    try {
      await api(`/api/v1/calendars/${calendarId()}/events`, {
        method: "POST",
        body: JSON.stringify({
          title: eventTitle(),
          starts_on: selectedDate(),
          notes: eventNotes() || null,
        }),
      })
      setEventTitle("")
      setEventNotes("")
      setShowAddEvent(false)
      await refetchEvents()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  const selectedCalendar = createMemo(() => allCalendars().find((c) => c.id === calendarId()))

  const canAddEvents = createMemo(() => selectedCalendar()?.system_kind !== "expiry")

  return (
    <div class="page-stack">
      <SectionHeader
        accent="calendar"
        icon={<IconCalendar class="size-6" />}
        title={<Trans>Calendar</Trans>}
        description={
          <Trans>Household and personal Calendars for meal plans, events, and expiry.</Trans>
        }
        action={
          <Show when={calendarId() && canAddEvents()}>
            <button
              type="button"
              class="btn btn-primary hit-target"
              onClick={() => setShowAddEvent((v) => !v)}
            >
              <IconPlus class="size-4" />
              <Trans>Add event</Trans>
            </button>
          </Show>
        }
      />

      <section class="content-card">
        <div class="form-grid">
          <label class="form-control">
            <span class="field-label">
              <Trans>Household</Trans>
            </span>
            <select
              class="select select-bordered hit-target"
              value={householdId()}
              onChange={(e) => {
                setHouseholdId(e.currentTarget.value)
                setCalendarId("")
              }}
            >
              <option value="">
                <Trans>Personal only</Trans>
              </option>
              <For each={households() ?? []}>
                {(hh) => <option value={hh.id}>{hh.name}</option>}
              </For>
            </select>
          </label>
          <label class="form-control">
            <span class="field-label">
              <Trans>Calendar</Trans>
            </span>
            <select
              class="select select-bordered hit-target"
              value={calendarId()}
              onChange={(e) => setCalendarId(e.currentTarget.value)}
            >
              <option value="">
                <Trans>Select…</Trans>
              </option>
              <For each={allCalendars()}>
                {(cal) => (
                  <option value={cal.id}>
                    {cal.name}
                    <Show when={cal.system_kind}> ({cal.system_kind})</Show>
                  </option>
                )}
              </For>
            </select>
          </label>
        </div>
      </section>

      <Show when={calendarId()}>
        <div class="calendar-layout">
          <section class="content-card calendar-grid-card">
            <div class="calendar-toolbar">
              <button type="button" class="btn btn-ghost btn-sm" onClick={prevMonth}>
                ‹
              </button>
              <h2 class="calendar-month-label">{monthLabel()}</h2>
              <button type="button" class="btn btn-ghost btn-sm" onClick={nextMonth}>
                ›
              </button>
            </div>
            <div class="calendar-weekdays">
              <For each={[...WEEKDAYS]}>{(day) => <span>{day}</span>}</For>
            </div>
            <div class="calendar-grid">
              <For each={monthCells()}>
                {(day) => {
                  if (day === null) {
                    return <div class="calendar-cell calendar-cell-empty" />
                  }
                  const iso = toIsoDate(viewYear(), viewMonth(), day)
                  const hasEvents = (eventsByDate().get(iso)?.length ?? 0) > 0
                  const isSelected = selectedDate() === iso
                  const isToday =
                    iso === toIsoDate(today.getFullYear(), today.getMonth(), today.getDate())
                  return (
                    <button
                      type="button"
                      class={`calendar-cell ${isSelected ? "calendar-cell-selected" : ""} ${isToday ? "calendar-cell-today" : ""}`}
                      onClick={() => selectDay(day)}
                    >
                      <span>{day}</span>
                      <Show when={hasEvents}>
                        <span class="calendar-dot" />
                      </Show>
                    </button>
                  )
                }}
              </For>
            </div>
          </section>

          <section class="content-card calendar-events-card">
            <h2 class="content-card-title">{selectedDate()}</h2>
            <Show
              when={selectedEvents().length > 0}
              fallback={
                <EmptyState
                  icon={<IconCalendar class="size-8" />}
                  title={<Trans>No events</Trans>}
                  description={
                    canAddEvents() ? (
                      <Trans>Add an event for this day.</Trans>
                    ) : (
                      <Trans>Expiry events are created from Stock Entries.</Trans>
                    )
                  }
                  action={
                    <Show when={canAddEvents()}>
                      <button
                        type="button"
                        class="btn btn-primary hit-target"
                        onClick={() => setShowAddEvent(true)}
                      >
                        <IconPlus class="size-4" />
                        <Trans>Add event</Trans>
                      </button>
                    </Show>
                  }
                />
              }
            >
              <ul class="event-list mt-4">
                <For each={selectedEvents()}>
                  {(ev) => (
                    <li class="event-card">
                      <p class="event-title">{ev.title}</p>
                      <Show when={ev.notes}>
                        <p class="event-notes">{ev.notes}</p>
                      </Show>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>
        </div>

        <Show when={showAddEvent() && canAddEvents()}>
          <section class="content-card">
            <h2 class="content-card-title">
              <Trans>New event on {selectedDate()}</Trans>
            </h2>
            <form class="mt-4 flex flex-col gap-3 max-w-lg" onSubmit={(e) => void createEvent(e)}>
              <input
                class="input input-bordered hit-target"
                value={eventTitle()}
                required
                placeholder="Dinner"
                onInput={(e) => setEventTitle(e.currentTarget.value)}
              />
              <textarea
                class="textarea textarea-bordered"
                rows={3}
                value={eventNotes()}
                placeholder="Notes"
                onInput={(e) => setEventNotes(e.currentTarget.value)}
              />
              <button type="submit" class="btn btn-primary hit-target self-start">
                <Trans>Save event</Trans>
              </button>
            </form>
          </section>
        </Show>
      </Show>

      <Show when={!calendarId()}>
        <EmptyState
          icon={<IconCalendar class="size-8" />}
          title={<Trans>Select a Calendar</Trans>}
          description={
            <Trans>Choose a Household to see its Calendars, or use your personal Calendars.</Trans>
          }
        />
      </Show>

      <Show when={error()}>
        <p class="text-error type-footnote">{error()}</p>
      </Show>
    </div>
  )
}
