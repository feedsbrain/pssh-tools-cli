#!/usr/bin/env node

const program = require('commander')
const tools = require('pssh-tools') 

program
  .version('0.1.0', '-v, --version')
  .option('-b, --base64', 'Output base64 encoded')
  .option('-h, --hex', 'Output hexadecimal encoded')
  .option('-H, --human', 'Output a human readable string')
  .option('-p, --from-base64 [pssh-box]', 'Parse the given base64 encoded PSSH box')
  .parse(process.argv)
 
if (program.fromBase64) console.log(program.fromBase64)