#!/usr/bin/env node

const program = require('commander')
const pssh = require('pssh-tools')

program
  .version('0.1.0', '-v, --version')
  .option('-W, --widevine', 'Access to Widevine tools')
  .option('-P, --playready', 'Access tp Playready tools')
  .option('-k, --b64-key [key]', 'Decode base64 PlayReady key')
  .option('-p, --b64 [pssh-box]', 'Parse the given base64 encoded PSSH box')
  .option('-d, --b64-data [pssh-data]', 'Parse the given base64 encoded PSSH data')
  .parse(process.argv)

if (program.b64) {
  const result = pssh.tools.decodePssh(program.b64)
  console.log(result.printPssh())
}

if (program.b64Key) {
  const result = pssh.playready.decodeKey(program.b64Key)
  console.log(result)
}

if (program.b64Data && program.widevine) {
  const result = pssh.widevine.decodeData(program.b64Data)
  console.log(result)
}

if (program.b64Data && program.playready) {
  const result = pssh.playready.decodeData(program.b64Data)
  console.log(result)
}

// show help if no argument passes
if (process.argv.length < 3) {
  program.help()
}
