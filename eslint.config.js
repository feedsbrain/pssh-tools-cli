import neostandard from 'neostandard'

export default [
  { ignores: ['build/'] },
  ...neostandard({ ts: true })
]
