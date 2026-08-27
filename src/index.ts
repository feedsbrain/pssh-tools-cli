#!/usr/bin/env node

import { run } from './cli.ts'

try {
  run(process.argv)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
