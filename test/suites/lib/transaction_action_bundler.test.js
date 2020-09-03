/* eslint-env jest */

'use strict'

const connector = require('../../connector')
const bundleTransactionAction = require('../../../lib/transaction_action_bundler')

const usersCollectionName = 'users'
const collection = connector.collection(usersCollectionName)

const doc = {
  firstname: 'aurora',
  lastname: 'lain'
}

function expectMatch (result, expected) {
  expect(result).toEqual(
    expect.objectContaining({
      ...expected,
      _id: expect.stringMatching(new RegExp(`^${usersCollectionName}/\\w+`)),
      _key: expect.any(String)
    })
  )
}

describe('lib/transaction_action_bundler', () => {
  beforeAll(() => collection.create())
  afterEach(() => collection.truncate())
  afterAll(() => collection.drop())

  it('should accept only function as "init" param', () => {
    expect(() => bundleTransactionAction({ init: 'not a function' }))
      .toThrow('init function is required')
  })

  it('should accept only hash of functions as "dependencies" param', () => {
    const dependencies = { notAFunction: 'not a function' }

    expect(() => bundleTransactionAction({
      init: () => {},
      dependencies
    }))
      .toThrow(`dependencies must be a hash of functions – actual value:\n${JSON.stringify(dependencies)}`)
  })

  ;[
    'not an object',
    [],
    2
  ].forEach(constants => it(`should reject ${Array.isArray(constants) ? 'array' : typeof constants} as "constants" param`, () => {
    expect(() => bundleTransactionAction({
      init: () => {},
      constants
    }))
      .toThrow(`constants must be an object – actual value:\n${constants}`)
  }))

  it('should create transaction from regular function', async () => {
    function addUser ({ user, collectionName }) {
      const { db } = require('@arangodb')

      return db._query(
        'INSERT @user INTO @@users RETURN NEW',
        {
          '@users': collectionName,
          user
        }
      ).toArray()[0]
    }

    const transaction = bundleTransactionAction({ init: addUser })

    const inserted = await connector.transaction(
      { write: [usersCollectionName] },
      transaction,

      {
        user: doc,
        collectionName: usersCollectionName
      }
    )

    const retrieved = (await (await collection.all()).all())[0]

    expectMatch(inserted, doc)
    expectMatch(retrieved, doc)
    expect(inserted).toEqual(retrieved)
  })

  it('should create transaction from arrow function', async () => {
    const addUser = ({ user, collectionName }) => {
      const { db } = require('@arangodb')

      return db._query(
        'INSERT @user INTO @@users RETURN NEW',
        {
          '@users': collectionName,
          user
        }
      ).toArray()[0]
    }

    const transaction = bundleTransactionAction({ init: addUser })

    const inserted = await connector.transaction(
      { write: [usersCollectionName] },
      transaction,

      {
        user: doc,
        collectionName: usersCollectionName
      }
    )

    const retrieved = (await (await collection.all()).all())[0]

    expectMatch(inserted, doc)
    expectMatch(retrieved, doc)
    expect(inserted).toEqual(retrieved)
  })

  it('should allow usage of regular functions as dependencies', async () => {
    function toDocInsertParams (props) {
      return Object.keys(props)
        .map(prop => `${prop}: @${prop}`)
        .join(',')
    }

    function buildUserInsertQueryParams (user, collectionName) {
      return [
        `INSERT {${toDocInsertParams(user)}} INTO @@users RETURN NEW`,

        Object.assign(
          { '@users': collectionName },
          user
        )
      ]
    }

    function addUser ({ user, collectionName }) {
      return require('@arangodb').db
        ._query(...buildUserInsertQueryParams(user, collectionName))
        .toArray()[0]
    }

    const transaction = bundleTransactionAction({
      init: addUser,

      dependencies: {
        toDocInsertParams,
        buildUserInsertQueryParams
      }
    })

    const inserted = await connector.transaction(
      { write: [usersCollectionName] },
      transaction,

      {
        user: doc,
        collectionName: usersCollectionName
      }
    )

    const retrieved = (await (await collection.all()).all())[0]

    expectMatch(inserted, doc)
    expectMatch(retrieved, doc)
    expect(inserted).toEqual(retrieved)
  })

  it('should allow usage of arrow functions as dependencies', async () => {
    const toDocInsertParams = props => Object.keys(props)
      .map(prop => `${prop}: @${prop}`)
      .join(',')

    const buildUserInsertQueryParams = (user, collectionName) => [
      `INSERT {${toDocInsertParams(user)}} INTO @@users RETURN NEW`,

      Object.assign(
        { '@users': collectionName },
        user
      )
    ]

    function addUser ({ user, collectionName }) {
      return require('@arangodb').db
        ._query(...buildUserInsertQueryParams(user, collectionName))
        .toArray()[0]
    }

    const transaction = bundleTransactionAction({
      init: addUser,

      dependencies: {
        toDocInsertParams,
        buildUserInsertQueryParams
      }
    })

    const inserted = await connector.transaction(
      { write: [usersCollectionName] },
      transaction,

      {
        user: doc,
        collectionName: usersCollectionName
      }
    )

    const retrieved = (await (await collection.all()).all())[0]

    expectMatch(inserted, doc)
    expectMatch(retrieved, doc)
    expect(inserted).toEqual(retrieved)
  })

  it('should allow usage of primitive constants', async () => {
    const VERSION_NUMBER = 1
    const READ_SCOPE = '"\\"read_scope\\""'

    function addUser ({ user, collectionName }) {
      const { db } = require('@arangodb')

      return db._query(
        'INSERT @user INTO @@users RETURN NEW',
        {
          '@users': collectionName,

          user: Object.assign(
            {
              /* eslint-disable no-undef */
              version: VERSION,
              scope: READ
              /* eslint-enable */
            },
            user
          )
        }
      ).toArray()[0]
    }

    const transaction = bundleTransactionAction({
      init: addUser,

      constants: {
        VERSION: VERSION_NUMBER,
        READ: READ_SCOPE
      }
    })

    const inserted = await connector.transaction(
      { write: [usersCollectionName] },
      transaction,

      {
        user: doc,
        collectionName: usersCollectionName
      }
    )

    const retrieved = (await (await collection.all()).all())[0]

    const expected = {
      ...doc,
      version: VERSION_NUMBER,
      scope: READ_SCOPE
    }

    expectMatch(inserted, expected)
    expectMatch(retrieved, expected)
    expect(inserted).toEqual(retrieved)
  })

  it('should allow usage of object constants', async () => {
    const VERSION_NUMBER = 'v1'
    const READ_SCOPE = 'read_scope'

    function addUser ({ user, collectionName }) {
      const { db } = require('@arangodb')

      return db._query(
        'INSERT @user INTO @@users RETURN NEW',
        {
          '@users': collectionName,

          user: Object.assign(
            {
              /* eslint-disable no-undef */
              version: config.VERSION,
              scope: config.READ
              /* eslint-enable */
            },
            user
          )
        }
      ).toArray()[0]
    }

    const transaction = bundleTransactionAction({
      init: addUser,

      constants: {
        config: {
          VERSION: VERSION_NUMBER,
          READ: READ_SCOPE
        }
      }
    })

    const inserted = await connector.transaction(
      { write: [usersCollectionName] },
      transaction,

      {
        user: doc,
        collectionName: usersCollectionName
      }
    )

    const retrieved = (await (await collection.all()).all())[0]

    const expected = {
      ...doc,
      version: VERSION_NUMBER,
      scope: READ_SCOPE
    }

    expectMatch(inserted, expected)
    expectMatch(retrieved, expected)
    expect(inserted).toEqual(retrieved)
  })

  it('should allow usage of array constants', async () => {
    const DEFAULT_TAGS = ['version_1', 'read_scope']

    function addUser ({ user, collectionName }) {
      const { db } = require('@arangodb')

      return db._query(
        'INSERT @user INTO @@users RETURN NEW',
        {
          '@users': collectionName,

          user: Object.assign(
            // eslint-disable-next-line no-undef
            { tags: TAGS },
            user
          )
        }
      ).toArray()[0]
    }

    const transaction = bundleTransactionAction({
      init: addUser,

      constants: {
        TAGS: DEFAULT_TAGS
      }
    })

    const inserted = await connector.transaction(
      { write: [usersCollectionName] },
      transaction,

      {
        user: doc,
        collectionName: usersCollectionName
      }
    )

    const retrieved = (await (await collection.all()).all())[0]

    const expected = {
      ...doc,
      tags: DEFAULT_TAGS
    }

    expectMatch(inserted, expected)
    expectMatch(retrieved, expected)
    expect(inserted).toEqual(retrieved)
  })
})
