'use strict'

const isReserved = require('./reserved_fields_check')
const Query = require('./query')

function createClassProxy () {
  const handler = {
    get (target, property, receiver) {
      if (typeof property !== 'string' || !property.match(Query.PATTERN)) {
        const value = Reflect.get(target, property, receiver)
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
    set (target, property, value, receiver) {
      if (!isReserved(property) && value !== Reflect.get(target, property, receiver)) {
        const updatedFieldsSymbol = Symbol.for('_updatedFields')
        const updatedFields = Reflect.get(target, updatedFieldsSymbol, receiver)
        updatedFields.add(property)
      }

      return Reflect.set(target, property, value, receiver)
    },

    get (target, property, receiver) {
      const value = Reflect.get(target, property, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    }
  }

  return new Proxy(collection, handler)
}

module.exports = {
  createClassProxy,
  createInstanceProxy
}
