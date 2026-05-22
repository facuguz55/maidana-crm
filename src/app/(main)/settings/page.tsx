import { createClient } from '@/lib/supabase/server'
import SettingsClient from '@/components/SettingsClient'
import type { Settings } from '@/lib/types'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()

  return <SettingsClient settings={settings as Settings | null} />
}
