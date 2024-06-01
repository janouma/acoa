'use strict'

const isReserved = require('./reserved_fields_check')
const Query = require('./query')

function createClassProxy () {
  const handler = {
    get (target, property, receiver) {
      if (typeof property !== 'string' || !property.match(Query.PATTERN)) {
        const value = target[property]
        return typeof value === 'function' ? value.bind(target) : value
      } else {
        return (...values) => new Query(receiver, property, ...values)
      }
    }
  }

  return new Proxy({}, handler)
}

function createInstanceProxy (collection) {
  const handler = {
    set (target, property, value) {
      if (!isReserved(property) && value !== target[property]) {
        target[Symbol.for('_updatedFields')].add(property)
      }

      target[property] = value

      return true
    },

    get (target, property) {
      const value = target[property]
      return typeof value === 'function' ? value.bind(target) : value
    }
  }

  return new Proxy(collection, handler)
}

module.exports = {
  createClassProxy,
  createInstanceProxy
}
