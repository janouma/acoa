'use strict'

const { aql } = require('arangojs')
const isReserved = require('./reserved_fields_check')
const { createClassProxy, createInstanceProxy } = require('./proxy_factory')

const idPrefixPattern = /^\w+\//
const idPattern = /^\w+\/.+$/
const orders = [-1, 1]
const edgeMetas = ['from', 'to']
const metas = ['id', 'key', ...edgeMetas]
const insertableMetas = edgeMetas.map(meta => '_' + meta)
const constructorArgumentTypes = ['string', 'object']

const metasSymbols = metas.reduce(
  (symbols, meta) => Object.assign(symbols, { ['_' + meta]: Symbol(meta) }), {}
)

const { _id, _key, _from, _to } = metasSymbols
const _updatedFields = Symbol.for('_updatedFields')
const _validateIndexes = Symbol('validateIndexes')
const _getDiff = Symbol('getDiff')
const _save = Symbol('save')

class CollectionAdapter {
  constructor () {
    if (this.constructor === CollectionAdapter) {
      throw new Error(`cannot instantiate abstract class ${CollectionAdapter.name}`)
    }
  }
}

const createCollection = (connector, collectionType, collectionName, extend = constructor => constructor) => {
  const BaseCollection = Object.freeze(
    class Collection extends CollectionAdapter {
      static get _rawCollection () {
        return connector[collectionType](collectionName)
      }

      static get connector () {
        return connector
      }

      static get collectionName () {
        return collectionName
      }

      set $id (id) {
        this[_id] = id
      }

      get $id () {
        return this[_id]
      }

      set $key (key) {
        this[_key] = key
      }

      get $key () {
        return this[_key]
      }

      set $from (from) {
        this[_from] = from
      }

      get $from () {
        return this[_from]
      }

      set $to (to) {
        this[_to] = to
      }

      get $to () {
        return this[_to]
      }

      constructor (ref) {
        super()

        if (ref && (Array.isArray(ref) || !constructorArgumentTypes.includes(typeof ref))) {
          throw new Error(`"ref" argument type could only be oneof ${constructorArgumentTypes}. actual: ${Array.isArray(ref) ? 'array' : typeof ref}`)
        }

        if (typeof ref === 'string' && (!ref.match(idPattern) || !ref.startsWith(`${collectionName}/`))) {
          throw new Error(`string type "ref" argument should match the pattern "${collectionName}/<string>". actual: "${ref}"`)
        }

        const doc = ref && typeof ref !== 'object'
          ? {
            _id: ref,
            _key: Collection.keyFromId(ref)
          }
          : ref

        this[_updatedFields] = new Set()

        if (doc) {
          for (const prop of Reflect.ownKeys(doc)) {
            writeField(this, prop, doc[prop])

            if (!doc._id && (!isReserved(prop) || insertableMetas.includes(prop))) {
              this[_updatedFields].add(prop)
            }
          }
        }

        return createInstanceProxy(this)
      }

      static exists () {
        return connector.collection(collectionName).exists()
      }

      static async applyIndexes () {
        const { indexes } = this

        if (indexes) {
          this[_validateIndexes]()

          const oldIndexes = await this._rawCollection.indexes()

          return Promise.all(
            indexes.map((index) => {
              const oldIndex = oldIndexes.find(({ type: oldType, fields: oldFields }) => {
                const { type, fields } = index

                return type === oldType &&
                  fields.length === oldFields.length &&
                  fields.every(field => oldFields.includes(field))
              })

              if (!oldIndex) {
                return this._rawCollection.createIndex(index)
              }
            })
          )
        }
      }

      static async create (options) {
        await this._rawCollection.create(options)
        return this.applyIndexes()
      }

      static bulkImport (docs) {
        return this._rawCollection.import(docs)
      }

      static async all ({ sortBy } = {}) {
        const sortProps = sortBy && Reflect.ownKeys(sortBy)

        if (sortProps && sortProps.some(prop => !orders.includes(sortBy[prop]))) {
          throw new Error(`sort order must be one of ${orders}`)
        }

        const sortArgs = []
        const bindVars = {}

        if (sortProps) {
          sortProps.forEach((prop, index) => {
            const varName = `field${index}`
            sortArgs.push(`doc[@${varName}] ${sortBy[prop] > -1 ? 'ASC' : 'DESC'}`)
            bindVars[varName] = prop
          })
        }

        const query = `FOR doc IN ${collectionName}${sortArgs.length ? ` SORT ${sortArgs.join(',')}` : ''} RETURN doc`

        const cursor = await connector.query(query, bindVars)

        return (await cursor.all()).map(doc => new this(doc))
      }

      static async get (id, { raw = false } = {}) {
        if (!id) {
          throw new Error('id must be provided')
        }

        const wrongCollectionErrorMsg = `id must be from "${collectionName}" collection. Actual: "${id}"`

        if (!id.match(idPattern) || !id.startsWith(`${collectionName}/`)) {
          throw new Error(wrongCollectionErrorMsg)
        }

        const cursor = await connector.query(
          aql`RETURN IS_SAME_COLLECTION(${collectionName}, ${id}) && DOCUMENT(${id})`
        )

        const [doc] = await cursor.all()

        if (doc === false) {
          throw new Error(wrongCollectionErrorMsg)
        }

        return doc && (raw ? doc : new this(doc))
      }

      static keyFromId (id) {
        if (!id) {
          throw new Error('id or key must be provided')
        }

        if (id.match(idPattern) && !id.startsWith(`${collectionName}/`)) {
          throw new Error(`id must be from "${collectionName}" collection. Actual: "${id}"`)
        }

        return id.replace(idPrefixPattern, '')
      }

      static delete (ref) {
        return connector.query(aql`REMOVE ${this.keyFromId(ref)} IN ${this._rawCollection}`)
      }

      async $save () {
        const diff = typeof this.$beforeSave === 'function'
          ? await this.$beforeSave(this[_getDiff]())
          : this[_getDiff]()

        if (Reflect.ownKeys(diff).length) {
          await this[_save](diff)
          this[_updatedFields].clear()
          updateFields(this, diff)
        }

        return this
      }

      async $refresh () {
        const doc = await Collection.get(this.$id, { raw: true })

        if (doc) {
          updateFields(this, doc)
        }
      }

      toJSON ({ omit } = {}) {
        const serializedProps = Reflect.ownKeys(this)
          .filter(
            prop =>
              typeof this[prop] !== 'function' &&
              !isReserved(prop) &&
              (!omit || !omit.includes(prop)) &&
              this[prop] !== undefined
          )

        serializedProps.push(
          ...metas
            .filter(meta => !omit || !omit.includes(`$${meta}`))
            .map(meta => `$${meta}`)
        )

        return serializedProps.reduce((json, prop) => ({
          ...json,
          [prop]: this[prop]
        }), {})
      }

      toString () {
        return JSON.stringify(this)
      }

      static [_validateIndexes] () {
        const { indexes } = this

        if (!Array.isArray(indexes) || !indexes.length) {
          throw new Error(`indexes must be a non-empty array. Actual\n${indexes}`)
        }

        for (const { fields, type } of indexes) {
          if (!Array.isArray(fields) || !fields.length) {
            throw new Error(`index.fields must be a non-empty array. Actual\n${fields}`)
          }

          if (typeof type !== 'string') {
            throw new Error(`index.type must be a string. Actual\n${type}`)
          }
        }
      }

      async [_save] (diff) {
        const query = this.$id
          ? aql`UPDATE ${this.$key} WITH ${diff} IN ${Collection._rawCollection}`
          : aql`INSERT ${diff} INTO ${Collection._rawCollection} RETURN NEW`

        const cursor = await connector.query(query)

        if (!this.$id) {
          const [doc] = await cursor.all()
          updateFields(this, doc)
        }
      }

      [_getDiff] () {
        return Array.from(this[_updatedFields])
          .reduce((diff, field) => ({
            ...diff,
            [field]: readField(this, field)
          }), {})
      }
    }
  )

  return createClassProxy(extend(BaseCollection))
}

function updateFields (target, updates) {
  for (const prop of Reflect.ownKeys(updates)) {
    writeField(target, prop, updates[prop])
  }
}

function readField (target, prop) {
  return target[metasSymbols[prop] || prop]
}

function writeField (target, prop, value) {
  target[metasSymbols[prop] || prop] = value
}

module.exports = {
  createDocumentCollection (connector, collectionName, extend) {
    return createCollection(connector, 'collection', collectionName, extend)
  },

  createEdgeCollection (connector, collectionName, extend) {
    return createCollection(connector, 'edgeCollection', collectionName, extend)
  },

  CollectionAdapter
}
