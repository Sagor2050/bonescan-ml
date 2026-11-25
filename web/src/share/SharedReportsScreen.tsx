import { Suspense, useEffect, useState } from 'react'
import { paths } from '../routing/paths.ts'
import { Timeline } from '../timeline/TimelineScreen.tsx'
import timelineStyles from '../timeline/TimelineScreen.module.css'
import TopBar from '../ui/TopBar.tsx'
import { formatExamDate } from '../workspace/examDate.ts'
import { ReadOnlyContext } from '../workspace/readOnly.ts'
import type { SavedReport } from '../workspace/reportStore.ts'
import { ReportWorkspace } from '../workspace/ReportScreen.tsx'
import reportStyles from '../workspace/ReportScreen.module.css'
import UnconfirmedBadge from '../workspace/UnconfirmedBadge.tsx'
import WorkspaceController from '../workspace/WorkspaceController.tsx'
import LinkUnavailableScreen from './LinkUnavailableScreen.tsx'
import styles from './SharedReportsScreen.module.css'
import { useSharedReports } from './useSharedReports.ts'

// The server sends X-Robots-Tag and Referrer-Policy too (web/vercel.json). These
// cover a browser that only reads the page itself.
const HEAD_TAGS = [
  { name: 'robots', content: 'noindex, nofollow' },
  { name: 'referrer', content: 'no-referrer' },
]

function useShareLinkHead() {
  useEffect(() => {
    const tags = HEAD_TAGS.map(({ name, content }) => {
      const tag = document.createElement('meta')
      tag.name = name
      tag.content = content
      document.head.append(tag)
      return tag
    })
    return () => tags.forEach((tag) => tag.remove())
  }, [])
}

function SharedReport({
  report,
  onBack,
}: {
  report: SavedReport
  onBack: () => void
}) {
  return (
    <main className={reportStyles.screen}>
      <div className={reportStyles.heading}>
        <div className={reportStyles.title}>
          <button type="button" className={styles.back} onClick={onBack}>
            ← All shared reports
          </button>
          <div className={reportStyles.titleLine}>
            <h1>Shared report and skeleton</h1>
            <p className={reportStyles.examDate}>
              Exam date: {formatExamDate(report.exam_date)}
              <UnconfirmedBadge report={report} />
            </p>
          </div>
        </div>
      </div>
      <Suspense
        fallback={<p className="page-message">Loading the skeleton…</p>}
      >
        <ReportWorkspace key={report.id} report={report} />
      </Suspense>
    </main>
  )
}

function SharedTimeline({ reports }: { reports: SavedReport[] }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = reports.find((report) => report.id === openId)
  if (open) return <SharedReport report={open} onBack={() => setOpenId(null)} />

  const heading = (
    <div className={styles.heading}>
      <h1 className={timelineStyles.title}>Shared reports</h1>
      <p>
        Someone shared these reports with you. You can look at them, but not
        change them.
      </p>
    </div>
  )
  return (
    <main className={timelineStyles.screen}>
      <Suspense
        fallback={
          <>
            {heading}
            <p className="page-message">Loading the skeleton…</p>
          </>
        }
      >
        <Timeline reports={reports} heading={heading} onOpenReport={setOpenId} />
      </Suspense>
    </main>
  )
}

// What a share link opens (S10.3). It needs no account and ignores any sign-in,
// so everyone with the link sees the same thing. Nothing here can add, change,
// delete, confirm, or share a report, and it shows nothing about the patient
// beyond the shared reports.
function SharedReportsScreen({ token }: { token: string }) {
  useShareLinkHead()
  const shared = useSharedReports(token)

  if (shared.status === 'unavailable') return <LinkUnavailableScreen />

  return (
    <ReadOnlyContext.Provider value={true}>
      {/* Its own controller, so nothing chosen on the patient's own screens
          carries over to the shared ones. */}
      <WorkspaceController>
        <TopBar brandHref={paths.home} />
        {shared.status === 'ready' ? (
          <SharedTimeline reports={shared.reports} />
        ) : (
          <main className={timelineStyles.screen}>
            <p className="page-message">
              {shared.status === 'loading'
                ? 'Loading the shared reports…'
                : "We couldn't load these reports. Please try again."}
            </p>
          </main>
        )}
      </WorkspaceController>
    </ReadOnlyContext.Provider>
  )
}

export default SharedReportsScreen
