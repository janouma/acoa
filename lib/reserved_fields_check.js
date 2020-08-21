'use strict'

const reservedPrefixes = ['_', '$']
const reservedFields = ['toJSON', 'toString']

module.exports = function isReserved (field) {
  return reservedPrefixes.includes(field[0]) || reservedFields.includes(field)
}
