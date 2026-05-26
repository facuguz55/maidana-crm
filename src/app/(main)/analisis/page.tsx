import { createClient } from '@/lib/supabase/server'
import AnalisisClient from '@/components/AnalisisClient'
import type { ProductCost } from '@/lib/types'

export default async function AnalisisPage() {
  const supabase = await createClient()
  const { data: costs } = await supabase
    .from('product_costs_maidana')
    .select('*')
    .order('product')

  return <AnalisisClient initialCosts={(costs ?? []) as ProductCost[]} />
}
