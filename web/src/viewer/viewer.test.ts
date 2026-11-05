import { Group, Mesh, MeshStandardMaterial, Object3D } from 'three'
import { describe, expect, test } from 'vitest'
import { boneLabel } from './bones.ts'
import { nearestAzimuth, VIEWS } from './cameraViews.ts'
import { boneIdOf, prepareSkeleton } from './skeletonObjects.ts'

const ids = new Set(['radius_left', 'radius_right'])

function boneGroup(name: string, meshNames: string[]) {
  const group = new Group()
  group.name = name
  for (const meshName of meshNames) {
    const mesh = new Mesh()
    mesh.name = meshName
    group.add(mesh)
  }
  return group
}

describe('boneIdOf', () => {
  test('names the left radius when a click lands on its wrongly named mesh', () => {
    const left = boneGroup('radius_left', ['radius_right_1', 'radius_right_2'])
    expect(boneIdOf(left.children[0], ids)).toBe('radius_left')
  })

  test('trusts the bone’s Group even if a mesh inside has another bone’s id', () => {
    const left = boneGroup('radius_left', ['radius_right'])
    expect(boneIdOf(left.children[0], ids)).toBe('radius_left')
  })

  test('works when the bone is deeper in the scene', () => {
    const scene = new Object3D()
    scene.name = 'Scene'
    const right = boneGroup('radius_right', ['radius_right_1'])
    scene.add(right)
    expect(boneIdOf(right.children[0], ids)).toBe('radius_right')
  })

  test('finds nothing for an object that is not part of a bone', () => {
    const other = new Object3D()
    other.name = 'marker'
    expect(boneIdOf(other, ids)).toBeNull()
  })
})

describe('prepareSkeleton', () => {
  function modelWithMaterial(name: string) {
    const scene = new Group()
    const material = new MeshStandardMaterial({ name, metalness: 0.5 })
    material.emissive.setRGB(1, 1, 1)
    scene.add(new Mesh(undefined, material))
    return { scene, material }
  }

  test('turns off the flat white glow set in the file', () => {
    const { scene } = modelWithMaterial('Bone-1')
    const mesh = prepareSkeleton(scene).children[0] as Mesh
    const material = mesh.material as MeshStandardMaterial
    expect(material.emissive.getHex()).toBe(0)
  })

  test('leaves the loaded model and its materials unchanged', () => {
    const { scene, material } = modelWithMaterial('Bone-1')
    const mesh = prepareSkeleton(scene).children[0] as Mesh
    expect(mesh.material).not.toBe(material)
    expect(material.emissive.getHex()).toBe(0xffffff)
    expect((scene.children[0] as Mesh).material).toBe(material)
  })

  test('meshes that shared a material still share one copy', () => {
    const scene = new Group()
    const material = new MeshStandardMaterial({ name: 'Bone' })
    scene.add(new Mesh(undefined, material), new Mesh(undefined, material))
    const [first, second] = prepareSkeleton(scene).children as Mesh[]
    expect(first.material).toBe(second.material)
  })
})

describe('the preset views', () => {
  function azimuth(name: string) {
    const view = VIEWS.find((candidate) => candidate.name === name)
    if (!view) throw new Error(`No ${name} view`)
    return view.azimuth
  }

  // A camera at this angle sits at x = sin(azimuth), z = cos(azimuth).
  test('the front view looks from the patient’s front (+Z)', () => {
    expect(Math.cos(azimuth('front'))).toBeCloseTo(1)
  })

  test('the back view looks from behind the patient (-Z)', () => {
    expect(Math.cos(azimuth('back'))).toBeCloseTo(-1)
  })

  test('the left view looks from the patient’s own left (+X)', () => {
    expect(Math.sin(azimuth('left'))).toBeCloseTo(1)
  })

  test('the right view looks from the patient’s own right (-X)', () => {
    expect(Math.sin(azimuth('right'))).toBeCloseTo(-1)
  })
})

describe('nearestAzimuth', () => {
  test.each([
    [0, Math.PI / 2, Math.PI / 2],
    [0, -Math.PI / 2, -Math.PI / 2],
    // After almost a full turn, going to 0 means going forward, not back round.
    [(2 * Math.PI * 7) / 8, 0, 2 * Math.PI],
    [(-2 * Math.PI * 7) / 8, 0, -2 * Math.PI],
    [4 * Math.PI, Math.PI / 2, 4 * Math.PI + Math.PI / 2],
  ])('from %f to %f gives %f', (current, wanted, expected) => {
    expect(nearestAzimuth(current, wanted)).toBeCloseTo(expected)
  })
})

test('boneLabel gives the medical and the everyday name', () => {
  expect(
    boneLabel({ medical: 'radius', everyday: 'forearm bone, thumb side' }),
  ).toBe('radius (forearm bone, thumb side)')
})
