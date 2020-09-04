<style>
  .summary ul {
    list-style-type: disc;
  }

  h1,
  h2,
  :not(h2) + h3,
  :not(h3) + h4,
  :not(h4) + h5,
  :not(h5) + h6 {
    margin: 3.5em 0 1em 0;
  }

  h2, h3, h4, h5, h6 {
    font-weight: bold;
  }

  h1 {
    font-size: 2.25em;
  }

  h2 {
    font-size: 2em;
  }

  h3 {
    font-size: 1.75em;
  }

  h4 {
    font-size: 1.5em;
  }

  h5 {
    font-size: 1.25em;
  }

  h6 {
    font-size: 1em;
  }

  dt {
    font-weight: bold;
  }

  dd {
    margin: 0.5em 0 0 0;
  }

  dd:not(:last-child) {
    margin-bottom: 4em;
  }

  td, th {
    vertical-align: top;
  }

  tbody th {
    text-align: left;
  }
</style>

# <center>ACOA<br><small><b>A</b>rango <b>C</b>ollection <b>O</b>bject <b>A</b>dapter</small></center>

<center style="margin-bottom: 3em;"><img src="logo.jpg"></center>

<b>O</b>bject <b>D</b>ocument <b>M</b>apping for Arangodb

## Summary
<ol class="summary" type="I">
  <li style="font-size:2em;"><a href="#usage-examples">Usage examples</a></li>
  <ol type="A">
    <li style="font-size:1.8em;"><a href="#usage-examples-simple-example">Simple example</a></li>
    <li style="font-size:1.8em;"><a href="#usage-examples-advance-example">Advance example</a></li>
    <li style="font-size:1.8em;"><a href="#usage-examples-app-setup">Application setup</a></li>
  </ol>
  <li style="font-size:2em;"><a href="#api">API</a></li>
  <ol type="A">
    <li style="font-size:1.8em;"><a href="#create-document-collection">createDocumentCollection()</a></li>
    <li style="font-size:1.8em;"><a href="#create-edge-collection">createEdgeCollection()</a></li>
    <li style="font-size:1.8em;"><a href="#collection-adapter">CollectionAdapter</a></li>
    <ol>
      <li style="font-size:1.6em;"><a href="#collection-adapter-constructor">Constructor</a></li>
      <li style="font-size:1.6em;"><a href="#collection-adapter-static-properties">Static properties</a></li>
      <li style="font-size:1.6em;"><a href="#collection-adapter-static-methods">Static methods</a></li>
      <li style="font-size:1.6em;"><a href="#collection-adapter-simple-queries">Simple queries</a></li>
      <li style="font-size:1.6em;"><a href="#collection-adapter-instance-properties">Instance properties</a></li>
      <li style="font-size:1.6em;"><a href="#collection-adapter-instance-methods">Instance methods</a></li>
      <li style="font-size:1.6em;"><a href="#collection-adapter-extending">Extending collections</a></li>
      <ol type="a">
        <li style="font-size:1.4em;"><a href="#collection-adapter-adding-indexes">Adding indexes</a></li>
        <li style="font-size:1.4em;"><a href="#collection-adapter-before-save-hook">Setup $beforeSave() hook</a></li>
        <li style="font-size:1.4em;"><a href="#collection-adapter-advance-queries">Advance queries</a></li>
        <li style="font-size:1.4em;"><a href="#collection-adapter-naming-convention">Naming convention</a></li>
      </ol>
    </ol>
    <li style="font-size:1.8em;"><a href="#bundle-transaction-acation">bundleTransactionAction()</a></li>
    <li style="font-size:1.8em;"><a href="#setup-graph">setupGraph()</a></li>
  </ol>
</ol>

## <span id="usage-examples">Usage examples</span>

### <span id="usage-examples-simple-example">Simple example</span>
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

### <span id="usage-examples-advance-example">Advance example</span>
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

### <span id="usage-examples-app-setup">Application setup</span>
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

## <span id="api">API</span>
### <span id="create-document-collection">createDocumentCollection()</span>
Return a class with which one can manipulate a document type collection.

<u>Parameters</u>

name | description | type | required
---- | ----------- | ---- | --------
connector | The db link | `arangojs.Database` | yes
collectionName | The name of the target collection | `String` | yes

### <span id="create-edge-collection">createEdgeCollection()</span>
Return a class with which one can manipulate an edge type collection.

<u>Parameters</u>

name | description | type | required
---- | ----------- | ---- | --------
connector | The db link | `arangojs.Database` | yes
collectionName | The name of the target collection | `String` | yes

### <span id="collection-adapter">CollectionAdapter</span>
Every classes created with `createDocumentCollection()` and `createEdgeCollection()` are children of `CollectionAdapter`. Although this class is exposed, it is an abstract class and cannot be instanciated directly. Its only purpose is to achieve type checking via the `instanceof` operator.

It should not be extend directly either.

#### <span id="collection-adapter-constructor">Constructor</span>

