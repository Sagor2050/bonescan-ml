import { createContext, useContext } from 'react'

// Read-only mode, for someone viewing reports a patient shared with them
// (S10.3). Screens in this mode render no control that adds, changes, deletes,
// confirms, or shares anything, and speak about "the patient" instead of "you".
export const ReadOnlyContext = createContext(false)

export function useReadOnly() {
  return useContext(ReadOnlyContext)
}

export type Wording = {
  // Comes before a side, as in "Your left side".
  owner: string
  // Who the bones belong to, as in "not a model of your own bones".
  ownBones: string
  enteredByPatient: string
  sideNotStated: string
  boneNotStated: string
  // Who the healing belongs to, as in "not how you are healing".
  whoHeals: string
  careTeam: string
  originalReport: string
}

export const PATIENT_WORDING: Wording = {
  owner: 'Your',
  ownBones: 'your own bones',
  enteredByPatient: 'Entered by you',
  sideNotStated: 'Side not stated. No marker is shown until you set the side.',
  boneNotStated:
    'Bone not stated. No marker is shown until you choose the bone.',
  whoHeals: 'you are',
  careTeam: 'Questions about what this means? Ask your care team.',
  originalReport: 'Your original report',
}

export const VIEWER_WORDING: Wording = {
  owner: "The patient's",
  ownBones: "the patient's own bones",
  enteredByPatient: 'Entered by the patient',
  sideNotStated:
    'Side not stated. No marker is shown until the patient sets the side.',
  boneNotStated:
    'Bone not stated. No marker is shown until the patient chooses the bone.',
  whoHeals: 'the patient is',
  careTeam:
    'Questions about what this means? The patient can ask their care team.',
  originalReport: 'The original report',
}

export function useWording() {
  return useReadOnly() ? VIEWER_WORDING : PATIENT_WORDING
}
