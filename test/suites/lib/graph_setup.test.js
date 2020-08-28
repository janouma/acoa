/* eslint-env jest */

'use strict'

const connector = require('../../connector')
const setupGraph = require('../../../lib/graph_setup')
const { CollectionAdapter } = require('../../../lib/collection_factory')

const graphName = 'knowledge'
const User = class extends CollectionAdapter { static collectionName = 'users' }
const Item = class extends CollectionAdapter { static collectionName = 'items' }
const Bookmark = class extends CollectionAdapter { static collectionName = 'bookmarks' }
const Connection = class extends CollectionAdapter { static collectionName = 'connections' }
const documentCollections = [User, Item]
const edgeCollections = [Bookmark, Connection]

const MALFORMED_EDGE_DEFINITIONS = `each edge must be an object matching the following structure:
{
  <Collection class>,
  from: <Collection class>[] | <Collection class>,
  to: <Collection class>[] | <Collection class>
}`

describe('lib/graph_setup', () => {
  beforeAll(() => Promise.all([
    ...documentCollections
      .map(({ collectionName }) => connector.collection(collectionName).create()),

    ...edgeCollections
      .map(({ collectionName }) => connector.edgeCollection(collectionName).create())
  ]))

  afterEach(() => connector.graph(graphName).drop().catch(() => {}))

  afterAll(() => Promise.allSettled(
    [...documentCollections, ...edgeCollections]
      .map(({ collectionName }) => connector.collection(collectionName).drop())
  ))

  it('should require connector', () =>
    expect(setupGraph(undefined, {
      name: graphName,

      edges: [{
        Bookmark,
        from: [User],
        to: [Item]
      }]
    })).rejects.toThrow('connector is missing')
  )

  it('should require graph name', () =>
    expect(setupGraph(connector, {
      edges: [{
        Bookmark,
        from: [User],
        to: [Item]
      }]
    })).rejects.toThrow('name is missing')
  )

  it('should require edges', () =>
    expect(setupGraph(connector, { name: graphName }))
      .rejects.toThrow('edges must be an array. Actual: undefined')
  )

  it('should require edge collection', () =>
    expect(setupGraph(connector, {
      name: graphName,

      edges: [{
        from: [User],
        to: [Item]
      }]
    })).rejects.toThrow(MALFORMED_EDGE_DEFINITIONS)
  )

  it('should reject unknown edge definition property', () =>
    expect(setupGraph(connector, {
      name: graphName,

      edges: [{
        Bookmark,
        unknown: 'unknown',
        from: [User],
        to: [Item]
      }]
    })).rejects.toThrow(MALFORMED_EDGE_DEFINITIONS)
  )

  it('should require at least one item in "from"', () =>
    expect(setupGraph(connector, {
      name: graphName,

      edges: [{
        Bookmark,
        from: [],
        to: Item
      }]
    })).rejects.toThrow(MALFORMED_EDGE_DEFINITIONS)
  )

  it('should require at least one item in "to"', () =>
    expect(setupGraph(connector, {
      name: graphName,

      edges: [{
        Bookmark,
        from: User,
        to: []
      }]
    })).rejects.toThrow(MALFORMED_EDGE_DEFINITIONS)
  )

  it('should accept only CollectionAdapter as edge collection', () =>
    expect(setupGraph(connector, {
      name: graphName,

      edges: [{
        collection: { collectionName: 'bookmarks' },
        from: User,
        to: Item
      }]
    })).rejects.toThrow(MALFORMED_EDGE_DEFINITIONS)
  )

  it('should accept only CollectionAdapter in "from"', async () => {
    await expect(setupGraph(connector, {
      name: graphName,

      edges: [{
        Bookmark,
        from: { collectionName: 'users' },
        to: Item
      }]
    })).rejects.toThrow(MALFORMED_EDGE_DEFINITIONS)

    return expect(setupGraph(connector, {
      name: graphName,

      edges: [{
        Bookmark,
        from: [{ collectionName: 'users' }],
        to: Item
      }]
    })).rejects.toThrow(MALFORMED_EDGE_DEFINITIONS)
  })

  it('should accept only CollectionAdapter in "to"', async () => {
    await expect(setupGraph(connector, {
      name: graphName,

      edges: [{
        Bookmark,
        from: User,
        to: { collectionName: 'items' }
      }]
    })).rejects.toThrow(MALFORMED_EDGE_DEFINITIONS)

    return expect(setupGraph(connector, {
      name: graphName,

      edges: [{
        Bookmark,
        from: User,
        to: [{ collectionName: 'items' }]
      }]
    })).rejects.toThrow(MALFORMED_EDGE_DEFINITIONS)
  })

  it('should create named graph', async () => {
    await setupGraph(connector, {
      name: graphName,

      edges: [{
        Bookmark,
        from: [User],
        to: [Item]
      }]
    })

    const graph = connector.graph(graphName)

    expect(await graph.exists()).toBe(true)

    const { edgeDefinitions } = await graph.get()

    expect(edgeDefinitions).toHaveLength(1)

    const [edgeDefinition] = edgeDefinitions

    expect(edgeDefinition).toEqual({
      collection: Bookmark.collectionName,
      from: [User.collectionName],
      to: [Item.collectionName]
    })
  })

  it('should accept collection classes as "from" and "to" params', async () => {
    await setupGraph(connector, {
      name: graphName,

      edges: [{
        Bookmark,
        from: User,
        to: Item
      }]
    })

    const graph = connector.graph(graphName)

    expect(await graph.exists()).toBe(true)

    const { edgeDefinitions } = await graph.get()

    expect(edgeDefinitions).toHaveLength(1)

    const [edgeDefinition] = edgeDefinitions

    expect(edgeDefinition).toEqual({
      collection: Bookmark.collectionName,
      from: [User.collectionName],
      to: [Item.collectionName]
    })
  })

  it('should add new edge definitions to existing graph', async () => {
    await connector.graph(graphName).create({
      edgeDefinitions: [{
        collection: Bookmark.collectionName,
        from: [User.collectionName],
        to: [Item.collectionName]
      }]
    })

    await setupGraph(connector, {
      name: graphName,

      edges: [
        {
          Bookmark,
          from: User,
          to: Item
        },
        {
          Connection,
          from: User,
          to: User
        }
      ]
    })

    const graph = connector.graph(graphName)
    const { edgeDefinitions } = await graph.get()

    expect(edgeDefinitions).toHaveLength(2)

    expect(edgeDefinitions).toEqual(expect.arrayContaining([
      {
        collection: Bookmark.collectionName,
        from: [User.collectionName],
        to: [Item.collectionName]
      },

      {
        collection: Connection.collectionName,
        from: [User.collectionName],
        to: [User.collectionName]
      }
    ]))
  })

  it('should update edge definition of existing graph', async () => {
    await connector.graph(graphName).create({
      edgeDefinitions: [{
        collection: Connection.collectionName,
        from: [User.collectionName],
        to: [User.collectionName]
      }]
    })

    await setupGraph(connector, {
      name: graphName,

      edges: [{
        Connection,
        from: User,
        to: Item
      }]
    })

    const graph = connector.graph(graphName)
    const { edgeDefinitions } = await graph.get()

    expect(edgeDefinitions).toHaveLength(1)

    const [edgeDefinition] = edgeDefinitions

    expect(edgeDefinition).toEqual({
      collection: Connection.collectionName,
      from: [User.collectionName],
      to: [Item.collectionName]
    })
  })

  it('should only update edges having changes', async () => {
    await connector.graph(graphName).create({
      edgeDefinitions: [{
        collection: Connection.collectionName,
        from: [User.collectionName],
        to: [User.collectionName]
      }]
    })

    const graph = connector.graph(graphName)

    const { _rev: oldRevision } = await graph.get()

    await setupGraph(connector, {
      name: graphName,

      edges: [{
        Connection,
        from: User,
        to: User
      }]
    })

    const { _rev: newRevision } = await graph.get()

    expect(newRevision).toBe(oldRevision)
  })

  it('should remove edge definition of existing graph', async () => {
    await connector.graph(graphName).create({
      edgeDefinitions: [
        {
          collection: Bookmark.collectionName,
          from: [User.collectionName],
          to: [Item.collectionName]
        },

        {
          collection: Connection.collectionName,
          from: [User.collectionName],
          to: [User.collectionName]
        }
      ]
    })

    await setupGraph(connector, {
      name: graphName,
      edges: [{ Bookmark, from: User, to: Item }]
    })

    const graph = connector.graph(graphName)

    const { edgeDefinitions } = await graph.get()

    expect(edgeDefinitions).toHaveLength(1)

    const [edgeDefinition] = edgeDefinitions

    expect(edgeDefinition).toEqual({
      collection: Bookmark.collectionName,
      from: [User.collectionName],
      to: [Item.collectionName]
    })
  })

  it('should dedup "from" and "to"', async () => {
    await setupGraph(connector, {
      name: graphName,

      edges: [{
        Bookmark,
        from: [User, User],
        to: [Item, Item]
      }]
    })

    const graph = connector.graph(graphName)

    expect(await graph.exists()).toBe(true)

    const { edgeDefinitions, _rev: oldRevision } = await graph.get()

    expect(edgeDefinitions).toHaveLength(1)

    const [edgeDefinition] = edgeDefinitions

    expect(edgeDefinition).toEqual({
      collection: Bookmark.collectionName,
      from: [User.collectionName],
      to: [Item.collectionName]
    })

    await setupGraph(connector, {
      name: graphName,

      edges: [{
        Bookmark,
        from: [User, User],
        to: [Item, Item]
      }]
    })

    const { _rev: newRevision } = await graph.get()

    expect(newRevision).toBe(oldRevision)
  })
})
