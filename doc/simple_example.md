# Simple example

**1. connector.js**
```javascript
const { Database } = require('arangojs')
const { protocol, host, port, name, user, pass } = require('./db-conf')

const connector = new Database({ url: `${protocol}://${user}:${pass}@${host}:${port}` })
connector.useDatabase(name)

module.exports = connector
```

<br>

**2. item.js**
```javascript
const { createDocumentCollection } = require('acoa')
const connector = require('./connector')

module.exports = createDocumentCollection(connector, 'items')
```

<br>

**3. insert_item.js**
```javascript
const Item = require('./item')

const doc = new Item({
  reference: 'TRU-5656',
  description: 'wrist brace'
})

doc.$save()
  .then(it => console.log(`item ${it.$id} successfully inserted`))
```

<br>

**4. fetch_item.js**
```javascript
const Item = require('./item')

Item.get('items/uydgldq467qsde89==')
  .then(it => console.log(`item ${it.reference} successfully fetched`))
```

<br>

<table width="100%">
  <tr>
    <td width="33%">
      &nbsp;
    </td>
    <td width="*" align="center">
      <a href="summary.md">⇧&nbsp;&nbsp;&nbsp;Summary</a>
    </td>
    <td width="33%" align="right">
      <a href="advance_example.md">Next&nbsp;&nbsp;&nbsp;⇨</a>
    </td>
  </tr>
</table>
