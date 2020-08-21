'use strict'

const AND = 'and'
const OR = 'or'
const sortCallMatcher = /^sortBy([_A-Z]\w*?)(Asc|Desc)$/
const comparatorMatcher = '((Greater|Lesser)Than(OrEqual)?)|NotEqual|Not|Equal'
const fieldMatcher = new RegExp(`^(\\w*?)(${comparatorMatcher})?$`)
const queryMatcher = new RegExp(`^findBy([_A-Z]\\w*?)(${comparatorMatcher})?$`)

const extendBooleanExpression = addFilter => new Proxy({}, {
  get (target, property) {
    if (typeof property !== 'string' || property in target) {
      return target[property]
    } else {
      const [, field, comparator] = property.match(fieldMatcher)
      return (...values) => addFilter(field, comparator, values)
    }
  }
})

const uncapitalize = text => `${text[0].toLowerCase()}${text.slice(1)}`

const convertToAqlComparator = (literalComparator = 'Equal', multipleValues) => {
  let aqlComparator

  if (literalComparator.match(/^(Greater|Lesser)/) && multipleValues) {
    throw new Error(`cannot compare to multiple values with comparator "${literalComparator}"`)
  }

  if (literalComparator.startsWith('Greater')) {
    aqlComparator = '>'
  } else if (literalComparator.startsWith('Lesser')) {
    aqlComparator = '<'
  } else if (['NotEqual', 'Not'].includes(literalComparator)) {
    aqlComparator = multipleValues ? 'NOT IN' : '!='
  } else {
    aqlComparator = multipleValues ? 'IN' : '=='
  }

  return literalComparator.endsWith('OrEqual') ? `${aqlComparator}=` : aqlComparator
}

module.exports = class Query {
  static PATTERN = queryMatcher
  _filters = []
  _vars = {}
  _sorts = []
  _proxy
  _booleanOperator
  _Collection

  get _filterSeparator () {
    return (this._booleanOperator || '').toUpperCase()
  }

  get [AND] () {
    return this._addBooleanOperator(AND)
  }

  get [OR] () {
    return this._addBooleanOperator(OR)
  }

  constructor (Collection, methodName, ...values) {
    this._Collection = Collection
    this._proxy = new Proxy(this, { get: this._proxyHandler })
    const [, field, comparator] = methodName.match(queryMatcher)
    return this._addFilter(uncapitalize(field), comparator, values)
  }

  _addFilter = (field, comparator, values) => {
    if (typeof field !== 'string') {
      throw new Error(`field argument must be a "string". Actual "${field}"`)
    }

    const hasMultipleValues = values.length < 1 || values.length > 1
    const aqlComparator = convertToAqlComparator(comparator, hasMultipleValues)

    this._filters.push(`doc.${field} ${aqlComparator} @${field}`)
    this._vars[field] = hasMultipleValues ? values : values[0]

    return this._proxy
  }

  _proxyHandler = (target, property) => {
    let match

    if (typeof property !== 'string' || property in this || !(match = property.match(sortCallMatcher))) {
      return this[property]
    } else {
      const [, field, way] = match
      return () => this._addSort(uncapitalize(field), way.toUpperCase())
    }
  }

  _addBooleanOperator (operator) {
    if (this._booleanOperator && this._booleanOperator !== operator) {
      throw new Error(`cannot mix logical operators "${AND}" and "${OR}"`)
    }

    this._booleanOperator = operator
    return extendBooleanExpression(this._addFilter)
  }

  _addSort = (field, direction) => {
    this._sorts.push(`doc.${field} ${direction}`)
    return this._proxy
  }

  toString () {
    return `FOR doc IN @@collection
      FILTER ${this._filters.join(` ${this._filterSeparator} `)}
      ${this._sorts.length > 0 ? `SORT ${this._sorts.join(', ')}` : ''}
      RETURN doc`
  }

  async run () {
    const cursor = await this._Collection.connector.query({
      query: this.toString(),
      bindVars: {
        '@collection': this._Collection.collectionName,
        ...this._vars
      }
    })

    return (await cursor.all()).map(doc => new this._Collection(doc))
  }
}
