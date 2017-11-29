const fs = require('mz/fs')
const path = require('path')
const {checkStatus, sameOnBranch, commitFile} = require('../../lib/githubHelpers.js')

module.exports = async function checkTravis (github, opts) {
  if (opts.noTravis) {
    console.robolog('Ignoreing Travis file')
    return []
  }

  const toCheck = []

  // If travis file exists
  const travisFile = {
    name: 'travis',
    path: '.travis.yml',
    note: ['Check if .travis.yml was overwritten or not.']
  }

  // Only commit if there is already a travis file
  const travisStatus = await checkStatus(github, travisFile)
  if (travisStatus === 404) {
    travisFile.note = [`Consider adding Travis. Travis is useful not only for tests, but also for [greenkeeper](https://greenkeeper.io/) and [semantic-release](https://github.com/semantic-release/semantic-release).`]
    toCheck.push(travisFile)
  } else {
    // Get the content of the template
    travisFile.content = await fs.readFileSync(path.join(__dirname, `../../fixtures/js/${travisFile.path}`)).toString('base64')
    // If it isn't the same on the branch
    if (!await sameOnBranch(github, travisFile)) {
      // Commit
      await commitFile(github, {
        name: travisFile.name,
        path: travisFile.path,
        message: 'ci: adding travis file with Greenkeeper and semantic-release enabled',
        content: travisFile.content
      })

      // And return the final object for travis
      toCheck.push(travisFile)
    }
  }

  return toCheck
}
