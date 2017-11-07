const btoa = require('btoa')
const fs = require('mz/fs')
const path = require('path')
const lintPackageJson = require('../../lib/lintPackageJson.js')
const {checkStatus, sameOnBranch, commitFile} = require('../../lib/githubHelpers.js')

module.exports = async function addJavascriptFiles (github) {
  // Is this a JS repo?
  const {data: {language}} = await github.get(`/repos/${github.repoName}`)
  if (language !== 'JavaScript') return

  console.robolog('Assuming this is a JavaScript repository, checking...')

  const toCheck = []

  const packageFile = {
    name: 'package.json',
    path: 'package.json',
    note: [`Check that nothing drastic happened in the \`package.json\`.`]
  }

  // Abandon if there is no package.json
  const npmStatus = await checkStatus(github, packageFile)
  if (npmStatus === 404) {
    console.robowarn('There is no package.json. Is this not checked into npm?')
    packageFile.note = [`You have no package.json file checked in that I can find. Think about adding one.`]
    toCheck.push(packageFile)
  } else {
    const {data: npm} = await github.get(`/repos/${github.repoName}/contents/package.json?ref=${github.branchName}`)
    const pkg = JSON.parse(Buffer.from(npm.content, 'base64'))
    // Do the heavylifting in the lintPackage file
    const {pkg: newPkg, notesForUser} = await lintPackageJson.lint(github, pkg)
    packageFile.note = packageFile.note.concat(notesForUser)
    packageFile.content = btoa(JSON.stringify(newPkg, null, 2))

    if (!await sameOnBranch(github, packageFile)) {
      await commitFile(github, {
        content: packageFile.content,
        message: `chore: updated fields in the package.json

        ${packageFile.note.map(note => `- [ ] ${note}`).join('\n')}
        `,
        path: packageFile.path,
        name: packageFile.name
      })

      toCheck.push(packageFile)
    }
  }

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

  // TODO Open issue to enable greenkeeper

  return toCheck
}
