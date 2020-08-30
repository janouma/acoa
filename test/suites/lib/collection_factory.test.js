/* eslint-env jest */

'use strict'

const connector = require('../../connector')
const { createDocumentCollection, createEdgeCollection, CollectionAdapter } = require('../../../lib/collection_factory')
const docs = require('../../fixtures/users')

jest.mock('../../../lib/proxy_factory', () =>
  CollectionClass => jest.requireActual('../../../lib/proxy_factory')(
    class extends CollectionClass {
      static isClassProxy = true
    }
  )
)

const DOCUMENT_COLLECTION_TYPE = 2
const EDGE_COLLECTION_TYPE = 3

const userComparator = (a, b) => a.lastname > b.lastname ? 1 : a.lastname < b.lastname ? -1 : 0
const expectedDocs = docs.map(doc => expect.objectContaining(doc))

describe('lib/collection_factory', () => {
  const userCollectionName = 'users'
  const connectionCollectionName = 'connections'

  afterEach(() => {
    jest.clearAllMocks()

    return Promise.allSettled([
      connector.collection(userCollectionName).drop(),
      connector.collection(connectionCollectionName).drop()
    ])
  })

  it('#createDocumentCollection should create document collection Class', async () => {
    const User = createDocumentCollection(connector, userCollectionName)
    await User.create()

    const collection = connector.collection(userCollectionName)
    expect(await collection.exists()).toBe(true)
    expect(collection.type).toBe(DOCUMENT_COLLECTION_TYPE)
  })

  it('#createEdgeCollection should create document collection Class', async () => {
    const Connection = createEdgeCollection(connector, connectionCollectionName)
    await Connection.create()

    const collection = connector.edgeCollection(connectionCollectionName)
    expect(await collection.exists()).toBe(true)
    expect(collection.type).toBe(EDGE_COLLECTION_TYPE)
  })

  it('#CollectionAdapter should not be instanciated directly', () => {
    expect(() => new CollectionAdapter()).toThrow('cannot instantiate abstract class CollectionAdapter')
  })

  describe('collection classes', () => {
    let User

    beforeEach(() => { User = createDocumentCollection(connector, userCollectionName) })

    it('should have a public "connector" property', () => expect(User.connector).toBe(connector))

    it('should have a public "collectionName" property', () => expect(User.collectionName).toBe(userCollectionName))

    it('should have a internal "_connector" property', () => expect(User._connector).toBe(connector))

    it('should have a internal "_rawCollection" property of the right type', () => {
      expect(User._rawCollection).toEqual(connector.collection(userCollectionName))

      const Connection = createEdgeCollection(connector, connectionCollectionName)

      expect(Connection._rawCollection).toEqual(connector.edgeCollection(connectionCollectionName))
    })

    ;[
      1,
      true,
      [],
      Symbol('a symbol')
    ].forEach(param => it(`should reject param of type "${Array.isArray(param) ? 'array' : typeof param}"`, () => {
      expect(() => new User(param))
        .toThrow(`"ref" argument type could only be oneof string,object. actual: ${Array.isArray(param) ? 'array' : typeof param}`)
    }))

    it('should reject malformed id on construction', () => {
      const malformedId = 'malformed id'

      expect(() => new User(malformedId)).toThrow(`string type "ref" argument should match the pattern "users/<string>". actual: "${malformedId}"`)
    })

    it('should reject id from another collection on construction', () => {
      const foreignId = 'connections/key'

      expect(() => new User(foreignId)).toThrow(`string type "ref" argument should match the pattern "users/<string>". actual: "${foreignId}"`)
    })

    it('should set $id and $key when id is provided on construction', () => {
      const key = 'key'
      const id = `${userCollectionName}/${key}`
      const user = new User(id)

      expect(user.$id).toBe(id)
      expect(user.$key).toBe(key)
    })

    it('should set props when object id provided on construction', () => {
      const props = {
        a: 'A',
        b: 'B',
        c: 'C'
      }

      const user = new User(props)

      expect(user).toEqual(expect.objectContaining(props))
    })

    it('should set meta props as so', () => {
      const key = 'key'
      const id = `${userCollectionName}/${key}`
      const from = `${userCollectionName}/key52`
      const to = `${userCollectionName}/key345`

      const metas = {
        _id: id,
        _key: key,
        _from: from,
        _to: to
      }

      const Connection = createEdgeCollection(connector, connectionCollectionName)

      const connection = new Connection({
        ...metas,
        a: 'A'
      })

      expect(connection).toEqual(expect.objectContaining({
        $id: id,
        $key: key,
        $from: from,
        $to: to,
        a: 'A'
      }))

      expect(connection).toEqual(expect.not.objectContaining(metas))
    })

    it('should be a Proxy', () => expect(User.isClassProxy).toBe(true))

    describe('#exists', () => {
      it('should return true if collection exists', async () => {
        await connector.collection(userCollectionName).create()
        expect(await User.exists()).toBe(true)
      })

      it('should return false if collection does not exists', async () => expect(await User.exists()).toBe(false))
    })

    describe('#create', () => {
      it('should handle creation options', async () => {
        await User.create({ isVolatile: true })
        const collection = connector.collection(userCollectionName)

        expect((await collection.properties()).isVolatile).toBe(true)
      })

      it('should apply indexes if any', async () => {
        const index = {
          type: 'hash',
          fields: ['name'],
          unique: true,
          deduplicate: true
        }

        class UniqueUser extends User {
          static indexes = [index]
        }

        await UniqueUser.create()

        const actualindex = (await connector.collection(userCollectionName).indexes())
          .find(({ type }) => type === index.type)

        expect(actualindex).toEqual(expect.objectContaining(index))
      })
    })

    describe('#applyIndexes', () => {
      const collection = connector.collection(userCollectionName)

      beforeEach(() => collection.create())

      it('should reject all but array type indexes', async () => {
        class UniqueUser extends User {
          static indexes = {}
        }

        return expect(UniqueUser.applyIndexes())
          .rejects
          .toThrow(/^indexes must be a non-empty array. Actual\s+\[object Object\]$/)
      })

      it('should reject empty array', async () => {
        class UniqueUser extends User {
          static indexes = []
        }

        return expect(UniqueUser.applyIndexes())
          .rejects
          .toThrow(/^indexes must be a non-empty array. Actual\s+$/)
      })

      it('should reject all but array type as fields', async () => {
        class UniqueUser extends User {
          static indexes = [{ fields: {} }]
        }

        return expect(UniqueUser.applyIndexes())
          .rejects
          .toThrow(/^index.fields must be a non-empty array. Actual\s+\[object Object\]$/)
      })

      it('should reject empty array as fields', async () => {
        class UniqueUser extends User {
          static indexes = [{ fields: [] }]
        }

        return expect(UniqueUser.applyIndexes())
          .rejects
          .toThrow(/^index.fields must be a non-empty array. Actual\s+$/)
      })

      it('should reject empty "type"', async () => {
        class UniqueUser extends User {
          static indexes = [{
            fields: ['name']
          }]
        }

        return expect(UniqueUser.applyIndexes())
          .rejects
          .toThrow(/^index.type must be a string. Actual\s+undefined$/)
      })

      it('should reject non-string "type"', async () => {
        class UniqueUser extends User {
          static indexes = [{
            type: {},
            fields: ['name']
          }]
        }

        return expect(UniqueUser.applyIndexes())
          .rejects
          .toThrow(/^index.type must be a string. Actual\s+\[object Object\]$/)
      })

      it('should apply only new indexes', async () => {
        const uniqueIndex = {
          type: 'hash',
          fields: ['name'],
          unique: true,
          deduplicate: true
        }

        await collection.createIndex(uniqueIndex)

        const fulltextIndex = {
          type: 'fulltext',
          fields: ['extendedKeywords'],
          minLength: 2
        }

        class UniqueUser extends User {
          static indexes = [
            uniqueIndex,
            fulltextIndex
          ]
        }

        await UniqueUser.applyIndexes()

        const actualIndexes = await connector.collection(userCollectionName).indexes()

        expect(actualIndexes).toEqual([
          expect.objectContaining({
            type: 'primary',
            fields: ['_key'],
            unique: true
          }),

          expect.objectContaining(uniqueIndex),
          expect.objectContaining(fulltextIndex)
        ])
      })
    })

    it('#bulkImport should insert documents from array of objects', async () => {
      const collection = connector.collection(userCollectionName)
      await collection.create()

      await User.bulkImport(docs)

      const cursor = await collection.all()
      const users = (await cursor.all()).sort(userComparator)

      expect(users).toEqual(expectedDocs)
    })

    describe('with filled db', () => {
      let collection

      beforeEach(async () => {
        collection = connector.collection(userCollectionName)
        await collection.create()
        return collection.import(docs)
      })

      describe('#all', () => {
        it('should return all documents wrapped as User instances', async () => {
          const users = (await User.all()).sort(userComparator)

          expect(users).toEqual(expectedDocs)
          expect(users.every(user => user instanceof User)).toBe(true)
        })

        it('should sort returned documents', async () => {
          const users = (await User.all({ sortBy: { lastname: -1 } }))
            .reverse()

          expect(users).toEqual(expectedDocs)
        })

        it('should reject all but number as sortBy param', () => {
          return expect(User.all({ sortBy: { lastname: 'DESC' } }))
            .rejects
            .toThrow('sort order must be one of -1,1')
        })
      })

      describe('#get', () => {
        it('should require an id', () =>
          expect(User.get(undefined))
            .rejects
            .toThrow('id must be provided')
        )

        it('should reject ids from others collections', () => {
          return expect(User.get('connections/key'))
            .rejects
            .toThrow('id must be from "users" collection. Actual: "connections/key"')
        })

        it('should return one document by id wrapped as User instance', async () => {
          const rawUser = await (await collection.all()).next()
          const user = await User.get(rawUser._id)

          expect(user).toEqual(expect.any(User))

          expect(user).toEqual(expect.objectContaining({
            $id: rawUser._id,
            firstname: rawUser.firstname,
            lastname: rawUser.lastname
          }))
        })

        it('should return unwrapped document when "raw" option is true', async () => {
          const rawUser = await (await collection.all()).next()
          const user = await User.get(rawUser._id, { raw: true })

          expect(user).not.toEqual(expect.any(User))
          expect(user).toEqual(rawUser)
        })
      })

      describe('#keyFromId', () => {
        it('should require an id', () => {
          expect(() => User.keyFromId(undefined))
            .toThrow('id or key must be provided')
        })

        it('should reject ids from others collections', () => {
          expect(() => User.keyFromId('connections/key'))
            .toThrow('id must be from "users" collection. Actual: "connections/key"')
        })

        it('should extract key from id', () => expect(User.keyFromId('users/key')).toBe('key'))
        it('should return key if only key is provided', () => expect(User.keyFromId('key')).toBe('key'))
      })

      describe('#delete', () => {
        it('should require an id', () => {
          expect(() => User.delete(undefined))
            .toThrow('id or key must be provided')
        })

        it('should reject ids from others collections', () => {
          expect(() => User.delete('connections/key'))
            .toThrow('id must be from "users" collection. Actual: "connections/key"')
        })

        it('should remove document having the given id', async () => {
          const rawUser = await (await collection.all()).next()
          await User.delete(rawUser._id)

          const results = await collection.lookupByKeys([rawUser._key])
          expect(results).toHaveLength(0)
        })

        it('should remove document having the given key', async () => {
          const rawUser = await (await collection.all()).next()
          await User.delete(rawUser._key)

          const results = await collection.lookupByKeys([rawUser._key])
          expect(results).toHaveLength(0)
        })
      })
    })
  })

  describe('collection instances', () => {
    const collection = connector.collection(userCollectionName)
    let User

    beforeEach(() => {
      User = createDocumentCollection(connector, userCollectionName)
      return User.create()
    })

    it.each([
      '$id',
      '$key'
    ])('should have a one time "%s" setter', prop => {
      const value = `${prop} value`
      const user = new User()

      user[prop] = value

      expect(user[prop]).toBe(value)

      expect(() => { user[prop] = `${prop} another value` })
        .toThrow(`Cannot assign to read only property '${prop}' of object '[object Object]'`)
    })

    describe('#$save', () => {
      it('should insert new document', async () => {
        const [doc] = docs
        const user = new User(doc)
        const insertedUser = await user.$save()

        const actualUser = await (await collection.all()).next()

        expect(actualUser).toEqual(expect.objectContaining(doc))
        expect(insertedUser).toEqual(expect.any(User))

        expect(insertedUser).toEqual(expect.objectContaining({
          ...doc,
          $id: expect.stringMatching(new RegExp(`^${userCollectionName}/\\w+$`)),
          $key: expect.stringMatching(/^\w+$/)
        }))
      })

      it('should NOT insert empty documents', async () => {
        const user = new User({})
        await user.$save()
        const cursor = await collection.all()
        const users = await cursor.all()

        expect(users).toHaveLength(0)
      })

      it('should update existing document', async () => {
        const [doc] = docs
        await collection.import([doc])

        const existingUser = await (await collection.all()).next()
        const age = 36

        const user = new User(existingUser)
        user.age = age

        const updatedUser = await user.$save()
        const [actualUser] = await collection.lookupByKeys([existingUser._id])

        expect(existingUser._rev).not.toEqual(actualUser._rev)

        expect(actualUser).toEqual(expect.objectContaining({
          ...doc,
          _id: existingUser._id,
          _key: existingUser._key,
          age
        }))

        expect(updatedUser).toEqual(expect.any(User))

        expect(updatedUser).toEqual(expect.objectContaining({
          ...doc,
          $id: existingUser._id,
          $key: existingUser._key,
          age
        }))
      })

      it('should do nothing if document hasn\'t been modified', async () => {
        const [doc] = docs
        await collection.import([doc])

        const existingUser = await (await collection.all()).next()
        const user = new User(existingUser)

        await user.$save()
        const [actualUser] = await collection.lookupByKeys([existingUser._id])

        expect(existingUser._rev).toBe(actualUser._rev)
      })

      it('should run "$beforeSave()" hook', async () => {
        class FullnameUser extends User {
          $beforeSave = props => Promise.resolve({
            ...props,
            fullname: `${props.firstname} ${props.lastname}`
          })
        }

        const [doc] = docs
        const user = new FullnameUser(doc)
        const insertedUser = await user.$save()
        const actualUser = await (await collection.all()).next()

        const expected = expect.objectContaining({
          ...doc,
          fullname: `${doc.firstname} ${doc.lastname}`
        })

        expect(actualUser).toEqual(expected)
        expect(insertedUser).toEqual(expected)
      })
    })

    it('#refresh should update document with data fetched from db', async () => {
      const [doc] = docs
      await collection.import([doc])

      const existingUser = await (await collection.all()).next()

      const user = new User(existingUser._id)
      await user.$refresh()

      expect(user).toEqual(expect.objectContaining({
        ...doc,
        $id: existingUser._id,
        $key: existingUser._key
      }))
    })

    describe('#toJSON', () => {
      let user
      let doc

      beforeEach(() => {
        ([doc] = docs)

        user = new User({
          _id: `${userCollectionName}/key`,
          _key: 'key'
        })

        Object.assign(user, doc)
      })

      it('should convert document to a plain json object', () => {
        const serialized = JSON.stringify(user)

        expect(JSON.parse(serialized)).toEqual({
          firstname: 'aurora',
          lastname: 'lain',
          $id: 'users/key',
          $key: 'key'
        })
      })

      it('should filter out props from "omit" option', () => {
        const serialized = JSON.stringify(
          user.toJSON({ omit: ['isInstanceProxy', '$key'] })
        )

        expect(JSON.parse(serialized)).toEqual({
          firstname: 'aurora',
          lastname: 'lain',
          $id: 'users/key'
        })
      })
    })

    it('#toString should return a serialized document', () => {
      const [doc] = docs

      const user = new User({
        _id: `${userCollectionName}/key`,
        _key: 'key'
      })

      Object.assign(user, doc)

      expect(JSON.parse(String(user))).toEqual({
        firstname: 'aurora',
        lastname: 'lain',
        $id: 'users/key',
        $key: 'key'
      })
    })
  })
})
