const btoa = require('btoa')
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
    packageFile.note = [`You have no package.json file checked in that I can find. I am assuming this isn't published on npm. Did I miss something?`]
    toCheck.push(packageFile)
  } else {
    const {data: npm} = await github.get(`/repos/${github.repoName}/contents/package.json?branch=${github.branchName}`)
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

  // TODO Open issue to enable greenkeeper
  return toCheck
}
