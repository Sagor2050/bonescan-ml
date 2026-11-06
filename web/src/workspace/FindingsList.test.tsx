import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Suspense } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import catalog from '../../public/shared/bones.json'
import type { Finding } from '../findings/types.ts'
import type { Bone } from '../viewer/bones.ts'
import FindingsList from './FindingsList.tsx'
import { findingSummary } from './findingSummary.ts'
import type { SavedFinding } from './reportStore.ts'
import WorkspaceController from './WorkspaceController.tsx'

const bones = catalog as unknown as Bone[]

function saved(fields: Partial<Finding>, id = 'finding-1'): SavedFinding {
  return {
    bone: 'radius',
    side: 'left',
    part: [],
    type_words: [],
    certainty: 'certain',
    healing_words: [],
    status: 'placed',
    wording: [],
    entered_by_patient: false,
    id,
    report_id: 'report-1',
    position: 0,
    ...fields,
  }
}

describe('findingSummary', () => {
  test('describes a placed finding from the catalog and the finding', () => {
    const summary = findingSummary(
      saved({
        part: ['distal', 'metaphysis'],
        type_words: ['transverse', 'mild dorsal angulation'],
      }),
      bones,
    )
    expect(summary).toMatchObject({
      title: 'Fracture',
      boneName: 'radius (forearm bone, thumb side)',
      sideLabel: 'Your left side',
      parts: 'distal, metaphysis',
      reportWords: 'transverse, mild dorsal angulation',
      noMarkerReason: null,
    })
  })

  test('shows healing words only when the report has them', () => {
    expect(findingSummary(saved({}), bones).healing).toEqual([])
    expect(
      findingSummary(saved({ healing_words: ['healed'] }), bones).healing,
    ).toEqual(['Healed: “healed”'])
  })

  test('titles an uncertain finding as possible', () => {
    expect(findingSummary(saved({ certainty: 'uncertain' }), bones).title).toBe(
      'Possible fracture',
    )
  })

  test('writes part names as words', () => {
    expect(
      findingSummary(saved({ part: ['medial_malleolus'] }), bones).parts,
    ).toBe('medial malleolus')
  })

  test('a finding outside coverage says so and quotes the report', () => {
    const summary = findingSummary(
      saved({
        bone: '',
        side: '',
        status: 'outside_coverage',
        wording: [{ start: 0, end: 20, text: 'Fracture of the rib.' }],
      }),
      bones,
    )
    expect(summary.noMarkerReason).toMatch(/Outside the bones this app covers/)
    expect(summary.boneName).toBeNull()
    expect(summary.reportSentence).toBe('Fracture of the rib.')
  })

  test('a finding with no side names the bone but no side', () => {
    const summary = findingSummary(
      saved({ side: '', status: 'side_not_stated' }),
      bones,
    )
    expect(summary.noMarkerReason).toMatch(/^Side not stated/)
    expect(summary.boneName).toBe('radius (forearm bone, thumb side)')
    expect(summary.sideLabel).toBeNull()
  })

  test('a finding with no bone says the bone is not stated', () => {
    const summary = findingSummary(
      saved({ bone: '', status: 'bone_not_stated' }),
      bones,
    )
    expect(summary.noMarkerReason).toMatch(/^Bone not stated/)
  })

  test('a placed finding on a bone the catalog lacks is not shown as placed', () => {
    const summary = findingSummary(saved({ bone: 'sacrum' }), bones)
    expect(summary.noMarkerReason).not.toBeNull()
    expect(summary.sideLabel).toBeNull()
  })
})

describe('FindingsList', () => {
  const findings = [
    saved({ bone: 'femur', side: 'right' }, 'a'),
    saved({ bone: 'tibia', side: 'left', certainty: 'uncertain' }, 'b'),
    saved({ side: '', status: 'side_not_stated' }, 'c'),
  ]

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(bones) }),
      ),
    )
  })

  async function renderList(list = findings) {
    await act(async () => {
      render(
        <WorkspaceController>
          <Suspense fallback="loading">
            <FindingsList findings={list} />
          </Suspense>
        </WorkspaceController>,
      )
    })
    return screen.getByRole('region', { name: 'Findings' })
  }

  function pressed(region: HTMLElement) {
    return within(region)
      .getAllByRole('button', { pressed: true })
      .map((button) => button.textContent)
  }

  test('lists every finding, with the reason when one has no marker', async () => {
    const region = await renderList()
    expect(within(region).getAllByRole('listitem')).toHaveLength(3)
    expect(region.textContent).toMatch(/femur \(thigh bone\)/)
    expect(region.textContent).toMatch(/Possible fracture/)
    expect(region.textContent).toMatch(/Side not stated/)
  })

  test('points back to the care team', async () => {
    const region = await renderList()
    expect(region.textContent).toMatch(/Ask your care team/)
  })

  test('choosing a finding selects it', async () => {
    const region = await renderList()
    fireEvent.click(within(region).getByRole('button', { name: /tibia/ }))
    expect(pressed(region)).toEqual([expect.stringMatching(/tibia/)])
    expect(region.textContent).toMatch(/2 of 3/)
  })

  test('steps through the findings one after another', async () => {
    const region = await renderList()
    const next = within(region).getByRole('button', { name: 'Next' })
    const previous = within(region).getByRole('button', { name: 'Previous' })

    fireEvent.click(next)
    expect(pressed(region)).toEqual([expect.stringMatching(/femur/)])
    fireEvent.click(next)
    expect(pressed(region)).toEqual([expect.stringMatching(/tibia/)])
    fireEvent.click(previous)
    expect(pressed(region)).toEqual([expect.stringMatching(/femur/)])
  })

  test('stepping stops at both ends', async () => {
    const region = await renderList()
    const next = within(region).getByRole('button', {
      name: 'Next',
    }) as HTMLButtonElement
    const previous = within(region).getByRole('button', {
      name: 'Previous',
    }) as HTMLButtonElement
    expect(previous.disabled).toBe(true)

    fireEvent.click(next)
    fireEvent.click(next)
    fireEvent.click(next)
    expect(next.disabled).toBe(true)
  })

  test('says so when a report has no findings', async () => {
    const region = await renderList([])
    expect(region.textContent).toMatch(/no findings to show/)
  })
})