Create a document / edge surrogate *– see [instance properties](#collection-adapter-instance-properties) and [instance methods](#collection-adapter-instance-methods)*

<u>Parameters</u>

name | description | type | required
---- | ----------- | ---- | --------
ref  | an entity id, a plain object or a raw document<sup>(1)</sup> | `String` \| `Object` | no

> (1): A raw document is an object returned by a query directly run with `arangojs`

#### <span id="collection-adapter-static-properties">Static properties</span>

<dl>
  <dt>connector : <code>arangojs.Database</code></dt>
  <dd>The db link</dd>

  <dt>collectionName : <code>String</code></dt>
  <dd>The name of the target collection</dd>

  <dt>_rawCollection : <code>arangojs.DocumentCollection</code> | <code>arangojs.EdgeCollection</code></dt>
  <dd>The <code>arangojs</code> internal collection object</dd>
</dl>

#### <span id="collection-adapter-static-methods">Static methods</span>

<dl>
  <dt><code>async</code> exists () : <code>Boolean</code></dt>
  <dd>Whether the target collection actually exists in the db</dd>

  <dt><code>async</code> create ()</dt>
  <dd>Creates the collection in the db</dd>

  <dt><code>async</code> applyIndexes ()</dt>
  <dd>
    <p>Creates defined indexes for the collection. Only non-existing indexes are added.<br>See <a href="#collection-adapter-adding-indexes">Adding indexes</a> to know how to define indexes</p>
  </dd>

  <dt><code>async</code> bulkImport (<code>docs</code> : <code>Object[]</code>)</dt>
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
          <th><code>docs</code></th>
          <td>An array of plain js objects</td>
        </tr>
      </tbody>
    </table>
  </dd>

  <dt><code>async</code> all (<code>options?</code> : <code>Object</code>) : <code>CollectionAdapter[]</code></dt>
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
          <th><code>options</code></th>
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
  </dd>

  <dt><code>async</code> get (<code>id</code> : <code>String</code>, <code>options?</code> : <code>Object</code>) : <code>CollectionAdapter</code></dt>
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
          <th><code>id</code></th>
          <td>The document id</td>
        </tr>
        <tr>
          <th><code>options</code></th>
          <td>
            <p>A plain js object with the following structure</p>
            <code>{ raw: Boolean }</code><br>
            <em>Whether to wrap the document as the current collection class or not</em>
          </td>
        </tr>
      </tbody>
    </table>
  </dd>

  <dt>keyFromId (<code>id/key</code> : <code>String</code>) : <code>String</code></dt>
  <dd>Extract the document key from the given id.<br>Returns the key if a key is provided</dd>

  <dt><code>async</code> delete (<code>id/key</code> : <code>String</code>)</dt>
  <dd>Removes the document having the given id / key from the db</dd>
</dl>

#### <span id="collection-adapter-simple-queries">Simple queries</span>
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

<u>Formal query syntax</u>

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

#### <span id="collection-adapter-instance-properties">Instance properties</span>

<dl>
  <dt>$id : <code>String</code></dt>
  <dd>The document id</dd>

  <dt>$key : <code>String</code></dt>
  <dd>The document key</dd>

  <dt>$from : <code>String</code></dt>
  <dd>The start vertex of the edge document.<br>Only for edge collection</dd>

  <dt>$to : <code>String</code></dt>
  <dd>The end vertex of the edge document.<br>Only for edge collection</dd>
</dl>

> Obvioulsly, all the properties of the document are also available through the `CollectionAdapter` instance.

#### <span id="collection-adapter-instance-methods">Instance methods</span>

<dl>
  <dt><code>async</code> $save () : <code>CollectionAdapter</code></dt>
  <dd>Inserts / updates the document in the db.<br>:warning: Does nothing if the document has no properties or if none has been modified</dd>

  <dt><code>async</code> $refresh ()</dt>
  <dd>Fetches the document having the current instance id from the db and update the instance with the fetched document properties</dd>

  <dt>toJSON () : <code>Object</code></dt>
  <dd>
    <p>Returns a plain js object containing all the non-internal<sup>(1)</sup> and non-reserved<sup>(2)</sup> properties of the document, along with <code>$id</code>, <code>$key</code>, <code>$from</code> and <code>$to</code>.</p>
    <p>Used by <code>JSON.stringify()</code></p>
    <blockquote>
      (1): An internal property is prefixed by an <code>_</code> <em>(underscore)</em><br>
      (2): A reserved property is prefixed by a <code>$</code> or is one of <code>toJSON</code> and <code>toString</code>
    </blockquote>
  </dd>

  <dt>toString () : <code>String</code></dt>
  <dd>Returns the result of <code>JSON.stringify()</code>, thus a serialized version of <code>toJSON()</code></dd>
</dl>

#### <span id="collection-adapter-extending">Extending collections</span>

There are situations where you would want to extend a collection class:

##### <span id="collection-adapter-adding-indexes">Adding indexes</span>

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

##### <span id="collection-adapter-before-save-hook">Setup $beforeSave() hook</span>

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

##### <span id="collection-adapter-advance-queries">Advance queries</span>

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

##### <span id="collection-adapter-naming-convention">Naming convention</span>

In order api instance properties and methods to standout – *from those actually inserted in the db*, it is recomanded to adopt the following rules:

- all public instance fields should be prefixed with `$` – *like the `$save()` method for instance*
- all internal fields should be prefixed with `_` *(underscore)*

Those properties – *apart from `_from` and `_to`* won't end up in the db.

### <span id="bundle-transaction-acation">bundleTransactionAction()</span>

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

<u>Parameters</u>

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

### <span id="setup-graph">setupGraph()</span>

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

<u>Parameters</u>

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
`name` | The name of the graph
`edges` | An array of edge definitions

<br>

edge definition property | description
------------------------ | -----------
collection | The edge collection
`from` | The collection class of the start vertex.<br>Can also be an array of collection classes
`to` | The collection class of the end vertex.<br>Can also be an array of collection classes

<br>

> The `setupGraph()` utility function **creates**, **updates** and **removes** edge definitions for the given graph: indeed, if a graph already exists with the given name, edges definitions will be modified according to the `edges` property list.
