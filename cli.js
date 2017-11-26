#!/usr/bin/env node

const meow = require('meow')
const fs = require('mz/fs')
const path = require('path')
const fn = require('./src/index')
const gitRemoteOriginUrl = require('git-remote-origin-url')
const gitRemoteUpstreamUrl = require('git-remote-upstream-url')

const cli = meow({
  'help': `
  Usage
    $ build-a-space <input> [opts]

  Options
    -f, --fork  Create and use a fork instead of pushing to a branch
    -t, --test  Don't open issues or create pull requests
    -c, --config  The path to a configuration file
    -b, --branch  The default branch to use instead of 'master'
    --email     The email for the Code of Conduct
    --licensee  The person to license the repository to

  Examples
    $ build-a-space mntnr/build-a-space
`,
  'flags': {
    'fork': {
      type: 'boolean',
      alias: 'f'
    },
    'test': {
      type: 'boolean',
      alias: 't'
    },
    'travis': {
      type: 'boolean',
      default: true
    },
    'open': {
      type: 'boolean',
      defaul: false
    },
    'config': {
      type: 'string',
      alias: 'c'
    },
    'branch': {
      type: 'string',
      alias: 'b'
    }
  }
})

// TODO Make this into it's own module, gh-get-shortname
function getRepoFromConfig () {
  return gitRemoteUpstreamUrl()
    .catch(() => gitRemoteOriginUrl())
    .then(res => res.match(/([^/:]+\/[^/.]+)(\.git)?$/)[1])
}

async function getConfig (configPath) {
  if (configPath) {
    let config = await fs.readFileSync(path.join(__dirname, configPath))
    .toString('utf8')
    return JSON.parse(config)
  }
}

async function letsGo () {
  console.log('')
  const repoName = cli.input[0] || await getRepoFromConfig()
  Object.assign(cli.flags, await getConfig(cli.flags.config))
  await fn(repoName, cli.flags)
  console.log('')
}

letsGo()
