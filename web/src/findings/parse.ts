import type {
  Box,
  Finding,
  ReadResponse,
  Refusal,
  Wording,
} from './types.ts'

const SIDES = ['left', 'right', '']
const CERTAINTIES = ['certain', 'uncertain']
const STATUSES = [
  'placed',
  'outside_coverage',
  'side_not_stated',
  'bone_not_stated',
]
const REFUSALS = ['not_pdf', 'too_large', 'too_many_pages', 'no_text']

const FINDING_FIELDS = [
  'bone',
  'certainty',
  'entered_by_patient',
  'healing_words',
  'part',
  'side',
  'status',
  'type_words',
  'wording',
]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function hasOnly(value: Record<string, unknown>, fields: string[]): boolean {
  return (
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify(fields.sort())
  )
}

function isBox(value: unknown): value is Box {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((item) => typeof item === 'number')
  )
}

function isWording(value: unknown): value is Wording {
  if (!isObject(value) || typeof value.text !== 'string') return false
  if (hasOnly(value, ['boxes', 'page', 'text'])) {
    return (
      typeof value.page === 'number' &&
      Array.isArray(value.boxes) &&
      value.boxes.length > 0 &&
      value.boxes.every(isBox)
    )
  }
  return (
    hasOnly(value, ['end', 'start', 'text']) &&
    typeof value.start === 'number' &&
    typeof value.end === 'number'
  )
}

function isFinding(value: unknown): value is Finding {
  return (
    isObject(value) &&
    hasOnly(value, [...FINDING_FIELDS]) &&
    typeof value.bone === 'string' &&
    SIDES.includes(value.side as string) &&
    isStringList(value.part) &&
    isStringList(value.type_words) &&
    CERTAINTIES.includes(value.certainty as string) &&
    isStringList(value.healing_words) &&
    STATUSES.includes(value.status as string) &&
    Array.isArray(value.wording) &&
    value.wording.every(isWording) &&
    typeof value.entered_by_patient === 'boolean'
  )
}

/** Check a reader response, so a bad one never reaches the model. */
export function parseReadResponse(value: unknown): ReadResponse {
  if (
    !isObject(value) ||
    typeof value.text !== 'string' ||
    !(value.exam_date === null || typeof value.exam_date === 'string') ||
    !isStringList(value.candidate_dates) ||
    !Array.isArray(value.findings) ||
    !value.findings.every(isFinding)
  ) {
    throw new Error('The reader sent a response in the wrong format.')
  }
  return value as unknown as ReadResponse
}

export function isRefusal(value: unknown): value is Refusal {
  return (
    isObject(value) &&
    REFUSALS.includes(value.refusal as string) &&
    typeof value.message === 'string'
  )
}
