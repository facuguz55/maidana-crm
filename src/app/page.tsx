import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/DashboardClient'
import type { Contact } from '@/lib/types'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .order('last_message_at', { ascending: false })

  return <DashboardClient initialContacts={(contacts ?? []) as Contact[]} />
}
