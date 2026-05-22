import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import ContactDetailClient from '@/components/ContactDetailClient'
import type { Contact, Order, Message } from '@/lib/types'

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: contact }, { data: order }, { data: messages }] = await Promise.all([
    supabase.from('contacts').select('*').eq('id', id).single(),
    supabase.from('orders').select('*').eq('contact_id', id).order('created_at', { ascending: false }).limit(1).single(),
    supabase.from('messages').select('*').eq('contact_id', id).order('timestamp', { ascending: true }).limit(100),
  ])

  if (!contact) notFound()

  return (
    <ContactDetailClient
      contact={contact as Contact}
      order={order as Order | null}
      initialMessages={(messages ?? []) as Message[]}
    />
  )
}
