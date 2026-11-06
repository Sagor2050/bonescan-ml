import { useBones } from '../viewer/bones.ts'
import { findingSummary } from './findingSummary.ts'
import styles from './FindingsList.module.css'
import type { SavedFinding } from './reportStore.ts'
import { steppedFinding, useWorkspace } from './workspaceState.ts'

// The report's findings, listed while the model is in view (S3.3). Choosing one
// selects it, and the skeleton follows the selection.
function FindingsList({ findings }: { findings: SavedFinding[] }) {
  const bones = useBones()
  const { selectedFindingId, selectFinding } = useWorkspace()
  const ids = findings.map((finding) => finding.id)
  const previous = steppedFinding(ids, selectedFindingId, -1)
  const next = steppedFinding(ids, selectedFindingId, 1)
  const selectedIndex = selectedFindingId ? ids.indexOf(selectedFindingId) : -1

  return (
    <section className={styles.list} aria-label="Findings">
      <h2>Findings</h2>

      {findings.length === 0 ? (
        <p>This report has no findings to show.</p>
      ) : (
        <>
          <div className={styles.stepper}>
            <button
              disabled={!previous}
              onClick={() => previous && selectFinding(previous)}
            >
              Previous
            </button>
            <span aria-live="polite">
              {selectedIndex === -1
                ? `${findings.length} found`
                : `${selectedIndex + 1} of ${findings.length}`}
            </span>
            <button
              disabled={!next}
              onClick={() => next && selectFinding(next)}
            >
              Next
            </button>
          </div>

          <ol>
            {findings.map((finding) => {
              const summary = findingSummary(finding, bones)
              return (
                <li key={finding.id}>
                  <button
                    className={styles.finding}
                    aria-pressed={finding.id === selectedFindingId}
                    onClick={() => selectFinding(finding.id)}
                  >
                    <strong>
                      {summary.noMarkerReason ? (
                        <span
                          className={styles.noMarker}
                          aria-hidden="true"
                        >
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
                    </strong>
                    {summary.boneName && <span>{summary.boneName}</span>}
                    {summary.sideLabel && <span>{summary.sideLabel}</span>}
                    {summary.parts && (
                      <span className={styles.detail}>
                        Part: {summary.parts}
                      </span>
                    )}
                    {summary.reportWords && (
                      <span className={styles.detail}>
                        Report says: {summary.reportWords}
                      </span>
                    )}
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
        </>
      )}

      <p className={styles.careTeam}>
        Questions about what this means? Ask your care team.
      </p>
    </section>
  )
}

export default FindingsList
