<p align="center">
  <h1>
    ACOA<br><small><b>A</b>rango <b>C</b>ollection <b>O</b>bject <b>A</b>dapter</small>
  </h1>
  <img src="logo.jpg"></img>
</p>

<b>O</b>bject <b>D</b>ocument <b>M</b>apping for Arangodb

## Summary

- [Usage examples](#usage-examples)
    - [Simple example](#usage-examples-simple-example)
    - [Advance example](#usage-examples-advance-example)
    - [Application setup](#usage-examples-app-setup)
- [API](#api)
    - [createDocumentCollection()](#create-document-collection)
    - [createEdgeCollection()](#create-edge-collection)
    - [CollectionAdapter](#collection-adapter)
        - [Constructor](#collection-adapter-constructor)
        - [Static properties](#collection-adapter-static-properties)
        - [Static methods](#collection-adapter-static-methods)
        - [Simple queries](#collection-adapter-simple-queries)
        - [Instance properties](#collection-adapter-instance-properties)
        - [Instance methods](#collection-adapter-instance-methods)
        - [Extending collections](#collection-adapter-extending)
            - [Adding indexes](#collection-adapter-adding-indexes)
            - [Setup $beforeSave() hook](#collection-adapter-before-save-hook)
            - [Advance queries](#collection-adapter-advance-queries)
            - [Naming convention](#collection-adapter-naming-convention)
    - [bundleTransactionAction()](#bundle-transaction-action)
    - [setupGraph()](#setup-graph)

## <a name="usage-examples">Usage examples</a>

### <a name="usage-examples-simple-example">Simple example</a>
*1. connector.js*
```javascript
const { Database } = require('arangojs')
const { protocol, host, port, name, user, pass } = require('./db-conf')

const connector = new Database({ url: `${protocol}://${user}:${pass}@${host}:${port}` })
connector.useDatabase(name)

module.exports = connector
```

<br>

*2. item.js*
```javascript
const { createDocumentCollection } = require('acoa')
const connector = require('./connector')

module.exports = createDocumentCollection(connector, 'items')
```

<br>

*3. insert_item.js*
```javascript
const Item = require('./item')

const doc = new Item({
  reference: 'TRU-5656',
  description: 'wrist brace'
})

doc.$save()
  .then(it => console.log(`item ${it.$id} succesfully inserted`))
```

<br>

*4. fetch_item.js*
```javascript
const Item = require('./item')

Item.get('items/uydgldq467qsde89==')
  .then(it => console.log(`item ${it.reference} succesfully fetched`))
```

<br>

### <a name="usage-examples-advance-example">Advance example</a>
*1. person.js*
```javascript
const bcrypt = require('bcrypt')
const { createDocumentCollection } = require('acoa')
const connector = require('./connector')

const SALT_ROUNDS = 10

class Person extends createDocumentCollection(connector, 'persons') {
  static indexes = [
    {
      type: 'hash',
      fields: ['username'],
      unique: true,
      deduplicate: true
    }
  ]

  async $beforeSave (props) {
    if (props.password) {
      return {
        ...props,
        password: await bcrypt.hash(props.password, SALT_ROUNDS)
      }
    }

    return props
  }
}

module.exports = Person
```

<br>

*2. update_person.js*
```javascript
const Person = require('./person')

async function updatePerson () {
  const id = 'persons/uyglgllu58659=='
  const doc = await Person.get(id)

  Object.assign(
    doc,
    {
      username: 'a.lane',
      password: 'passengers',
      job: 'ux',
      location: 'paris',
      experience: 8
    }
  )

  return doc.$save()
}

updatePerson()
  .then(p => console.log(`person ${p.$id} succesfully updated`))
```

<br>

*3. find_person.js*
```javascript
const Person = require('./person')

Person.findByLocation('paris').and
  .jobNot('developer').and
  .experienceGreaterThan(5)
  .sortByExperienceDesc()
  .sortByLastnameAsc()
  .slice(0, 20)
  .run()
  .then(
    results =>
      results.forEach(
        ({ username, $id }) =>
          console.log(`person ${username}(${$id}) found`)
      )
  )
```

<br>

### <a name="usage-examples-app-setup">Application setup</a>
You can setup your app so that your collections are automatically created and configured when starting it with an empty database. Here is an example:

*init_db.js*
```javascript
const Person = require('./person')
const Item = require('./item')

module.exports = async () => {
  for (const Collection of [Person, Item]) {
    if (!(await Collection.exists())) {
      await Collection.create()
    }

    await Collection.applyIndexes()
  }
} 
```

<br>

## <a name="api">API</a>
### <a name="create-document-collection">createDocumentCollection()</a>
Return a class with which one can manipulate a document type collection.

<ins>Parameters</ins>

name | description | type | required
---- | ----------- | ---- | --------
connector | The db link | `arangojs.Database` | yes
collectionName | The name of the target collection | `String` | yes

<br>

### <a name="create-edge-collection">createEdgeCollection()</a>
Return a class with which one can manipulate an edge type collection.

<ins>Parameters</ins>

name | description | type | required
---- | ----------- | ---- | --------
connector | The db link | `arangojs.Database` | yes
collectionName | The name of the target collection | `String` | yes

<br>

### <a name="collection-adapter">CollectionAdapter</a>
Every classes created with `createDocumentCollection()` and `createEdgeCollection()` are children of `CollectionAdapter`. Although this class is exposed, it is an abstract class and cannot be instanciated directly. Its only purpose is to achieve type checking via the `instanceof` operator.

It should not be extend directly either.

<br>

#### <a name="collection-adapter-constructor">Constructor</a>

Create a document / edge surrogate *– see [instance properties](#collection-adapter-instance-properties) and [instance methods](#collection-adapter-instance-methods)*

<ins>Parameters</ins>

name | description | type | required
---- | ----------- | ---- | --------
ref  | an entity id, a plain object or a raw document<sup>(1)</sup> | `String` \| `Object` | no

> (1): A raw document is an object returned by a query directly run with `arangojs`

<br>

#### <a name="collection-adapter-static-properties">Static properties</a>

<dl>
  <dt>connector : <code>arangojs.Database</code></dt>
  <dd>The db link<br><br></dd>

  <dt>collectionName : <code>String</code></dt>
  <dd>The name of the target collection<br><br></dd>

  <dt>_rawCollection : <code>arangojs.DocumentCollection</code> | <code>arangojs.EdgeCollection</code></dt>
  <dd>The <code>arangojs</code> internal collection object</dd>
</dl>

<br>

#### <a name="collection-adapter-static-methods">Static methods</a>

<dl>
  <dt><code>async</code> exists () : <code>Boolean</code></dt>
  <dd>Whether the target collection actually exists in the db<br><br></dd>

  <dt><code>async</code> create ()</dt>
  <dd>Creates the collection in the db<br><br></dd>

  <dt><code>async</code> applyIndexes ()</dt>
  <dd>
    Creates defined indexes for the collection. Only non-existing indexes are added.<br>See <a href="#collection-adapter-adding-indexes">Adding indexes</a> to know how to define indexes
    <br><br>
  </dd>

  <dt><code>async</code> bulkImport (docs : <code>Object[]</code>)</dt>
  <dd>
    <p>Inserts a list of plain js objects in the collection</p>
    <table>
      <thead>
        <tr>
          <th>parameter</th>
          <th>description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>docs</th>
          <td>An array of plain js objects</td>
        </tr>
      </tbody>
    </table>
    <br>
  </dd>

  <dt><code>async</code> all (options? : <code>Object</code>) : <code>CollectionAdapter[]</code></dt>
  <dd>
    <p>Fetches all the documents in the collection</p>
    <table>
      <thead>
        <tr>
          <th>parameter</th>
          <th>description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>options</th>
          <td>
            <p>A plain js object with the following structure</p>
            <code>{ sortBy: { &lt;field&gt;: -1|1, … } }</code><br>
            <em>
              -1 for descending sort, 1 for ascending sort
            </em>
          </td>
        </tr>
      </tbody>
    </table>
    <br>
  </dd>

  <dt><code>async</code> get (id : <code>String</code>, options? : <code>Object</code>) : <code>CollectionAdapter</code></dt>
  <dd>
    <p>Fetches a document from the db by the given id, wrapping it as an instance of the current collection class</p>
    <table>
      <thead>
        <tr>
          <th>parameter</th>
          <th>description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>id</th>
          <td>The document id</td>
        </tr>
        <tr>
          <th>options</th>
          <td>
            <p>A plain js object with the following structure</p>
            <code>{ raw: Boolean }</code><br>
            <em>Whether to wrap the document as the current collection class or not</em>
          </td>
        </tr>
      </tbody>
    </table>
    <br>
  </dd>

  <dt>keyFromId (id/key : <code>String</code>) : <code>String</code></dt>
  <dd>Extract the document key from the given id.<br>Returns the key if a key is provided<br><br></dd>

  <dt><code>async</code> delete (id/key : <code>String</code>)</dt>
  <dd>Removes the document having the given id / key from the db</dd>
</dl>

<br>

#### <a name="collection-adapter-simple-queries">Simple queries</a>
Through the `CollectionAdapter` interface you can perform simple queries without writting `aql`.<br>Here is an example:

```javascript
const results = await User.findByLocation('Paris')
  .and.statusNot('pending', 'disabled')
  .and.busy(false)
  .sortByLastnameAsc()
  .sortByLastConnectionDesc()
  .slice(30, 50) // for pagination
  .run()
```

<ins>Formal query syntax</ins>

```html
findBy<Field><Comparator>?(<value>[, <value>]*)
  [.[and|or].<field><Comparator>?(<value>[, <value>]*)]*
  [.sortBy<Field>[Asc|Desc]()]*
  [.slice(<integer>, <integer>)]?
  .run()

where <Comparator> = Equal | NotEqual | Not | GreaterThan | GreaterThanOrEqual | LesserThan | LesserThanOrEqual |
Matching | NotMatching | Containing | NotContaining
```

*Notice the capitalized occurances of `<Field>` and `<Comparator>` : at those positions the first letter must be uppercase.*

> Boolean operators – *`and`, `or`* – cannot be mixed: once you've started with one, you must carry on with only it.

> `Greater…`, `Lesser…`, `Matching` and `NotMatching` comparators does not support multiple values.

> `Matching` and `NotMatching` comparators accept a RegExp String or RegExp Object as value.<br>Flags can only be set with a RegExp Object *(only the `i` flag is supported)*

> `Containing` and `NotContaining` comparators only work for array fields.

<br>

#### <a name="collection-adapter-instance-properties">Instance properties</a>

<dl>
  <dt>$id : <code>String</code></dt>
  <dd>The document id<br><br></dd>

  <dt>$key : <code>String</code></dt>
  <dd>The document key<br><br></dd>

  <dt>$from : <code>String</code></dt>
  <dd>The start vertex of the edge document.<br>Only for edge collection<br><br></dd>

  <dt>$to : <code>String</code></dt>
  <dd>The end vertex of the edge document.<br>Only for edge collection</dd>
</dl>

> Obvioulsly, all the properties of the document are also available through the `CollectionAdapter` instance.

<br>

#### <a name="collection-adapter-instance-methods">Instance methods</a>

<dl>
  <dt><code>async</code> $save () : <code>CollectionAdapter</code></dt>
  <dd>Inserts / updates the document in the db.<br>:warning: Does nothing if the document has no properties or if none has been modified<br><br></dd>

  <dt><code>async</code> $refresh ()</dt>
  <dd>Fetches the document having the current instance id from the db and update the instance with the fetched document properties<br><br></dd>

  <dt>toJSON () : <code>Object</code></dt>
  <dd>
    <p>Returns a plain js object containing all the non-internal<sup>(1)</sup> and non-reserved<sup>(2)</sup> properties of the document, along with <code>$id</code>, <code>$key</code>, <code>$from</code> and <code>$to</code>.</p>
    <p>Used by <code>JSON.stringify()</code></p>
    <blockquote>
      (1): An internal property is prefixed by an <code>_</code> <em>(underscore)</em><br>
      (2): A reserved property is prefixed by a <code>$</code> or is one of <code>toJSON</code> and <code>toString</code>
    </blockquote>
    <br>
  </dd>

  <dt>toString () : <code>String</code></dt>
  <dd>Returns the result of <code>JSON.stringify()</code>, thus a serialized version of <code>toJSON()</code></dd>
</dl>

<br>

#### <a name="collection-adapter-extending">Extending collections</a>

There are situations where you would want to extend a collection class:

##### <a name="collection-adapter-adding-indexes">Adding indexes</a>

Here is an example of index configuration:

```javascript
class Person extends createDocumentCollection(connector, 'persons') {
  static indexes = [
    {
      type: 'hash',
      fields: ['username'],
      unique: true,
      deduplicate: true
    }
  ]
}
```

Indexes are created along with the collection – *by calling the `create()` static method* – or on `applyIndexes()` static method call.

<br>

##### <a name="collection-adapter-before-save-hook">Setup $beforeSave() hook</a>

As his name suggests, the `$beforeSave()` hook is called when the instance method `$save()` is called, just before actual db insertion / update. His sole argument is a plain js `Object` containing the properties marked as modified – *which will be actually inserted or updated*. For example here if the `password` hasn't been modified since the last document load, it won't be present in the object.

Here is an example of hook implementation:

```javascript
class Person extends createDocumentCollection(connector, 'persons') {
  async $beforeSave (props) {
    if (props.password) {
      return {
        ...props,
        password: await bcrypt.hash(props.password, 10)
      }
    }

    return props
  }
}
```

> A modified copy of the argument, or the unmodified argument itself should always be returned, as it contains all the properties that will be actually saved in the db. If an empty `Object` returns, nothing will be saved: no attempt to reach the db will be made.
>
> Returning anything other than an `Object` – *as in `typeof props === 'object'`* – will cause an error.

<br>

##### <a name="collection-adapter-advance-queries">Advance queries</a>

Collection classes are good places to store sophisticated queries. So you could implement custom static methods as follow:

```javascript
const { aql } = require('arangojs')
const { createDocumentCollection } = require('acoa')
const connector = require('./connector')

class Tag extends createDocumentCollection(connector, 'tags') {
  static async findWorkspaces (userId) {
    const query = aql`FOR tag IN ${this._rawCollection}
      FILTER (
        FOR bookmark, category IN OUTBOUND tag._id GRAPH 'knowledge'
          FILTER bookmark._from == ${userId} && category.workspace
          COLLECT WITH COUNT INTO length
          RETURN length
      )[0] > 0
      SORT tag.rank ASC
      RETURN tag`

    const cursor = await this.connector.query(query)
    return (await cursor.all()).map(doc => new this(doc))
  }
}
```

<br>

##### <a name="collection-adapter-naming-convention">Naming convention</a>

In order api instance properties and methods to standout – *from those actually inserted in the db*, it is recomanded to adopt the following rules:

- all public instance fields should be prefixed with `$` – *like the `$save()` method for instance*
- all internal fields should be prefixed with `_` *(underscore)*

Those properties – *apart from `_from` and `_to`* won't end up in the db.

<br>

### <a name="bundle-transaction-action">bundleTransactionAction()</a>

To use the `arangojs.Database.executeTransaction()` method, you must provide the whole script of the transaction at once. This can be cumbersome for large transactions. With `bundleTransactionAction()` it is possible to split a transaction into several modules to ease implementation.

Here is an example:

*1. disconnect_user.js*
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

*2. transaction_helpers.js*
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

*3. run_transaction.js*
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

### <a name="setup-graph">setupGraph()</a>

`setupGraph()` utility function allows named graphs creation and configuration using collection classes:

```javascript
const { setupGraph } = require('acoa')
const connector = require('./connector')
const Bookmark = require('./bookmark')
const User = require('./user')
const Item = require('./item')

setupGraph(
  connector,
  {
    name: 'favorites',
    edges: [
      {
        Bookmark,
        from: User,
        to: Item
      }
    ]
  }
)
  .then(() => console.log('graph "favorites" successfully configured'))
```

<br>

<ins>Parameters</ins>

*1. connector*

`arangojs.Database`

<br>

*2. graph definition*

```javascript
{
  [name: String]: String,

  [edges: String]: [
    {
      [String]: CollectionAdapter,
      [from: String]: CollectionAdapter | CollectionAdapter[],
      [to: String]: CollectionAdapter | CollectionAdapter[]
    },
    …
  ]
}
```

graph definition property | description
------------------------- | -----------
name | The name of the graph
edges | An array of edge definitions

<br>

edge definition property | description
------------------------ | -----------
collection | The edge collection
from | The collection class of the start vertex.<br>Can also be an array of collection classes
to | The collection class of the end vertex.<br>Can also be an array of collection classes

<br>

> The `setupGraph()` utility function **creates**, **updates** and **removes** edge definitions for the given graph: indeed, if a graph already exists with the given name, edges definitions will be modified according to the `edges` property list.
