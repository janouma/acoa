# Advance example

**1. person.js**
```javascript
const bcrypt = require('bcrypt')
const { createDocumentCollection } = require('acoa')
const connector = require('./connector')

const SALT_ROUNDS = 10

const Person = createDocumentCollection(connector, 'persons', BaseCollection => class extends BaseCollection {
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
})

module.exports = Person
```

<br>

**2. update_person.js**
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
  .then(p => console.log(`person ${p.$id} successfully updated`))
```

<br>

**3. find_person.js**
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

<table width="100%">
  <tr>
    <td width="33%">
      <a href="simple_example.md">⇦&nbsp;&nbsp;&nbsp;Previous</a>
    </td>
    <td width="*" align="center">
      <a href="summary.md">⇧&nbsp;&nbsp;&nbsp;Summary</a>
    </td>
    <td width="33%" align="right">
      <a href="app_setup.md">Next&nbsp;&nbsp;&nbsp;⇨</a>
    </td>
  </tr>
</table>
