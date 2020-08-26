'use strict'

function defineConstants (constants) {
  return Object.entries(constants)
    .map(([name, value]) => `const ${name} = ${JSON.stringify(value, undefined, 2).replace('\\"', '"')}`)
}

module.exports = function createTransaction ({ init, dependencies, constants }) {
  if (typeof init !== 'function') {
    throw new Error('init function is required')
  }

  if (constants && (Array.isArray(constants) || typeof constants !== 'object')) {
    throw new Error(`constants must be an object – actual value:\n${constants}`)
  }

  if (dependencies && Object.values(dependencies).some(dependency => typeof dependency !== 'function')) {
    throw new Error(`dependencies must be a hash of functions – actual value:\n${JSON.stringify(dependencies)}`)
  }

  return `function transaction (params) {
    ${constants ? defineConstants(constants).join('\n') : ''}

    ${
      dependencies
        ? Object.entries(dependencies)
          .map(([name, code]) => `const ${name} = ${code}`)
          .join('\n\n')

        : ''
    }

    const init = ${init}

    return init(params)
  }`
}
