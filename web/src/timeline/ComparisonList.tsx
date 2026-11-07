import { useBones } from '../viewer/bones.ts'
import type { MarkerSpec } from '../viewer/markers.ts'
import { formatExamDate } from '../workspace/examDate.ts'
import { findingSummary } from '../workspace/findingSummary.ts'
import type { SavedFinding, SavedReport } from '../workspace/reportStore.ts'
import { useWorkspace } from '../workspace/workspaceState.ts'
import {
  presenceLook,
  PRESENCE_ORDER,
  PRESENCE_TITLES,
  type ComparedInjury,
  type Comparison,
} from './comparison.ts'
import styles from './ComparisonList.module.css'

function ReportEntry({
  report,
  finding,
}: {
  report: SavedReport
  finding: SavedFinding
}) {
  const bones = useBones()
  const summary = findingSummary(finding, bones)
  return (
    <span className={styles.entry}>
      <strong>
        {formatExamDate(report.exam_date)}: {summary.title}
      </strong>
      {summary.parts && (
        <span className={styles.detail}>Part: {summary.parts}</span>
      )}
      {summary.reportWords && (
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
      {summary.noMarkerReason && <em>{summary.noMarkerReason}</em>}
      {summary.enteredByPatient && <em>Entered by you</em>}
    </span>
  )
}

function InjuryRow({
  injury,
  comparison,
  markers,
}: {
  injury: ComparedInjury
  comparison: Comparison
  markers: MarkerSpec[]
}) {
  const bones = useBones()
  const { selectedFindingId, selectFinding } = useWorkspace()
  const findings = [...injury.earlier, ...injury.later]
  const ids = findings.map((finding) => finding.id)
  // Findings can share a marker, so choosing the row goes to one that has one.
  const target =
    markers.find((marker) => ids.includes(marker.findingId))?.findingId ?? ids[0]
  const { boneName, sideLabel } = findingSummary(findings[0], bones)

  return (
    <li>
      <button
        className={styles.injury}
        aria-pressed={selectedFindingId !== null && ids.includes(selectedFindingId)}
        onClick={() => selectFinding(target)}
      >
        {boneName && <strong>{boneName}</strong>}
        {sideLabel && <span>{sideLabel}</span>}
        {injury.earlier.map((finding) => (
          <ReportEntry
            key={finding.id}
            report={comparison.earlier}
            finding={finding}
          />
        ))}
        {injury.later.map((finding) => (
          <ReportEntry
            key={finding.id}
            report={comparison.later}
            finding={finding}
          />
        ))}
      </button>
    </li>
  )
}

// The comparison's findings, grouped by which reports they are in (S5.2). It
// only says what each report lists. A finding missing from a report is not
// described as healed, and one that appears later is not described as new.
function ComparisonList({
  comparison,
  markers,
}: {
  comparison: Comparison
  markers: MarkerSpec[]
}) {
  return (
    <section className={styles.list} aria-label="Comparison">
      <h2>Findings</h2>
      <div className={styles.scroll}>
        {comparison.injuries.length === 0 && (
          <p>These two reports have no findings to show.</p>
        )}
        {PRESENCE_ORDER.map((presence) => {
          const injuries = comparison.injuries.filter(
            (injury) => injury.presence === presence,
          )
          if (injuries.length === 0) return null
          return (
            <div
              key={presence}
              role="group"
              aria-label={PRESENCE_TITLES[presence]}
            >
              <h3>
                <span
                  className={styles.glyph}
                  style={{ color: presenceLook(presence, 'certain').fill }}
                  aria-hidden="true"
                >
                  {presenceLook(presence, 'certain').glyph}
                </span>{' '}
                {PRESENCE_TITLES[presence]}
              </h3>
              <ol>
                {injuries.map((injury) => (
                  <InjuryRow
                    key={[...injury.earlier, ...injury.later][0].id}
                    injury={injury}
                    comparison={comparison}
                    markers={markers}
                  />
                ))}
              </ol>
            </div>
          )
        })}
        <p className={styles.note}>
          A hollow shape means a possible fracture. This shows what each report
          says, not how you are healing. Reports are matched by bone and side,
          so two breaks in one bone show as one.
        </p>
      </div>

      <p className={styles.careTeam}>
        Questions about what this means? Ask your care team.
      </p>
    </section>
  )
}

export default ComparisonList
