#!/usr/bin/env node

const meow = require('meow')
const fn = require('./index')
const gitRemoteOriginUrl = require('git-remote-origin-url')
const gitRemoteUpstreamUrl = require('git-remote-upstream-url')

const cli = meow([`
  Usage
    $ enable-community <input> [opts]

  Options

  Examples
`], {
  alias: {}
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
  await fn(repoName)
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
