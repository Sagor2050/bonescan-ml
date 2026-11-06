// An exam date as the patient reads it, such as "Sep 14, 2026". The date is a
// plain calendar day, so it is shown in UTC to stop time zones moving it.
export function formatExamDate(examDate: string) {
  return new Date(`${examDate}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
