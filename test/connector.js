'use strict'

const { Database } = require('arangojs')

const connector = new Database({ url: process.env.npm_package_config_testDbUrl })
connector.useDatabase(process.env.npm_package_config_testDbName)

module.exports = connector
