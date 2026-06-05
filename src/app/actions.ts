'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateOrderStatus(orderId: string, status: 'pendiente' | 'verificado' | 'enviado') {
  const supabase = await createClient()
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
  if (error) throw error
  revalidatePath('/ventas')
}

export async function saveSettings(data: {
  google_sheets_id: string
  sheet_name: string
  google_api_key: string
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('settings')
    .upsert({ id: 1, ...data })
  if (error) throw error
  revalidatePath('/settings')
}
