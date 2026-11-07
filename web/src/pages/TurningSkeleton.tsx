import { useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Box3, Vector3, type Group } from 'three'
import { FIELD_OF_VIEW } from '../viewer/cameraViews.ts'
import SceneLights from '../viewer/SceneLights.tsx'
import { MODEL_URL, prepareSkeleton } from '../viewer/skeletonObjects.ts'
import styles from './HomePage.module.css'

// Radians per second, so one full turn takes about 12 seconds.
const TURN_SPEED = 0.5

// Far enough back that the whole model fits with room around it, level with its
// middle, so it clears the notice at the top for its whole turn.
const CAMERA_POSITION: [number, number, number] = [0, 0.72, 4.3]

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function Model({ turning }: { turning: boolean }) {
  const { scene } = useGLTF(MODEL_URL)
  const skeleton = useMemo(() => prepareSkeleton(scene), [scene])
  const group = useRef<Group>(null)

  // Puts the vertical axis through the middle of the model, so it turns in place.
  const toCenter = useMemo(() => {
    const center = new Box3().setFromObject(skeleton).getCenter(new Vector3())
    return [-center.x, 0, -center.z] as const
  }, [skeleton])

  useFrame((_state, seconds) => {
    if (turning && group.current) group.current.rotation.y += seconds * TURN_SPEED
  })

  return (
    <group ref={group}>
      <primitive object={skeleton} position={toCenter} />
    </group>
  )
}

// The homepage's skeleton. It only turns: no markers, no controls, and no report.
function TurningSkeleton() {
  const [turning, setTurning] = useState(() => !prefersReducedMotion())

  return (
    <>
      <div
        className={styles.canvas}
        role="img"
        aria-label="A standard adult skeleton, without the skull, spine, or ribs, turning slowly."
      >
        <Canvas
          frameloop={turning ? 'always' : 'demand'}
          dpr={[1, 2]}
          camera={{
            fov: FIELD_OF_VIEW,
            near: 0.01,
            far: 20,
            position: CAMERA_POSITION,
            rotation: [0, 0, 0],
          }}
        >
          <SceneLights />
          <Model turning={turning} />
        </Canvas>
      </div>
      <button className={styles.turn} onClick={() => setTurning(!turning)}>
        {turning ? 'Stop turning' : 'Start turning'}
      </button>
    </>
  )
}

export default TurningSkeleton
