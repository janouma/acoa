'use strict'

const AND = 'and'
const OR = 'or'
const sortCallMatcher = /^sortBy([_A-Z]\w*?)(Asc|Desc)$/
const comparatorMatcher = '((Greater|Lesser)Than(OrEqual)?)|(Not)?(Equal|Matching|Containing(OneOf)?)?'
const fieldMatcher = new RegExp(`^(\\w*?)(${comparatorMatcher})?$`)
const queryMatcher = new RegExp(`^findBy([_A-Z]\\w*?)(${comparatorMatcher})?$`)

const _addSort = Symbol('addSort')
const _filterSeparator = Symbol('filterSeparator')
const _addBooleanOperator = Symbol('addBooleanOperator')
const _addFilter = Symbol('addFilter')

const queryProxy = new Proxy(
  {},
  {
    get (target, property, receiver) {
      let match

      if (typeof property !== 'string' || !(match = property.match(sortCallMatcher))) {
        const value = Reflect.get(target, property, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      } else {
        const [, field, way] = match
        return () => receiver[_addSort](uncapitalize(field), way.toUpperCase())
      }
    }
  }
)

class Query {
  static PATTERN = queryMatcher

  #filters = []
  #vars = {}
  #sorts = []
  #limit
  #booleanOperator
  #Collection

  get [_filterSeparator] () {
    return (this.#booleanOperator || '').toUpperCase()
  }

  get [AND] () {
    return this[_addBooleanOperator](AND)
  }

  get [OR] () {
    return this[_addBooleanOperator](OR)
  }

  constructor (Collection, methodName, ...values) {
    if (!Collection) {
      throw new Error('missing Collection')
    }

    if (!methodName) {
      throw new Error('missing methodName')
    }

    const match = methodName.match(queryMatcher)

    if (!match) {
      throw new Error(`methodName doesn't match query pattern ${queryMatcher}. Actual: "${methodName}"`)
    }

    this.#Collection = Collection
    const [, field, comparator] = match
    return this[_addFilter](uncapitalize(field), comparator, values)
  }

  [_addFilter] (field, comparator, values) {
    if (typeof field !== 'string') {
      throw new Error(`field argument must be a "string". Actual "${field}"`)
    }

    const hasMultipleValues = values.length < 1 || values.length > 1
    const aqlComparator = convertToAqlComparator(comparator, hasMultipleValues)
    const filter = [`doc.${field}`, aqlComparator, `@${field}`]

    if (comparator && comparator.match(/^(Not)?Containing(OneOf)?$/)) {
      filter.reverse()
    }

    if (aqlComparator.endsWith('~') && values[0] instanceof RegExp) {
      this.#filters.push(
        `${aqlComparator.startsWith('!') ? '!' : ''}REGEX_TEST(doc.${field}, @${field}, ${values[0].ignoreCase})`
      )

      this.#vars[field] = String(values[0]).replace(/(^\/)|(\/\w*$)/g, '')
    } else {
      this.#filters.push(filter.join(' '))
      this.#vars[field] = hasMultipleValues || aqlComparator.startsWith('ANY') ? values : values[0]
    }

    return this
  }

  [_addBooleanOperator] (operator) {
    if (this.#booleanOperator && this.#booleanOperator !== operator) {
      throw new Error(`cannot mix logical operators "${AND}" and "${OR}"`)
    }

    this.#booleanOperator = operator
    return extendBooleanExpression((...args) => this[_addFilter](...args))
  }

  [_addSort] (field, direction) {
    this.#sorts.push(`doc.${field} ${direction}`)
    return this
  }

  toString () {
    return `FOR doc IN @@collection
      FILTER ${this.#filters.join(` ${this[_filterSeparator]} `)}
      ${this.#sorts.length > 0 ? `SORT ${this.#sorts.join(', ')}` : ''}
      ${this.#limit ? `LIMIT ${this.#limit.join(', ')}` : ''}
      RETURN doc`
  }

  slice (start, end) {
    // eslint-disable-next-line eqeqeq
    if (start == undefined) {
      throw new Error('"start" argument is missing')
    }

    if (start < 0) {
      throw new Error(`"start" argument must be positive. Actual: ${start}`)
    }

    // eslint-disable-next-line eqeqeq
    if (end == undefined) {
      throw new Error('"end" argument is missing')
    }

    if (end <= start) {
      throw new Error(`"end" must be greater than "start". start: ${start}, end: ${end}`)
    }

    this.#limit = [start, end - start]

    return this
  }

  async run () {
    const cursor = await this.#Collection.connector.query({
      query: this.toString(),
      bindVars: {
        '@collection': this.#Collection.collectionName,
        ...this.#vars
      }
    })

    return (await cursor.all()).map(doc => new this.#Collection(doc))
  }
}

const extendBooleanExpression = addFilter => new Proxy({}, {
  get (target, property, receiver) {
    if (typeof property !== 'string' || property in target) {
      const value = Reflect.get(target, property, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    } else {
      const [, field, comparator] = property.match(fieldMatcher)
      return (...values) => addFilter(field, comparator, values)
    }
  }
})

const uncapitalize = text => `${text[0].toLowerCase()}${text.slice(1)}`

const convertToAqlComparator = (literalComparator = 'Equal', multipleValues) => {
  let aqlComparator

  if (literalComparator.match(/(^(Greater|Lesser))|((Not)?Matching$)/) && multipleValues) {
    throw new Error(`cannot compare to multiple values with comparator "${literalComparator}"`)
  }

  if (literalComparator.startsWith('Greater')) {
    aqlComparator = '>'
  } else if (literalComparator.startsWith('Lesser')) {
    aqlComparator = '<'
  } else if (literalComparator === 'Matching') {
    aqlComparator = '=~'
  } else if (literalComparator === 'NotMatching') {
    aqlComparator = '!~'
  } else if (literalComparator === 'ContainingOneOf') {
    aqlComparator = 'ANY IN'
  } else if (literalComparator === 'NotContainingOneOf') {
    aqlComparator = 'ANY NOT IN'
  } else if (literalComparator === 'Containing') {
    aqlComparator = multipleValues ? 'ALL IN' : 'IN'
  } else if (literalComparator === 'NotContaining') {
    aqlComparator = multipleValues ? 'NONE IN' : 'NOT IN'
  } else if (['NotEqual', 'Not'].includes(literalComparator)) {
    aqlComparator = multipleValues ? 'NOT IN' : '!='
  } else {
    aqlComparator = multipleValues ? 'IN' : '=='
  }

  return literalComparator.endsWith('OrEqual') ? `${aqlComparator}=` : aqlComparator
}

Reflect.setPrototypeOf(Query.prototype, queryProxy)

module.exports = Query
