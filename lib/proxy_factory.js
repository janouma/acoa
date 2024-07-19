'use strict'

const isReserved = require('./reserved_fields_check')
const Query = require('./query')

function createClassProxy (Collection) {
  const handler = {
    get (target, property, receiver) {
      if (typeof property !== 'string' || property in target || !property.match(Query.PATTERN)) {
        return Reflect.get(target, property, receiver)
      } else {
        return (...values) => new Query(target, property, ...values)
      }
    }
  }

  return new Proxy(Collection, handler)
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
