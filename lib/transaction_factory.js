'use strict'

function defineConstants (constants) {
  return Object.entries(constants)
    .map(([name, value]) => `const ${name} = ${JSON.stringify(value).replace('\\"', '"')}`)
}

module.exports = function createTransaction ({ init, dependencies, constants }) {
  if (typeof init !== 'function') {
    throw new Error('init function is required')
  }

  if (constants && typeof constants !== 'object') {
    throw new Error(`constants must be an object – actual value:\n${constants}`)
  }

  if (dependencies && (!Array.isArray(dependencies) ||
    dependencies.some(dependency => typeof dependency !== 'function'))) {
    throw new Error(`dependencies must be an array of function – actual value:\n${dependencies}`)
  }

  return `function transaction (params) {
    ${constants ? defineConstants(constants).join('\n') : ''}

    ${dependencies ? dependencies.join('\n\n') : ''}

    ${init}

    return ${init.name}(params)
  }`
}
