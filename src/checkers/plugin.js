const btoa = require('btoa')
const fs = require('mz/fs')
const path = require('path')
const {checkStatus, sameOnBranch, commitFile} = require('../../lib/githubHelpers.js')

// opts = {
//   name: 'package.json',
//   note: [`Check that nothing drastic happened in the \`package.json\`.`]
//   path: 'package.json', // Path on GitHub
//   addNewFile: Bool, // Whether to add it if it doesn't exist
//   contentPath: path, // Path to content locally, from basedir
//   message: commitMessage,
//   linter: function(github, fileContent)
// }

module.exports = async function addPlugin (github, opts) {
  const notesForHumans = []
  let newNotes

  console.log(opts)

  const status = await checkStatus(github, opts)

  // If we shouldn't add in a file which doesn't exist yet
  if (!opts.addNewFile && status === 404) {
    console.robowarn(`There is no ${opts.name}.`)
    notesForHumans.push()
    return notesForHumans
  }

  // If we should add a new file, and it doesn't exist yet
  if (opts.addNewFile && status === 404) {
    // Get the content of the template from path
    opts.content = await fs.readFileSync(path.join(__dirname, `../../${opts.contentPath}`)).toString('base64')

    newNotes = checkAndCommit(github, opts, notesForHumans)
    return notesForHumans.concat(newNotes)
  }

  async function checkAndCommit (github, opts) {
    // If it isn't the same on the branch
    if (!await sameOnBranch(github, opts)) {
      // Commit
      await commitFile(github, {
        content: opts.content,
        message: opts.message,
        name: opts.name,
        path: opts.path,
        newFile: opts.addNewFile
      })

      // And return the final object
      return opts.note
    }
    return []
  }

  // If we should edit the existing file
  const {data} = await github.get(`/repos/${github.repoName}/contents/${opts.path}?ref=${github.branchName}`)
  const fileContent = JSON.parse(Buffer.from(data, 'base64'))
  // Do the heavylifting in the lintPackage file
  const {newFile, notesForUser} = await opts.linter(github, fileContent)
  opts.note = opts.note.concat(notesForUser)
  opts.content = btoa(JSON.stringify(newFile, null, 2))

  newNotes = checkAndCommit(github, opts, notesForHumans)
  return notesForHumans.concat(newNotes)
}
