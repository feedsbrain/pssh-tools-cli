#!/usr/bin/env node

const program = require('commander')
const pssh = require('pssh-tools')

program
  .version('0.1.0', '-v, --version')
  .option('-W, --widevine', 'Widevine Tools')
  .option('-P, --playready', 'Playready Tools')
  .option('-b, --base64', 'Output base64 encoded')
  .option('-h, --hex', 'Output hexadecimal encoded')
  .option('-H, --human', 'Output a human readable string')
  .option('-p, --from-base64 [pssh-box]', 'Parse the given base64 encoded PSSH box')
  .option('-d, --from-base64-data [pssh-box]', 'Parse the given base64 encoded PSSH box')
  .parse(process.argv)

if (program.fromBase64) {
  const result = pssh.tools.decodePssh(program.fromBase64)
  console.log(result.printPssh())
}

if (program.fromBase64Data && program.widevine) {
  const result = pssh.widevine.decodeData(program.fromBase64Data)
  console.log(result)
}

if (program.fromBase64Data && program.playready) {
  const result = pssh.playready.decodeData(program.fromBase64Data)
  console.log(result)
}

// show help if no argument passes
if (process.argv.length < 3) {
  program.help()
}
