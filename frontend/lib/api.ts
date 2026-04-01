import axios from 'axios'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | 'valid'
  | 'invalid'
  | 'duplicate'
  | 'pending'
  | 'processing'
  | 'approved'
  | 'rejected'

export interface Invoice {
  id: string
  invoice_number: string
  vendor: string
  vendor_id: string
  date: string
  amount: number
  currency: string
  status: InvoiceStatus
  po_number?: string
  ai_summary?: string
  risk_score?: number
  errors?: ValidationError[]
  created_at: string
  updated_at: string
}

export interface ValidationError {
  code: string
  field: string
  message: string
  severity: 'error' | 'warning' | 'info'
  suggestion?: string
}

export interface DashboardStats {
  total_invoices: number
  valid: number
  invalid: number
  duplicates: number
  pending_approval: number
  approved_today: number
  processing: number
}

export interface ActivityItem {
  id: string
  type: 'uploaded' | 'approved' | 'rejected' | 'flagged' | 'email_sent'
  invoice_number: string
  vendor: string
  message: string
  timestamp: string
  user?: string
}

export interface Vendor {
  id: string
  name: string
  email: string
  total_invoices: number
  invalid_count: number
  error_rate: number
  last_invoice_date: string
  errors_by_type: Record<string, number>
}

export interface EmailLog {
  id: string
  vendor: string
  vendor_email: string
  invoice_number: string
  sent_at: string
  subject: string
  status: 'sent' | 'failed' | 'bounced'
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

export const MOCK_STATS: DashboardStats = {
  total_invoices: 1247,
  valid: 893,
  invalid: 184,
  duplicates: 67,
  pending_approval: 103,
  approved_today: 28,
  processing: 12,
}

export const MOCK_INVOICES: Invoice[] = [
  {
    id: '1',
    invoice_number: 'INV-2026-001',
    vendor: 'AstraZeneca Supplies',
    vendor_id: 'v1',
    date: '2026-03-28',
    amount: 142500.0,
    currency: 'USD',
    status: 'valid',
    po_number: 'PO-8821',
    ai_summary: 'Invoice matches PO within tolerance. All line items verified.',
    risk_score: 12,
    errors: [],
    created_at: '2026-03-28T09:15:00Z',
    updated_at: '2026-03-28T09:20:00Z',
  },
  {
    id: '2',
    invoice_number: 'INV-2026-002',
    vendor: 'Pfizer Distribution',
    vendor_id: 'v2',
    date: '2026-03-27',
    amount: 87320.5,
    currency: 'USD',
    status: 'invalid',
    po_number: 'PO-8754',
    ai_summary: 'Price mismatch detected on 3 line items. Total discrepancy: $4,250.',
    risk_score: 78,
    errors: [
      {
        code: 'PRICE_MISMATCH',
        field: 'unit_price',
        message: 'Unit price for SKU-4421 does not match PO ($45.00 vs $39.50)',
        severity: 'error',
        suggestion: 'Verify pricing agreement with vendor or raise price dispute.',
      },
      {
        code: 'PRICE_MISMATCH',
        field: 'unit_price',
        message: 'Unit price for SKU-4422 does not match PO ($12.00 vs $10.75)',
        severity: 'error',
        suggestion: 'Contact vendor for revised invoice.',
      },
      {
        code: 'TAX_CALCULATION',
        field: 'tax_amount',
        message: 'Tax calculation appears incorrect (expected $8,732.05, got $9,150.00)',
        severity: 'warning',
        suggestion: 'Verify applicable tax rate with finance team.',
      },
    ],
    created_at: '2026-03-27T14:30:00Z',
    updated_at: '2026-03-27T14:35:00Z',
  },
  {
    id: '3',
    invoice_number: 'INV-2026-003',
    vendor: 'Novartis AG',
    vendor_id: 'v3',
    date: '2026-03-26',
    amount: 56000.0,
    currency: 'USD',
    status: 'duplicate',
    po_number: 'PO-8699',
    ai_summary: 'Duplicate of INV-2026-001. Same vendor, amount, and PO number submitted twice.',
    risk_score: 95,
    errors: [
      {
        code: 'DUPLICATE_INVOICE',
        field: 'invoice_number',
        message: 'Exact duplicate of INV-2025-987 submitted on 2026-03-10',
        severity: 'error',
        suggestion: 'Reject and notify vendor. Previous invoice already processed.',
      },
    ],
    created_at: '2026-03-26T11:00:00Z',
    updated_at: '2026-03-26T11:05:00Z',
  },
  {
    id: '4',
    invoice_number: 'INV-2026-004',
    vendor: 'Roche Diagnostics',
    vendor_id: 'v4',
    date: '2026-03-25',
    amount: 234100.75,
    currency: 'USD',
    status: 'pending',
    po_number: 'PO-8800',
    ai_summary: 'All validations passed. Awaiting manager approval.',
    risk_score: 8,
    errors: [],
    created_at: '2026-03-25T16:45:00Z',
    updated_at: '2026-03-25T16:50:00Z',
  },
  {
    id: '5',
    invoice_number: 'INV-2026-005',
    vendor: 'Johnson & Johnson',
    vendor_id: 'v5',
    date: '2026-03-24',
    amount: 19875.0,
    currency: 'USD',
    status: 'processing',
    po_number: 'PO-8790',
    ai_summary: 'AI validation in progress...',
    risk_score: 0,
    errors: [],
    created_at: '2026-03-24T08:00:00Z',
    updated_at: '2026-03-24T08:01:00Z',
  },
  {
    id: '6',
    invoice_number: 'INV-2026-006',
    vendor: 'Merck KGaA',
    vendor_id: 'v6',
    date: '2026-03-23',
    amount: 312000.0,
    currency: 'USD',
    status: 'approved',
    po_number: 'PO-8710',
    ai_summary: 'Invoice approved by Manager Sarah Chen on 2026-03-24.',
    risk_score: 5,
    errors: [],
    created_at: '2026-03-23T13:20:00Z',
    updated_at: '2026-03-24T10:00:00Z',
  },
  {
    id: '7',
    invoice_number: 'INV-2026-007',
    vendor: 'Abbott Laboratories',
    vendor_id: 'v7',
    date: '2026-03-22',
    amount: 68450.0,
    currency: 'USD',
    status: 'invalid',
    po_number: 'PO-8680',
    ai_summary: 'PO number not found in system. Possible data entry error.',
    risk_score: 85,
    errors: [
      {
        code: 'PO_MISMATCH',
        field: 'po_number',
        message: 'PO-8680 not found in procurement system',
        severity: 'error',
        suggestion: 'Verify PO number with procurement department before processing.',
      },
      {
        code: 'MISSING_FIELD',
        field: 'line_items',
        message: 'Line item descriptions are missing for 5 of 8 items',
        severity: 'warning',
        suggestion: 'Request complete itemized invoice from vendor.',
      },
    ],
    created_at: '2026-03-22T09:30:00Z',
    updated_at: '2026-03-22T09:35:00Z',
  },
  {
    id: '8',
    invoice_number: 'INV-2026-008',
    vendor: 'Baxter International',
    vendor_id: 'v8',
    date: '2026-03-21',
    amount: 145200.0,
    currency: 'USD',
    status: 'valid',
    po_number: 'PO-8651',
    ai_summary: 'Invoice validated successfully. No discrepancies detected.',
    risk_score: 7,
    errors: [],
    created_at: '2026-03-21T15:10:00Z',
    updated_at: '2026-03-21T15:15:00Z',
  },
  {
    id: '9',
    invoice_number: 'INV-2026-009',
    vendor: 'AstraZeneca Supplies',
    vendor_id: 'v1',
    date: '2026-03-20',
    amount: 92750.0,
    currency: 'USD',
    status: 'rejected',
    po_number: 'PO-8620',
    ai_summary: 'Rejected due to expired contract pricing. Vendor notified.',
    risk_score: 72,
    errors: [
      {
        code: 'EXPIRED_CONTRACT',
        field: 'pricing',
        message: 'Pricing based on contract expired 2026-02-28',
        severity: 'error',
        suggestion: 'Request updated invoice with current contract pricing.',
      },
    ],
    created_at: '2026-03-20T10:45:00Z',
    updated_at: '2026-03-20T11:30:00Z',
  },
  {
    id: '10',
    invoice_number: 'INV-2026-010',
    vendor: 'Becton Dickinson',
    vendor_id: 'v9',
    date: '2026-03-19',
    amount: 27300.0,
    currency: 'USD',
    status: 'pending',
    po_number: 'PO-8600',
    ai_summary: 'Validated and awaiting approval. Minor rounding difference noted.',
    risk_score: 18,
    errors: [],
    created_at: '2026-03-19T12:00:00Z',
    updated_at: '2026-03-19T12:05:00Z',
  },
]

export const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: 'a1',
    type: 'uploaded',
    invoice_number: 'INV-2026-010',
    vendor: 'Becton Dickinson',
    message: 'New invoice uploaded and queued for AI validation',
    timestamp: '2026-03-31T08:42:00Z',
  },
  {
    id: 'a2',
    type: 'approved',
    invoice_number: 'INV-2026-006',
    vendor: 'Merck KGaA',
    message: 'Invoice approved by Manager Sarah Chen',
    timestamp: '2026-03-31T08:30:00Z',
    user: 'Sarah Chen',
  },
  {
    id: 'a3',
    type: 'flagged',
    invoice_number: 'INV-2026-007',
    vendor: 'Abbott Laboratories',
    message: 'Invoice flagged: PO number not found in system',
    timestamp: '2026-03-31T08:15:00Z',
  },
  {
    id: 'a4',
    type: 'email_sent',
    invoice_number: 'INV-2026-003',
    vendor: 'Novartis AG',
    message: 'Rejection email sent for duplicate invoice',
    timestamp: '2026-03-31T08:00:00Z',
  },
  {
    id: 'a5',
    type: 'rejected',
    invoice_number: 'INV-2026-009',
    vendor: 'AstraZeneca Supplies',
    message: 'Invoice rejected: expired contract pricing',
    timestamp: '2026-03-30T17:45:00Z',
    user: 'James Wilson',
  },
  {
    id: 'a6',
    type: 'uploaded',
    invoice_number: 'INV-2026-005',
    vendor: 'Johnson & Johnson',
    message: 'Invoice uploaded — AI processing initiated',
    timestamp: '2026-03-30T16:20:00Z',
  },
]

