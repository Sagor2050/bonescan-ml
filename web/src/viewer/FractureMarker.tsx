import { Html } from '@react-three/drei'
import { createPortal, useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef, type CSSProperties } from 'react'
import { Group, Vector3, type Object3D } from 'three'
import styles from './FractureMarker.module.css'
import { labelPlacement, type MarkerSpec } from './markers.ts'
import { markerPosition } from './skeletonObjects.ts'

// How big a marker looks, as a share of its distance from the camera. It keeps
// the same size on screen, so it doesn't hide a finger when zoomed in.
const SCREEN_SIZE = 0.008
const CLICK_DRAG_LIMIT = 4

const OUTLINE_COLOR = '#111111'
const COLORS = { certain: '#e5352b', uncertain: '#ffb000' }

const worldPosition = new Vector3()

// Certain and uncertain findings differ by shape, so the difference survives
// without color (S3.1, NFR12): a round marker, or a diamond.
function MarkerShape({ certainty }: { certainty: MarkerSpec['certainty'] }) {
  return certainty === 'certain' ? (
    <sphereGeometry args={[1, 24, 16]} />
  ) : (
    <octahedronGeometry args={[1.5]} />
  )
}

type FractureMarkerProps = {
  marker: MarkerSpec
  bone: Object3D
  selected: boolean
  onSelect: (findingId: string) => void
}

// The marker is a child of its bone, so it stays on that bone from every angle
// and at every zoom (S3.2), and it shows or hides along with the bone.
function FractureMarker({
  marker,
  bone,
  selected,
  onSelect,
}: FractureMarkerProps) {
  const position = useMemo(
    () => markerPosition(bone, marker.point),
    [bone, marker.point],
  )
  const shapeRef = useRef<Group>(null)
  const labelRef = useRef<HTMLButtonElement>(null)

  useFrame(({ camera, size }) => {
    const shape = shapeRef.current
    if (!shape) return
    shape.getWorldPosition(worldPosition)
    shape.scale.setScalar(
      worldPosition.distanceTo(camera.position) * SCREEN_SIZE,
    )

    const label = labelRef.current
    if (label) {
      const placement = labelPlacement(
        worldPosition.project(camera).x,
        size.width,
      )
      const flip = String(placement.goesLeft)
      label.style.maxWidth = `${placement.maxWidth}px`
      if (label.dataset.flip !== flip) label.dataset.flip = flip
    }
  })

  function handleClick(event: ThreeEvent<MouseEvent>) {
    if (event.delta > CLICK_DRAG_LIMIT) return
    event.stopPropagation()
    onSelect(marker.findingId)
  }

  return createPortal(
    <group name={`marker:${marker.findingId}`} position={position}>
      <group ref={shapeRef} scale={0.03}>
        <mesh
          renderOrder={11}
          userData={{ findingId: marker.findingId }}
          onClick={handleClick}
        >
          <MarkerShape certainty={marker.certainty} />
          <meshBasicMaterial
            color={COLORS[marker.certainty]}
            depthTest={false}
            transparent
          />
        </mesh>
        <mesh renderOrder={10} scale={1.3}>
          <MarkerShape certainty={marker.certainty} />
          <meshBasicMaterial
            color={OUTLINE_COLOR}
            depthTest={false}
            transparent
          />
        </mesh>
      </group>
      <Html wrapperClass={styles.anchor} zIndexRange={[10, 0]}>
        <button
          ref={labelRef}
          className={`${styles.label} ${styles[marker.certainty]}`}
          style={{ '--stack': marker.stackIndex } as CSSProperties}
          aria-pressed={selected}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(marker.findingId)
          }}
        >
          <strong>
            <span aria-hidden="true">
              {marker.certainty === 'certain' ? '● ' : '◆ '}
            </span>
            {marker.title}
          </strong>
          <span>{marker.boneName}</span>
          <span>{marker.sideLabel}</span>
          {marker.enteredByPatient && <em>Entered by you</em>}
        </button>
      </Html>
    </group>,
    bone,
  )
}

export default FractureMarker
