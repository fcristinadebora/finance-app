import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

export type Period = Database['public']['Tables']['periods']['Row']
export type PeriodInsert = Database['public']['Tables']['periods']['Insert']

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

/** Update a period's editable fields. */
export async function updatePeriod(
  id: string,
  patch: { started_on?: string; label?: string | null },
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
