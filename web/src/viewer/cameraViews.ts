// Where the camera can go. The model stands facing +Z with the patient's left on
// +X (Requirements A.4), so a camera at +Z sees the patient's left on the
// viewer's right.

export const FIELD_OF_VIEW = 30

// The middle of the skeleton, and far enough back to see all of it.
export const START_TARGET: [number, number, number] = [0, 0.73, 0]
export const START_POSITION: [number, number, number] = [0, 0.73, 3]

// Close enough for one finger to fill the view (S3.2).
export const MIN_DISTANCE = 0.1
export const MAX_DISTANCE = 6

export const ZOOM_STEP = 0.35

export type ViewName = 'front' | 'back' | 'left' | 'right'

// Each view's camera direction, as an angle around the vertical axis from +Z
// toward +X. The left and right views look at the patient's own left and right.
export const VIEWS: { name: ViewName; label: string; azimuth: number }[] = [
  { name: 'front', label: 'Front', azimuth: 0 },
  { name: 'back', label: 'Back', azimuth: Math.PI },
  { name: 'left', label: 'Your left side', azimuth: Math.PI / 2 },
  { name: 'right', label: 'Your right side', azimuth: -Math.PI / 2 },
]

// How the camera looks at one fracture (S3.3): from the front and outer side,
// where other bones are least likely to be in the way, and slightly from above.
// The bone's size sets how close, with a limit for the smallest bones.
const FRONT_BIAS = 0.15
const FOCUS_ELEVATION = 0.15
const BONE_FILLS_VIEW = 0.6

export function focusView(
  target: [number, number, number],
  boneRadius: number,
) {
  const [x, y, z] = target
  const halfHeightPerDistance = Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180)
  const distance = Math.min(
    MAX_DISTANCE,
    Math.max(
      MIN_DISTANCE,
      boneRadius / (halfHeightPerDistance * BONE_FILLS_VIEW),
    ),
  )
  const azimuth = Math.atan2(x, z + FRONT_BIAS)
  const polar = Math.PI / 2 - FOCUS_ELEVATION
  const position: [number, number, number] = [
    x + distance * Math.sin(polar) * Math.sin(azimuth),
    y + distance * Math.cos(polar),
    z + distance * Math.sin(polar) * Math.cos(azimuth),
  ]
  return { position, target, distance }
}

// The camera's angle keeps growing as it circles, so turning straight to an
// angle could spin the long way round. This gives the nearest equal angle.
export function nearestAzimuth(current: number, wanted: number) {
  const fullTurn = 2 * Math.PI
  const difference = (wanted - current) % fullTurn
  const shortest =
    difference > Math.PI
      ? difference - fullTurn
      : difference < -Math.PI
        ? difference + fullTurn
        : difference
  return current + shortest
}
