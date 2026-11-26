// Where each screen lives. The screens are the six in Plan Appendix A, the
// Account page that their header links to, and the page a share link opens.
export const paths = {
  home: '/', // A.1
  signIn: '/sign-in', // A.2
  createAccount: '/create-account', // A.2
  resetPassword: '/reset-password', // A.2
  addReport: '/add-report', // A.3
  verifyFindings: '/verify-findings', // A.4
  report: '/reports/:reportId', // A.5
  changeReport: '/reports/:reportId/change',
  reports: '/reports', // A.6
  account: '/account',
  shared: '/s/:token', // S10.3
} as const

export function reportPath(reportId: string) {
  return `/reports/${encodeURIComponent(reportId)}`
}

export function changeReportPath(reportId: string) {
  return `${reportPath(reportId)}/change`
}
