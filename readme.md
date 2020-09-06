# ACOA
<b>A</b>rango <b>C</b>ollection <b>O</b>bject <b>A</b>dapter

![logo](logo.jpg)

# Install
```bash
npm i -S acoa
```

# At a glance
ACOA is an object document mapper (ODM) for Arangodb: it provides a set of utilities allowing to manipulate collection through js classes and objects.

Take a quick look at a way to use it :

```javascript
const { createDocumentCollection } = require('acoa')
const dbLink = require('./db_link')

const Item = createDocumentCollection(dbLink, 'items')

new Item({
  reference: 'TRU-5656',
  name: 'wrist brace',
  description: 'Wrist protection for active people'
})
  .$save()
  .then(it => console.log(`item ${it.$id} successfully inserted`))
```

```javascript
Item.get('items/uydgldq467qsde89==')
  .then(it => console.log(`item ${it.reference} successfully fetched`))
```

```javascript
Item.findByDescriptionMatching(/wrist/i)
  .sortByNameAsc()
  .slice(20, 30)
  .run()
  .then(
    results =>
      results.forEach(
        ({ $id, reference, name }) =>
          console.log(`${$id} | ${$reference} | ${name}`)
      )
  )

```

For more details see the [documentation](doc/summary.md)
