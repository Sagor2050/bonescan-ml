// @vitest-environment node
import { expect, test } from 'vitest'
import * as reportsRoute from '../api/shared/[token]/index.js'
import * as fileRoute from '../api/shared/[token]/reports/[index]/file.js'
import { LINK_UNAVAILABLE } from './sharedReports.js'

// The route files Vercel runs. Neither request here needs the database, so no
// Supabase settings are set.
const routes = [
  ['reports', reportsRoute, '/api/shared/not-a-token'],
  ['file', fileRoute, '/api/shared/not-a-token/reports/0/file'],
] as const

test.each(routes)('the %s route answers a dead link with the 404', async (_name, route, path) => {
  const response = await route.GET(new Request(`https://bonescan.example${path}`))
  expect(response.status).toBe(404)
  expect(await response.json()).toEqual({ error: LINK_UNAVAILABLE })
})

test.each(routes)('the %s route refuses every write', async (_name, route, path) => {
  for (const [method, handler] of Object.entries(route)) {
    if (method === 'GET') continue
    const response = await handler(
      new Request(`https://bonescan.example${path}`, { method }),
    )
    expect(response.status).toBe(405)
  }
  expect(Object.keys(route).sort()).toEqual(['DELETE', 'GET', 'PATCH', 'POST', 'PUT'])
})
