import { use } from 'react'

// An entry in the one bone catalog (Plan B.4). Nothing else may list bone names.
export type Point = [number, number, number]

export type Bone = {
  id: string
  bone: string
  side: 'left' | 'right'
  medical: string
  everyday: string
  words: string[]
  parts: Record<string, Point>
}

export const BONES_URL = '/shared/bones.json'

let catalog: Promise<Bone[]> | undefined

function loadBones() {
  catalog ??= fetch(BONES_URL).then((response) => {
    if (!response.ok) throw new Error('The bone catalog could not be loaded.')
    return response.json() as Promise<Bone[]>
  })
  return catalog
}

// Suspends until the catalog has loaded. Use it under a Suspense boundary.
export function useBones() {
  return use(loadBones())
}

// As in S3.1: "radius (forearm bone, thumb side)".
export function boneLabel(bone: Pick<Bone, 'medical' | 'everyday'>) {
  return `${bone.medical} (${bone.everyday})`
}
