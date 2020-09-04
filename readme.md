<p align="center">
  <h1>
    ACOA<br><small><b>A</b>rango <b>C</b>ollection <b>O</b>bject <b>A</b>dapter</small>
  </h1>
  <img src="logo.jpg"></img>
</p>

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

…

Item.get('items/uydgldq467qsde89==')
  .then(it => console.log(`item ${it.reference} successfully fetched`))

…

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