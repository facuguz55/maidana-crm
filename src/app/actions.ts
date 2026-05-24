'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ContactStatus } from '@/lib/types'

export async function updateContactStatus(contactId: string, status: ContactStatus) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('contacts')
    .update({ status })
    .eq('id', contactId)
  if (error) throw error
  revalidatePath('/')
  revalidatePath(`/contact/${contactId}`)
}

export async function updateContactNotes(contactId: string, notes: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('contacts')
    .update({ notes })
    .eq('id', contactId)
  if (error) throw error
  revalidatePath(`/contact/${contactId}`)
}

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
  evolution_api_url: string
  evolution_api_key: string
  instance_name: string
  google_sheets_id: string
  sheet_name: string
  google_api_key: string
  form_message: string
}) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('settings')
    .upsert({ id: 1, ...data })
  if (error) throw error
  revalidatePath('/settings')
}

export async function updateContactName(contactId: string, name: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('contacts')
    .update({ name: name.trim() || null })
    .eq('id', contactId)
  if (error) throw error
  revalidatePath('/')
  revalidatePath(`/contact/${contactId}`)
}

export async function toggleScheduled(contactId: string, scheduled: boolean) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('contacts')
    .update({ scheduled })
    .eq('id', contactId)
  if (error) throw error
  revalidatePath('/')
  revalidatePath(`/contact/${contactId}`)
}
