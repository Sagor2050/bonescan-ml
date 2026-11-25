import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, test, vi } from 'vitest'
import {
  changeShareLinkExpiry,
  createShareLink,
  loadDefaultShareExpiry,
  loadShareLinks,
  saveDefaultShareExpiry,
  turnOffShareLink,
} from './shareStore.ts'

function fakeClient(result: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null, ...result })
  const order = vi.fn().mockResolvedValue({ data: null, error: null, ...result })
  const select = vi.fn(() => ({ order }))
  const from = vi.fn(() => ({ select }))
  return { client: { rpc, from } as unknown as SupabaseClient, rpc, from, select, order }
}

const token = 'A'.repeat(43)

test('makes a link to the chosen reports and gives back its address once', async () => {
  const { client, rpc } = fakeClient({
    data: [{ id: 'link-1', token, expires_at: '2026-12-02T00:00:00Z' }],
  })

  const link = await createShareLink(['r1', 'r2'], 7, client)

  expect(rpc).toHaveBeenCalledWith('create_share_link', {
    report_ids: ['r1', 'r2'],
    expires_in_days: 7,
    use_default_expiry: false,
  })
  expect(link).toEqual({
    id: 'link-1',
    url: `${window.location.origin}/s/${token}`,
    expiresAt: '2026-12-02T00:00:00Z',
  })
})

test('never is sent as no expiry, not as the default', async () => {
  const { client, rpc } = fakeClient({ data: [{ id: 'l', token, expires_at: null }] })

  await createShareLink(['r1'], null, client)

  expect(rpc).toHaveBeenCalledWith('create_share_link', {
    report_ids: ['r1'],
    expires_in_days: null,
    use_default_expiry: false,
  })
})

test('leaving the expiry out uses the patient’s default', async () => {
  const { client, rpc } = fakeClient({ data: [{ id: 'l', token, expires_at: null }] })

  await createShareLink(['r1'], undefined, client)

  expect(rpc).toHaveBeenCalledWith('create_share_link', {
    report_ids: ['r1'],
    expires_in_days: null,
    use_default_expiry: true,
  })
})

test('a refused link, such as one with another account’s report, says it failed', async () => {
  const { client } = fakeClient({ error: { code: '42501' } })

  await expect(createShareLink(['someone-elses'], 7, client)).rejects.toThrow(
    'The link could not be made',
  )
})

test('lists links newest first, with their reports in exam order and their state', async () => {
  const { client, from, order } = fakeClient({
    data: [
      {
        id: 'l1',
        created_at: '2026-11-20T00:00:00Z',
        expires_at: null,
        revoked_at: null,
        share_link_reports: [
          { reports: { id: 'r2', exam_date: '2026-10-12' } },
          { reports: { id: 'r1', exam_date: '2026-09-14' } },
        ],
      },
      {
        id: 'l2',
        created_at: '2026-11-01T00:00:00Z',
        expires_at: null,
        revoked_at: '2026-11-02T00:00:00Z',
        share_link_reports: [],
      },
    ],
  })

  const links = await loadShareLinks(client)

  expect(from).toHaveBeenCalledWith('share_links')
  expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  expect(links[0].reports.map((report) => report.id)).toEqual(['r1', 'r2'])
  expect(links.map((link) => link.state)).toEqual(['active', 'turned_off'])
})

test('changes a link’s expiry and turns links off through the checked functions', async () => {
  const { client, rpc } = fakeClient({})

  await changeShareLinkExpiry('l1', 90, client)
  await turnOffShareLink('l1', client)

  expect(rpc).toHaveBeenNthCalledWith(1, 'set_share_link_expiry', {
    link_id: 'l1',
    expires_in_days: 90,
  })
  expect(rpc).toHaveBeenNthCalledWith(2, 'revoke_share_link', { link_id: 'l1' })
})

test('changing or turning off a link that isn’t the patient’s fails', async () => {
  const { client } = fakeClient({ error: { code: '42501' } })

  await expect(changeShareLinkExpiry('other', 7, client)).rejects.toThrow('could not be changed')
  await expect(turnOffShareLink('other', client)).rejects.toThrow('could not be turned off')
})

test('reads and saves the default expiry, where null means never', async () => {
  const { client, rpc } = fakeClient({ data: null })

  expect(await loadDefaultShareExpiry(client)).toBeNull()
  await saveDefaultShareExpiry(14, client)

  expect(rpc).toHaveBeenNthCalledWith(1, 'my_default_share_expiry')
  expect(rpc).toHaveBeenNthCalledWith(2, 'set_default_share_expiry', { days: 14 })
})
