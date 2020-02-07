#!/usr/bin/env node

const program = require('commander')
const pssh = require('pssh-tools')

const DRM_AES_KEYSIZE_128 = 16
const PR_TEST_KEY_SEED = 'XVBovsmzhP9gRIZxWfFta3VVRPzVEWmJsazEJ46I'

function collect (value, keyStore) {
  keyStore.push(value)
  return keyStore
}

program
  .version('0.1.0', '-v, --version')
  .option('-W, --widevine', 'Switch for Widevine')
  .option('-P, --playready', 'Switch for Playready')
  .option('-O, --dataOnly', 'Generate PSSH data only')
  .option('-k, --b64-key [key]', 'Decode base64 PlayReady key')
  .option('-e, --kid [key]', 'Encode hex kid for PlayReady', collect, [])
  .option('-c, --key [key]', 'Encode hex key for PlayReady', collect, [])
  .option('-K, --key-seed [key]', 'KeySeed for PlayReady key')
  .option(
    '-C, --checksum',
    'Switch to exclude checksum calculation on PlayReady PRO'
  )
  .option(
    '-p, --b64 [pssh-box]',
    'Parse the given base64 encoded PSSH box (universal)'
  )
  .option(
    '-d, --b64-data [pssh-data]',
    'Parse the given base64 encoded PSSH data (combined with -W or -P switch)'
  )
  .option(
    '-r, --pro',
    'Generate PlayReady PRO with given kid and key (optionally using key seed)'
  )
  .option(
    '-w, --wv-data',
    'Generate Widevine data with given kid(s) and key(s)'
  )
  .option(
    '-i, --content-id [id]',
    'Set Content ID value to generate Widevine PSSH'
  )
  .option(
    '-o, --provider [name]',
    'Set Provider value to generate Widevine PSSH'
  )
  .option(
    '-l, --la-url [url]',
    'Set PlayReady PRO License Acquisition URL (combined with -r switch)'
  )
  .option(
    '-h, --human',
    'Convert output of base64 key to human readable hex format'
  )
  .option(
    '-n, --new-header',
    'It will generate PRO w/ header version 4.2.0.0 if the value is set, otherwise it will use header version 4.0.0.0 (default)'
  )
  .parse(process.argv)

const base64ToHex = base64String => {
  return swapEndian(base64String, 'base64').toString('hex')
}

const swapEndian = (keyId, keyEncoding = 'hex') => {
  // Microsoft GUID endianness
  const keyIdBytes = Buffer.from(keyId, keyEncoding)
  const keyIdBuffer = Buffer.concat(
    [
      keyIdBytes.slice(0, 4).swap32(),
      keyIdBytes.slice(4, 6).swap16(),
      keyIdBytes.slice(6, 8).swap16(),
      keyIdBytes.slice(8, 16)
    ],
    DRM_AES_KEYSIZE_128
  )
  return keyIdBuffer
}

if (program.b64) {
  const result = pssh.tools.decodePssh(program.b64)
  console.log(result.printPssh())
}

if (program.b64Key) {
  const result = pssh.playready.decodeKey(program.b64Key)
  console.log(result)
}

if (program.kid && program.kid.length) {
  const keyPairs = []
  const encodedKeyPairs = []
  const keySeed = !program.key ? PR_TEST_KEY_SEED : undefined

  for (let i = 0; i < program.kid.length; i++) {
    try {
      const key = program.key.length > i ? program.key[i] : undefined
      const keyPair = { kid: program.kid[i], key: key }
      const eKey = pssh.playready.encodeKey(
        keyPair,
        !key ? PR_TEST_KEY_SEED : undefined
      )
      encodedKeyPairs.push(eKey)
      keyPairs.push({
        kid: pssh.playready.decodeKey(eKey.kid),
        key: pssh.playready.decodeKey(eKey.key)
      })
    } catch (error) {
      console.error('Failed when generating key pairs')
      process.exit(1)
    }
  }

  console.log('KEYS:')
  console.log(encodedKeyPairs)
  if (program.human) {
    keyPairs.forEach(keyPair => {
      keyPair.kid = base64ToHex(keyPair.kid)
      keyPair.key = base64ToHex(keyPair.key)
    })
  }
  console.log(keyPairs)
  console.log('\nPSSH-DATA:')
  if (program.pro) {
    const payload = {
      keyPairs: keyPairs,
      keySeed: keySeed,
      compatibilityMode: !program.newHeader && program.kid.length === 1,
      dataOnly: program.dataOnly,
      checksum: !program.checksum
    }
    if (program.laUrl) {
      payload.licenseUrl = program.laUrl
    }
    const encodedPssh = pssh.playready.encodePssh(payload)
    console.log(encodedPssh)
  }

  if (program.wvData) {
    if (program.contentId && program.provider) {
      const payload = {
        contentId: program.contentId,
        keyIds: keyPairs.map(k => {
          return k.kid
        }),
        provider: program.provider,
        protectionScheme: 'cenc',
        dataOnly: program.dataOnly
      }

      const encodedPssh = pssh.widevine.encodePssh(payload)
      console.log(encodedPssh)
    } else {
      console.log(
        'Provide Content ID and Provider name to generate Widevine PSSH'
      )
    }
  }
}

if (program.b64Data && program.widevine) {
  const result = pssh.widevine.decodeData(program.b64Data)
  console.log(result)
}

if (program.b64Data && program.playready) {
  const result = pssh.playready.decodeData(program.b64Data)
  console.log(result.recordXml)
}

// show help if no argument passes
if (process.argv.length < 3) {
  program.help()
}
