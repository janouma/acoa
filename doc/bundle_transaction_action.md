# bundleTransactionAction()

To use the `arangojs.Database.executeTransaction()` method, you must provide the whole script of the transaction at once. This can be cumbersome for large transactions. With `bundleTransactionAction()` it is possible to split a transaction into several modules to ease implementation. Here is an example:

**1. disconnect_user.js**
```javascript
const { bundleTransactionAction } = require('acoa')
const { getDocumentById } = require('./transaction_helpers')
const { USER_COLLECTION, CONNECTION_COLLECTION } = require('./constants')

function disconnect ({connecteeId, userId}) {
  const { db } = require('@arangodb')

  const connectee = getDocumentById(db, USER_COLLECTION, connecteeId)

  const query = `FOR connection IN ${CONNECTION_COLLECTION}
    FILTER connection._from == @connectorId AND connection._to == @connecteeId
    REMOVE connection IN ${CONNECTION_COLLECTION}`

  db._query(query, {
    connectorId: userId,
    connecteeId
  })

  if (connectee.pending) {
    db._query(query, {
      connectorId: connecteeId,
      connecteeId: userId
    })

    db.users.removeByKeys([connectee._key])
  }

  return connectee
}

module.exports = bundleTransactionAction({
  init: disconnect,

  dependencies: { getDocumentById },

  constants: {
    USER_COLLECTION,
    CONNECTION_COLLECTION
  }
})
```

<br>

**2. transaction_helpers.js**
```javascript
function getDocumentById (db, collection, id) {
  return db._query(
    'RETURN IS_SAME_COLLECTION(@collection, @id) ? DOCUMENT(@id) : null',
    {
      id,
      collection
    }
  ).toArray()[0]
}

module.exports = { getDocumentById }
```

<br>

**3. run_transaction.js**
```javascript
const disconnectUser = require('./disconnect_user')
const connector = require('./connector')
const { USER_COLLECTION, CONNECTION_COLLECTION } = require('./constants')

connector.executeTransaction(
  {
    read: [USER_COLLECTION, CONNECTION_COLLECTION],
    write: [USER_COLLECTION, CONNECTION_COLLECTION]
  },

  disconnectUser,

  {
    params: {
      connecteeId: 'users/HGGGL5676==',
      userId: 'users/giuyogiuh~7689'
    }
  }
)
  .then(() => 'user successfully disconnected')
```

<br>

<ins>Parameters</ins>

`bundleTransactionAction()` takes one parameter which is a plain js `Object` with the following structure:

```javascript
{
  [init: String]: Function(params: Object): any,

  [dependencies: String]: {
    [String]: Function,
    …
  },

  [constants: String]: Object
}
```

property | description
-------- | -----------
`init` | The entry point of the transaction
`dependencies` | A map of every functions called within the entry point and the dependencies
`constants` | A map of constants used within the entry point and the dependencies

<br>

<table width="100%">
  <tr>
    <td width="33%">
      <a href="collection_adapter.md">⇦&nbsp;&nbsp;&nbsp;Previous</a>
    </td>
    <td width="*" align="center">
      <a href="summary.md">⇧&nbsp;&nbsp;&nbsp;Summary</a>
    </td>
    <td width="33%" align="right">
      <a href="setup_graph.md">Next&nbsp;&nbsp;&nbsp;⇨</a>
    </td>
  </tr>
</table>
