# setupGraph()

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

**connector**

`arangojs.Database`

<br>

**graph definition**

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

<br>

<table width="100%">
  <tr>
    <td width="33%">
      <a href="bundle_transaction_action.md">⇦&nbsp;&nbsp;&nbsp;Previous</a>
    </td>
    <td width="*" align="center">
      <a href="summary.md">⇧&nbsp;&nbsp;&nbsp;Summary</a>
    </td>
    <td width="33%" align="right">
      &nbsp;
    </td>
  </tr>
</table>
