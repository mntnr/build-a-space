const atob = require('atob')
const btoa = require('btoa')
const fs = require('mz/fs')
const path = require('path')
const lintPackageJson = require('../../lib/lintPackageJson.js')
const {getCurrentSha} = require('../../lib/githubHelpers.js')

module.exports = async function addJavascriptFiles (github) {
  // Is this a JS repo?
  const {data: {language}} = await github.get(`/repos/${github.repoName}`)
  if (language !== 'JavaScript') return

  console.robolog('Assuming this is a JavaScript repository, checking...')

  let toCheck = []

  // package.json checks
  const {status, data: npm} = await github.get(`/repos/${github.repoName}/contents/package.json`).catch(err => err)
  if (status === 404) {
    console.robowarn('There is no package.json. Is this not checked into npm?')
    return
  }

  const packageFile = {
    name: 'package',
    filePath: 'package.json',
    note: [`Check that nothing drastic happened in the \`package.json\`.`]
  }

  const pkg = JSON.parse(Buffer.from(npm.content, 'base64'))
  const {pkg: newPkg, notesForUser} = await lintPackageJson.lint(github, pkg)
  packageFile.note = packageFile.note.concat(notesForUser)
  packageFile.content = btoa(JSON.stringify(newPkg, null, 2))

  const {data: {content: fileOnBranch}} = await github.get(`/repos/${github.targetRepo}/contents/package.json?ref=${github.branchName}`)

  // If the content is the same, don't add a new commit
  // Shim them in and out to make sure that there's no formatting differences
  if (btoa(atob(packageFile.content)) !== btoa(atob(fileOnBranch))) {
    const commitMessage = {
      path: packageFile.filePath,
      message: `chore: updated fields in the package.json

      ${packageFile.note.map(note => `- [ ] ${note}`).join('\n')}
      `,
      content: packageFile.content,
      branch: github.branchName,
      sha: await getCurrentSha(github, packageFile.filePath)
    }

    await github.put(`/repos/${github.targetRepo}/contents/${packageFile.filePath}?ref=${github.branchName}`, commitMessage)
    .catch(err => {
      if (err) {
        console.robowarn('Unable to add package.json file!', err)
      }
    })

    toCheck.push(packageFile)
  }

  // If travis file exists
  const travisFile = {
    name: 'travis',
    filePath: '.travis.yml',
    note: ['Check if .travis.yml was overwritten or not.']
  }

  travisFile.content = await fs.readFileSync(path.join(__dirname, `../../fixtures/js/${travisFile.filePath}`)).toString('base64')
  const {status: travisStatus, data: travisContent} = await github.get(`/repos/${github.repoName}/contents/${travisFile.filePath}?ref=${github.branchName}`)
    .catch(err => {
      console.robolog('Unable to find travis file.')
      return err.response
    })
  if (travisStatus !== 404) {
    if (Buffer.from(travisContent.content, 'base64').toString('base64') !== travisFile.content) {
      await github.put(`/repos/${github.targetRepo}/contents/${travisFile.filePath}?ref=${github.branchName}`, {
        path: travisFile.filePath,
        message: 'ci: adding travis file with Greenkeeper and semantic-release enabled',
        content: travisFile.content,
        branch: github.branchName,
        sha: await getCurrentSha(github, travisFile.filePath)
      }).catch(err => {
        if (err) {
          console.robowarn('Unable to add travis file!')
        }
      })

      toCheck.push(travisFile)
    }
  }

  // TODO Open issue to enable greenkeeper

  return toCheck
}