export const MOCK_VENDORS: Vendor[] = [
  {
    id: 'v1',
    name: 'AstraZeneca Supplies',
    email: 'accounts@astrazeneca-supplies.com',
    total_invoices: 84,
    invalid_count: 12,
    error_rate: 14.3,
    last_invoice_date: '2026-03-28',
    errors_by_type: {
      PRICE_MISMATCH: 5,
      EXPIRED_CONTRACT: 4,
      MISSING_FIELD: 3,
    },
  },
  {
    id: 'v2',
    name: 'Pfizer Distribution',
    email: 'billing@pfizer-dist.com',
    total_invoices: 126,
    invalid_count: 18,
    error_rate: 14.3,
    last_invoice_date: '2026-03-27',
    errors_by_type: {
      PRICE_MISMATCH: 11,
      TAX_CALCULATION: 4,
      DUPLICATE_INVOICE: 3,
    },
  },
  {
    id: 'v3',
    name: 'Novartis AG',
    email: 'invoices@novartis.com',
    total_invoices: 92,
    invalid_count: 9,
    error_rate: 9.8,
    last_invoice_date: '2026-03-26',
    errors_by_type: {
      DUPLICATE_INVOICE: 6,
      MISSING_FIELD: 3,
    },
  },
  {
    id: 'v4',
    name: 'Roche Diagnostics',
    email: 'ap@roche-diagnostics.com',
    total_invoices: 153,
    invalid_count: 7,
    error_rate: 4.6,
    last_invoice_date: '2026-03-25',
    errors_by_type: {
      PO_MISMATCH: 4,
      TAX_CALCULATION: 3,
    },
  },
  {
    id: 'v5',
    name: 'Johnson & Johnson',
    email: 'vendor-billing@jnj.com',
    total_invoices: 178,
    invalid_count: 14,
    error_rate: 7.9,
    last_invoice_date: '2026-03-24',
    errors_by_type: {
      PRICE_MISMATCH: 8,
      PO_MISMATCH: 3,
      MISSING_FIELD: 3,
    },
  },
  {
    id: 'v7',
    name: 'Abbott Laboratories',
    email: 'accounts@abbott.com',
    total_invoices: 67,
    invalid_count: 19,
    error_rate: 28.4,
    last_invoice_date: '2026-03-22',
    errors_by_type: {
      PO_MISMATCH: 10,
      MISSING_FIELD: 6,
      PRICE_MISMATCH: 3,
    },
  },
]

