import { lazy, Suspense, useMemo, useState } from 'react'
import { useWorkspace } from '../workspace/workspaceState.ts'
import { boneLabel, useBones, type Bone } from './bones.ts'
import { withStackIndexes, type MarkerSpec } from './markers.ts'
import styles from './MarkerPointsPage.module.css'

const SkeletonViewer = lazy(() => import('./SkeletonViewer.tsx'))

function partName(part: string) {
  return part.replaceAll('_', ' ')
}

// Every named part of one bone gets a marker, labeled with the part's name. Each
// left point has a mirror-image right point, so one side is enough to check.
function partMarkers(bone: Bone): MarkerSpec[] {
  return withStackIndexes(
    Object.entries(bone.parts).map(([part, point]) => ({
      findingId: `part:${bone.id}:${part}`,
      boneId: bone.id,
      point,
      certainty: 'certain',
      look: { shape: 'round', fill: '#e5352b', glyph: '●' },
      title: partName(part),
      subtitle: null,
      boneName: boneLabel(bone),
      sideLabel: `Your ${bone.side} side`,
      healing: [],
      enteredByPatient: false,
      stackIndex: 0,
    })),
  )
}

// For the team, in development only: where a teammate checks by eye that each marker
// point sits on the part it names (#39). Production builds leave this out.
function MarkerPointsPage() {
  const bones = useBones()
  const { selectFinding } = useWorkspace()
  const leftBones = useMemo(
    () => bones.filter((bone) => bone.side === 'left'),
    [bones],
  )
  const [index, setIndex] = useState(0)
  const bone = leftBones[index]
  const markers = useMemo(() => partMarkers(bone), [bone])

  return (
    <main className={styles.screen}>
      <div className={styles.side}>
        <h1>Check the marker points</h1>
        <p>
          Does each marker sit on the part it names? Click a part to go to it.
          Post anything wrong in issue #39. The right side mirrors the left.
        </p>
        <label>
          Bone ({index + 1} of {leftBones.length})
          <select
            value={index}
            onChange={(event) => setIndex(Number(event.target.value))}
          >
            {leftBones.map((option, optionIndex) => (
              <option key={option.id} value={optionIndex}>
                {option.medical}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.step}>
          <button disabled={index === 0} onClick={() => setIndex(index - 1)}>
            Previous bone
          </button>
          <button
            disabled={index === leftBones.length - 1}
            onClick={() => setIndex(index + 1)}
          >
            Next bone
          </button>
        </div>
        <h2>Parts</h2>
        <ul>
          {markers.map((marker) => (
            <li key={marker.findingId}>
              <button onClick={() => selectFinding(marker.findingId)}>
                {marker.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Suspense fallback={<p>Loading the skeleton…</p>}>
        <SkeletonViewer markers={markers} />
      </Suspense>
    </main>
  )
}

export default MarkerPointsPage
