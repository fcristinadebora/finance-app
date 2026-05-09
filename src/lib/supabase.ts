import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url) throw new Error('Missing env var: VITE_SUPABASE_URL')
if (!key) throw new Error('Missing env var: VITE_SUPABASE_PUBLISHABLE_KEY')

export const supabase = createClient<Database>(url, key)