export const MOCK_EMAIL_LOGS: EmailLog[] = [
  {
    id: 'e1',
    vendor: 'Novartis AG',
    vendor_email: 'invoices@novartis.com',
    invoice_number: 'INV-2026-003',
    sent_at: '2026-03-31T08:01:00Z',
    subject: 'Invoice Rejection: INV-2026-003 — Duplicate Submission',
    status: 'sent',
  },
  {
    id: 'e2',
    vendor: 'AstraZeneca Supplies',
    vendor_email: 'accounts@astrazeneca-supplies.com',
    invoice_number: 'INV-2026-009',
    sent_at: '2026-03-30T17:46:00Z',
    subject: 'Invoice Rejection: INV-2026-009 — Expired Contract Pricing',
    status: 'sent',
  },
  {
    id: 'e3',
    vendor: 'Abbott Laboratories',
    vendor_email: 'accounts@abbott.com',
    invoice_number: 'INV-2026-007',
    sent_at: '2026-03-29T14:20:00Z',
    subject: 'Invoice Flagged: INV-2026-007 — PO Number Not Found',
    status: 'sent',
  },
  {
    id: 'e4',
    vendor: 'Pfizer Distribution',
    vendor_email: 'billing@pfizer-dist.com',
    invoice_number: 'INV-2026-002',
    sent_at: '2026-03-28T11:00:00Z',
    subject: 'Invoice Correction Required: INV-2026-002 — Price Mismatch',
    status: 'sent',
  },
  {
    id: 'e5',
    vendor: 'Pfizer Distribution',
    vendor_email: 'billing@pfizer-dist.com',
    invoice_number: 'INV-2026-011',
    sent_at: '2026-03-27T09:30:00Z',
    subject: 'Invoice Rejection: INV-2026-011 — Tax Calculation Error',
    status: 'failed',
  },
]

