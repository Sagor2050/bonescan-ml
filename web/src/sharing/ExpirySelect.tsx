import styles from './Sharing.module.css'
import {
  EXPIRY_CHOICES,
  expiryLabel,
  expiryValue,
  parseExpiry,
  type ExpiryDays,
} from './shareLinks.ts'

function ExpirySelect({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: {
  id: string
  label: string
  value: ExpiryDays
  onChange: (days: ExpiryDays) => void
  disabled?: boolean
}) {
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={expiryValue(value)}
        disabled={disabled}
        onChange={(event) => onChange(parseExpiry(event.target.value))}
      >
        {EXPIRY_CHOICES.map((days) => (
          <option key={expiryValue(days)} value={expiryValue(days)}>
            {expiryLabel(days)}
          </option>
        ))}
      </select>
    </div>
  )
}

export default ExpirySelect
