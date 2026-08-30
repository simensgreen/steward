import { Trans } from "@lingui/solid/macro"
import { createResource, createSignal, For, Show } from "solid-js"
import { api, type Budget, type BudgetTransaction, type Fund, type MemberBalance } from "../api"
import { formatMoney } from "../session"

export function MoneyPage() {
  const [budget, { refetch: refetchBudget }] = createResource(() =>
    api<Budget>("/api/v1/budgets/me"),
  )
  const [funds, { refetch: refetchFunds }] = createResource(() => api<Fund[]>("/api/v1/funds"))
  const [transactions, { refetch: refetchTx }] = createResource(
    () => budget()?.id,
    (id) =>
      id ? api<BudgetTransaction[]>(`/api/v1/budgets/${id}/transactions`) : Promise.resolve([]),
  )

  const [fundName, setFundName] = createSignal("")
  const [txKind, setTxKind] = createSignal("expense")
  const [txAmount, setTxAmount] = createSignal("")
  const [txMemo, setTxMemo] = createSignal("")
  const [selectedFund, setSelectedFund] = createSignal("")
  const [balances, { refetch: refetchBalances }] = createResource(selectedFund, (id) =>
    id ? api<MemberBalance[]>(`/api/v1/funds/${id}/balances`) : Promise.resolve([]),
  )
  const [expenseAmount, setExpenseAmount] = createSignal("")
  const [error, setError] = createSignal<string | null>(null)

  const addTx = async (event: Event) => {
    event.preventDefault()
    const id = budget()?.id
    if (!id) {
      return
    }
    setError(null)
    try {
      await api(`/api/v1/budgets/${id}/transactions`, {
        method: "POST",
        body: JSON.stringify({
          kind: txKind(),
          amount: Number(txAmount()),
          memo: txMemo() || null,
          idempotency_key: crypto.randomUUID(),
        }),
      })
      setTxAmount("")
      setTxMemo("")
      await refetchTx()
      await refetchBudget()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  const createFund = async (event: Event) => {
    event.preventDefault()
    setError(null)
    try {
      await api("/api/v1/funds", {
        method: "POST",
        body: JSON.stringify({ name: fundName() }),
      })
      setFundName("")
      await refetchFunds()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  const postExpense = async (event: Event) => {
    event.preventDefault()
    if (!selectedFund()) {
      return
    }
    setError(null)
    try {
      const fund = funds()?.find((f) => f.id === selectedFund())
      await api("/api/v1/commands/fund/expense", {
        method: "POST",
        body: JSON.stringify({
          fund_id: selectedFund(),
          payer_person_id: fund?.owner_person_id,
          amount: Number(expenseAmount()),
          idempotency_key: crypto.randomUUID(),
        }),
      })
      setExpenseAmount("")
      await refetchBalances()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed")
    }
  }

  return (
    <div class="flex flex-col gap-6">
      <section class="glass-panel p-6">
        <h1 class="type-title text-2xl">
          <Trans>Money</Trans>
        </h1>
        <p class="type-body mt-2">
          <Trans>Personal Budget and shared Funds with derived Member Balances.</Trans>
        </p>
      </section>

      <section class="glass-panel p-6">
        <h2 class="type-title text-lg">
          <Trans>Budget</Trans>
        </h2>
        <Show when={budget()}>
          {(b) => (
            <p class="type-footnote mt-1">
              <Trans>Currency: {b().currency}</Trans>
            </p>
          )}
        </Show>
        <form class="mt-4 grid gap-3 sm:grid-cols-3" onSubmit={(e) => void addTx(e)}>
          <select
            class="select select-bordered hit-target"
            value={txKind()}
            onChange={(e) => setTxKind(e.currentTarget.value)}
          >
            <option value="expense">
              <Trans>Expense</Trans>
            </option>
            <option value="income">
              <Trans>Income</Trans>
            </option>
          </select>
          <input
            class="input input-bordered hit-target"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={txAmount()}
            onInput={(e) => setTxAmount(e.currentTarget.value)}
          />
          <input
            class="input input-bordered hit-target"
            placeholder="Memo"
            value={txMemo()}
            onInput={(e) => setTxMemo(e.currentTarget.value)}
          />
          <button type="submit" class="btn btn-primary hit-target sm:col-span-3">
            <Trans>Post Transaction</Trans>
          </button>
        </form>
        <ul class="mt-4 flex flex-col gap-2">
          <For each={transactions() ?? []}>
            {(tx) => (
              <li class="flex justify-between border-b border-base-300/30 py-2 type-footnote">
                <span>
                  {tx.kind}
                  <Show when={tx.memo}> · {tx.memo}</Show>
                </span>
                <span>{formatMoney(tx.amount_minor, tx.currency)}</span>
              </li>
            )}
          </For>
        </ul>
      </section>

      <section class="glass-panel p-6">
        <h2 class="type-title text-lg">
          <Trans>Funds</Trans>
        </h2>
        <form class="mt-3 flex gap-3" onSubmit={(e) => void createFund(e)}>
          <input
            class="input input-bordered hit-target flex-1"
            value={fundName()}
            required
            placeholder="Trip fund"
            onInput={(e) => setFundName(e.currentTarget.value)}
          />
          <button type="submit" class="btn btn-primary hit-target">
            <Trans>Create Fund</Trans>
          </button>
        </form>
        <label class="form-control mt-4 max-w-md">
          <span class="type-footnote mb-2">
            <Trans>Open Fund</Trans>
          </span>
          <select
            class="select select-bordered hit-target"
            value={selectedFund()}
            onChange={(e) => setSelectedFund(e.currentTarget.value)}
          >
            <option value="">
              <Trans>Select…</Trans>
            </option>
            <For each={funds() ?? []}>{(f) => <option value={f.id}>{f.name}</option>}</For>
          </select>
        </label>

        <Show when={selectedFund()}>
          <ul class="mt-4 flex flex-col gap-2">
            <For each={balances() ?? []}>
              {(bal) => (
                <li class="flex justify-between py-1">
                  <span>{bal.display_name}</span>
                  <span>
                    {formatMoney(
                      bal.balance_minor,
                      funds()?.find((f) => f.id === selectedFund())?.default_currency ?? "USD",
                    )}
                  </span>
                </li>
              )}
            </For>
          </ul>
          <form class="mt-4 flex gap-3" onSubmit={(e) => void postExpense(e)}>
            <input
              class="input input-bordered hit-target"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={expenseAmount()}
              onInput={(e) => setExpenseAmount(e.currentTarget.value)}
            />
            <button type="submit" class="btn btn-outline hit-target">
              <Trans>Shared expense (equal shares)</Trans>
            </button>
          </form>
        </Show>
      </section>

      <Show when={error()}>
        <p class="text-error type-footnote">{error()}</p>
      </Show>
    </div>
  )
}
