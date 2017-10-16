#!/usr/bin/env node

const meow = require('meow')
const fn = require('./index')
const gitRemoteOriginUrl = require('git-remote-origin-url')
const gitRemoteUpstreamUrl = require('git-remote-upstream-url')

const cli = meow([`
  Usage
    $ build-a-space <input> [opts]

  Options
    -f, --fork  Create and use a fork instead of pushing to a branch
    -t, --test  Don't open issues or create pull requests

  Examples
    $ build-a-space RichardLitt/build-a-space
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

// const token = process.env.GITHUB_TOKEN;

// if (cli.flags.u && cli.flags.r && token) {
//   graphql.executequery(token, queries.everything(cli.flags.r, cli.flags.u))
//     .then(JSON.parse)
//     .then(queries.cleanData)
//     .then(console.log);
// } else {
//   console.error('You must currently specify both a user and a repo name. And provide a token.');
//   process.exit(1);
// }
