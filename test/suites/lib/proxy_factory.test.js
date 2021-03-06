/* eslint-env jest */

'use strict'

const Query = require('../../../lib/query')
const { createClassProxy, createInstanceProxy } = require('../../../lib/proxy_factory')

jest.mock('../../../lib/query', () => {
  const MockQuery = jest.fn().mockName('Query')
  MockQuery.PATTERN = /^findBy[A-Z]\w*$/

  return MockQuery
})

describe('lib/proxies', () => {
  afterEach(() => jest.clearAllMocks())

  describe('#createClassProxy', () => {
    const cacheSym = Symbol('cache')

    class User {
      static findByName () {}
      static [cacheSym] = { cachedProp: 'cached' }

      _updatedFields = new Set()
    }

    const UserProxy = createClassProxy(User)

    it('should create Proxy that returns value of existing string prop', () => expect(UserProxy.findByName).toBe(User.findByName))
    it('should create Proxy that returns value of existing Symbol prop', () => expect(UserProxy[cacheSym]).toBe(User[cacheSym]))

    it(
      'should create Proxy that returns undefined for unknown prop not matching query pattern',
      () => expect(UserProxy.unknown).not.toBeDefined()
    )

    it('should create Proxy that returns Query factory for unkown prop matching query pattern', () => {
      const age = 36
      expect(UserProxy.findByAge(age)).toEqual(expect.any(Query))
      expect(Query).toHaveBeenCalledWith(User, 'findByAge', age)
    })
  })

  describe('#createInstanceProxy', () => {
    const job = 'agent'
    let userProxy

    beforeEach(() => {
      userProxy = createInstanceProxy({
        _updatedFields: new Set(),
        job
      })
    })

    it('should create Proxy that marks set prop as updated field', () => {
      const name = 'doe'
      userProxy.name = name

      expect(userProxy.name).toBe(name)
      expect(userProxy._updatedFields.has('name')).toBe(true)
    })

    it('should create Proxy that does NOT mark unchanged set prop as updated field', () => {
      userProxy.job = job
      expect(userProxy._updatedFields.has('job')).toBe(false)
    })

    it.each([
      '_id',
      '$key',
      'toJSON',
      'toString'
    ])('should create Proxy that does NOT mark reserved prop "%s" as updated field', prop => {
      const value = `${prop} value`
      userProxy[prop] = value

      expect(userProxy[prop]).toBe(value)
      expect(userProxy._updatedFields.has(prop)).toBe(false)
    })
  })
})
