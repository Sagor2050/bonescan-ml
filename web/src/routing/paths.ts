// Where each screen lives. The screens are the six in Plan Appendix A, plus the
// Account page that their header links to.
export const paths = {
  home: '/', // A.1
  signIn: '/sign-in', // A.2
  createAccount: '/create-account', // A.2
  addReport: '/add-report', // A.3
  verifyFindings: '/verify-findings', // A.4
  report: '/reports/:reportId', // A.5
  reports: '/reports', // A.6
  account: '/account',
} as const

export function reportPath(reportId: string) {
  return `/reports/${encodeURIComponent(reportId)}`
}
