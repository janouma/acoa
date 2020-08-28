'use strict'

const { aql } = require('arangojs')
const isReserved = require('./reserved_fields_check')
const { proxyFromConstructor, proxyFromInstance } = require('./proxies')

const idPrefixPattern = /^\w+\//
const idPattern = /^\w+\/.+$/
const orders = [-1, 1]
const edgeMetas = ['from', 'to']
const metas = ['id', 'key', ...edgeMetas]
const insertableMetas = edgeMetas.map(meta => `_${meta}`)
const constructorArgumentTypes = ['string', 'object']

class CollectionAdapter {
  constructor () {
    if (this.constructor === CollectionAdapter) {
      throw new Error(`cannot instantiate abstract class ${CollectionAdapter.name}`)
    }
  }
}

function setOnce (target, property, value) {
  if (!value) {
    throw new Error(`${property} must be provided`)
  }

  Reflect.defineProperty(target, property, {
    value,
    configurable: false,
    writable: false
  })
}

function createCollection (connector, collectionType, collectionName) {
  const collectionConstructor = (
    class Collection extends CollectionAdapter {
      static get connector () {
        return this._connector
      }

      // eslint-disable-next-line accessor-pairs
      set $id (id) {
        setOnce(this, '$id', id)
      }

      // eslint-disable-next-line accessor-pairs
      set $key (key) {
        setOnce(this, '$key', key)
      }

      constructor (ref) {
        super()

        if (ref && (Array.isArray(ref) || !constructorArgumentTypes.includes(typeof ref))) {
          throw new Error(`"ref" argument type could only be oneof ${constructorArgumentTypes}. actual: ${Array.isArray(ref) ? 'array' : typeof ref}`)
        }

        if (typeof ref === 'string' && (!ref.match(idPattern) || !ref.startsWith(`${Collection.collectionName}/`))) {
          throw new Error(`string type "ref" argument should match the pattern "${Collection.collectionName}/<string>". actual: "${ref}"`)
        }

        const doc = ref && typeof ref !== 'object'
          ? {
            _id: ref,
            _key: Collection.keyFromId(ref)
          }
          : ref

        this._updatedFields = new Set()

        if (doc) {
          const isInDoc = meta => `_${meta}` in doc

          if (metas.some(isInDoc)) {
            this._importMetasFrom(doc)
          }

          const safeProps = Reflect.ownKeys(doc)
            .filter(field => !isReserved(field) || (!this.$id && insertableMetas.includes(field)))

          for (const prop of safeProps) {
            this[prop] = doc[prop]
            !this.$id && this._updatedFields.add(prop)
          }
        }

        return proxyFromInstance(this)
      }

      static exists () {
        return this._connector.collection(this.collectionName).exists()
      }

      static async applyIndexes () {
        const { indexes } = this

        if (indexes) {
          this._validateIndexes()

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

        const query = `FOR doc IN ${this.collectionName}${sortArgs.length ? ` SORT ${sortArgs.join(',')}` : ''} RETURN doc`

        const cursor = await this._connector.query(query, bindVars)

        return (await cursor.all()).map(doc => new this(doc))
      }

      static async get (id, { raw = false } = {}) {
        if (!id) {
          throw new Error('id must be provided')
        }

        const wrongCollectionErrorMsg = `id must be from "${this.collectionName}" collection. Actual: "${id}"`

        if (!id.match(idPattern) || !id.startsWith(`${Collection.collectionName}/`)) {
          throw new Error(wrongCollectionErrorMsg)
        }

        const cursor = await this._connector.query(
          aql`RETURN IS_SAME_COLLECTION(${this.collectionName}, ${id}) && DOCUMENT(${id})`
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

        if (id.match(idPattern) && !id.startsWith(`${Collection.collectionName}/`)) {
          throw new Error(`id must be from "${this.collectionName}" collection. Actual: "${id}"`)
        }

        return id.replace(idPrefixPattern, '')
      }

      static delete (ref) {
        return this._connector.query(aql`REMOVE ${this.keyFromId(ref)} IN ${this._rawCollection}`)
      }

      async $save () {
        const diff = typeof this.$beforeSave === 'function'
          ? await this.$beforeSave(this._getDiff())
          : this._getDiff()

        if (Reflect.ownKeys(diff).length) {
          await this._save(diff)
          this._updatedFields.clear()
          Object.assign(this, diff)
        }

        return this
      }

      async $refresh () {
        const doc = await Collection.get(this.$id, { raw: true })

        if (doc) {
          for (const prop of Reflect.ownKeys(doc).filter(p => !isReserved(p) && !metas.includes(p))) {
            this[prop] = doc[prop]
          }
        }
      }

      toJSON ({ omit } = {}) {
        const json = {}
        const ownProps = Reflect.ownKeys(this).filter(prop => !isReserved(prop) && (!omit || !omit.includes(prop)))

        ownProps.push(
          ...metas
            .filter(meta => !omit || !omit.includes(`$${meta}`))
            .map(meta => `$${meta}`)
        )

        for (const property of ownProps) {
          const value = this[property]

          if (value !== undefined) {
            json[property] = value
          }
        }

        return json
      }

      toString () {
        return JSON.stringify(this)
      }

      static _validateIndexes () {
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

      _importMetasFrom (doc) {
        for (const meta of metas) {
          const value = doc[`_${meta}`]
          value && (this[`$${meta}`] = value)
        }
      }

      async _save (diff) {
        const query = this.$id
          ? aql`UPDATE ${this.$key} WITH ${diff} IN ${Collection._rawCollection}`
          : aql`INSERT ${diff} INTO ${Collection._rawCollection} RETURN NEW`

        const cursor = await collectionConstructor._connector.query(query)

        if (!this.$id) {
          const [doc] = await cursor.all()
          this._importMetasFrom(doc)
        }
      }

      _getDiff () {
        const { _updatedFields: fields } = this

        if (fields && fields.size) {
          const diff = {}

          for (const field of fields) {
            diff[field] = this[field]
          }

          return diff
        }

        return {}
      }
    }
  )

  setOnce(collectionConstructor, 'collectionName', collectionName)
  collectionConstructor._connector = connector
  collectionConstructor._rawCollection = connector[collectionType](collectionName)

  return proxyFromConstructor(Object.freeze(collectionConstructor))
}

module.exports = {
  createDocumentCollection (connector, collectionName) {
    return createCollection(connector, 'collection', collectionName)
  },

  createEdgeCollection (connector, collectionName) {
    return createCollection(connector, 'edgeCollection', collectionName)
  },

  CollectionAdapter
}
