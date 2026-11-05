import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  checkGltf,
  MAX_TRIANGLES,
  readGltfJson,
  type Gltf,
} from './check-model.ts'

const shared = resolve(import.meta.dirname, '../public/shared')

function realModel() {
  return readGltfJson(readFileSync(resolve(shared, 'models/skeleton.glb')))
}

function realBoneIds() {
  const bones = JSON.parse(
    readFileSync(resolve(shared, 'bones.json'), 'utf8'),
  ) as { id: string }[]
  return bones.map((bone) => bone.id)
}

// A small model: one mesh centered on the origin, with this many triangles.
function modelWithNodes(nodes: Gltf['nodes'], triangles = 12): Gltf {
  return {
    scenes: [{ nodes: nodes.map((_node, index) => index) }],
    nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      { count: 8, min: [-0.01, -0.01, -0.01], max: [0.01, 0.01, 0.01] },
      { count: triangles * 3 },
    ],
  }
}

function modelWithOffCenterMesh(nodes: Gltf['nodes']): Gltf {
  const gltf = modelWithNodes(nodes)
  gltf.accessors[0] = { count: 8, min: [0.2, 0, 0], max: [0.3, 0.1, 0.1] }
  return gltf
}

function problemsWith(gltf: Gltf, boneIds: string[]) {
  return checkGltf(gltf, boneIds).problems
}

