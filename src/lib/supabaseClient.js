import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://xxjovqoixtlgjjjnbuoe.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4am92cW9peHRsZ2pqam5idW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMzgxNDMsImV4cCI6MjA3OTgxNDE0M30.vW8t4jHtX8RKkZi1qLEbABF2AV9qchK3gzROPh4S7r0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 2 } },
})

