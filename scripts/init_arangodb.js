
'use strict'

const url = require('url')
const { spawn } = require('child_process')
const { Transform } = require('stream')
const { Database } = require('arangojs')

const {
  npm_package_config_testDbUrl: testDbUrl,
  npm_package_config_testDbRootPassword: rootPassword,
  npm_package_config_testDbContainer: container
} = process.env

// eslint-disable-next-line node/no-deprecated-api
const testDbParsedUrl = url.parse(testDbUrl)

const [testUser, testPassword] = testDbParsedUrl.auth.split(':')

const args = [
  'run', '-e', 'ARANGO_ROOT_PASSWORD=' + rootPassword, '--rm', '-p', testDbParsedUrl.port + ':8529', '--name', container,
  'arangodb:3.10.4'
]

const command = 'docker ' + args.join(' ')
console.info(`\x1b[1m\x1b[34mcommand: ${command}\x1b[89m\x1b[22m\x1b[0m`)

const proc = spawn('docker', args)
const { stdout, stderr } = proc

stdout.pipe(process.stdout)

const colorizeStdErr = new Transform({
  transform (chunk, _, callback) {
    const noError = undefined
    callback(noError, `\x1b[31m${String(chunk)}\x1b[89m\x1b[0m`)
  }
})

stderr.pipe(colorizeStdErr).pipe(process.stderr)

proc.on('close', code => console.log(`\x1b[1m\x1b[${code > 0 ? 31 : 34}m"${command}" exited with code ${code}\x1b[89m\x1b[22m\x1b[0m`))

initDb()
  .then(() => console.info('\x1b[1m\x1b[32m✔ db init successfull\x1b[89m\x1b[22m\x1b[0m'))
  .catch(error => {
    console.error('\x1b[1m\x1b[31mx db init failed')
    console.error(error + '\x1b[22m\x1b[0m')
    process.exit(1)
  })

async function initDb () {
  const connector = new Database({
    url: `http://root:${rootPassword}@${testDbParsedUrl.hostname}:` + testDbParsedUrl.port
  })

  return tryToCreateDb(connector)
}

function tryToCreateDb (connector) {
  return new Promise((resolve, reject) => {
    const delay = 3000
    let retryCount = 0

    setTimeout(function tryToCreateDB () {
      createDatabase(connector)
        .then(resolve)
        .catch(error => {
          console.warn(`\x1b[1m\x1b[33m${error.name}: `, error.message + '\x1b[89m\x1b[22m\x1b[0m')

          if (retryCount++ > 5) {
            reject(error)
          } else {
            setTimeout(tryToCreateDB, delay)
          }
        })
    }, delay)
  })
}

async function createDatabase (connector) {
  return connector.createDatabase(
    process.env.npm_package_config_testDbName,
    [{ username: testUser, passwd: testPassword }]
  )
}
