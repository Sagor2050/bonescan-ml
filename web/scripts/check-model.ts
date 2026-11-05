// The guard against putting markers on the mirror-image bone (Plan Key
// Decision 4). Run it with `npm run check:model`. It fails if:
//   - a bones.json bone is missing from the model, or the model draws a bone
//     that isn't in bones.json
//   - a _left bone sits on the patient's right, or a _right bone on their left
//     (the patient's left is +X)
//   - the model draws more than 250,000 triangles
//
// Everything is read from the node, not the mesh. skeleton.glb has 63 meshes,
// each used by a left node and a right node: the node `radius_left` reuses the
// mesh `radius_right`, mirrored. So node names are the bone ids, each node's
// transforms decide its side, and a mesh counts once per node that draws it.

import { readFileSync } from 'node:fs'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'

export const MAX_TRIANGLES = 250_000

const GLB_MAGIC = 0x46546c67 // "glTF"
const JSON_CHUNK = 0x4e4f534a // "JSON"

const TRIANGLES = 4
const TRIANGLE_STRIP = 5
const TRIANGLE_FAN = 6

type GltfNode = {
  name?: string
  mesh?: number
  children?: number[]
  matrix?: number[]
  translation?: number[]
  rotation?: number[]
  scale?: number[]
}

type GltfPrimitive = {
  attributes: { POSITION: number }
  indices?: number
  mode?: number
}

export type Gltf = {
  scene?: number
  scenes: { nodes?: number[] }[]
  nodes: GltfNode[]
  meshes: { primitives: GltfPrimitive[] }[]
  accessors: { count: number; min?: number[]; max?: number[] }[]
}

export type ModelCheckResult = {
  problems: string[]
  bones: number
  triangles: number
}

export function readGltfJson(glb: Uint8Array): Gltf {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength)
  if (glb.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) {
    throw new Error('The file is not a .glb model.')
  }
  if (view.getUint32(16, true) !== JSON_CHUNK) {
    throw new Error('The .glb file does not start with a JSON chunk.')
  }
  const jsonLength = view.getUint32(12, true)
  return JSON.parse(
    new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)),
  ) as Gltf
}

function localMatrix(node: GltfNode) {
  if (node.matrix) return new Matrix4().fromArray(node.matrix)
  return new Matrix4().compose(
    new Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new Vector3().fromArray(node.scale ?? [1, 1, 1]),
  )
}

function meshBox(gltf: Gltf, meshIndex: number) {
  const box = new Box3()
  for (const primitive of gltf.meshes[meshIndex].primitives) {
    const { min, max } = gltf.accessors[primitive.attributes.POSITION]
    if (!min || !max) {
      throw new Error(`Mesh ${meshIndex} has no POSITION bounds.`)
    }
    box.expandByPoint(new Vector3().fromArray(min))
    box.expandByPoint(new Vector3().fromArray(max))
  }
  return box
}

function meshTriangles(gltf: Gltf, meshIndex: number) {
  let triangles = 0
  for (const primitive of gltf.meshes[meshIndex].primitives) {
    const accessor = primitive.indices ?? primitive.attributes.POSITION
    const vertices = gltf.accessors[accessor].count
    const mode = primitive.mode ?? TRIANGLES
    if (mode === TRIANGLES) triangles += Math.floor(vertices / 3)
    if (mode === TRIANGLE_STRIP || mode === TRIANGLE_FAN) {
      triangles += Math.max(vertices - 2, 0)
    }
  }
  return triangles
}

export function checkGltf(gltf: Gltf, boneIds: string[]): ModelCheckResult {
  const problems: string[] = []
  const catalog = new Set(boneIds)
  const drawnBones = new Set<string>()
  let triangles = 0

  function visit(nodeIndex: number, parentMatrix: Matrix4) {
    const node = gltf.nodes[nodeIndex]
    const worldMatrix = parentMatrix.clone().multiply(localMatrix(node))

    if (node.mesh !== undefined) {
      triangles += meshTriangles(gltf, node.mesh)
      const name = node.name ?? `(unnamed node ${nodeIndex})`

      if (!catalog.has(name)) {
        problems.push(`The model has a bone that is not in bones.json: ${name}`)
      }
      if (drawnBones.has(name)) {
        problems.push(`The model has this bone more than once: ${name}`)
      }
      drawnBones.add(name)

      const box = meshBox(gltf, node.mesh).applyMatrix4(worldMatrix)
      const centerX = box.getCenter(new Vector3()).x
      if (name.endsWith('_left') && centerX <= 0) {
        problems.push(
          `${name} sits on the patient's right (x = ${centerX.toFixed(4)}). The patient's left is +X.`,
        )
      }
      if (name.endsWith('_right') && centerX >= 0) {
        problems.push(
          `${name} sits on the patient's left (x = ${centerX.toFixed(4)}). The patient's right is -X.`,
        )
      }
    }

    for (const child of node.children ?? []) visit(child, worldMatrix)
  }

  const scene = gltf.scenes[gltf.scene ?? 0]
  for (const root of scene.nodes ?? []) visit(root, new Matrix4())

  for (const id of boneIds) {
    if (!drawnBones.has(id)) {
      problems.push(`A bone in bones.json is missing from the model: ${id}`)
    }
  }
  if (triangles > MAX_TRIANGLES) {
    problems.push(
      `The model draws ${triangles} triangles. The limit is ${MAX_TRIANGLES}.`,
    )
  }

  return { problems, bones: drawnBones.size, triangles }
}

function main() {
  const shared = new URL('../public/shared/', import.meta.url)
  const bones = JSON.parse(
    readFileSync(new URL('bones.json', shared), 'utf8'),
  ) as { id: string }[]
  const glb = readFileSync(new URL('models/skeleton.glb', shared))

  const { problems, bones: boneCount, triangles } = checkGltf(
    readGltfJson(glb),
    bones.map((bone) => bone.id),
  )

  if (problems.length > 0) {
    console.error(`The model check failed with ${problems.length} problem(s):`)
    for (const problem of problems) console.error(`- ${problem}`)
    process.exitCode = 1
    return
  }
  console.log(
    `The model check passed: ${boneCount} bones, ${triangles} triangles drawn.`,
  )
}

if (import.meta.main) main()
