import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

export type Account = Database['public']['Tables']['accounts']['Row']
export type AccountInsert = Database['public']['Tables']['accounts']['Insert']
export type AccountUpdate = Database['public']['Tables']['accounts']['Update']

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data
}

export async function createAccount(
  input: Omit<AccountInsert, 'user_id' | 'id' | 'created_at'>,
): Promise<Account> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('accounts')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateAccount(id: string, patch: AccountUpdate): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}

export async function listAccountBalances(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('account_balances')
    .select('account_id, current_balance')
  if (error) throw error
  return Object.fromEntries(
    data
      .filter(row => row.account_id != null)
      .map(row => [row.account_id!, Number(row.current_balance ?? 0)]),
  )
}
