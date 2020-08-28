'use strict'

const dedup = array => Array.from(new Set(array))

module.exports = async function setupGraph (connector, { name: graphName, edges }) {
  if (!connector) {
    throw new Error('connector is missing')
  }

  if (!graphName) {
    throw new Error('name is missing')
  }

  if (!Array.isArray(edges)) {
    throw new Error(`edges must be an array. Actual: ${typeof edges}`)
  }

  if (edges.some(({ from, to, ...collection }) =>
    Object.values(collection).length !== 1 ||
    !from || (Array.isArray(from) && from.length < 1) ||
    !to || (Array.isArray(to) && to.length < 1)
  )) {
    throw new Error(`each edge must be an object matching the following structure:
{
  <Collection class>,
  from: <Collection class>[] | <Collection class>,
  to: <Collection class>[] | <Collection class>
}`)
  }

  const edgeDefinitions = edges.map(({ from, to, ...collection }) => ({
    collection: Object.values(collection)[0].collectionName,
    from: Array.isArray(from) ? dedup(from).map(({ collectionName }) => collectionName) : [from.collectionName],
    to: Array.isArray(to) ? dedup(to).map(({ collectionName }) => collectionName) : [to.collectionName]
  }))

  const graph = connector.graph(graphName)

  if (await graph.exists()) {
    const graphDescription = await graph.get()

    const existingEdgesNames = graphDescription
      .edgeDefinitions
      .map(({ collection: name }) => name)

    for (const existingEdgeName of existingEdgesNames) {
      if (!edgeDefinitions.find(({ collection: name }) => name === existingEdgeName)) {
        await graph.removeEdgeDefinition(existingEdgeName)
      }
    }

    for (const edgeDefinition of edgeDefinitions) {
      if (!existingEdgesNames.includes(edgeDefinition.collection)) {
        await graph.addEdgeDefinition(edgeDefinition)
      } else {
        const changedEdge = graphDescription.edgeDefinitions.find(({ collection, from, to }) =>
          collection === edgeDefinition.collection &&
          (
            from.length !== edgeDefinition.from.length || from.some(name => !edgeDefinition.from.includes(name)) ||
            edgeDefinition.from.some(name => !from.includes(name)) ||
            to.length !== edgeDefinition.to.length || to.some(name => !edgeDefinition.to.includes(name)) ||
            edgeDefinition.to.some(name => !to.includes(name))
          )
        )

        if (changedEdge) {
          await graph.replaceEdgeDefinition(edgeDefinition.collection, edgeDefinition)
        }
      }
    }
  } else {
    return graph.create({ edgeDefinitions })
  }
}
