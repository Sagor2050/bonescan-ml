import { ChevronLeftIcon, ChevronRightIcon } from '../ui/icons.tsx'
import { useBones } from '../viewer/bones.ts'
import { findingSummary } from './findingSummary.ts'
import styles from './FindingsList.module.css'
import type { SavedFinding } from './reportStore.ts'
import { steppedFinding, useWorkspace } from './workspaceState.ts'

// The report's findings, listed while the model is in view (S3.3). Choosing one
// selects it, and the skeleton follows the selection. Each row stays short until
// it's chosen, so a long report's list can still be taken in at a glance.
function FindingsList({
  findings,
  showHeading = true,
}: {
  findings: SavedFinding[]
  showHeading?: boolean
}) {
  const bones = useBones()
  const { selectedFindingId, selectFinding } = useWorkspace()
  const ids = findings.map((finding) => finding.id)
  const previous = steppedFinding(ids, selectedFindingId, -1)
  const next = steppedFinding(ids, selectedFindingId, 1)
  const selectedIndex = selectedFindingId ? ids.indexOf(selectedFindingId) : -1
  const canStep = findings.length > 1

  return (
    <section className={styles.list} aria-label="Findings">
      {(showHeading || canStep) && (
        <div className={styles.header}>
          {showHeading && <h2>Findings</h2>}
          {canStep && (
            <div className={styles.stepper}>
              <span aria-live="polite">
                {selectedIndex === -1
                  ? `${findings.length} found`
                  : `${selectedIndex + 1} of ${findings.length}`}
              </span>
              <div className={styles.arrows}>
                <button
                  aria-label="Previous"
                  title="Previous"
                  disabled={!previous}
                  onClick={() => previous && selectFinding(previous)}
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  aria-label="Next"
                  title="Next"
                  disabled={!next}
                  onClick={() => next && selectFinding(next)}
                >
                  <ChevronRightIcon />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {findings.length === 0 ? (
        <p className={styles.empty}>This report has no findings to show.</p>
      ) : (
        <ol>
          {findings.map((finding) => {
            const summary = findingSummary(finding, bones)
            const selected = finding.id === selectedFindingId
            const showDetails = selected || findings.length === 1
            return (
              <li key={finding.id}>
                <button
                  className={styles.finding}
                  aria-pressed={selected}
                  onClick={() => selectFinding(finding.id)}
                >
                  {summary.boneName && <strong>{summary.boneName}</strong>}
                  <span className={styles.status}>
                    {summary.noMarkerReason ? (
                      <span className={styles.noMarker} aria-hidden="true">
                        ○
                      </span>
                    ) : (
                      <span
                        className={
                          finding.certainty === 'certain'
                            ? styles.certain
                            : styles.uncertain
                        }
                        aria-hidden="true"
                      >
                        {finding.certainty === 'certain' ? '●' : '◆'}
                      </span>
                    )}{' '}
                    {summary.title}
                    {summary.sideLabel && ` · ${summary.sideLabel}`}
                  </span>
                  {showDetails && summary.parts && (
                    <span className={styles.detail}>
                      Part: {summary.parts}
                    </span>
                  )}
                  {showDetails && summary.reportWords && (
                    <span className={styles.detail}>
                      Report says: {summary.reportWords}
                    </span>
                  )}
                  {summary.healing.map((line) => (
                    <span key={line} className={styles.healing}>
                      {line}
                    </span>
                  ))}
                  {summary.reportSentence && (
                    <span className={styles.detail}>
                      Report says: “{summary.reportSentence}”
                    </span>
                  )}
                  {summary.noMarkerReason && (
                    <em>{summary.noMarkerReason}</em>
                  )}
                  {summary.enteredByPatient && <em>Entered by you</em>}
                </button>
              </li>
            )
          })}
        </ol>
      )}

      <p className={styles.careTeam}>
        Questions about what this means? Ask your care team.
      </p>
    </section>
  )
}

export default FindingsList
