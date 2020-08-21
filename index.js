'use strict'

module.exports = {
  ...require('./lib/collection_factory'),
  createTransaction: require('./lib/transaction_factory')
}
