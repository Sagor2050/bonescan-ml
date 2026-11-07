import AccountScreen from './account/AccountScreen.tsx'
import AddReportScreen from './add-report/AddReportScreen.tsx'
import VerifyFindingsScreen from './add-report/VerifyFindingsScreen.tsx'
import HomePage from './pages/HomePage.tsx'
import RegisterPage from './pages/RegisterPage.tsx'
import ResetPasswordPage from './pages/ResetPasswordPage.tsx'
import SignInPage from './pages/SignInPage.tsx'
import NotFoundScreen from './routing/NotFoundScreen.tsx'
import { paths } from './routing/paths.ts'
import Routes, { type Route } from './routing/Routes.tsx'
import ChangeReportScreen from './workspace/ChangeReportScreen.tsx'
import ReportScreen from './workspace/ReportScreen.tsx'
import TimelineScreen from './timeline/TimelineScreen.tsx'
import WorkspaceController from './workspace/WorkspaceController.tsx'
import WorkspaceLayout from './workspace/WorkspaceLayout.tsx'

const routes: Route[] = [
  { path: paths.home, render: () => <HomePage /> },
  {
    path: paths.signIn,
    render: () => <SignInPage />,
  },
  {
    path: paths.createAccount,
    render: () => <RegisterPage />,
  },
  {
    path: paths.resetPassword,
    render: () => <ResetPasswordPage />,
  },
  {
    path: paths.addReport,
    render: () => (
      <WorkspaceLayout>
        <AddReportScreen />
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
    path: paths.changeReport,
    render: ({ reportId }) => (
      <WorkspaceLayout>
        <ChangeReportScreen reportId={reportId} />
      </WorkspaceLayout>
    ),
  },
  {
    path: paths.reports,
    render: () => (
      <WorkspaceLayout>
        <TimelineScreen />
      </WorkspaceLayout>
    ),
  },
  {
    path: paths.account,
    render: () => (
      <WorkspaceLayout>
        <AccountScreen />
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
