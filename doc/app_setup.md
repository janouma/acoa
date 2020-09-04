# Application setup
You can setup your app so that your collections are automatically created and configured when starting it with an empty database. Here is an example:

```javascript
const Person = require('./person')
const Item = require('./item')

async function initDb () {
  for (const Collection of [Person, Item]) {
    if (!(await Collection.exists())) {
      await Collection.create()
    }

    await Collection.applyIndexes()
  }
}

module.exports = initDb
```

<br>

<table width="100%">
  <tr>
    <td width="33%">
      <a href="advance_example.md">⇦&nbsp;&nbsp;&nbsp;Previous</a>
    </td>
    <td width="*" align="center">
      <a href="summary.md">⇧&nbsp;&nbsp;&nbsp;Summary</a>
    </td>
    <td width="33%" align="right">
      <a href="create_document_collection.md">Next&nbsp;&nbsp;&nbsp;⇨</a>
    </td>
  </tr>
</table>
