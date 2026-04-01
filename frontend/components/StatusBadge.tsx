'use client'

import { InvoiceStatus } from '@/lib/api'
import clsx from 'clsx'

interface StatusBadgeProps {
  status: InvoiceStatus
  size?: 'sm' | 'md'
}

const STATUS_CONFIG: Record<
  InvoiceStatus,
  { label: string; className: string; dot: string }
> = {
  valid: {
    label: 'Valid',
    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    dot: 'bg-emerald-500',
  },
  invalid: {
    label: 'Invalid',
    className: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    dot: 'bg-red-500',
  },
  duplicate: {
    label: 'Duplicate',
    className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    dot: 'bg-amber-500',
  },
  pending: {
    label: 'Pending',
    className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    dot: 'bg-blue-500',
  },
  processing: {
    label: 'Processing',
    className: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
    dot: 'bg-gray-400',
  },
  approved: {
    label: 'Approved',
    className: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
    dot: 'bg-teal-500',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    dot: 'bg-rose-500',
  },
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.processing

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        config.className,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      )}
    >
      <span className={clsx('rounded-full flex-shrink-0', config.dot, size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
      {config.label}
    </span>
  )
}
