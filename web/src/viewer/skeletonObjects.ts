import { Color, Mesh, MeshStandardMaterial, type Object3D } from 'three'

export const MODEL_URL = '/shared/models/skeleton.glb'

const BONE_COLOR = new Color('#e6dfd0')

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
  return skeleton
}
