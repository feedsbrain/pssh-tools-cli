#!/usr/bin/env node

const program = require('commander')
const pssh = require('pssh-tools')

const PR_TEST_KEY_SEED = 'XVBovsmzhP9gRIZxWfFta3VVRPzVEWmJsazEJ46I'

program
  .version('0.1.0', '-v, --version')
  .option('-W, --widevine', 'Switch for Widevine')
  .option('-P, --playready', 'Switch for Playready')
  .option('-k, --b64-key [key]', 'Decode base64 PlayReady key')
  .option('-e, --kid [key]', 'Encode hex kid for PlayReady')
  .option('-c, --key [key]', 'Encode hex key for PlayReady')
  .option('-K, --keySeed [key]', 'KeySeed for PlayReady key')
  .option('-p, --b64 [pssh-box]', 'Parse the given base64 encoded PSSH box (universal)')
  .option('-d, --b64-data [pssh-data]', 'Parse the given base64 encoded PSSH data (combined with -W or -P switch)')
  .option('-r, --pro', 'Generate PlayReady PRO with given kid and key (optionally using key seed)')
  .option('-h, --human', 'Convert output of base64 key to human readable hex format')
  .parse(process.argv)

const base64ToHex = (base64String) => {
  return Buffer.from(base64String, 'base64').toString('hex')
}

if (program.b64) {
  const result = pssh.tools.decodePssh(program.b64)
  console.log(result.printPssh())
}

if (program.b64Key) {
  const result = pssh.playready.decodeKey(program.b64Key)
  console.log(result)
}

if (program.kid) {
  let result
  let keyPair = { kid: program.kid, key: program.key || undefined }
  let KeySeed = !program.key ? PR_TEST_KEY_SEED : undefined

  result = pssh.playready.encodeKey(keyPair, !program.key ? PR_TEST_KEY_SEED : undefined)

  if (program.pro) {
    const payload = { keyPairs: [{ kid: pssh.playready.decodeKey(result.kid), key: pssh.playready.decodeKey(result.key) }], keySeed: KeySeed, compatibilityMode: true, dataOnly: true }
    result = pssh.playready.encodePssh(payload)

    if (result.dataObject) {
      result = result.dataObject
    }
  } else {
    if (program.human) {
      result.kid = base64ToHex(result.kid)
      result.key = base64ToHex(result.key)
    }
  }
  console.log(result)
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
