import { CameraControls, useGLTF } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Sphere, Vector3, type Object3D } from 'three'
import type { SavedFinding } from '../workspace/reportStore.ts'
import { useWorkspace } from '../workspace/workspaceState.ts'
import { boneLabel, useBones, type Bone } from './bones.ts'
import {
  FIELD_OF_VIEW,
  focusView,
  MAX_DISTANCE,
  MIN_DISTANCE,
  nearestAzimuth,
  START_POSITION,
  START_TARGET,
  VIEWS,
  ZOOM_STEP,
} from './cameraViews.ts'
import FractureMarker from './FractureMarker.tsx'
import { markersFor, type MarkerSpec } from './markers.ts'
import {
  boneBox,
  boneIdOf,
  highlightBone,
  markerPosition,
  MODEL_URL,
  prepareSkeleton,
  showOnlyBone,
} from './skeletonObjects.ts'
import styles from './SkeletonViewer.module.css'
import ViewerErrorBoundary from './ViewerErrorBoundary.tsx'

useGLTF.preload(MODEL_URL)

function moveCameraTo(
  controls: CameraControls,
  bone: Object3D,
  point: Vector3,
) {
  const { radius } = boneBox(bone).getBoundingSphere(new Sphere())
  const { position, target } = focusView([point.x, point.y, point.z], radius)
  void controls.setLookAt(...position, ...target, true)
}

// Movement of more pixels than this between press and release is a drag.
const CLICK_DRAG_LIMIT = 4

function Skeleton({
  bones,
  markers,
  controls,
  selectedFindingId,
  selectionCount,
  shownAloneId,
  onSelectBone,
  onSelectFinding,
}: {
  bones: Bone[]
  markers: MarkerSpec[]
  controls: CameraControls | null
  selectedFindingId: string | null
  selectionCount: number
  shownAloneId: string | null
  onSelectBone: (bone: Bone | null) => void
  onSelectFinding: (findingId: string) => void
}) {
  const { scene } = useGLTF(MODEL_URL)
  const invalidate = useThree((state) => state.invalidate)
  const skeleton = useMemo(() => prepareSkeleton(scene), [scene])
  const byId = useMemo(
    () => new Map(bones.map((bone) => [bone.id, bone])),
    [bones],
  )
  const ids = useMemo(() => new Set(byId.keys()), [byId])

  // A finding with no named part marks the whole bone (S3.1).
  const wholeBoneIds = useMemo(
    () =>
      [
        ...new Set(
          markers
            .filter((marker) => marker.point === null)
            .map((marker) => marker.boneId),
        ),
      ].join(' '),
    [markers],
  )
  useEffect(() => {
    if (!wholeBoneIds) return
    const undo = wholeBoneIds.split(' ').flatMap((id) => {
      const bone = skeleton.getObjectByName(id)
      return bone ? [highlightBone(bone)] : []
    })
    invalidate()
    return () => {
      undo.forEach((restore) => restore())
      invalidate()
    }
  }, [skeleton, wholeBoneIds, invalidate])

  // Choosing a finding centers its fracture in the view (S3.3).
  useEffect(() => {
    if (!controls || !selectedFindingId) return
    const marker = markers.find(
      (candidate) => candidate.findingId === selectedFindingId,
    )
    const bone = marker && skeleton.getObjectByName(marker.boneId)
    if (!marker || !bone) return
    const point = bone.localToWorld(markerPosition(bone, marker.point))
    moveCameraTo(controls, bone, point)
  }, [controls, markers, selectedFindingId, selectionCount, skeleton])

  // Showing a bone on its own also brings it into the view.
  useEffect(() => {
    showOnlyBone(skeleton, shownAloneId)
    const bone = shownAloneId && skeleton.getObjectByName(shownAloneId)
    if (controls && bone) {
      moveCameraTo(controls, bone, boneBox(bone).getCenter(new Vector3()))
    }
    invalidate()
  }, [controls, invalidate, shownAloneId, skeleton])

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (event.delta > CLICK_DRAG_LIMIT) return
    // Hidden bones still catch the ray, so a click passes through them.
    const clickedId = boneIdOf(event.object, ids)
    if (shownAloneId && clickedId !== shownAloneId) return
    // Markers draw on top of the bones, so one wins even if a bone is nearer.
    const hitMarker = event.intersections.some(
      (hit) => hit.object.userData.findingId,
    )
    if (hitMarker) return
    event.stopPropagation()
    onSelectBone(clickedId ? (byId.get(clickedId) ?? null) : null)
  }

  return (
    <>
      <primitive object={skeleton} onClick={handleClick} />
      {markers.map((marker) => {
        const bone = skeleton.getObjectByName(marker.boneId)
        const shown = !shownAloneId || marker.boneId === shownAloneId
        return bone && shown ? (
          <FractureMarker
            key={marker.findingId}
            marker={marker}
            bone={bone}
            selected={marker.findingId === selectedFindingId}
            onSelect={onSelectFinding}
          />
        ) : null
      })}
    </>
  )
}

