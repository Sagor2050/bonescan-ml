import { CameraControls, useGLTF } from '@react-three/drei'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { boneLabel, useBones, type Bone } from './bones.ts'
import {
  FIELD_OF_VIEW,
  MAX_DISTANCE,
  MIN_DISTANCE,
  nearestAzimuth,
  START_POSITION,
  START_TARGET,
  VIEWS,
  ZOOM_STEP,
} from './cameraViews.ts'
import { boneIdOf, MODEL_URL, prepareSkeleton } from './skeletonObjects.ts'
import styles from './SkeletonViewer.module.css'
import ViewerErrorBoundary from './ViewerErrorBoundary.tsx'

useGLTF.preload(MODEL_URL)

// Movement of more pixels than this between press and release is a drag.
const CLICK_DRAG_LIMIT = 4

function Skeleton({
  bones,
  onSelectBone,
}: {
  bones: Bone[]
  onSelectBone: (bone: Bone | null) => void
}) {
  const { scene } = useGLTF(MODEL_URL)
  const skeleton = useMemo(() => prepareSkeleton(scene), [scene])
  const byId = useMemo(
    () => new Map(bones.map((bone) => [bone.id, bone])),
    [bones],
  )
  const ids = useMemo(() => new Set(byId.keys()), [byId])

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (event.delta > CLICK_DRAG_LIMIT) return
    event.stopPropagation()
    const id = boneIdOf(event.object, ids)
    onSelectBone(id ? (byId.get(id) ?? null) : null)
  }

  return <primitive object={skeleton} onClick={handleClick} />
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

function SkeletonViewer() {
  const bones = useBones()
  const controlsRef = useRef<CameraControls | null>(null)
  const [controls, setControls] = useState<CameraControls | null>(null)
  const [selectedBone, setSelectedBone] = useState<Bone | null>(null)

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
              <Skeleton bones={bones} onSelectBone={setSelectedBone} />
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
