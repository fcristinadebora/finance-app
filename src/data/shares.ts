import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

export type Share = Database['public']['Tables']['shared_expenses']['Row']
export type ShareInsert = Database['public']['Tables']['shared_expenses']['Insert']
export type ShareUpdate = Database['public']['Tables']['shared_expenses']['Update']

export interface ShareMeta {
  title: string
  requires_password: boolean
}

export interface SharePublicPayment {
  id: string
  payers: string[]
  amount: number
  paid_on: string
  notes: string | null
}

export interface SharePublicData {
  id: string
  title: string
  extra_info: string | null
  participants: string[]
  share_token: string
  created_at: string
  transactions: Array<{
    id: string
    description: string
    amount: number
    occurred_on: string
    kind: string
    notes: string | null
    category_id: string | null
  }>
  payments: SharePublicPayment[]
}

function generateToken(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export async function listShares(): Promise<Share[]> {
  const { data, error } = await supabase
    .from('shared_expenses')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createShare(input: {
  title: string
  extra_info?: string | null
  participants: string[]
  password?: string | null
}): Promise<Share> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('shared_expenses')
    .insert({
      user_id: user.id,
      title: input.title,
      extra_info: input.extra_info ?? null,
      participants: input.participants,
      share_token: generateToken(),
      // empty string → trigger converts to null (no password)
      password: input.password || null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateShare(id: string, patch: {
  title?: string
  extra_info?: string | null
  participants?: string[]
  /** Pass a new string to change password, null to remove it, omit to leave unchanged */
  password?: string | null
}): Promise<Share> {
  // Build the patch carefully — only include `password` when explicitly provided
  const updatePayload: ShareUpdate = {}
  if (patch.title !== undefined)       updatePayload.title = patch.title
  if (patch.extra_info !== undefined)  updatePayload.extra_info = patch.extra_info
  if (patch.participants !== undefined) updatePayload.participants = patch.participants
  if ('password' in patch)             updatePayload.password = patch.password ?? null

  const { data, error } = await supabase
    .from('shared_expenses')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteShare(id: string): Promise<void> {
  const { error } = await supabase
    .from('shared_expenses')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── Public functions (no auth required) ───────────────────────

/** Fast metadata check — returns title + whether a password is required. */
export async function getShareMeta(token: string): Promise<ShareMeta | null> {
  const { data, error } = await supabase.rpc('get_share_meta', { p_token: token })
  if (error) throw error
  return data as ShareMeta | null
}

/**
 * Fetch the full share data.
 * - If the share has no password, call without `password`.
 * - If the share has a password, pass it; returns null on wrong password.
 */
export async function getShareByToken(
  token: string,
  password?: string,
): Promise<SharePublicData | null> {
  const args: { p_token: string; p_password?: string } = { p_token: token }
  if (password !== undefined) args.p_password = password

  const { data, error } = await supabase.rpc('get_share_by_token', args)
  if (error) throw error
  return data as SharePublicData | null
}
