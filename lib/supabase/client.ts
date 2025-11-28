import { createBrowserClient } from '@supabase/ssr'

// Lazy initialization to avoid build-time errors when env vars aren't available
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

export const getSupabase = () => {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
      throw new Error('Supabase URL and Anon Key are required. Check your environment variables.')
    }

    supabaseInstance = createBrowserClient(url, key)
  }
  return supabaseInstance
}

// For backwards compatibility - creates client on first access
export const supabase = typeof window !== 'undefined'
  ? createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
  : (null as unknown as ReturnType<typeof createBrowserClient>)