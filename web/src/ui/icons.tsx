import type { ReactNode } from 'react'

// Small line icons, drawn here so the app needs no icon package. Each one sits
// beside words or has a label on its button, so it's never the only signal.
function Icon({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flex: 'none' }}
    >
      {children}
    </svg>
  )
}

export function PlusIcon() {
  return (
    <Icon>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function MinusIcon() {
  return (
    <Icon>
      <path d="M5 12h14" />
    </Icon>
  )
}

export function ResetViewIcon() {
  return (
    <Icon>
      <path d="M4 12a8 8 0 1 0 2.6-5.9L4 8.5" />
      <path d="M4 4v4.5h4.5" />
    </Icon>
  )
}

export function ChevronLeftIcon() {
  return (
    <Icon size={16}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  )
}

export function ChevronRightIcon() {
  return (
    <Icon size={16}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  )
}

export function CheckIcon() {
  return (
    <Icon>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </Icon>
  )
}

export function CrossIcon() {
  return (
    <Icon>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  )
}

export function UploadIcon() {
  return (
    <Icon size={28}>
      <path d="M12 16V5M7.5 9.5 12 5l4.5 4.5" />
      <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" />
    </Icon>
  )
}

export function InfoIcon() {
  return (
    <Icon size={16}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </Icon>
  )
}
