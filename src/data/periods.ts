import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'
import { listTransactions } from './transactions'
import { listCategories } from './categories'
import { listAccounts } from './accounts'

export type Period = Database['public']['Tables']['periods']['Row']
export type PeriodInsert = Database['public']['Tables']['periods']['Insert']

export type PeriodAccountSnapshot =
  Database['public']['Tables']['period_account_snapshots']['Row'] & {
    accounts: { name: string; currency: string } | null
  }

/** All periods for the current user, newest first. */
export async function listPeriods(): Promise<Period[]> {
  const { data, error } = await supabase
    .from('periods')
    .select('*')
    .order('started_on', { ascending: false })
  if (error) throw error
  return data
}

/** Start a new salary period. */
export async function createPeriod(
  startedOn: string,
  label?: string,
): Promise<Period> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('periods')
    .insert({ user_id: user.id, started_on: startedOn, label: label ?? null })
    .select()
    .single()
  if (error) throw error
  return data
}

/** Update a period's editable fields (and optionally its computed stats). */
export async function updatePeriod(
  id: string,
  patch: {
    started_on?: string
    label?: string | null
    total_balance?: number | null
    incomes?: number | null
    expenses?: number | null
    savings?: number | null
  },
): Promise<Period> {
  const { data, error } = await supabase
    .from('periods')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/** Delete a period by id. */
export async function deletePeriod(id: string): Promise<void> {
  const { error } = await supabase.from('periods').delete().eq('id', id)
  if (error) throw error
}

/** All per-account balance snapshots, joined with account name/currency. */
export async function listPeriodAccountSnapshots(): Promise<PeriodAccountSnapshot[]> {
  const { data, error } = await supabase
    .from('period_account_snapshots')
    .select('*, accounts(name, currency)')
  if (error) throw error
  return data as PeriodAccountSnapshot[]
}

// ─── helpers ──────────────────────────────────────────────────────────────────

export interface PeriodBounds {
  start: string   // ISO date, e.g. "2026-04-25"
  end: string     // ISO date, inclusive
  label: string   // human-readable label
  isCurrent: boolean
}

/**
 * Given the sorted (newest-first) list of periods and an index into it,
 * return the start/end bounds for that period.
 *
 * index 0 = current period (started_on[0] → today)
 * index 1 = previous period (started_on[1] → started_on[0] - 1 day)
 * …and so on.
 *
 * If `periods` is empty, falls back to the current calendar month.
 */
export function getPeriodBounds(periods: Period[], index: number): PeriodBounds {
  const today = new Date().toISOString().slice(0, 10)

  // No periods recorded yet → fall back to calendar month
  if (periods.length === 0) {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
    return { start, end, label: now.toLocaleString('default', { month: 'long', year: 'numeric' }), isCurrent: true }
  }

  const period = periods[index]
  if (!period) {
    // Out of bounds — return the oldest available
    return getPeriodBounds(periods, periods.length - 1)
  }

  const start = period.started_on

  // End is the day before the next (more recent) period starts, or today for the current
  let end: string
  if (index === 0) {
    end = today
  } else {
    const nextPeriod = periods[index - 1]
    const nextStart = new Date(nextPeriod.started_on)
    nextStart.setDate(nextStart.getDate() - 1)
    end = nextStart.toISOString().slice(0, 10)
  }

  // Label: use the stored label, or derive one from the start date
  const label = period.label ?? formatPeriodLabel(start, end, index === 0)

  return { start, end, label, isCurrent: index === 0 }
}

/**
 * Recalculate incomes, expenses, savings, total_balance, and per-account
 * balance snapshots for a closed period, then persist everything.
 *
 * Income / expenses / savings:
 *   Derived from transactions within the period date range, excluding transfers
 *   and excluded-category transactions (same logic as the Dashboard).
 *
 * Per-account balances (period_account_snapshots) and total_balance:
 *   Always reconstructed from raw data:
 *     balance_for_account = account.starting_balance
 *                         + Σ ALL transactions for that account (incl. transfers)
 *                           where occurred_on ≤ period_end
 *   Transfers MUST be included: a transfer of €X creates −€X on the source and
 *   +€X on the destination, so both legs must be summed to get the correct
 *   per-account running balance. Across all accounts the legs cancel out, so the
 *   aggregate total_balance is also correct.
 *   The query goes directly through the Supabase client (no row-limit wrapper)
 *   so that no transaction history is silently truncated.
 *   Existing snapshots for the period are deleted and replaced with fresh values.
 */
export async function recalculatePeriodStats(
  periodId: string,
  periods: Period[],
): Promise<Period> {
  const idx = periods.findIndex(p => p.id === periodId)
  if (idx < 0) throw new Error('Period not found')

  const bounds = getPeriodBounds(periods, idx)

  // Run all fetches in parallel
  const [periodTxs, accounts, categories, { data: { user } }] = await Promise.all([
    listTransactions({ from: bounds.start, to: bounds.end, includeTransfers: false, limit: 9999 }),
    listAccounts(),
    listCategories(),
    supabase.auth.getUser(),
  ])

  if (!user) throw new Error('Not authenticated')

  // ── income / expenses / savings ───────────────────────────────────────────
  const excludedCatIds = new Set(categories.filter(c => c.exclude_from_totals).map(c => c.id))
  const categoryById = Object.fromEntries(categories.map(c => [c.id, c]))

  let incomes = 0
  let expenses = 0

  for (const t of periodTxs) {
    if (t.category_id && excludedCatIds.has(t.category_id)) continue

    const cat = t.category_id ? categoryById[t.category_id] : null

    if (cat?.kind === 'income') {
      incomes += t.amount
    } else if (!cat && t.amount > 0) {
      incomes += t.amount
    }

    if (t.amount < 0) {
      expenses += Math.abs(t.amount)
    }
  }

  const savings = incomes - expenses

  // ── per-account balances at period end ────────────────────────────────────
  // Fetch ALL transactions up to period end (no limit) including transfers.
  const { data: allTxsToEnd, error: txErr } = await supabase
    .from('transactions')
    .select('account_id, amount')
    .lte('occurred_on', bounds.end)

  if (txErr) throw txErr

  const txSumByAccount: Record<string, number> = {}
  for (const t of allTxsToEnd ?? []) {
    if (t.account_id) {
      txSumByAccount[t.account_id] = (txSumByAccount[t.account_id] ?? 0) + Number(t.amount)
    }
  }

  // Compute each account's balance at period end
  const accountBalancesAtEnd = accounts.map(a => ({
    account_id: a.id,
    balance: a.starting_balance + (txSumByAccount[a.id] ?? 0),
  }))

  const total_balance = accountBalancesAtEnd.reduce((sum, a) => sum + a.balance, 0)

  // ── replace snapshots ─────────────────────────────────────────────────────
  // Delete stale snapshots, then insert freshly computed ones.
  const { error: delErr } = await supabase
    .from('period_account_snapshots')
    .delete()
    .eq('period_id', periodId)

  if (delErr) throw delErr

  if (accountBalancesAtEnd.length > 0) {
    const { error: insErr } = await supabase
      .from('period_account_snapshots')
      .insert(
        accountBalancesAtEnd.map(({ account_id, balance }) => ({
          period_id: periodId,
          account_id,
          user_id: user.id,
          balance,
        })),
      )
    if (insErr) throw insErr
  }

  return updatePeriod(periodId, { incomes, expenses, savings, total_balance })
}

function formatPeriodLabel(start: string, end: string, isCurrent: boolean): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const fmt = (d: Date) =>
    d.toLocaleString('default', { month: 'short', day: 'numeric' })
  if (isCurrent) return `${fmt(s)} – today`
  if (s.getFullYear() !== e.getFullYear()) {
    return `${fmt(s)} ${s.getFullYear()} – ${fmt(e)} ${e.getFullYear()}`
  }
  return `${fmt(s)} – ${fmt(e)}`
}
