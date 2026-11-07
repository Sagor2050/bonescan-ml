#!/usr/bin/env node
// The Milestone 4 proofs and the NFR1 and NFR2 timings, on the live site.
//
//   cd web && node live-proofs/run.mjs              # asks for test accounts
//   cd web && node live-proofs/run.mjs --no-login   # only what needs no account
//
// A person runs this by hand. It's separate from `npm run test:e2e`, because tests
// never run against the live project. See supabase/README.md for the steps.
//
// It adds fictional reports only and removes what it adds. Passwords are typed in
// here and never saved. The results file holds pass or fail, status codes, and
// timings. It never holds an email address, password, token, or report text, so
// it's safe to share.
//
// The project address and publishable key come from the deployed page, the same
// way any visitor's browser gets them, so no env file or secret is needed.

import { chromium } from '@playwright/test'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'

const SITE = process.env.PROOF_SITE ?? 'https://bonescan-ml.vercel.app'
const NO_LOGIN = process.argv.includes('--no-login')
const FIXTURES = new URL('../../tests/fixtures/', import.meta.url)
const RESULTS = new URL('./results.json', import.meta.url)
const MARKER = /radius \(forearm bone, thumb side\)/
const B1_WORDING = 'Mildly angulated distal left radius fracture.'
const THREE_FRACTURES =
  'EXAM: XR FICTIONAL\nDATE OF EXAM: 09/14/2026\nFINDINGS: Fracture of the left radius. Fracture of the right tibia. Fracture of the left femur.'

// Scrubs anything secret out of an error before it can reach the results.
const secrets = new Set()
function scrub(text) {
  let clean = String(text)
  for (const secret of secrets) clean = clean.split(secret).join('<hidden>')
  return clean
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '<token>')
    .replace(/sb_[a-z]+_[\w-]+/g, '<key>')
    .slice(0, 300)
}

const results = []
let group = ''

function record(name, status, detail = '') {
  results.push({ group, name, status, detail: scrub(detail) })
  const mark = { pass: 'PASS', fail: 'FAIL', error: 'ERROR', info: 'INFO' }[status]
  console.log(`  ${mark.padEnd(5)} ${name}${detail ? ` (${scrub(detail)})` : ''}`)
}

// Runs one check. It passes on `true`, or on `{ ok, detail }`. A check that
// crashes is an error, never a pass, and doesn't stop the rest.
async function check(name, run) {
  try {
    const outcome = await run()
    const ok = typeof outcome === 'object' ? outcome.ok : outcome
    record(name, ok ? 'pass' : 'fail', outcome?.detail ?? '')
    return ok
  } catch (problem) {
    record(name, 'error', problem.message)
    return false
  }
}

// A failed clean-up is reported, and never stops the rest or loses the results.
async function cleanUp(what, run) {
  try {
    await run()
  } catch (problem) {
    record(`Couldn't remove ${what}, so remove it by hand`, 'error', problem.message)
  }
}

function section(title) {
  group = title
  console.log(`\n${title}`)
}

// --- The deployed page, and calls to its services ---------------------------

// The Supabase library itself mentions the bare prefix, so a secret key is the
// prefix followed by the key. An older-style key is a token that names its role.
function holdsSecret(code) {
  if (/sb_secret_[\w-]{16,}/.test(code)) return true
  const tokens = code.match(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g) ?? []
  return tokens.some((token) => {
    try {
      const claims = Buffer.from(token.split('.')[1], 'base64url').toString()
      return JSON.parse(claims).role !== 'anon'
    } catch {
      return true
    }
  })
}

