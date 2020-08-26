/* eslint-env jest */

'use strict'

const connector = require('../../connector')
const Query = require('../../../lib/query')
const docs = require('../../fixtures/items')

class Item {
  static collectionName = 'items'
  static connector = connector

  constructor (doc) {
    this.doc = doc
  }
}

const identity = v => v

function assertResultsContent (results, expected, exact = false) {
  expect(results.map(({ doc }) => doc))
    .toEqual((exact ? identity : expect.arrayContaining)(expected.map(doc => expect.objectContaining({
      ...doc,
      _id: expect.stringMatching(new RegExp(`^${Item.collectionName}/\\w+`)),
      _key: expect.any(String)
    }))))
}

function assertResultsStruct (results, length, type) {
  expect(results).toHaveLength(length)
  expect(results).toEqual(results.map(() => expect.any(type)))
}

function expectMatch (results, ...expected) {
  assertResultsStruct(results, expected.length, Item)
  assertResultsContent(results, expected)
}

function expectExactMatch (results, ...expected) {
  assertResultsStruct(results, expected.length, Item)
  assertResultsContent(results, expected, true)
}

describe('lib/query', () => {
  const collection = connector.collection(Item.collectionName)

  beforeAll(async () => {
    await collection.create()
    return collection.import(docs)
  })

  afterAll(() => collection.drop())

  it('should require Collection', () => {
    expect(() => new Query(undefined, 'findByName', 'value'))
      .toThrow('missing Collection')
  })

  it('should require methodName', () => {
    expect(() => new Query(Item, undefined, 'value'))
      .toThrow('missing methodName')
  })

  it('should reject malformed query methodName', () => {
    const malformedMethodName = 'malformedMethodName'

    expect(() => new Query(Item, malformedMethodName, 'value'))
      .toThrow(`methodName doesn't match query pattern ${Query.PATTERN}. Actual: "${malformedMethodName}"`)
  })

  it('should ignore non-string unknown property', () => {
    expect(new Query(Item, 'findByName', 'large screen')[Symbol('sortByNameAsc')])
      .toBeUndefined()

    expect(new Query(Item, 'findByName', 'large screen')
      .and[Symbol('nameEqual')])
      .toBeUndefined()

    expect(new Query(Item, 'findByName', 'large screen')
      .or[Symbol('priceGreaterThan')])
      .toBeUndefined()
  })

  ;[
    ['findByName', 'exact match', ['large screen'], [docs[0]]],
    ['findByNameEqual', 'exact match', ['large screen'], [docs[0]]],
    ['findByNameNot', 'exact mismatch', ['large screen'], [docs[1]]],
    ['findByNameNotEqual', 'exact mismatch', ['large screen'], [docs[1]]],
    ['findByNameMatching', 'regexp literal match', ['\\sscre\\w+'], [docs[0]]],
    ['findByNameNotMatching', 'regexp literal mismatch', ['\\sscre\\w+'], [docs[1]]],
    ['findByNameMatching', 'regexp object match', [/\sScre\w+/i], [docs[0]]],
    ['findByNameNotMatching', 'regexp object mismatch', [/\sscre\w+/], [docs[1]]],
    ['findByTagsContaining', 'exact match', ['hifi'], [docs[0]]],
    ['findByTagsNotContaining', 'exact mismatch', ['hifi'], [docs[1]]],
    ['findByName', 'exact match', ['large screen', 'hard drive'], docs],
    ['findByNameEqual', 'exact match', ['large screen', 'hard drive'], docs],
    ['findByTagsContaining', 'exact match', ['hifi', 'display'], [docs[0]]],
    ['findByNameNot', 'exact mismatch', ['large screen', 'hard drive'], []],
    ['findByNameNotEqual', 'exact mismatch', ['large screen', 'hard drive'], []],
    ['findByTagsNotContaining', 'exact mismatch', ['hifi', 'display'], [docs[1]]],
    ['findByName', 'exact match', [], []],
    ['findByNameEqual', 'exact match', [], []],
    ['findByTagsContaining', 'exact match', [], docs],
    ['findByNameNot', 'exact mismatch', [], docs],
    ['findByNameNotEqual', 'exact mismatch', [], docs],
    ['findByTagsNotContaining', 'exact mismatch', [], docs]
  ].forEach(([methodName, match, values, expected]) => {
    describe(`#${methodName}`, () => {
      it(`should allow ${match} with ${values.length > 1 ? 'multiple ' : values.length < 1 ? '0 ' : ''}value${values.length < 1 || values.length > 1 ? 's' : ''}`, async () => {
        const query = new Query(Item, methodName, ...values)
        expectMatch(await query.run(), ...expected)
      })
    })
  })

  ;[
    ['findByPriceGreaterThan', 229.99, '>', [docs[0]]],
    ['findByPriceLesserThan', 999.99, '<', [docs[1]]],
    ['findByPriceGreaterThanOrEqual', 229.99, '>=', docs],
    ['findByPriceLesserThanOrEqual', 999.99, '<=', docs]
  ].forEach(([methodName, price, comparator, expected]) => {
    describe(`#${methodName}`, () => {
      it(`should return wrapped documents filtered out by price ${comparator} value`, async () => {
        const query = new Query(Item, methodName, price)
        expectMatch(await query.run(), ...expected)
      })
    })
  })

  ;[
    'findByPriceGreaterThan',
    'findByPriceLesserThan',
    'findByPriceGreaterThanOrEqual',
    'findByPriceLesserThanOrEqual',
    'findByNameMatching',
    'findByNameNotMatching'
  ].forEach(methodName => {
    describe(`#${methodName}`, () => {
      [
        [229.99, 999.99],
        []
      ].forEach(values => {
        it(`should reject ${values.length > 1 ? 'multiple' : 'missing'} value${values.length > 1 ? 's' : ''}`, () => {
          const literalComparator = methodName.replace(/findBy(Price|Name)/, '')

          expect(() => new Query(Item, methodName, ...values))
            .toThrow(`cannot compare to multiple values with comparator "${literalComparator}"`)
        })
      })
    })
  })

  ;[
    ['and', [docs[0]]],
    ['or', docs]
  ].forEach(([booleanOperator, expected]) => {
    describe(`#findByType.${booleanOperator}.name`, () => {
      it(
        `should return wrapped documents filtered out by type ${booleanOperator} name matching exact values`,

        async () => {
          const results = await new Query(
            Item,
            'findByType',
            'hardware'
          )[booleanOperator].name('large screen')
            .run()

          expectMatch(results, ...expected)
        }
      )
    })
  })

  ;[
    ['nameEqual', [docs[0]], 'matching exact', [docs[0].name]],
    ['nameNot', [docs[1]], 'NOT matching exact', [docs[0].name]],
    ['nameNotEqual', [docs[1]], 'NOT matching exact', [docs[0].name]],
    ['name', docs, 'matching exact', docs.map(({ name }) => name)],
    ['nameEqual', docs, 'matching exact', docs.map(({ name }) => name)],
    ['nameNot', [], 'NOT matching exact', docs.map(({ name }) => name)],
    ['nameNotEqual', [], 'NOT matching exact', docs.map(({ name }) => name)],
    ['nameMatching', [docs[0]], 'matching literal regexp', ['\\sscre\\w+']],
    ['nameNotMatching', [docs[1]], 'NOT matching literal regexp', ['\\sscre\\w+']],
    ['nameMatching', [docs[0]], 'matching object regexp', [/\sScre\w+/gim]],
    ['nameNotMatching', [docs[1]], 'NOT matching object regexp', [/\sscre\w+/]],
    ['tagsContaining', [docs[0]], 'containing', ['hifi']],
    ['tagsContaining', [docs[0]], 'containing', ['hifi', 'display']],
    ['tagsNotContaining', [docs[1]], 'NOT containing', ['hifi']],
    ['tagsNotContaining', [docs[1]], 'NOT containing', ['hifi', 'display']],
    ['name', [], 'matching exact', []],
    ['nameEqual', [], 'matching exact', []],
    ['nameNot', docs, 'NOT matching exact', []],
    ['nameNotEqual', docs, 'NOT matching exact', []],
    ['tagsContaining', docs, 'containing', []],
    ['tagsNotContaining', docs, 'NOT containing', []]
  ].forEach(([additionalFilter, expected, equality, values]) => {
    describe(`#findByType.and.${additionalFilter}`, () => {
      it(
        `should return wrapped documents filtered out by type and field ${equality} ${values.length > 1 ? 'multiple ' : values.length < 1 ? '0 ' : ''}values`,

        async () => {
          const results = await new Query(Item, 'findByType', 'hardware')
            .and[additionalFilter](...values)
            .run()

          expectMatch(results, ...expected)
        }
      )
    })
  })

  ;[
    ['priceGreaterThan', 229.99, [docs[0]], '>'],
    ['priceGreaterThanOrEqual', 229.99, docs, '>='],
    ['priceLesserThan', 999.99, [docs[1]], '<'],
    ['priceLesserThanOrEqual', 999.99, docs, '<=']
  ].forEach(([additionalFilter, price, expected, comparator]) => {
    describe(`#findByType.and.${additionalFilter}`, () => {
      it(`should return wrapped documents filtered out by type and price ${comparator} value`, async () => {
        const results = await new Query(Item, 'findByType', 'hardware')
          .and[additionalFilter](price)
          .run()

        expectMatch(results, ...expected)
      })
    })
  })

  ;[
    'priceGreaterThan',
    'priceGreaterThanOrEqual',
    'priceLesserThan',
    'priceLesserThanOrEqual',
    'nameMatching',
    'nameNotMatching'
  ].forEach(additionalFilter => {
    describe(`#findByType.and.${additionalFilter}`, () => {
      [
        [229.99, 999.99],
        []
      ].forEach(values => {
        it(`should reject ${values.length > 1 ? 'multiple' : 'missing'} value${values.length > 1 ? 's' : ''}`, () => {
          const literalComparator = additionalFilter.replace(/price|name/, '')

          expect(
            () => new Query(Item, 'findByType', 'hardware')
              .and[additionalFilter](...values)
          )
            .toThrow(`cannot compare to multiple values with comparator "${literalComparator}"`)
        })
      })
    })
  })

  it('should prevent mix of "and" & "or" operators', () => {
    expect(() => new Query(Item, 'findByType', 'hardware')
      .and.name('large screen')
      .or.name('hard drive')
    ).toThrow('cannot mix logical operators "and" and "or"')
  })

  it('should sort documents ascending', async () => {
    const results = await new Query(Item, 'findByType', 'hardware')
      .sortByTypeAsc()
      .sortByPriceAsc()
      .run()

    expectExactMatch(results, ...docs.slice().reverse())
  })

  it('should sort documents descending', async () => {
    const results = await new Query(Item, 'findByType', 'hardware')
      .sortByTypeDesc()
      .sortByPriceDesc()
      .run()

    expectExactMatch(results, ...docs)
  })

  describe('#slice', () => {
    it('should require "start" argument', () => {
      expect(
        () => new Query(Item, 'findByType', 'hardware')
          .slice(undefined, 2)
      ).toThrow('"start" argument is missing')
    })

    it('should require "end" argument', () => {
      expect(
        () => new Query(Item, 'findByType', 'hardware')
          .slice(1, undefined)
      ).toThrow('"end" argument is missing')
    })

    it('should reject negative value as "start"', () => {
      expect(
        () => new Query(Item, 'findByType', 'hardware')
          .slice(-1, 2)
      ).toThrow('"start" argument must be positive. Actual: -1')
    })

    it('should ensure that "end" > "start"', () => {
      expect(
        () => new Query(Item, 'findByType', 'hardware')
          .slice(1, -2)
      ).toThrow('"end" must be greater than "start". start: 1, end: -2')

      expect(
        () => new Query(Item, 'findByType', 'hardware')
          .slice(0, 0)
      ).toThrow('"end" must be greater than "start". start: 0, end: 0')
    })

    it('should slice results with given bounds', async () => {
      const results = await new Query(Item, 'findByType', 'hardware')
        .sortByPriceAsc()
        .slice(1, 2)
        .run()

      expectMatch(results, docs[0])
    })
  })
})
