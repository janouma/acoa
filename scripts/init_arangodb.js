
'use strict'

const url = require('url')
const { spawn } = require('child_process')
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

const command = `docker ${args.join(' ')}`
console.info(command)

const proc = spawn('docker', args)
const { stdout, stderr } = proc

stdout.pipe(process.stdout)
stderr.pipe(process.stderr)

proc.on('close', code => console.log(`"${command}" process exited with code ${code}`))

initDb()
  .then(() => 'db init successfull')
  .catch(error => {
    console.error(error)
    console.info('x build failed')
    process.exit(1)
  })

async function initDb () {
  const connector = new Database({
    url: `http://root:${rootPassword}@${testDbParsedUrl.hostname}:` + testDbParsedUrl.port
  })

  await tryToCreateDb(connector)
}

function tryToCreateDb (connector) {
  return new Promise((resolve, reject) => {
    const delay = 1000
    let retryCount = 0

    setTimeout(function tryToCreateDB () {
      createDatabase(connector)
        .then(resolve)
        .catch(error => {
          console.warn(error.message)

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
