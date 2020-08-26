'use strict'

const AND = 'and'
const OR = 'or'
const sortCallMatcher = /^sortBy([_A-Z]\w*?)(Asc|Desc)$/
const comparatorMatcher = '((Greater|Lesser)Than(OrEqual)?)|(Not)?(Equal|Matching|Containing)?'
const fieldMatcher = new RegExp(`^(\\w*?)(${comparatorMatcher})?$`)
const queryMatcher = new RegExp(`^findBy([_A-Z]\\w*?)(${comparatorMatcher})?$`)

const emptyValues = [null, undefined]

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

module.exports = class Query {
  static PATTERN = queryMatcher
  _filters = []
  _vars = {}
  _sorts = []
  _limit
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

    this._Collection = Collection
    this._proxy = new Proxy(this, { get: this._proxyHandler })
    const [, field, comparator] = match
    return this._addFilter(uncapitalize(field), comparator, values)
  }

  _addFilter = (field, comparator, values) => {
    if (typeof field !== 'string') {
      throw new Error(`field argument must be a "string". Actual "${field}"`)
    }

    const hasMultipleValues = values.length < 1 || values.length > 1
    const aqlComparator = convertToAqlComparator(comparator, hasMultipleValues)
    const filter = [`doc.${field}`, aqlComparator, `@${field}`]

    if (comparator && comparator.match(/^(Not)?Containing$/)) {
      filter.reverse()
    }

    if (aqlComparator.endsWith('~') && values[0] instanceof RegExp) {
      this._filters.push(
        `${aqlComparator.startsWith('!') ? '!' : ''}REGEX_TEST(doc.${field}, @${field}, ${values[0].ignoreCase})`
      )

      this._vars[field] = String(values[0]).replace(/(^\/)|(\/\w*$)/g, '')
    } else {
      this._filters.push(filter.join(' '))
      this._vars[field] = hasMultipleValues ? values : values[0]
    }

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
      ${this._limit ? `LIMIT ${this._limit.join(', ')}` : ''}
      RETURN doc`
  }

  slice (start, end) {
    if (emptyValues.includes(start)) {
      throw new Error('"start" argument is missing')
    }

    if (start < 0) {
      throw new Error(`"start" argument must be positive. Actual: ${start}`)
    }

    if (emptyValues.includes(end)) {
      throw new Error('"end" argument is missing')
    }

    if (end <= start) {
      throw new Error(`"end" must be greater than "start". start: ${start}, end: ${end}`)
    }

    this._limit = [start, end - start]

    return this._proxy
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
