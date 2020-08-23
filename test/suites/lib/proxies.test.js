/* eslint-env jest */

'use strict'

const Query = require('../../../lib/query')
const { proxyFromConstructor, proxyFromInstance } = require('../../../lib/proxies')

jest.mock('../../../lib/query', () => {
  const MockQuery = jest.fn().mockName('Query')
  MockQuery.PATTERN = /^findBy[A-Z]\w*$/

  return MockQuery
})

describe('lib/query', () => {
  afterEach(() => jest.clearAllMocks())

  describe('constructor proxy', () => {
    const cacheSym = Symbol('cache')

    class User {
      static findByName () {}
      static [cacheSym] = { cachedProp: 'cached' }
    }

    const UserProxy = proxyFromConstructor(User)

    it('should return value of existing string prop', () => expect(UserProxy.findByName).toBe(User.findByName))
    it('should return value of existing Symbol prop', () => expect(UserProxy[cacheSym]).toBe(User[cacheSym]))

    it(
      'should return undefined for unknown prop not matching query pattern',
      () => expect(UserProxy.unknown).not.toBeDefined()
    )

    it('should return Query factory for unkown prop matching query pattern', () => {
      const age = 36
      expect(UserProxy.findByAge(age)).toEqual(expect.any(Query))
      expect(Query).toHaveBeenCalledWith(User, 'findByAge', age)
    })
  })

  describe('instance proxy', () => {
    let user
    let userProxy

    beforeEach(() => {
      user = { _updatedFields: new Set() }
      userProxy = proxyFromInstance(user)
    })

    it('should mark set prop as updated field', () => {
      const name = 'doe'
      userProxy.name = name

      expect(user.name).toBe(name)
      expect(user._updatedFields.has('name')).toBe(true)
    })

    it.each([
      '_id',
      '$key',
      'toJSON',
      'toString'
    ])('should NOT mark reserved prop "%s" as updated field', prop => {
      const value = `${prop} value`
      userProxy[prop] = value

      expect(user[prop]).toBe(value)
      expect(user._updatedFields.has(prop)).toBe(false)
    })
  })
})
