const atob = require('atob')
const btoa = require('btoa')
const console = require('./robo')

module.exports = {
  // getCurrentSha,
  // getFileBlob,
  bunchFiles,
  sameOnBranch,
  commitFile,
  checkStatus
}

async function checkStatus (github, file) {
  let {status} = await github.get(`/repos/${github.repoName}/contents/${file.path}?ref=${github.branchName}`)
    .catch(err => {
      console.robolog(`Unable to find ${file.name}.`)
      return err.response
    })
  return status
}

async function sameOnBranch (github, file) {
  // Check if the file is any different on the branch
  const {data} = await github.get(`/repos/${github.targetRepo}/contents/${file.path}?ref=${github.branchName}`)
    .catch(err => {
      if (err) {
        // console.log('File does not exist, so cannot check sameOnBranch.')
      }
      return false
    })

  // If the content is the same, don't add a new commit
  // Shim them in and out to make sure that there's no formatting differences
  return (data) ? btoa(atob(file.content)) === btoa(atob(data.content)) : false
}

async function commitFile (github, file) {
  await github.put(`/repos/${github.targetRepo}/contents/${file.path}?ref=${github.branchName}`, {
    branch: github.branchName,
    content: file.content,
    message: file.message,
    path: file.path,
    sha: await getCurrentSha(github, file.path)
  }).catch(err => {
    if (err) {
      console.robowarn(`Unable to add ${file.name}!`)
    }
  })
}

// This function bunches up multiple file changes into the same commit.
// It depends on a files object: { name, filepath, content, note }.
async function bunchFiles (github, filesToCheck, opts) {
  opts = opts || {}

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

  if (newBlobs.length !== 0 && !opts.test) {
    const newTree = tree.concat(newBlobs)

    // post a new tree object with that file path pointer replaced with your new blob SHA getting a tree SHA back
    const {data: {sha: newTreeSha}} = await github.post(`/repos/${github.targetRepo}/git/trees`, {
      tree: newTree,
      base_tree: treeSha
    })

    // create a new commit object with the current commit SHA as the parent and the new tree SHA, getting a commit SHA back
    const {data: {sha: newCommitSha}} = await github.post(`/repos/${github.targetRepo}/git/commits`, {
      message: opts.message,
      tree: newTreeSha,
      parents: [currentCommitSha]
    }).catch(err => {
      if (err) {
        console.log('Unable to create new commit obj')
      }
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
