import VerifyFindingsScreen from './add-report/VerifyFindingsScreen.tsx'
import RegisterPage from './pages/RegisterPage.tsx'
import HomePage from './pages/HomePage.tsx'
import NotFoundScreen from './routing/NotFoundScreen.tsx'
import { paths } from './routing/paths.ts'
import PlaceholderScreen from './routing/PlaceholderScreen.tsx'
import Routes, { type Route } from './routing/Routes.tsx'
import ReportScreen from './workspace/ReportScreen.tsx'
import WorkspaceController from './workspace/WorkspaceController.tsx'
import WorkspaceLayout from './workspace/WorkspaceLayout.tsx'

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
  render: () => <RegisterPage />,
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
        <VerifyFindingsScreen />
      </WorkspaceLayout>
    ),
  },
  {
    path: paths.report,
    render: ({ reportId }) => (
      <WorkspaceLayout>
        <ReportScreen reportId={reportId} />
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
