import HomePage from './pages/HomePage.tsx'
import NotFoundScreen from './routing/NotFoundScreen.tsx'
import { paths, reportPath } from './routing/paths.ts'
import PlaceholderScreen from './routing/PlaceholderScreen.tsx'
import Routes, { type Route } from './routing/Routes.tsx'
import WorkspaceController from './workspace/WorkspaceController.tsx'
import WorkspaceLayout from './workspace/WorkspaceLayout.tsx'

// Stands in for a real report until reports can be saved (Milestone 4).
const sampleReportPath = reportPath('sample')

const routes: Route[] = [
  { path: paths.home, render: () => <HomePage /> },
  {
    path: paths.signIn,
    render: () => (
      <PlaceholderScreen
        title="Sign in"
        links={[
          { href: paths.reports, label: 'Go to my reports' },
          { href: paths.createAccount, label: 'Create account' },
        ]}
      />
    ),
  },
  {
    path: paths.createAccount,
    render: () => (
      <PlaceholderScreen
        title="Create account"
        links={[{ href: paths.signIn, label: 'Sign in' }]}
      />
    ),
  },
  {
    path: paths.addReport,
    render: () => (
      <WorkspaceLayout>
        <PlaceholderScreen
          title="Add a report"
          links={[{ href: paths.verifyFindings, label: 'Check the findings' }]}
        />
      </WorkspaceLayout>
    ),
  },
  {
    path: paths.verifyFindings,
    render: () => (
      <WorkspaceLayout>
        <PlaceholderScreen
          title="Check the findings"
          links={[{ href: sampleReportPath, label: 'See it on the skeleton' }]}
        />
      </WorkspaceLayout>
    ),
  },
  {
    path: paths.report,
    render: () => (
      <WorkspaceLayout>
        <PlaceholderScreen title="Your report and skeleton" />
      </WorkspaceLayout>
    ),
  },
  {
    path: paths.reports,
    render: () => (
      <WorkspaceLayout>
        <PlaceholderScreen
          title="My reports"
          links={[{ href: paths.addReport, label: 'Add a report' }]}
        />
      </WorkspaceLayout>
    ),
  },
  {
    path: paths.account,
    render: () => (
      <WorkspaceLayout>
        <PlaceholderScreen title="Account" />
      </WorkspaceLayout>
    ),
  },
]

function App() {
  return (
    <WorkspaceController>
      <Routes routes={routes} notFound={<NotFoundScreen />} />
    </WorkspaceController>
  )
}

export default App
