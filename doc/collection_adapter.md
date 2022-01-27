# CollectionAdapter
Every classes created with `createDocumentCollection()` and `createEdgeCollection()` are children of `CollectionAdapter`. Although this class is exposed, it is an abstract class and cannot be instanciated directly. Its only purpose is to achieve type checking via the `instanceof` operator.

It should not be extend directly either.

<br>

## <a name="collection-adapter-constructor">Constructor</a>

Create a document / edge surrogate *– see [Instance properties](#collection-adapter-instance-properties) and [Instance methods](#collection-adapter-instance-methods)*

<ins>Parameters</ins>

name | description | type | required
---- | ----------- | ---- | --------
ref  | an entity id, a plain object or a raw document<sup>(1)</sup> | `String` \| `Object` | no

> (1): A raw document is an object returned by a query directly run with `arangojs`

<br>

## <a name="collection-adapter-static-properties">Static properties</a>

<dl>
  <dt>connector : <code>arangojs.Database</code></dt>
  <dd>The db link<br><br></dd>

  <dt>collectionName : <code>String</code></dt>
  <dd>The name of the target collection<br><br></dd>

  <dt>_rawCollection : <code>arangojs.DocumentCollection</code> | <code>arangojs.EdgeCollection</code></dt>
  <dd>The <code>arangojs</code> internal collection object</dd>
</dl>

<br>

## <a name="collection-adapter-static-methods">Static methods</a>

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

## <a name="collection-adapter-simple-queries">Simple queries</a>
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

<br>

<ins>Formal query syntax</ins>

```html
findBy<Field><Comparator>?(<value>[, <value>]*)
  [.[and|or].<field><Comparator>?(<value>[, <value>]*)]*
  [.sortBy<Field>[Asc|Desc]()]*
  [.slice(<integer>, <integer>)]?
  .run()

where <Comparator> = Equal | NotEqual | Not | GreaterThan | GreaterThanOrEqual | LesserThan | LesserThanOrEqual |
Matching | NotMatching | Containing | NotContaining | ContainingOneOf | NotContainingOneOf
```

*Notice the capitalized occurrences of `<Field>` and `<Comparator>` : at those positions the first letter must be uppercase.*

<br>

<ins>Comparators description</ins>

Comparator | Description | Allows multiple values
---------- | ----------- | ----------------------
&nbsp; | strict equality | yes
`Equal` | strict equality | yes
`Not` | strict inequality | yes
`NotEqual` | strict inequality | yes
`GreaterThan` | > | no
`GreaterThanOrEqual` | >= | no
`LesserThan` | < | no
`LesserThanOrEqual` | <= | no
`Matching` | match against RegExp `String` or `RegExp` object<sup>(1)</sup> | no
`NotMatching` | mismatch against RegExp `String` or `RegExp` object<sup>(1)</sup> | no
`Containing` | check for inclusion of all values in an array field | yes
`NotContaining` | check for exclusion of all values from an array field | yes
`ContainingOneOf` | check for inclusion of any value in an array field | yes
`NotContainingOneOf` | check for exclusion of any value from an array field | yes

<br>

> (1) : Flags can only be set with a `RegExp` object, and only the `i` flag is supported – *any other flag is ignored*

<br>

## <a name="collection-adapter-instance-properties">Instance properties</a>

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

## <a name="collection-adapter-instance-methods">Instance methods</a>

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

## <a name="collection-adapter-extending">Extending collections</a>

There are situations where you would want to extend a collection class:

### <a name="collection-adapter-adding-indexes">Adding indexes</a>

Here is an example of index configuration:

```javascript
const Person = createDocumentCollection(connector, 'persons', BaseCollection => class extends BaseCollection {
  static indexes = [
    {
      type: 'hash',
      fields: ['username'],
      unique: true,
      deduplicate: true
    }
  ]
})
```

Indexes are created along with the collection – *by calling the `create()` static method* – or on `applyIndexes()` static method call.

<br>

### <a name="collection-adapter-before-save-hook">Setup $beforeSave() hook</a>

As his name suggests, the `$beforeSave()` hook is called when the instance method `$save()` is called, just before actual db insertion / update. His sole argument is a plain js `Object` containing the properties marked as modified – *which will be actually inserted or updated*. For example here if the `password` hasn't been modified since the last document load, it won't be present in the object.

Here is an example of hook implementation:

```javascript
const Person = createDocumentCollection(connector, 'persons', BaseCollection => class extends BaseCollection {
  async $beforeSave (props) {
    if (props.password) {
      return {
        ...props,
        password: await bcrypt.hash(props.password, 10)
      }
    }

    return props
  }
})
```

> A modified copy of the argument, or the unmodified argument itself should always be returned, as it contains all the properties that will be actually saved in the db. If an empty `Object` returns, nothing will be saved: no attempt to reach the db will be made.
>
> Returning anything other than an `Object` – *as in `typeof props === 'object'`* – will cause an error.

<br>

### <a name="collection-adapter-advance-queries">Advance queries</a>

Collection classes are good places to store sophisticated queries. So you could implement custom static methods as follow:

```javascript
const { aql } = require('arangojs')
const { createDocumentCollection } = require('acoa')
const connector = require('./connector')

const Tag = createDocumentCollection(connector, 'tags', BaseCollection => class extends BaseCollection {
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
})
```

<br>

### <a name="collection-adapter-naming-convention">Naming convention</a>

In order api instance properties and methods to standout – *from those actually inserted in the db*, it is recomanded to adopt the following rules:

- all public instance fields should be prefixed with `$` – *like the `$save()` method for instance*
- all internal fields should be prefixed with `_` *(underscore)*

Those properties – *apart from `_from` and `_to`* won't end up in the db.

<br>

<table width="100%">
  <tr>
    <td width="33%">
      <a href="create_edge_collection.md">⇦&nbsp;&nbsp;&nbsp;Previous</a>
    </td>
    <td width="*" align="center">
      <a href="summary.md">⇧&nbsp;&nbsp;&nbsp;Summary</a>
    </td>
    <td width="33%" align="right">
      <a href="bundle_transaction_action.md">Next&nbsp;&nbsp;&nbsp;⇨</a>
    </td>
  </tr>
</table>
