/* eslint-env jest */

'use strict'

const connector = require('../../connector')
const { createDocumentCollection } = require('../../../lib/collection_factory')

describe('lib/collection_factory', () => {
  afterEach(() => connector.truncate())

  describe('#createDocumentCollection', () => {
    const collectionName = 'users'

    afterEach(() => connector.collection(collectionName).drop())

    it('should create document collection', async () => {
      const User = createDocumentCollection(connector, collectionName)
      await User.create()
      expect(connector.collection(collectionName)).toBeDefined()
    })
  })
})
