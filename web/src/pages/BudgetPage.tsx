import { Trans } from "@lingui/solid/macro"
import { createResource, createSignal, For, Show } from "solid-js"
import { api, type Budget, type BudgetTransaction, type Fund, type MemberBalance } from "../api"
import { EmptyState } from "../components/EmptyState"
import { IconBudget, IconPlus } from "../components/icons"
import { PageTabs, type TabItem } from "../components/PageTabs"
import { SectionHeader } from "../components/SectionHeader"
import { formatMoney } from "../session"

function balanceFromTransactions(transactions: BudgetTransaction[]): number {
  return transactions.reduce((sum, tx) => {
    const delta = tx.kind === "income" ? tx.amount_minor : -tx.amount_minor
    return sum + delta
  }, 0)
}

export function BudgetPage() {
  const [tab, setTab] = createSignal("budget")
  const tabs: TabItem[] = [
    { id: "budget", label: <Trans>Transactions</Trans> },
    { id: "funds", label: <Trans>Funds</Trans> },
  ]

  const [budget, { refetch: refetchBudget }] = createResource(() =>
    api<Budget>("/api/v1/budgets/me"),
  )
  const [transactions, { refetch: refetchTx }] = createResource(
    () => budget()?.id,
    (id) =>
      id ? api<BudgetTransaction[]>(`/api/v1/budgets/${id}/transactions`) : Promise.resolve([]),
  )
  const [funds, { refetch: refetchFunds }] = createResource(() => api<Fund[]>("/api/v1/funds"))

  const [txKind, setTxKind] = createSignal("expense")
  const [txAmount, setTxAmount] = createSignal("")
  const [txMemo, setTxMemo] = createSignal("")
  const [fundName, setFundName] = createSignal("")
  const [selectedFund, setSelectedFund] = createSignal("")
  const [expenseAmount, setExpenseAmount] = createSignal("")
  const [balances, { refetch: refetchBalances }] = createResource(selectedFund, (id) =>
    id ? api<MemberBalance[]>(`/api/v1/funds/${id}/balances`) : Promise.resolve([]),
  )
  const [error, setError] = createSignal<string | null>(null)

  const balance = () => balanceFromTransactions(transactions() ?? [])

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
    <div class="page-stack">
      <SectionHeader
        accent="budget"
        icon={<IconBudget class="size-6" />}
        title={<Trans>Budget</Trans>}
        description={
          <Trans>Personal Budget: Transactions, Rules, and Shopping Lists on your ledger.</Trans>
        }
      />

      <Show when={budget()}>
        {(b) => (
          <section class="summary-card summary-card-budget">
            <p class="summary-label">
              <Trans>Current balance</Trans>
            </p>
            <p class="summary-value">{formatMoney(balance(), b().currency)}</p>
            <p class="summary-meta">
              <Trans>Currency: {b().currency}</Trans>
            </p>
          </section>
        )}
      </Show>

      <PageTabs tabs={tabs} active={tab()} onChange={setTab} />

      <Show when={tab() === "budget"}>
        <section class="content-card">
          <h2 class="content-card-title">
            <Trans>Add Transaction</Trans>
          </h2>
          <form class="form-grid mt-4" onSubmit={(e) => void addTx(e)}>
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
              placeholder="0.00"
              value={txAmount()}
              onInput={(e) => setTxAmount(e.currentTarget.value)}
            />
            <input
              class="input input-bordered hit-target sm:col-span-2"
              placeholder="Memo"
              value={txMemo()}
              onInput={(e) => setTxMemo(e.currentTarget.value)}
            />
            <button type="submit" class="btn btn-primary hit-target sm:col-span-2">
              <IconPlus class="size-4" />
              <Trans>Post Transaction</Trans>
            </button>
          </form>
        </section>

        <section class="content-card">
          <h2 class="content-card-title">
            <Trans>Recent Transactions</Trans>
          </h2>
          <Show
            when={(transactions() ?? []).length > 0}
            fallback={
              <EmptyState
                icon={<IconBudget class="size-8" />}
                title={<Trans>No transactions yet</Trans>}
                description={<Trans>Post income or expenses to track your Budget.</Trans>}
              />
            }
          >
            <ul class="item-list mt-4">
              <For each={transactions() ?? []}>
                {(tx) => (
                  <li class="item-row">
                    <div>
                      <span class={`tx-badge tx-badge-${tx.kind}`}>{tx.kind}</span>
                      <Show when={tx.memo}>
                        <span class="item-meta ml-2">{tx.memo}</span>
                      </Show>
                    </div>
                    <span class={tx.kind === "income" ? "text-success" : ""}>
                      {formatMoney(tx.amount_minor, tx.currency)}
                    </span>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>
      </Show>

      <Show when={tab() === "funds"}>
        <section class="content-card">
          <h2 class="content-card-title">
            <Trans>Shared Funds</Trans>
          </h2>
          <p class="content-card-description">
            <Trans>Funds track shared obligations with derived Member Balances.</Trans>
          </p>
          <form class="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => void createFund(e)}>
            <input
              class="input input-bordered hit-target flex-1"
              value={fundName()}
              required
              placeholder="Trip fund"
              onInput={(e) => setFundName(e.currentTarget.value)}
            />
            <button type="submit" class="btn btn-primary hit-target">
              <IconPlus class="size-4" />
              <Trans>Create Fund</Trans>
            </button>
          </form>

          <label class="form-control mt-6 max-w-md">
            <span class="field-label">
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
            <ul class="item-list mt-4">
              <For each={balances() ?? []}>
                {(bal) => (
                  <li class="item-row">
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
            <form
              class="mt-4 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => void postExpense(e)}
            >
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
      </Show>

      <Show when={error()}>
        <p class="text-error type-footnote">{error()}</p>
      </Show>
    </div>
  )
}
