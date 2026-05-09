import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

export type Budget = Database['public']['Tables']['budgets']['Row']
export type BudgetInsert = Database['public']['Tables']['budgets']['Insert']
export type BudgetUpdate = Database['public']['Tables']['budgets']['Update']

export async function listBudgets(): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

export async function createBudget(
  input: Omit<BudgetInsert, 'user_id' | 'id' | 'created_at'>,
): Promise<Budget> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('budgets')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBudget(id: string, patch: BudgetUpdate): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .update(patch)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) throw error
}

export async function upsertBudget(category_id: string, monthly_limit: number): Promise<Budget> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      { category_id, monthly_limit, user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,category_id' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}
