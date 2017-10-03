#!/usr/bin/env node

const meow = require('meow')
const fn = require('./index')

const cli = meow([`
  Usage
    $ enable-community <input> [opts]

  Options

  Examples
`, {
  alias: {}
}])

async function letsGo () {
  console.log('')
  await fn(cli.input[0])
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
