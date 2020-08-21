'use strict'

const { Database } = require('arangojs')

const protocol = 'http'
const host = 'localhost'
const port = 8529
const name = 'acoa-test'
const user = 'test'
const pass = 'evod'

const url = `${protocol}://${user}:${pass}@${host}:${port}`
const connector = new Database({ url })

connector.useDatabase(name)

module.exports = connector
