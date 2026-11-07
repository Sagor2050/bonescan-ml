import { Html } from '@react-three/drei'
import { createPortal, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useCallback, useMemo, useRef, type CSSProperties } from 'react'
import { Group, Vector3, type Object3D } from 'three'
import styles from './FractureMarker.module.css'
import {
  LABEL_FAR_GAP,
  LABEL_RISE,
  LABEL_STACK_GAP,
  labelPlacement,
  labelRise,
  type MarkerLook,
  type MarkerSpec,
} from './markers.ts'
import { markerPosition } from './skeletonObjects.ts'

// How big a marker looks, as a share of its distance from the camera. It keeps
// the same size on screen, so it doesn't hide a finger when zoomed in.
const SCREEN_SIZE = 0.0045
// The area around the dot that counts as clicking it, as a share of the dot.
const CLICK_AREA = 3
// Where the line to the label starts, in pixels from the dot's center.
const LINE_START = 9
// How far before the label the line bends to run straight into it, in pixels.
const LINE_BEND = 20
const CLICK_DRAG_LIMIT = 4

const OUTLINE_COLOR = '#111111'

const worldPosition = new Vector3()
const bodyCenter = new Vector3()

// The line from the dot to its label: up and out to a bend, then straight across.
function linePoints(gap: number, labelHeight: number) {
  const bendX = gap - LINE_BEND
  const length = Math.hypot(bendX, labelHeight)
  const startX = (bendX / length) * LINE_START
  const startY = (labelHeight / length) * LINE_START
  return `${startX},${startY} ${bendX},${labelHeight} ${gap},${labelHeight}`
}

function MarkerShape({ shape }: { shape: MarkerLook['shape'] }) {
  switch (shape) {
    case 'round':
      return <sphereGeometry args={[1, 24, 16]} />
    case 'diamond':
      return <octahedronGeometry args={[1.5]} />
    case 'cube':
      return <boxGeometry args={[1.7, 1.7, 1.7]} />
    case 'cone':
      return <coneGeometry args={[1.3, 2.2, 32]} />
  }
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
  const labelRef = useRef<HTMLButtonElement | null>(null)
  const invalidate = useThree((state) => state.invalidate)
  // The label appears after the first frame, and frames only draw on demand, so ask
  // for two: one to place the label, and one more now that it's at its final width.
  const connectLabel = useCallback(
    (element: HTMLButtonElement | null) => {
      labelRef.current = element
      if (element) invalidate(2)
    },
    [invalidate],
  )
  const lineRef = useRef<SVGSVGElement>(null)
  const drop = marker.stackIndex * LABEL_STACK_GAP

  useFrame(({ camera, size }) => {
    const shape = shapeRef.current
    if (!shape) return
    shape.getWorldPosition(worldPosition)
    shape.scale.setScalar(
      worldPosition.distanceTo(camera.position) * SCREEN_SIZE,
    )

    const label = labelRef.current
    const line = lineRef.current
    if (label && line) {
      // The skeleton stands on the model's center line, at x and z of 0.
      bodyCenter.set(0, worldPosition.y, 0).project(camera)
      const { x, y } = worldPosition.project(camera)
      const flipped = label.dataset.flip
      const placement = labelPlacement(
        x,
        size.width,
        flipped === undefined ? undefined : flipped === 'true',
        bodyCenter.x,
      )
      const flip = String(placement.goesLeft)
      if (flipped !== flip) {
        label.dataset.flip = flip
        line.dataset.flip = flip
      }

      const height = drop - labelRise(y, size.height, label.offsetHeight)
      label.style.maxWidth = `${placement.maxWidth}px`
      label.style.setProperty('--gap', `${placement.gap}px`)
      label.style.setProperty('--height', `${height}px`)
      line
        .querySelector('polyline')
        ?.setAttribute('points', linePoints(placement.gap, height))
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
        <mesh renderOrder={11}>
          <MarkerShape shape={marker.look.shape} />
          <meshBasicMaterial
            color={marker.look.fill}
            depthTest={false}
            transparent
          />
        </mesh>
        <mesh renderOrder={10} scale={1.3}>
          <MarkerShape shape={marker.look.shape} />
          <meshBasicMaterial
            color={OUTLINE_COLOR}
            depthTest={false}
            transparent
          />
        </mesh>
        {/* Unseen, so a small dot is still easy to click. */}
        <mesh
          scale={CLICK_AREA}
          userData={{ findingId: marker.findingId }}
          onClick={handleClick}
        >
          <sphereGeometry args={[1, 12, 8]} />
          <meshBasicMaterial
            depthTest={false}
            depthWrite={false}
            opacity={0}
            transparent
          />
        </mesh>
      </group>
      {/* A chosen label comes to the front, in case another was covering it. */}
      <Html
        wrapperClass={styles.anchor}
        zIndexRange={selected ? [20, 11] : [10, 0]}
      >
        <svg
          ref={lineRef}
          className={`${styles.line} ${styles[marker.certainty]}`}
          aria-hidden="true"
          width="1"
          height="1"
        >
          <polyline points={linePoints(LABEL_FAR_GAP, -LABEL_RISE + drop)} />
        </svg>
        <button
          ref={connectLabel}
          className={`${styles.label} ${styles[marker.certainty]}`}
          style={
            {
              '--gap': `${LABEL_FAR_GAP}px`,
              '--height': `${-LABEL_RISE + drop}px`,
            } as CSSProperties
          }
          aria-pressed={selected}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onSelect(marker.findingId)
          }}
        >
          <strong>
            <span aria-hidden="true">{marker.look.glyph} </span>
            {marker.title}
          </strong>
          {marker.subtitle && <span>{marker.subtitle}</span>}
          <span>{marker.boneName}</span>
          <span>{marker.sideLabel}</span>
          {marker.healing.map((line) => (
            <span key={line} className={styles.healing}>
              {line}
            </span>
          ))}
          {marker.enteredByPatient && <em>Entered by you</em>}
        </button>
      </Html>
    </group>,
    bone,
  )
}

export default FractureMarker
