import {readFileSync} from 'fs'

describe(`action.yml unit tests`, () => {
  const yaml = require('js-yaml')
  test('yaml file compiles without errors', async () => {
    expect(() => yaml.load(readFileSync('./action.yml', 'utf8'))).not.toThrow()
  })
})
