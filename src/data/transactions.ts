import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

export type Transaction = Database['public']['Tables']['transactions']['Row']
export type TransactionInsert = Database['public']['Tables']['transactions']['Insert']
export type TransactionUpdate = Database['public']['Tables']['transactions']['Update']

interface ListTransactionsOpts {
  from?: string
  to?: string
  accountId?: string
  categoryId?: string
  kind?: 'income' | 'expense' | 'transfer'
  includeTransfers?: boolean
  limit?: number
}

export async function listTransactions(opts: ListTransactionsOpts = {}): Promise<Transaction[]> {
  const { from, to, accountId, categoryId, kind, includeTransfers = true, limit = 100 } = opts

  let query = supabase
    .from('transactions')
    .select('*')
    .order('occurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (from) query = query.gte('occurred_on', from)
  if (to) query = query.lte('occurred_on', to)
  if (accountId) query = query.eq('account_id', accountId)
  if (categoryId) query = query.eq('category_id', categoryId)
  if (kind) query = query.eq('kind', kind)
  else if (!includeTransfers) query = query.neq('kind', 'transfer')

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createTransaction(
  input: Omit<TransactionInsert, 'user_id' | 'id' | 'created_at'>,
): Promise<Transaction> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function createTransfer(input: {
  fromAccountId: string
  toAccountId: string
  amount: number
  occurredOn: string
  description: string
  notes?: string | null
}): Promise<Transaction[]> {
  const { fromAccountId, toAccountId, amount, occurredOn, description, notes } = input

  const { data, error } = await supabase.rpc('create_transfer', {
    from_account: fromAccountId,
    to_account: toAccountId,
    amount,
    occurred_on: occurredOn,
    description,
    notes: notes ?? undefined,
  })
  if (error) throw error
  return data as Transaction[]
}

export async function updateTransaction(id: string, patch: TransactionUpdate): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTransfer(
  legs: [Transaction, Transaction],
  patch: { occurredOn?: string; description?: string; notes?: string | null; amount?: number },
): Promise<void> {
  const [legA, legB] = legs
  const negLeg = legA.amount < 0 ? legA : legB
  const posLeg = legA.amount >= 0 ? legA : legB

  const sharedPatch: TransactionUpdate = {}
  if (patch.occurredOn !== undefined) sharedPatch.occurred_on = patch.occurredOn
  if (patch.description !== undefined) sharedPatch.description = patch.description
  if (patch.notes !== undefined) sharedPatch.notes = patch.notes

  if (patch.amount !== undefined) {
    const { error: e1 } = await supabase
      .from('transactions')
      .update({ ...sharedPatch, amount: -Math.abs(patch.amount) })
      .eq('id', negLeg.id)
    if (e1) throw e1

    const { error: e2 } = await supabase
      .from('transactions')
      .update({ ...sharedPatch, amount: Math.abs(patch.amount) })
      .eq('id', posLeg.id)
    if (e2) throw e2
  } else if (Object.keys(sharedPatch).length > 0) {
    const { error } = await supabase
      .from('transactions')
      .update(sharedPatch)
      .in('id', [legA.id, legB.id])
    if (error) throw error
  }
}

export async function deleteTransaction(id: string): Promise<void> {
  const { data: tx, error: fetchError } = await supabase
    .from('transactions')
    .select('transfer_pair_id')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  if (tx?.transfer_pair_id) {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .in('id', [id, tx.transfer_pair_id])
    if (error) throw error
  } else {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) throw error
  }
}

export function isTransferLeg(t: Transaction): boolean {
  return t.kind === 'transfer'
}
