import { createClient } from '@/lib/supabase/server'
import ChatClient from '@/components/ChatClient'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: messages } = await supabase
    .from('chat_messages')
    .select('id, role, content, created_at')
    .order('created_at', { ascending: true })
    .limit(60)

  return <ChatClient initialMessages={messages ?? []} />
}
