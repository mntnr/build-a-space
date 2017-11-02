#!/usr/bin/env node

const meow = require('meow')
const fn = require('./src/index')
const gitRemoteOriginUrl = require('git-remote-origin-url')
const gitRemoteUpstreamUrl = require('git-remote-upstream-url')

const cli = meow([`
  Usage
    $ build-a-space <input> [opts]

  Options
    -f, --fork  Create and use a fork instead of pushing to a branch
    -t, --test  Don't open issues or create pull requests

  Examples
    $ build-a-space mntnr/build-a-space
`], {
  boolean: ['fork', 'test'],
  alias: {
    'f': 'fork',
    't': 'test'
  }
})

// TODO Make this into it's own module, gh-get-shortname
function getRepoFromConfig () {
  return gitRemoteUpstreamUrl()
    .catch(() => gitRemoteOriginUrl())
    .then(res => res.match(/([^/:]+\/[^/.]+)(\.git)?$/)[1])
}

async function letsGo () {
  console.log('')
  const repoName = cli.input[0] || await getRepoFromConfig()
  await fn(repoName, cli.flags)
  console.log('')
}

letsGo()
