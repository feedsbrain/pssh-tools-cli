# pssh-tools-cli

[![CI](https://github.com/feedsbrain/pssh-tools-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/feedsbrain/pssh-tools-cli/actions/workflows/ci.yml)

**Command Line Tools to decode PSSH Data and PSSH Box**

For dealing with multi-drm using common encryption (cenc) we may need to encode or decode pssh data and/or pssh box to use in our workflow. This tools is written to help that process.

## Installation

This command line is installed via npm:

``` bash
$ npm install -g pssh-tools-cli
```

# CLI Help

``` bash
$ psshtools --help
```

## Supported PSSH

Currently we're only focus on Widevine and PlayReady but we will support more in the future.

## Development

``` bash
$ npm run build   # lint + type-check + compile to build/
$ npm test        # lint + type-check + run the unit tests (node:test)
```

The test suite (`test/cli.test.ts`) covers the key-id endianness helpers, the
Commander option definitions, and every command branch (`-k`, `-e -r`,
`-e -w`, `-P -d`, `-W -d`, `-p`) by driving `run()` and asserting on the
captured output. It runs on the built-in Node.js test runner with no extra
dependencies (Node.js executes the TypeScript sources directly).

## Releasing

Publishing is done from the CLI with an automatic version bump. Commit everything
first (the working tree must be clean), then run one of:

``` bash
$ npm run release        # patch bump  (1.1.0 -> 1.1.1)
$ npm run release:minor  # minor bump  (1.1.0 -> 1.2.0)
$ npm run release:major  # major bump  (1.1.0 -> 2.0.0)
```

Each command runs the build, bumps the version in `package.json` /
`package-lock.json`, creates the `vX.Y.Z` commit and git tag, publishes the
package to npm, and finally pushes the commit and tag with
`git push --follow-tags`. Make sure you are logged in first with `npm login`.