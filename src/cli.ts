import { Command } from 'commander'
import * as pssh from '@feedsbrain/pssh-tools'

import type { PlayReadyData } from '@feedsbrain/pssh-tools'

export const DRM_AES_KEYSIZE_128 = 16
export const PR_TEST_KEY_SEED = 'XVBovsmzhP9gRIZxWfFta3VVRPzVEWmJsazEJ46I'

/** Commander accumulator for repeatable options (`-e`, `-c`). */
export function collect (value: string, keyStore: string[]): string[] {
  keyStore.push(value)
  return keyStore
}

/** Swap a 16-byte key id between big-endian and Microsoft GUID (mixed-endian) layout. */
export function swapEndian (keyId: string, keyEncoding: BufferEncoding = 'hex'): Buffer {
  const keyIdBytes = Buffer.from(keyId, keyEncoding)
  return Buffer.concat(
    [
      keyIdBytes.subarray(0, 4).swap32(),
      keyIdBytes.subarray(4, 6).swap16(),
      keyIdBytes.subarray(6, 8).swap16(),
      keyIdBytes.subarray(8, 16)
    ],
    DRM_AES_KEYSIZE_128
  )
}

/** Decode a base64 GUID key id into its little-endian hex representation. */
export function base64ToHex (base64String: string): string {
  return swapEndian(base64String, 'base64').toString('hex')
}

/** Build a fresh, unparsed CLI definition. */
export function createProgram (): Command {
  const program = new Command()

  program
    .name('psshtools')
    .version('1.1.0', '-v, --version')
    // `-h` is used below for `--human`, so move help onto `-H`
    .helpOption('-H, --help', 'display help for command')
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

  return program
}

/**
 * Parse `argv` (a full `process.argv`-style array) and execute the matching
 * command. Throws on key-pair generation failure; the caller maps that to a
 * non-zero exit code.
 */
export function run (argv: string[]): void {
  const program = createProgram()
  program.parse(argv)
  const options = program.opts()

  if (options.b64) {
    const result = pssh.tools.decodePssh(options.b64)
    if (result?.printPssh) {
      console.log(result.printPssh())
    }
  }

  if (options.b64Key) {
    console.log(pssh.playready.decodeKey(options.b64Key))
  }

  if (options.kid && options.kid.length) {
    const keyPairs: Array<{ kid: string, key: string }> = []
    const encodedKeyPairs: Array<{ kid: string, key: string, checksum: string }> = []
    const keySeed = !options.key ? PR_TEST_KEY_SEED : undefined

    for (let i = 0; i < options.kid.length; i++) {
      try {
        const key = options.key.length > i ? options.key[i] : undefined
        const eKey = pssh.playready.encodeKey(
          { kid: options.kid[i], key },
          !key ? PR_TEST_KEY_SEED : undefined
        )
        encodedKeyPairs.push(eKey)
        keyPairs.push({
          kid: pssh.playready.decodeKey(eKey.kid),
          key: pssh.playready.decodeKey(eKey.key)
        })
      } catch {
        throw new Error('Failed when generating key pairs')
      }
    }

    console.log('KEYS:')
    console.log(encodedKeyPairs)
    if (options.human) {
      keyPairs.forEach(keyPair => {
        keyPair.kid = base64ToHex(keyPair.kid)
        keyPair.key = base64ToHex(keyPair.key)
      })
    }
    console.log(keyPairs)
    console.log('\nPSSH-DATA:')

    if (options.pro) {
      const payload = {
        keyPairs,
        keySeed,
        compatibilityMode: !options.newHeader && options.kid.length === 1,
        dataOnly: options.dataOnly,
        checksum: !options.checksum,
        licenseUrl: options.laUrl as string | undefined
      }
      console.log(pssh.playready.encodePssh(payload))
    }

    if (options.wvData) {
      if (options.contentId && options.provider) {
        const payload = {
          contentId: options.contentId,
          keyIds: keyPairs.map(k => k.kid),
          provider: options.provider,
          protectionScheme: 'cenc',
          dataOnly: options.dataOnly
        }
        console.log(pssh.widevine.encodePssh(payload))
      } else {
        console.log(
          'Provide Content ID and Provider name to generate Widevine PSSH'
        )
      }
    }
  }

  if (options.b64Data && options.widevine) {
    console.log(pssh.widevine.decodeData(options.b64Data))
  }

  if (options.b64Data && options.playready) {
    const result = pssh.playready.decodeData(options.b64Data)
    if (result) {
      console.log((result as PlayReadyData).recordXml)
    }
  }

  // show help if no argument passes
  if (argv.length < 3) {
    program.help()
  }
}