// Lets the end-to-end tests read the camera and the scene. It is left out of
// production builds.
function ExposeForTests({ controls }: { controls: CameraControls | null }) {
  const camera = useThree((state) => state.camera)
  const scene = useThree((state) => state.scene)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const target = window as unknown as Record<string, unknown>
    target.__bonescanViewer = { camera, scene, controls }
    return () => {
      delete target.__bonescanViewer
    }
  }, [camera, scene, controls])
  return null
}

function SkeletonViewer({ findings }: { findings: SavedFinding[] }) {
  const bones = useBones()
  const { selectedFindingId, selectionCount, selectFinding } = useWorkspace()
  const markers = useMemo(() => markersFor(findings, bones), [findings, bones])
  const controlsRef = useRef<CameraControls | null>(null)
  const [controls, setControls] = useState<CameraControls | null>(null)
  const [selectedBone, setSelectedBone] = useState<Bone | null>(null)
  const [aloneId, setAloneId] = useState<string | null>(null)

  const selectedMarker = markers.find(
    (marker) => marker.findingId === selectedFindingId,
  )
  // Choosing a finding on another bone brings that bone back into view.
  const shownAloneId =
    aloneId && (!selectedMarker || selectedMarker.boneId === aloneId)
      ? aloneId
      : null
  const boneToShowAlone = selectedMarker?.boneId ?? selectedBone?.id ?? null

  function connectControls(instance: CameraControls | null) {
    controlsRef.current = instance
    if (!instance) return
    instance.setLookAt(...START_POSITION, ...START_TARGET, false)
    setControls(instance)
  }

  function goToView(azimuth: number) {
    const current = controlsRef.current
    if (!current) return
    void current.rotateTo(
      nearestAzimuth(current.azimuthAngle, azimuth),
      Math.PI / 2,
      true,
    )
  }

  function zoom(direction: 1 | -1) {
    const current = controlsRef.current
    if (!current) return
    void current.dolly(direction * current.distance * ZOOM_STEP, true)
  }

  function resetView() {
    void controlsRef.current?.setLookAt(
      ...START_POSITION,
      ...START_TARGET,
      true,
    )
  }

  return (
    <section className={styles.viewer} aria-label="3D skeleton">
      <p className={styles.notice}>
        This is a standard adult skeleton, not a model of your own bones.
      </p>

      <div className={styles.stage}>
        <ViewerErrorBoundary
          fallback={
            <p className={styles.message}>
              We can't show the 3D skeleton in this browser. Try the latest
              version of Chrome, Safari, Firefox, or Edge.
            </p>
          }
        >
          <Suspense
            fallback={<p className={styles.message}>Loading the skeleton…</p>}
          >
            <Canvas
              frameloop="demand"
              dpr={[1, 2]}
              camera={{
                fov: FIELD_OF_VIEW,
                near: 0.01,
                far: 20,
                position: START_POSITION,
              }}
              onPointerMissed={() => setSelectedBone(null)}
            >
              <ambientLight intensity={0.8} />
              <directionalLight position={[1, 2, 3]} intensity={1.8} />
              <directionalLight position={[-1, 1, -3]} intensity={1} />
              <Skeleton
                bones={bones}
                markers={markers}
                controls={controls}
                selectedFindingId={selectedFindingId}
                selectionCount={selectionCount}
                shownAloneId={shownAloneId}
                onSelectBone={setSelectedBone}
                onSelectFinding={selectFinding}
              />
              <CameraControls
                ref={connectControls}
                makeDefault
                minDistance={MIN_DISTANCE}
                maxDistance={MAX_DISTANCE}
                dollyToCursor
                smoothTime={0.2}
              />
              <ExposeForTests controls={controls} />
            </Canvas>
          </Suspense>
        </ViewerErrorBoundary>
      </div>

      <div className={styles.controls}>
        <div role="group" aria-label="Views">
          {VIEWS.map((view) => (
            <button key={view.name} onClick={() => goToView(view.azimuth)}>
              {view.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Zoom">
          <button onClick={() => zoom(1)}>Zoom in</button>
          <button onClick={() => zoom(-1)}>Zoom out</button>
          <button onClick={resetView}>Starting view</button>
        </div>
        <div role="group" aria-label="Bones shown">
          {shownAloneId ? (
            <button onClick={() => setAloneId(null)}>
              Show the full skeleton
            </button>
          ) : (
            <button
              disabled={!boneToShowAlone}
              onClick={() => setAloneId(boneToShowAlone)}
            >
              Show this bone on its own
            </button>
          )}
        </div>
      </div>

      <p className={styles.help}>
        Drag to turn. Scroll to zoom. Right-drag to move sideways.
      </p>

      <p className={styles.selectedBone} aria-live="polite">
        {selectedBone
          ? `Your ${selectedBone.side} ${boneLabel(selectedBone)}`
          : 'Click a bone to see its name.'}
      </p>
    </section>
  )
}

export default SkeletonViewer
