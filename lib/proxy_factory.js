'use strict'

const isReserved = require('./reserved_fields_check')
const Query = require('./query')

function createClassProxy (Collection) {
  const handler = {
    construct (Target, args) {
      return createInstanceProxy(new Target(...args))
    },

    get (target, property) {
      if (typeof property !== 'string' || property in target || !property.match(Query.PATTERN)) {
        return target[property]
      } else {
        return (...values) => new Query(target, property, ...values)
      }
    }
  }

  return new Proxy(Collection, handler)
}

function createInstanceProxy (collection) {
  const handler = {
    set (target, property, value) {
      if (!isReserved(property) && value !== target[property]) {
        target._updatedFields.add(property)
      }

      target[property] = value

      return true
    }
  }

  return new Proxy(collection, handler)
}

module.exports = createClassProxy
