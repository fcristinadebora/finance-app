import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

export type SharePayment = Database['public']['Tables']['share_payments']['Row']

export async function listSharePayments(shareId: string): Promise<SharePayment[]> {
  const { data, error } = await supabase
    .from('share_payments')
    .select('*')
    .eq('share_id', shareId)
    .order('paid_on', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createSharePayment(input: {
  shareId: string
  payers: string[]
  amount: number
  paidOn: string
  notes?: string | null
}): Promise<SharePayment> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('share_payments')
    .insert({
      share_id: input.shareId,
      user_id: user.id,
      payers: input.payers,
      amount: input.amount,
      paid_on: input.paidOn,
      notes: input.notes ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteSharePayment(id: string): Promise<void> {
  const { error } = await supabase.from('share_payments').delete().eq('id', id)
  if (error) throw error
}
