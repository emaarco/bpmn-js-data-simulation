// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { inShadow } from '../../src/utils/shadow'

describe('inShadow', () => {
  it('renders the content in an open shadow root, away from the host page styles', () => {
    const content = document.createElement('p')
    const host = inShadow(content)

    expect(host.shadowRoot?.contains(content)).toBe(true)
    expect(host.contains(content)).toBe(false)
  })
})
