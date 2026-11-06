import {
  Box3,
  Color,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  type Object3D,
} from 'three'
import type { Point } from './bones.ts'

export const MODEL_URL = '/shared/models/skeleton.glb'

const BONE_COLOR = new Color('#e6dfd0')
const HIGHLIGHT_COLOR = new Color('#f08a4b')

// Finds which bone an object belongs to, such as the mesh a click landed on.
//
// A mesh's own name can't be trusted: the meshes in radius_left are named
// radius_right_1 and radius_right_2 (#38). So this walks up and keeps the
// outermost name that is a bone id, which is always the bone's own Group.
export function boneIdOf(object: Object3D, boneIds: ReadonlySet<string>) {
  let found: string | null = null
  for (
    let current: Object3D | null = object;
    current;
    current = current.parent
  ) {
    if (boneIds.has(current.name)) found = current.name
  }
  return found
}

// Makes this viewer's own copy of the loaded model, so the cached original stays
// untouched, and fixes how it looks. Every material in the file sets an emissive
// factor of 1, which would draw each bone as flat white with no shading.
export function prepareSkeleton(scene: Object3D) {
  const skeleton = scene.clone(true)
  const copies = new Map<unknown, MeshStandardMaterial>()

  skeleton.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const source = object.material as MeshStandardMaterial
    let copy = copies.get(source)
    if (!copy) {
      copy = source.clone()
      copy.emissive.setRGB(0, 0, 0)
      copy.metalness = 0
      copy.roughness = 0.75
      if (source.name.startsWith('Bone')) copy.color.copy(BONE_COLOR)
      copies.set(source, copy)
    }
    object.material = copy
  })
  skeleton.updateMatrixWorld(true)
  return skeleton
}

// Where a marker goes inside its bone: the given point, in the model's
// coordinates, or the middle of the bone when the finding names no part. The
// result is in the bone's own coordinates, because half the bones are mirrored.
export function markerPosition(bone: Object3D, point: Point | null) {
  const world = point
    ? new Vector3(...point)
    : boneBox(bone).getCenter(new Vector3())
  return bone.worldToLocal(world)
}

// The space the bone itself takes up, in the model's coordinates. Markers are
// children of the bone, so they are left out.
export function boneBox(bone: Object3D) {
  const box = new Box3()
  bone.traverse((object) => {
    if (object instanceof Mesh && object.material instanceof MeshStandardMaterial) {
      box.expandByObject(object)
    }
  })
  return box
}

// Shows only one bone, or every bone when given null.
export function showOnlyBone(skeleton: Object3D, boneId: string | null) {
  for (const bone of skeleton.children) {
    bone.visible = boneId === null || bone.name === boneId
  }
}

// Highlights a whole bone and returns how to undo it. The bones share materials,
// so each mesh gets its own copy and no other bone changes (#38). Markers are
// children of their bone but have a different material, so they stay as they are.
export function highlightBone(bone: Object3D) {
  const undo: (() => void)[] = []
  bone.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const original = object.material
    if (!(original instanceof MeshStandardMaterial)) return
    const copy = original.clone()
    copy.color.copy(HIGHLIGHT_COLOR)
    object.material = copy
    undo.push(() => {
      object.material = original
      copy.dispose()
    })
  })
  return () => undo.forEach((restore) => restore())
}
