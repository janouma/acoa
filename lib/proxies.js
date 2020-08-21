'use strict'

const isReserved = require('./reserved_fields_check')
const Query = require('./query')

function proxyFromConstructor (Collection) {
  const handler = {
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

function proxyFromInstance (collection) {
  const handler = {
    set (target, property, value) {
      if (!isReserved(property)) {
        if (value !== target[property]) {
          target._updatedFields.add(property)
          target[property] = value
        }
      } else {
        target[property] = value
      }

      return true
    }
  }

  return new Proxy(collection, handler)
}

module.exports = {
  proxyFromConstructor,
  proxyFromInstance
}
