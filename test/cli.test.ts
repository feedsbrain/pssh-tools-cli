import test from 'node:test'
import assert from 'node:assert/strict'
import { inspect } from 'node:util'

import * as pssh from '@feedsbrain/pssh-tools'

import {
  PR_TEST_KEY_SEED,
  base64ToHex,
  collect,
  createProgram,
  run,
  swapEndian
} from '../src/cli.ts'

// --- fixtures -------------------------------------------------------------

const KID = '43215678123412341234123412341234'
const ENCODED_KID = 'eFYhQzQSNBISNBI0EjQSNA==' // pssh.playready.encodeKey(KID, seed).kid

const keyPair = (() => {
  const eKey = pssh.playready.encodeKey({ kid: KID, key: '' }, PR_TEST_KEY_SEED)
  return {
    kid: pssh.playready.decodeKey(eKey.kid),
    key: pssh.playready.decodeKey(eKey.key)
  }
})()

const PLAYREADY_DATA = pssh.playready.encodePssh({
  keyPairs: [keyPair],
  compatibilityMode: true,
  dataOnly: true,
  checksum: true
})

const WIDEVINE_DATA = pssh.widevine.encodePssh({
  contentId: 'unit-content',
  keyIds: [KID],
  provider: 'unit-provider',
  protectionScheme: 'cenc',
  dataOnly: true
})

const WIDEVINE_BOX = pssh.widevine.encodePssh({
  contentId: 'unit-content',
  keyIds: [KID],
  provider: 'unit-provider',
  protectionScheme: 'cenc',
  dataOnly: false
})

// --- helpers -----------------------------------------------------------------

/** Run `fn`, returning everything it wrote to stdout/stderr as a single string. */
function capture (fn: () => void): string {
  const lines: string[] = []
  const original = { log: console.log, error: console.error }
  const sink = (...args: unknown[]): void => {
    lines.push(args.map(a => (typeof a === 'string' ? a : inspect(a))).join(' '))
  }
  console.log = sink as typeof console.log
  console.error = sink as typeof console.error
  try {
    fn()
  } finally {
    console.log = original.log
    console.error = original.error
  }
  return lines.join('\n')
}

/** Build a `process.argv`-style array for `run()`. */
const argv = (...args: string[]): string[] => ['node', 'psshtools', ...args]

/** The longest base64-looking line in some CLI output (the generated PSSH blob). */
function base64Blob (output: string): string {
  return output
    .split('\n')
    .filter(line => /^[A-Za-z0-9+/]+=*$/.test(line) && line.length > 40)
    .sort((a, b) => b.length - a.length)[0]
}

// --- pure helpers ----------------------------------------------------------

test('swapEndian() converts a hex key id to Microsoft GUID byte order', () => {
  const swapped = swapEndian('00112233445566778899aabbccddeeff')
  assert.equal(swapped.toString('hex'), '33221100554477668899aabbccddeeff')
  assert.equal(swapped.length, 16)
})

test('swapEndian() is its own inverse', () => {
  const once = swapEndian(KID).toString('hex')
  assert.notEqual(once, KID)
  assert.equal(swapEndian(once).toString('hex'), KID)
})

test('swapEndian() honours the encoding argument', () => {
  const base64 = Buffer.from('00112233445566778899aabbccddeeff', 'hex').toString('base64')
  assert.equal(
    swapEndian(base64, 'base64').toString('hex'),
    '33221100554477668899aabbccddeeff'
  )
})

test('base64ToHex() decodes a base64 GUID into little-endian hex', () => {
  const base64 = Buffer.from('00112233445566778899aabbccddeeff', 'hex').toString('base64')
  assert.equal(base64ToHex(base64), '33221100554477668899aabbccddeeff')
})

test('collect() appends to and returns the same accumulator', () => {
  const store: string[] = []
  assert.equal(collect('a', store), store)
  collect('b', store)
  assert.deepEqual(store, ['a', 'b'])
})

// --- option parsing ------------------------------------------------------------

test('createProgram() defaults repeatable options to empty arrays', () => {
  const program = createProgram()
  program.parse([], { from: 'user' })
  assert.deepEqual(program.opts().kid, [])
  assert.deepEqual(program.opts().key, [])
})

test('createProgram() parses the documented flags', () => {
  const program = createProgram()
  program.parse(
    ['-e', 'AAAA', '-e', 'BBBB', '-c', 'CCCC', '--playready', '-h', '-d', 'ZGF0YQ=='],
    { from: 'user' }
  )
  const opts = program.opts()
  assert.deepEqual(opts.kid, ['AAAA', 'BBBB'])
  assert.deepEqual(opts.key, ['CCCC'])
  assert.equal(opts.playready, true)
  assert.equal(opts.human, true) // -h is remapped to --human, not --help
  assert.equal(opts.b64Data, 'ZGF0YQ==')
})

test('createProgram() reports the package version', () => {
  assert.equal(createProgram().version(), '1.1.0')
})

// --- commands ----------------------------------------------------------------

test('-k decodes a base64 PlayReady key id to hex', () => {
  const output = capture(() => { run(argv('-k', ENCODED_KID)) })
  assert.match(output, new RegExp(KID))
})

test('-e -r generates PlayReady PRO data that round-trips', () => {
  const output = capture(() => { run(argv('-e', KID, '-r')) })
  assert.match(output, /KEYS:/)
  assert.match(output, /PSSH-DATA:/)
  assert.match(output, new RegExp(ENCODED_KID.replace(/[+/=]/g, '\\$&')))

  const decoded = pssh.tools.decodePssh(base64Blob(output))
  assert.equal(decoded.systemName, 'PlayReady')
  assert.match((decoded.dataObject as { recordXml: string }).recordXml, /WRMHEADER/)
})

test('-e -w with content id and provider generates Widevine PSSH data', () => {
  const output = capture(() => {
    run(argv('-e', KID, '-w', '-i', 'unit-content', '-o', 'unit-provider'))
  })
  const decoded = pssh.tools.decodePssh(base64Blob(output))
  assert.equal(decoded.systemName, 'Widevine')
  assert.equal((decoded.dataObject as { provider?: string }).provider, 'unit-provider')
})

test('-e -w without content id and provider prints guidance', () => {
  const output = capture(() => { run(argv('-e', KID, '-w')) })
  assert.match(output, /Provide Content ID and Provider name/)
})

test('-e -r -h prints keys in human readable form', () => {
  const plain = capture(() => { run(argv('-e', KID, '-r')) })
  const human = capture(() => { run(argv('-e', KID, '-r', '-h')) })
  assert.match(human, /KEYS:/)
  assert.notEqual(human, plain)
})

test('-P -d prints the decoded PlayReady record XML', () => {
  const output = capture(() => { run(argv('-P', '-d', PLAYREADY_DATA)) })
  assert.match(output, /WRMHEADER/)
})

test('-W -d prints the decoded Widevine data', () => {
  const output = capture(() => { run(argv('-W', '-d', WIDEVINE_DATA)) })
  assert.match(output, /unit-provider/)
})

test('-p parses a base64 PSSH box', () => {
  const output = capture(() => { run(argv('-p', WIDEVINE_BOX)) })
  assert.match(output, /PSSH Box/)
  assert.match(output, /Widevine/)
})
