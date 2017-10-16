const console = require('./robo')

async function getOrCreateFork (github, opts) {
  // List forks
  const repoOnly = github.repoName.split('/')[1]

  const {data: forks} = await github.get(`/repos/${github.repoName}/forks`)
  // Filter forks owner - if it matches github.owner, use that fork
  const ownFork = forks.filter(fork => fork.owner.login === github.user.login)
  // Return if it does exist
  if (ownFork.length !== 0) {
    console.robolog(`Using existing fork: ${github.user.login}/${repoOnly}.`)
  } else {
    var error
    // Create it if it don't exist ya'll
    // This doesn't seem to be working at all
    if (opts.test) {
      console.robofire(`Refusing to create fork, because tests.`)
    } else {
      console.log(github.user.login, repoOnly)
      await github.post(`/repos/${github.repoName}/forks`)
        .catch(err => {
          if (err) {
            error = true
            console.robofire(`Unable to create a new fork for ${github.user.login}!`)
            console.log(err)
          }
        })
      if (!error) {
        console.robolog(`Created new fork: ${github.user.login}/${repoOnly}.`)
      }
    }
  }
  return `${github.user.login}/${repoOnly}`
}

async function getOrCreateBranch (github, sha) {
  // Gets a 422 sometimes
  const branchExists = await github.get(`/repos/${github.targetRepo}/branches/${github.branchName}`)
    .catch(err => {
      if (err) {
        console.robolog(`Creating new branch on ${github.targetRepo}: ${github.branchName} using last sha ${sha}`)
      } // do nothing
    })
  if (!branchExists) {
    await github.post(`/repos/${github.targetRepo}/git/refs`, {
      ref: `refs/heads/${github.branchName}`,
      sha
    }).catch(err => {
      if (err) {}
      console.robofire('Unable to create a new branch. Do you have access?')
      console.log('')
      process.exit(1)
    })
  } else {
    console.robolog(`Using existing branch on ${github.targetRepo}: ${github.branchName} using last sha ${sha}`)
  }
}

// This function bunches up multiple file changes into the same commit.
// It depends on a files object: { name, filepath, content, note }.
async function bunchFiles (github, filesToCheck) {
  // Always work off of master, for now. TODO Enable other dev branches
  // get the current commit object and current tree
  const {
    data: {commit: {sha: currentCommitSha}},
    data: {commit: {commit: {tree: {sha: treeSha}}}}
  } = await github.get(`/repos/${github.repoName}/branches/master`)
    .catch(err => {
      if (err) {
        console.robowarn('Unable to get commit information to bunch files')
      }
    })

  // retrieve the content of the blob object that tree has for that particular file path
  const {data: {tree}} = await github.get(`/repos/${github.repoName}/git/trees/${treeSha}`)
    .catch(err => {
      if (err) {
        console.robowarn('Unable to get tree')
      }
    })

  // change the content somehow and post a new blob object with that new content, getting a blob SHA back
  const newBlobs = await Promise.all(filesToCheck.map(async file => getFileBlob(github, file)))

  if (newBlobs.length !== 0) {
    const newTree = tree.concat(newBlobs)

    // post a new tree object with that file path pointer replaced with your new blob SHA getting a tree SHA back
    const {data: {sha: newTreeSha}} = await github.post(`/repos/${github.targetRepo}/git/trees`, {
      tree: newTree,
      base_tree: treeSha
    })

    // create a new commit object with the current commit SHA as the parent and the new tree SHA, getting a commit SHA back
    const {data: {sha: newCommitSha}} = await github.post(`/repos/${github.targetRepo}/git/commits`, {
      message: `docs: adding community docs`,
      tree: newTreeSha,
      parents: [currentCommitSha]
    })

    // update the reference of your branch to point to the new commit SHA
    await github.post(`/repos/${github.targetRepo}/git/refs/heads/${github.branchName}`, {
      sha: newCommitSha
    }).catch(err => {
      if (err) {
        console.log('Unable to update refs with new commit')
      }
    })
  }
  return filesToCheck
}

async function getFileBlob (github, file) {
  console.robolog(`Adding ${file.name} file`)

  // Create a blob
  const {data: blob} = await github.post(`/repos/${github.targetRepo}/git/blobs`, {
    content: file.content,
    encoding: 'base64'
  }).catch(err => {
    if (err) {}
    console.robofire(`I can't post to a foreign repo! Do you have access?`)
    console.log('')
    process.exit(1)
  })

  return {
    mode: '100644',
    type: 'blob',
    path: file.filePath, // Puts them all in the base directory for now
    sha: blob.sha,
    url: blob.url
  }
}

async function getCurrentSha (github, filename) {
  const {data: {sha: currentSha}} = await github.get(`/repos/${github.targetRepo}/contents/${filename}?ref=${github.branchName}`)
    .catch(err => {
      if (err) {}
      console.robofire('Unable to get current sha, most likely due to undefined branch.')
    })
  return currentSha
}

module.exports = {
  getOrCreateBranch,
  getOrCreateFork,
  getCurrentSha,
  getFileBlob,
  bunchFiles
}