async function findProject() {
  const page = await (await fetch(SITE)).text()
  const path = page.match(/\/assets\/index-[^"]+\.js/)?.[0]
  const code = path ? await (await fetch(new URL(path, SITE))).text() : ''
  const project = {
    url:
      process.env.PROOF_SUPABASE_URL ??
      code.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0],
    key:
      process.env.PROOF_KEY ??
      code.match(/sb_publishable_[\w-]+|eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/)?.[0],
    reader:
      process.env.PROOF_READER ??
      code.match(/https:\/\/[a-z0-9.-]+\.onrender\.com/)?.[0],
    leaksSecret: holdsSecret(code),
  }
  if (!project.url || !project.key || !project.reader) {
    throw new Error('Could not find the project settings on the deployed page.')
  }
  secrets.add(project.key)
  return project
}

function api(project) {
  async function call(token, method, url, { json, bytes, type, headers } = {}) {
    const response = await fetch(`${project.url}${url}`, {
      method,
      headers: {
        apikey: project.key,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(type ? { 'Content-Type': type } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : bytes,
    })
    const body = await response.arrayBuffer()
    let parsed = null
    try {
      parsed = JSON.parse(Buffer.from(body).toString())
    } catch {
      parsed = null
    }
    return { status: response.status, json: parsed, bytes: Buffer.from(body) }
  }
  const returning = { Prefer: 'return=representation' }
  return {
    call,
    signIn: (email, password) =>
      call(null, 'POST', '/auth/v1/token?grant_type=password', {
        json: { email, password },
      }),
    select: (token, table, query) =>
      call(token, 'GET', `/rest/v1/${table}?${query}`),
    insert: (token, table, row) =>
      call(token, 'POST', `/rest/v1/${table}`, { json: row, headers: returning }),
    update: (token, table, query, change) =>
      call(token, 'PATCH', `/rest/v1/${table}?${query}`, {
        json: change,
        headers: returning,
      }),
    remove: (token, table, query) =>
      call(token, 'DELETE', `/rest/v1/${table}?${query}`, { headers: returning }),
    rpc: (token, name, args = {}) =>
      call(token, 'POST', `/rest/v1/rpc/${name}`, { json: args }),
    list: (token, prefix) =>
      call(token, 'POST', '/storage/v1/object/list/reports', {
        json: { prefix, limit: 100, offset: 0 },
      }),
    download: (token, path) =>
      call(token, 'GET', `/storage/v1/object/reports/${path}`),
    upload: (token, path, bytes, type = 'application/pdf', upsert = false) =>
      call(token, 'POST', `/storage/v1/object/reports/${path}`, {
        bytes,
        type,
        headers: { 'x-upsert': String(upsert) },
      }),
    sign: (token, path) =>
      call(token, 'POST', `/storage/v1/object/sign/reports/${path}`, {
        json: { expiresIn: 60 },
      }),
    removeFiles: (token, paths) =>
      call(token, 'DELETE', '/storage/v1/object/reports', {
        json: { prefixes: paths },
      }),
    moveFile: (token, from, to) =>
      call(token, 'POST', '/storage/v1/object/move', {
        json: { bucketId: 'reports', sourceKey: from, destinationKey: to },
      }),
    copyFile: (token, from, to) =>
      call(token, 'POST', '/storage/v1/object/copy', {
        json: { bucketId: 'reports', sourceKey: from, destinationKey: to },
      }),
  }
}

// Refused means an error status, or a success that touched or returned nothing.
const refused = (response) =>
  response.status >= 400 ||
  (Array.isArray(response.json) && response.json.length === 0)

const refusal = (response) => ({
  ok: refused(response),
  detail: `HTTP ${response.status}`,
})

// --- Fictional files ---------------------------------------------------------

function buildPdf(pages) {
  const escape = (line) => line.replace(/([\\()])/g, '\\$1')
  const pageIds = pages.map((_, index) => 3 + index * 2)
  const fontId = 3 + pages.length * 2
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  ]
  pages.forEach((lines, index) => {
    const text = lines.map(
      (line, row) => `1 0 0 1 72 ${720 - row * 18} Tm (${escape(line)}) Tj`,
    )
    const content = ['BT /F1 11 Tf', ...text, 'ET'].join('\n')
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    )
  })
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')

  let output = '%PDF-1.4\n'
  const offsets = objects.map((body, index) => {
    const offset = output.length
    output += `${index + 1} 0 obj\n${body}\nendobj\n`
    return offset
  })
  const xref = output.length
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    output += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  output += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(output)
}

function fictionalFiles(folder) {
  const b1 = readFileSync(new URL('report-b1.txt', FIXTURES), 'utf8').split('\n')
  const filler = Array.from(
    { length: 30 },
    (_, row) => `Fictional filler line ${row + 1} for a timing test.`,
  )
  const pages = (count) => [
    ...Array.from({ length: count - 1 }, () => filler),
    b1.filter(Boolean),
  ]
  const onePage = buildPdf(pages(1))
  const files = {
    tenPages: buildPdf(pages(10)),
    elevenPages: buildPdf(pages(11)),
    noText: buildPdf([[]]),
    // Over the limit by a megabyte: a real PDF followed by harmless padding.
    elevenMb: Buffer.concat([onePage, Buffer.alloc(11 * 1024 * 1024, 0x20)]),
    word: Buffer.concat([
      Buffer.from('PK\x03\x04'),
      Buffer.from('fictional, not really a Word file'),
    ]),
  }
  const names = {
    tenPages: 'ten-pages.pdf',
    elevenPages: 'eleven-pages.pdf',
    noText: 'no-text.pdf',
    elevenMb: 'eleven-mb.pdf',
    word: 'report.docx',
  }
  const paths = {}
  for (const [key, bytes] of Object.entries(files)) {
    paths[key] = join(folder, names[key])
    writeFileSync(paths[key], bytes)
  }
  return { paths, files }
}

// --- No account needed -------------------------------------------------------

async function checksWithoutAccount(project, client) {
  const unknownId = randomUUID()
  section('Without signing in')

  await check('The deployed page holds no secret or service role key', () => ({
    ok: !project.leaksSecret,
  }))
  await check('A visitor can\'t read reports', async () =>
    refusal(await client.select(null, 'reports', 'select=id')),
  )
  await check('A visitor can\'t read findings', async () =>
    refusal(await client.select(null, 'findings', 'select=id')),
  )
  await check('A visitor can\'t add a report', async () =>
    refusal(
      await client.insert(null, 'reports', {
        id: unknownId,
        user_id: unknownId,
        source: 'pasted',
        raw_text: 'Fictional proof report.',
        exam_date: '2026-09-14',
        exam_date_source: 'report',
      }),
    ),
  )
  await check('A visitor can\'t list files', async () =>
    refusal(await client.list(null, '')),
  )
  await check('A visitor can\'t upload a file', async () =>
    refusal(
      await client.upload(null, `${unknownId}/${unknownId}.pdf`, buildPdf([['x']])),
    ),
  )
  await check('The reports bucket isn\'t public', async () =>
    refusal(
      await client.call(
        null,
        'GET',
        `/storage/v1/object/public/reports/${unknownId}/${unknownId}.pdf`,
      ),
    ),
  )
  await check('A visitor can\'t call the account deletion function', async () =>
    refusal(await client.rpc(null, 'delete_my_account')),
  )

  const read = (headers) =>
    fetch(`${project.reader}/read`, {
      method: 'POST',
      headers,
      body: (() => {
        const form = new FormData()
        form.append('text', 'Fictional proof report.')
        return form
      })(),
    })
  await check('The reader is up', async () => {
    const response = await fetch(`${project.reader}/health`)
    return { ok: response.ok, detail: `HTTP ${response.status}` }
  })
  await check('The reader refuses a request with no token', async () => {
    const { status } = await read({ Origin: SITE })
    return { ok: status === 401, detail: `HTTP ${status}` }
  })
  await check('The reader refuses a made-up token', async () => {
    const { status } = await read({
      Origin: SITE,
      Authorization: 'Bearer not-a-token',
    })
    return { ok: status === 401, detail: `HTTP ${status}` }
  })
  await check('The reader refuses another site', async () => {
    const { status } = await read({
      Origin: 'https://example.com',
      Authorization: 'Bearer not-a-token',
    })
    return { ok: status === 403, detail: `HTTP ${status}` }
  })
}

// --- Two accounts, directly through Supabase's API ---------------------------

async function checksThroughApi(client, a, b) {
  section('Account B against account A, directly through the API')
  const reportId = randomUUID()
  const findingId = randomUUID()
  const filePath = `${a.id}/${reportId}.pdf`
  const pdf = readFileSync(new URL('report-b1.pdf', FIXTURES))
  const rawText = 'Fictional proof report. FINDINGS: Left radius fracture.'
  const stolen = `${b.id}/${randomUUID()}.pdf`

  const uploaded = await client.upload(a.token, filePath, pdf)
  const added = await client.insert(a.token, 'reports', {
    id: reportId,
    source: 'pdf',
    file_path: filePath,
    raw_text: rawText,
    exam_date: '2026-09-14',
    exam_date_source: 'report',
  })
  const addedFinding = await client.insert(a.token, 'findings', {
    id: findingId,
    report_id: reportId,
    bone: 'radius',
    side: 'left',
    certainty: 'certain',
    status: 'placed',
  })
  const ready = await check('Account A adds a report, finding, and file', () => ({
    ok:
      uploaded.status < 300 && added.status < 300 && addedFinding.status < 300,
    detail: `HTTP ${uploaded.status}, ${added.status}, ${addedFinding.status}`,
  }))
  if (!ready) return

  try {
    const byB = {
      'read A\'s report': () => client.select(b.token, 'reports', `id=eq.${reportId}`),
      'read A\'s findings': () =>
        client.select(b.token, 'findings', `report_id=eq.${reportId}`),
      'change A\'s exam date': () =>
        client.update(b.token, 'reports', `id=eq.${reportId}`, {
          exam_date: '2020-01-01',
          exam_date_source: 'patient',
        }),
      'change A\'s finding': () =>
        client.update(b.token, 'findings', `id=eq.${findingId}`, { side: 'right' }),
      'delete A\'s finding': () =>
        client.remove(b.token, 'findings', `id=eq.${findingId}`),
      'delete A\'s report': () =>
        client.remove(b.token, 'reports', `id=eq.${reportId}`),
      'add a report under A\'s account': () =>
        client.insert(b.token, 'reports', {
          user_id: a.id,
          source: 'pasted',
          raw_text: 'Fictional proof report.',
          exam_date: '2026-09-14',
          exam_date_source: 'report',
        }),
      'add a finding to A\'s report': () =>
        client.insert(b.token, 'findings', {
          report_id: reportId,
          certainty: 'certain',
          status: 'placed',
        }),
      'list A\'s files': () => client.list(b.token, a.id),
      'download A\'s file': () => client.download(b.token, filePath),
      'get a signed link to A\'s file': () => client.sign(b.token, filePath),
      'add a file to A\'s folder': () =>
        client.upload(b.token, `${a.id}/${randomUUID()}.pdf`, pdf),
      'overwrite A\'s file': () => client.upload(b.token, filePath, pdf, undefined, true),
      'move A\'s file to B\'s folder': () => client.moveFile(b.token, filePath, stolen),
      'copy A\'s file to B\'s folder': () => client.copyFile(b.token, filePath, stolen),
      'delete A\'s file': () => client.removeFiles(b.token, [filePath]),
    }
    for (const [name, attempt] of Object.entries(byB)) {
      await check(`B can't ${name}`, async () => refusal(await attempt()))
    }

    await check('B\'s list of all reports doesn\'t include A\'s', async () => {
      const { json } = await client.select(b.token, 'reports', 'select=id')
      return Array.isArray(json) && !json.some((row) => row.id === reportId)
    })
    await check('A made-up token reads nothing', async () =>
      refusal(await client.select('not-a-token', 'reports', 'select=id')),
    )

    // Refused responses prove little alone, so A checks everything is unchanged.
    await check('A\'s report is unchanged after all of that', async () => {
      const { json } = await client.select(a.token, 'reports', `id=eq.${reportId}`)
      return (
        json?.[0]?.raw_text === rawText &&
        json?.[0]?.exam_date === '2026-09-14' &&
        json?.[0]?.exam_date_source === 'report'
      )
    })
    await check('A\'s finding is unchanged after all of that', async () => {
      const { json } = await client.select(a.token, 'findings', `id=eq.${findingId}`)
      return json?.[0]?.side === 'left'
    })
    await check('A\'s file is byte for byte unchanged', async () => {
      const { status, bytes } = await client.download(a.token, filePath)
      return { ok: status === 200 && bytes.equals(pdf), detail: `HTTP ${status}` }
    })
    await check('Nothing of A\'s reached B\'s folder', async () => {
      const { status } = await client.download(b.token, stolen)
      return { ok: status >= 400, detail: `HTTP ${status}` }
    })

    section('The original report stays as it was added (NFR4)')
    await check('A can\'t edit their own report text', async () =>
      refusal(
        await client.update(a.token, 'reports', `id=eq.${reportId}`, {
          raw_text: 'Changed.',
        }),
      ),
    )
    await check('A can\'t overwrite their own file', async () =>
      refusal(await client.upload(a.token, filePath, buildPdf([['x']]), undefined, true)),
    )

    section('The file store\'s own limits')
    const oversized = Buffer.concat([pdf, Buffer.alloc(11 * 1024 * 1024, 0x20)])
    const oversizedPath = `${b.id}/${randomUUID()}.pdf`
    await check('An 11 MB file can\'t go straight into storage', async () =>
      refusal(await client.upload(b.token, oversizedPath, oversized)),
    )
    const wordPath = `${b.id}/${randomUUID()}.pdf`
    await check('A Word file can\'t go straight into storage', async () =>
      refusal(
        await client.upload(
          b.token,
          wordPath,
          Buffer.from('fictional'),
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ),
    )
    await client.removeFiles(b.token, [oversizedPath, wordPath, stolen])
  } finally {
    await cleanUp('account A\'s proof report', async () => {
      await client.removeFiles(a.token, [filePath])
      await client.remove(a.token, 'reports', `id=eq.${reportId}`)
    })
  }

  section('After account A removes its proof report')
  await check('The report and its findings are gone', async () => {
    const reports = await client.select(a.token, 'reports', `id=eq.${reportId}`)
    const findings = await client.select(a.token, 'findings', `id=eq.${findingId}`)
    return reports.json?.length === 0 && findings.json?.length === 0
  })
  await check('The file is gone', async () => {
    const { status } = await client.download(a.token, filePath)
    return { ok: status >= 400, detail: `HTTP ${status}` }
  })
}

// --- Through the app ---------------------------------------------------------

const model = (page) => page.getByRole('region', { name: '3D skeleton' })
const markerLabels = (page) => model(page).getByRole('button', { name: /\(.*\)/ })
const url = (path) => new URL(path, SITE).href

async function signInThroughApp(page, account) {
  await page.goto(url('/sign-in'))
  await page.getByLabel('Email address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL(url('/reports'), { timeout: 30_000 })
}

async function readThroughApp(page, input) {
  await page.goto(url('/add-report'))
  if (input.file) {
    await page.getByLabel(/PDF file/).setInputFiles(input.file)
  } else {
    await page.getByRole('radio', { name: 'Paste the text' }).check()
    await page.getByLabel('Report text').fill(input.text)
  }
  const started = performance.now()
  await page.getByRole('button', { name: 'Read my report' }).click()
  return started
}

// Up to 90 seconds, because the reader's free hosting can be asleep.
async function readUntilChecking(page, input) {
  const started = await readThroughApp(page, input)
  await page.waitForURL(url('/verify-findings'), { timeout: 90_000 })
  return performance.now() - started
}

async function confirmUntilMarkers(page, count = 1) {
  const started = performance.now()
  await page.getByRole('button', { name: 'Confirm and see the skeleton' }).click()
  await page.waitForFunction(
    (expected) => {
      const region = document.querySelector('[aria-label="3D skeleton"]')
      const buttons = region ? [...region.querySelectorAll('button')] : []
      const labels = buttons.filter((button) =>
        /\(.*\)/.test(button.getAttribute('aria-label') ?? button.textContent),
      )
      return labels.length >= expected
    },
    count,
    { timeout: 60_000 },
  )
  return performance.now() - started
}

const reportIdOf = (page) => new URL(page.url()).pathname.split('/').pop()
const bodyText = (page) => page.locator('body').innerText()
const seconds = (ms) => `${(ms / 1000).toFixed(2)} s`

async function checksThroughApp(project, client, browser, a, b, files) {
  const fixture = (name) => new URL(name, FIXTURES).pathname
  const added = []
  const first = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const second = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const asB = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  let pdfReportId = null
  const computerOne = await first.newPage()

  try {
    section('A new user adds B.1 and corrects a finding, through the app')
    await check('Signs in on the first computer', async () => {
      await signInThroughApp(computerOne, a)
      return true
    })
    await check('B.1 as a PDF shows its one finding', async () => {
      const time = await readUntilChecking(computerOne, {
        file: fixture('report-b1.pdf'),
      })
      await computerOne
        .getByRole('heading', { name: 'radius (forearm bone, thumb side), left side' })
        .waitFor({ timeout: 10_000 })
      await computerOne.getByText(B1_WORDING).waitFor({ timeout: 10_000 })
      return { ok: true, detail: `first read took ${seconds(time)}` }
    })
    await check('Correcting a finding marks it as entered by the patient', async () => {
      await computerOne.getByRole('button', { name: 'Change finding 1' }).click()
      await computerOne.getByLabel('Side for finding 1').selectOption('right')
      await computerOne.getByText('Entered by you').first().waitFor({ timeout: 10_000 })
      return true
    })
    await check('The corrected finding has a marker on the skeleton', async () => {
      await confirmUntilMarkers(computerOne)
      pdfReportId = reportIdOf(computerOne)
      added.push({ owner: a, id: pdfReportId })
      return (await markerLabels(computerOne).first().innerText()).match(MARKER) !== null
    })
    await check('B.1 as pasted text shows the same finding and a marker', async () => {
      const text = readFileSync(new URL('report-b1.txt', FIXTURES), 'utf8')
      await readUntilChecking(computerOne, { text })
      await computerOne
        .getByRole('heading', { name: 'radius (forearm bone, thumb side), left side' })
        .waitFor({ timeout: 10_000 })
      await confirmUntilMarkers(computerOne)
      added.push({ owner: a, id: reportIdOf(computerOne) })
      return true
    })

    section('Account B against account A, through the app')
    const pageB = await asB.newPage()
    await check('B signs in', async () => {
      await signInThroughApp(pageB, b)
      return true
    })
    await check('B\'s timeline shows nothing of A\'s', async () => {
      await pageB.getByRole('heading', { name: 'My reports' }).waitFor()
      await pageB.waitForLoadState('networkidle')
      return !(await bodyText(pageB)).includes('Sep 14, 2026')
    })
    await check('B opening A\'s report link sees none of it', async () => {
      await pageB.goto(url(`/reports/${pdfReportId}`))
      await pageB.waitForLoadState('networkidle')
      await pageB.waitForTimeout(1500)
      return (
        !(await bodyText(pageB)).includes(B1_WORDING) &&
        (await markerLabels(pageB).count()) === 0
      )
    })

    section('A report is there on another computer (separate browser profiles)')
    const computerTwo = await second.newPage()
    await check('A signs in on a second browser profile', async () => {
      await signInThroughApp(computerTwo, a)
      return true
    })
    await check('The report, its finding, and its marker are there', async () => {
      await computerTwo.goto(url(`/reports/${pdfReportId}`))
      await markerLabels(computerTwo).first().waitFor({ timeout: 60_000 })
      return true
    })
    await check('The original PDF opens there, too', async () => {
      const response = computerTwo.waitForResponse(
        (r) => r.url().includes('/storage/v1/object/reports/') && r.status() === 200,
        { timeout: 30_000 },
      )
      await computerTwo.reload()
      await response
      return true
    })
    await second.close()

    section('Nothing is left after signing out')
    await check('Signing out removes everything from the browser', async () => {
      await computerOne.goto(url(`/reports/${pdfReportId}`))
      await computerOne.getByRole('button', { name: 'Sign out' }).click()
      await computerOne.waitForURL(url('/'), { timeout: 15_000 })
      const left = await computerOne.evaluate(() => {
        const session = { ...sessionStorage }
        const local = { ...localStorage }
        return JSON.stringify({ session, local })
      })
      const cookies = await first.cookies()
      return {
        ok:
          !left.includes('sb-') &&
          !left.includes('radius') &&
          !cookies.some((cookie) => cookie.name.startsWith('sb-')),
        detail: `${cookies.length} cookies`,
      }
    })
    await check('The Back button shows nothing of the report', async () => {
      await computerOne.goBack()
      await computerOne.waitForTimeout(1500)
      return !(await bodyText(computerOne)).includes(B1_WORDING)
    })
    await check('My reports now goes to the sign-in screen', async () => {
      await computerOne.goto(url('/reports'))
      await computerOne.waitForURL(url('/sign-in'), { timeout: 15_000 })
      return true
    })

    section('Files that are turned away, through the app')
    const counts = async () => {
      const rows = await client.select(b.token, 'reports', 'select=id')
      const stored = await client.list(b.token, b.id)
      return `${rows.json?.length} reports, ${stored.json?.length} files`
    }
    const before = await counts()
    const turnedAway = [
      ['A Word file', files.word, "isn't a PDF"],
      ['An 11 MB PDF', files.elevenMb, 'over the 10 MB limit'],
      ['An 11-page PDF', files.elevenPages, 'more than 10 pages'],
      ['A PDF with no text', files.noText, "couldn't find any text"],
    ]
    for (const [name, file, message] of turnedAway) {
      await check(`${name} is turned away and says why`, async () => {
        await readThroughApp(pageB, { file })
        const alert = pageB.getByRole('alert')
        await alert.waitFor({ timeout: 90_000 })
        return {
          ok:
            (await alert.innerText()).includes(message) &&
            new URL(pageB.url()).pathname === '/add-report',
        }
      })
    }
    await check('None of those saved anything', async () => {
      const after = await counts()
      return { ok: after === before, detail: `${before}, then ${after}` }
    })

    section('Timing: findings ready (NFR1, target under 10 s)')
    const reads = []
    for (let run = 1; run <= 5; run += 1) {
      await check(`10-page PDF, run ${run}`, async () => {
        const time = await readUntilChecking(pageB, { file: files.tenPages })
        reads.push(time)
        return { ok: time < 10_000, detail: seconds(time) }
      })
    }
    if (reads.length > 0) {
      record('Slowest 10-page read', 'info', seconds(Math.max(...reads)))
    }

    section('Timing: model and every marker (NFR2, target under 5 s)')
    const shows = []
    for (let run = 1; run <= 3; run += 1) {
      // A new profile each time, so the model downloads as for a first visit.
      const fresh = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      try {
        const page = await fresh.newPage()
        await signInThroughApp(page, b)
        await check(`Three markers from a fresh browser, run ${run}`, async () => {
          await readUntilChecking(page, { text: THREE_FRACTURES })
          const time = await confirmUntilMarkers(page, 3)
          shows.push(time)
          added.push({ owner: b, id: reportIdOf(page) })
          return { ok: time < 5000, detail: seconds(time) }
        })
      } finally {
        await fresh.close()
      }
    }
    if (shows.length > 0) {
      record('Slowest model and markers', 'info', seconds(Math.max(...shows)))
    }
    record(
      'What these timings ran on',
      'info',
      'headless Chromium with software graphics, on the machine that ran this script',
    )
  } finally {
    section('Removing the proof reports')
    for (const { owner, id } of added) {
      await cleanUp('a proof report', async () => {
        const { json } = await client.select(owner.token, 'reports', `id=eq.${id}`)
        if (json?.[0]?.file_path) {
          await client.removeFiles(owner.token, [json[0].file_path])
        }
        await client.remove(owner.token, 'reports', `id=eq.${id}`)
      })
    }
    record('Removed', 'info', `${added.length} reports`)
    await first.close()
    await asB.close()
  }
}

// --- Other account checks ----------------------------------------------------

async function checkDuplicateSignUp(client, a) {
  section('One email address, one account')
  await check('Signing up again doesn\'t create or change an account', async () => {
    const { json } = await client.call(null, 'POST', '/auth/v1/signup', {
      json: { email: a.email, password: randomBytes(18).toString('base64url') },
    })
    const noNewIdentity = (json?.identities ?? []).length === 0
    const stillWorks = await client.signIn(a.email, a.password)
    return {
      ok: noNewIdentity && !json?.access_token && stillWorks.status === 200,
      detail: `original password: HTTP ${stillWorks.status}`,
    }
  })
}

async function checkDeletingAccount(client, browser, c) {
  section('Deleting an account (S6.3)')
  const reportId = randomUUID()
  const filePath = `${c.id}/${reportId}.pdf`
  const pdf = readFileSync(new URL('report-b1.pdf', FIXTURES))
  await check('The account to delete has a report and a file', async () => {
    const uploaded = await client.upload(c.token, filePath, pdf)
    const added = await client.insert(c.token, 'reports', {
      id: reportId,
      source: 'pdf',
      file_path: filePath,
      raw_text: 'Fictional proof report.',
      exam_date: '2026-09-14',
      exam_date_source: 'report',
    })
    return uploaded.status < 300 && added.status < 300
  })

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  try {
    await signInThroughApp(page, c)
    await page.goto(url('/account'))
    await page.getByRole('button', { name: 'Delete my account' }).click()
    await check('A wrong password deletes nothing', async () => {
      await page.getByLabel('Enter your password to confirm').fill('not-the-password-1')
      await page.getByRole('button', { name: 'Yes, delete everything' }).click()
      await page.getByRole('alert').waitFor({ timeout: 15_000 })
      const stillThere = await client.select(c.token, 'reports', `id=eq.${reportId}`)
      return stillThere.json?.length === 1
    })
    await check('The right password deletes the account', async () => {
      await page.getByLabel('Enter your password to confirm').fill(c.password)
      await page.getByRole('button', { name: 'Yes, delete everything' }).click()
      await page.waitForURL(url('/'), { timeout: 30_000 })
      return true
    })
  } finally {
    await context.close()
  }

  await check('The old password no longer signs in', async () => {
    const { status } = await client.signIn(c.email, c.password)
    return { ok: status >= 400, detail: `HTTP ${status}` }
  })
  await check('No report rows remain', async () =>
    refusal(await client.select(c.token, 'reports', `id=eq.${reportId}`)),
  )
  await check('No files remain', async () => {
    const download = await client.download(c.token, filePath)
    const listing = await client.list(c.token, c.id)
    return {
      ok: download.status >= 400 && refused(listing),
      detail: `HTTP ${download.status}, ${listing.status}`,
    }
  })
}

// --- Asking for accounts -----------------------------------------------------

function prompter() {
  let muted = false
  const output = new Writable({
    write(chunk, _encoding, done) {
      if (!muted) process.stdout.write(chunk)
      done()
    },
  })
  const reader = createInterface({
    input: process.stdin,
    output,
    terminal: Boolean(process.stdin.isTTY),
  })
  const lines = reader[Symbol.asyncIterator]()
  return {
    async ask(question, { hidden = false } = {}) {
      process.stdout.write(question)
      muted = hidden
      const { value } = await lines.next()
      muted = false
      if (hidden) process.stdout.write('\n')
      return (value ?? '').trim()
    },
    close: () => reader.close(),
  }
}

async function signInAccount(client, prompts, label) {
  const email = await prompts.ask(`Account ${label} email: `)
  if (!email) return null
  const password = await prompts.ask(`Account ${label} password (hidden): `, {
    hidden: true,
  })
  secrets.add(email)
  secrets.add(password)
  const { status, json } = await client.signIn(email, password)
  if (status !== 200) {
    throw new Error(`Account ${label} can't sign in (HTTP ${status}). Is it confirmed?`)
  }
  secrets.add(json.access_token)
  return { email, password, id: json.user.id, token: json.access_token }
}

// --- Run ---------------------------------------------------------------------

function saveResults() {
  const tally = (status) => results.filter((r) => r.status === status).length
  writeFileSync(
    RESULTS,
    `${JSON.stringify({ site: SITE, ranAt: new Date().toISOString(), noLogin: NO_LOGIN, results }, null, 2)}\n`,
  )
  console.log(
    `\n${tally('pass')} passed, ${tally('fail')} failed, ${tally('error')} couldn't run.`,
  )
  console.log(`Results, with no secrets or report text: ${RESULTS.pathname}`)
  return tally('fail') + tally('error') === 0
}

async function main() {
  const project = await findProject()
  const client = api(project)
  await checksWithoutAccount(project, client)

  if (!NO_LOGIN) {
    const prompts = prompter()
    console.log(`
This needs test accounts you've made on the live site and confirmed. Use only
accounts made for this. Leave account C's email empty to skip deleting an account.
`)
    const a = await signInAccount(client, prompts, 'A')
    const b = await signInAccount(client, prompts, 'B')
    const c = await signInAccount(client, prompts, 'C (this one gets deleted)')
    let deleteC = false
    if (c) {
      deleteC =
        (await prompts.ask(`Type DELETE to delete ${c.email} for good: `)) === 'DELETE'
    }
    prompts.close()
    if (a.id === b.id) throw new Error('Accounts A and B must be different.')

    await checksThroughApi(client, a, b)
    await checkDuplicateSignUp(client, a)

    const folder = mkdtempSync(join(tmpdir(), 'bonescan-proofs-'))
    const browser = await chromium.launch()
    try {
      const { paths } = fictionalFiles(folder)
      await checksThroughApp(project, client, browser, a, b, paths)
      if (deleteC) {
        await checkDeletingAccount(client, browser, c)
        console.log(`
Last steps by hand, for the deleted account:
1. In Supabase's SQL Editor, run these. Both should say 0:
     select count(*) from public.reports where user_id = '${c.id}';
     select count(*) from storage.objects where name like '${c.id}/%';
2. Sign up again on the live site with the same email and confirm it. The new
   account should have no reports.`)
      }
    } finally {
      await browser.close()
      rmSync(folder, { recursive: true, force: true })
    }
  }
}

// Whatever happens, the results so far are saved.
main()
  .catch((problem) => {
    record('The run stopped early', 'error', problem.message)
  })
  .finally(() => {
    process.exitCode = saveResults() ? 0 : 1
  })
