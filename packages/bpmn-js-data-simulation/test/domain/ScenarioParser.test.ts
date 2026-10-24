import { describe, expect, it } from 'vitest'
import { ScenarioError } from '../../src/domain/ScenarioError'
import { ScenarioParser } from '../../src/domain/ScenarioParser'

const parser = new ScenarioParser()

describe('ScenarioParser', () => {
  it('accepts a file object with a scenarios array', () => {
    const scenarios = parser.parse({
      scenarios: [
        {
          id: 'premium',
          name: 'Premium customer',
          description: 'Large order',
          variables: { orderTotal: 2400 },
          taskResults: { Task_CheckCredit: { score: 720 } },
        },
      ],
    })

    expect(scenarios).toEqual([
      {
        id: 'premium',
        name: 'Premium customer',
        description: 'Large order',
        variables: { orderTotal: 2400 },
        taskResults: { Task_CheckCredit: { score: 720 } },
      },
    ])
  })

  it('accepts a plain array and fills in defaults', () => {
    expect(parser.parse([{ id: 'empty' }])).toEqual([{ id: 'empty', name: 'empty', variables: {}, taskResults: {} }])
  })

  it.each([
    [{}, 'Expected an array of scenarios'],
    [[42], 'Scenario #1 must be an object'],
    [[{ name: 'no id' }], 'Scenario #1 needs a non-empty string "id"'],
    [[{ id: 'a', variables: [] }], 'Scenario "a": "variables" must be an object'],
    [[{ id: 'a', taskResults: { Task: 5 } }], 'Scenario "a": "taskResults" must map element ids to objects'],
    [[{ id: 'a' }, { id: 'a' }], 'Duplicate scenario id "a"'],
  ])('rejects %j', (input, message) => {
    expect(() => parser.parse(input)).toThrow(ScenarioError)
    expect(() => parser.parse(input)).toThrow(message)
  })
})
