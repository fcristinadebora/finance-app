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
  limit?: number
}

export async function listTransactions(opts: ListTransactionsOpts = {}): Promise<Transaction[]> {
  const { from, to, accountId, categoryId, limit = 100 } = opts

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

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}