describe('the real model', () => {
  test('passes, with every bone and every drawn triangle counted', () => {
    const result = checkGltf(realModel(), realBoneIds())
    expect(result.problems).toEqual([])
    expect(result.bones).toBe(126)
    expect(result.triangles).toBe(141_632)
  })

  test('fails when its left and right radius are swapped', () => {
    const gltf = realModel()
    const left = gltf.nodes.find((node) => node.name === 'radius_left')
    const right = gltf.nodes.find((node) => node.name === 'radius_right')
    if (!left || !right) throw new Error('The model has no radius nodes.')
    left.name = 'radius_right'
    right.name = 'radius_left'

    const { problems } = checkGltf(gltf, realBoneIds())

    expect(problems).toHaveLength(2)
    expect(problems[0]).toMatch(/radius_right sits on the patient's left/)
    expect(problems[1]).toMatch(/radius_left sits on the patient's right/)
  })
})

describe('the side check', () => {
  test('accepts a _left bone on +X and a _right bone on -X', () => {
    const gltf = modelWithNodes([
      { mesh: 0, name: 'radius_left', translation: [0.25, 1, 0] },
      { mesh: 0, name: 'radius_right', translation: [-0.25, 1, 0] },
    ])
    expect(problemsWith(gltf, ['radius_left', 'radius_right'])).toEqual([])
  })

  test('fails on a _left bone on the patient’s right', () => {
    const gltf = modelWithNodes([
      { mesh: 0, name: 'radius_left', translation: [-0.25, 1, 0] },
    ])
    expect(problemsWith(gltf, ['radius_left'])).toEqual([
      expect.stringMatching(/radius_left sits on the patient's right/),
    ])
  })

  test('fails on a _right bone on the patient’s left', () => {
    const gltf = modelWithNodes([
      { mesh: 0, name: 'radius_right', translation: [0.25, 1, 0] },
    ])
    expect(problemsWith(gltf, ['radius_right'])).toEqual([
      expect.stringMatching(/radius_right sits on the patient's left/),
    ])
  })

  test('applies a node’s mirror before deciding its side', () => {
    // The mesh sits on +X, and the node mirrors it onto -X.
    const gltf = modelWithOffCenterMesh([
      { mesh: 0, name: 'radius_left', scale: [-1, 1, 1] },
    ])
    expect(problemsWith(gltf, ['radius_left'])).toEqual([
      expect.stringMatching(/radius_left sits on the patient's right/),
    ])
  })

  test('applies a node’s rotation before deciding its side', () => {
    // Half a turn around the vertical axis moves +X to -X.
    const gltf = modelWithOffCenterMesh([
      { mesh: 0, name: 'radius_left', rotation: [0, 1, 0, 0] },
    ])
    expect(problemsWith(gltf, ['radius_left'])).toEqual([
      expect.stringMatching(/radius_left sits on the patient's right/),
    ])
  })

  test('applies a node’s matrix before deciding its side', () => {
    const gltf = modelWithNodes([
      {
        mesh: 0,
        name: 'radius_left',
        matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.25, 1, 0, 1],
      },
    ])
    expect(problemsWith(gltf, ['radius_left'])).toEqual([
      expect.stringMatching(/radius_left sits on the patient's right/),
    ])
  })

  test('applies a parent’s transform before deciding its side', () => {
    const gltf = modelWithNodes([
      { name: 'Armature', scale: [-1, 1, 1], children: [1] },
      { mesh: 0, name: 'radius_left', translation: [0.25, 1, 0] },
    ])
    gltf.scenes[0].nodes = [0]
    expect(problemsWith(gltf, ['radius_left'])).toEqual([
      expect.stringMatching(/radius_left sits on the patient's right/),
    ])
  })
})

describe('the bone list check', () => {
  const left = { mesh: 0, name: 'radius_left', translation: [0.25, 1, 0] }

  test('fails on a bones.json bone missing from the model', () => {
    const gltf = modelWithNodes([left])
    expect(problemsWith(gltf, ['radius_left', 'ulna_left'])).toEqual([
      'A bone in bones.json is missing from the model: ulna_left',
    ])
  })

  test('fails on a model bone missing from bones.json', () => {
    const gltf = modelWithNodes([
      left,
      { mesh: 0, name: 'sacrum', translation: [0.25, 1, 0] },
    ])
    expect(problemsWith(gltf, ['radius_left'])).toEqual([
      'The model has a bone that is not in bones.json: sacrum',
    ])
  })

  test('fails on a bone that appears twice', () => {
    const gltf = modelWithNodes([left, left])
    expect(problemsWith(gltf, ['radius_left'])).toEqual([
      'The model has this bone more than once: radius_left',
    ])
  })

  test('ignores nodes that draw nothing', () => {
    const gltf = modelWithNodes([
      left,
      { name: 'Camera', translation: [0, 1, 3] },
    ])
    expect(problemsWith(gltf, ['radius_left'])).toEqual([])
  })
})

describe('the triangle limit', () => {
  const left = { mesh: 0, name: 'radius_left', translation: [0.25, 1, 0] }
  const right = { mesh: 0, name: 'radius_right', translation: [-0.25, 1, 0] }
  const ids = ['radius_left', 'radius_right']

  test('allows exactly the limit', () => {
    const gltf = modelWithNodes([left, right], MAX_TRIANGLES / 2)
    expect(problemsWith(gltf, ids)).toEqual([])
  })

  test('counts a shared mesh once for each node that draws it', () => {
    // The one mesh is under the limit, but drawing it twice is over.
    const gltf = modelWithNodes([left, right], MAX_TRIANGLES / 2 + 1)
    expect(problemsWith(gltf, ids)).toEqual([
      'The model draws 250002 triangles. The limit is 250000.',
    ])
  })

  test('counts triangle strips and fans', () => {
    const gltf = modelWithNodes([left])
    gltf.accessors[1] = { count: 12 }
    gltf.meshes[0].primitives[0].mode = 5
    expect(checkGltf(gltf, ['radius_left']).triangles).toBe(10)

    gltf.meshes[0].primitives[0].mode = 6
    expect(checkGltf(gltf, ['radius_left']).triangles).toBe(10)
  })

  test('does not count lines or points', () => {
    const gltf = modelWithNodes([left])
    gltf.meshes[0].primitives[0].mode = 1
    expect(checkGltf(gltf, ['radius_left']).triangles).toBe(0)
  })
})

describe('reading the file', () => {
  test('refuses a file that is not a .glb', () => {
    const notAGlb = new TextEncoder().encode('this is not a model at all')
    expect(() => readGltfJson(notAGlb)).toThrow(/not a \.glb/)
  })
})
