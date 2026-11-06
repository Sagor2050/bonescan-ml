import type { Finding } from '../findings/types.ts'

type Injury = Pick<Finding, 'bone' | 'side'>

// The one place that decides whether findings in two reports are the same
// injury. Until OQ3 is decided, that means same bone and same side. A finding
// with no bone or no side can't be said to match anything. Don't change this
// rule without the team.
export function sameInjury(a: Injury, b: Injury) {
  return a.bone !== '' && a.side !== '' && a.bone === b.bone && a.side === b.side
}
