import { lazy, Suspense } from 'react'
import styles from './ReportScreen.module.css'

// The 3D code is large, so only this screen loads it.
const SkeletonViewer = lazy(() => import('../viewer/SkeletonViewer.tsx'))

// The split view (Plan A.5). For now it has the model half.
function ReportScreen() {
  return (
    <main className={styles.screen}>
      <h1>Your report and skeleton</h1>
      <Suspense fallback={<p>Loading the skeleton…</p>}>
        <SkeletonViewer />
      </Suspense>
    </main>
  )
}

export default ReportScreen
