'use strict'

const { spawn, exec, execSync } = require('child_process')

if (exec('pgrep arangod').status !== 0) {
  const subProcess = spawn(
    'arangod',
    {
      detached: true,
      stdio: 'ignore'
    }
  )

  subProcess.unref()
}

execSync('pgrep arangod; while [ $? -eq 1 ]; do pgrep arangod; done')
