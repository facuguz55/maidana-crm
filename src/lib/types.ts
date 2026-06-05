export type ContactStatus = 'nuevo' | 'frio' | 'caliente' | 'verificar_pago' | 'pagado'
export type OrderStatus = 'pagado' | 'preparando' | 'enviado'

export interface Contact {
  id: string
  phone: string
  name: string | null
  status: ContactStatus
  scheduled: boolean
  first_contact_at: string
  last_message_at: string
  last_message_preview: string | null
  notes: string | null
  created_at: string
}

export interface Order {
  id: string
  contact_id: string | null
  name: string
  phone: string
  address: string
  quantity: number
  status: OrderStatus
  form_timestamp: string | null
  created_at: string
  email?: string | null
  product?: string | null
  postal_code?: string | null
  extra_data?: string | null
  sale_price?: number | null
  unit_cost_override?: number | null
}

export interface ProductCost {
  id: number
  product: string
  cost_per_unit: number
  shipping_cost_per_order: number
  updated_at: string
}

export interface AnalysisResult {
  resumen: string
  total_ingresos: number
  total_costos: number
  total_ganancia: number
  margen_porcentaje: number
  producto_mas_rentable: string
  cliente_mas_grande: { nombre: string; cantidad: number; ganancia: number }
  alertas: string[]
  recomendaciones: string[]
}

export interface Message {
  id: string
  contact_id: string
  body: string
  direction: 'inbound' | 'outbound'
  timestamp: string
  wamid?: string | null
  media_type?: 'image' | 'audio' | 'video' | 'document' | 'sticker' | null
  media_url?: string | null
}

export interface Settings {
  id: number
  google_sheets_id: string
  sheet_name: string
  google_api_key: string
}

export const STATUS_LABELS: Record<ContactStatus, string> = {
  nuevo: 'Nuevo',
  frio: 'Frío',
  caliente: 'Caliente',
  verificar_pago: 'Verificar Pago',
  pagado: 'Pagado',
}

export const STATUS_COLORS: Record<ContactStatus, string> = {
  nuevo: '#3b82f6',
  frio: '#94a3b8',
  caliente: '#f97316',
  verificar_pago: '#f59e0b',
  pagado: '#22c55e',
}