// ─── API Functions ────────────────────────────────────────────────────────────

async function safeGet<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await apiClient.get<T>(url)
    return res.data
  } catch {
    return fallback
  }
}

export async function getStats(): Promise<DashboardStats> {
  return safeGet('/dashboard/stats', MOCK_STATS)
}

export async function getRecentActivity(): Promise<ActivityItem[]> {
  return safeGet('/dashboard/activity', MOCK_ACTIVITY)
}

export async function getInvoices(params?: {
  status?: string
  vendor?: string
  page?: number
  limit?: number
  date_from?: string
  date_to?: string
  amount_min?: number
  amount_max?: number
}): Promise<{ invoices: Invoice[]; total: number }> {
  try {
    const res = await apiClient.get('/invoices', { params })
    return res.data
  } catch {
    let filtered = [...MOCK_INVOICES]
    if (params?.status && params.status !== 'all') {
      filtered = filtered.filter((i) => i.status === params.status)
    }
    if (params?.vendor) {
      filtered = filtered.filter((i) =>
        i.vendor.toLowerCase().includes(params.vendor!.toLowerCase())
      )
    }
    return { invoices: filtered, total: filtered.length }
  }
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  try {
    const res = await apiClient.get(`/invoices/${id}`)
    return res.data
  } catch {
    return MOCK_INVOICES.find((i) => i.id === id) || null
  }
}

export async function uploadInvoice(file: File): Promise<Invoice> {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await apiClient.post('/invoices/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  } catch {
    // Mock response for demo
    await new Promise((r) => setTimeout(r, 1500))
    return {
      id: `mock-${Date.now()}`,
      invoice_number: `INV-2026-${Math.floor(Math.random() * 900 + 100)}`,
      vendor: 'Demo Vendor',
      vendor_id: 'v0',
      date: new Date().toISOString().split('T')[0],
      amount: Math.random() * 100000 + 10000,
      currency: 'USD',
      status: Math.random() > 0.5 ? 'valid' : 'invalid',
      risk_score: Math.floor(Math.random() * 100),
      errors: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }
}

export async function approveInvoice(id: string): Promise<void> {
  try {
    await apiClient.put(`/invoices/${id}/approve`)
  } catch {
    // Mock: silently succeed
    await new Promise((r) => setTimeout(r, 500))
  }
}

export async function rejectInvoice(id: string, reason: string): Promise<void> {
  try {
    await apiClient.put(`/invoices/${id}/reject`, { reason })
  } catch {
    await new Promise((r) => setTimeout(r, 500))
  }
}

export async function getVendors(): Promise<Vendor[]> {
  return safeGet('/vendors', MOCK_VENDORS)
}

export async function getEmailLogs(): Promise<EmailLog[]> {
  return safeGet('/email-logs', MOCK_EMAIL_LOGS)
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
