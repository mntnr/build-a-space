module.exports = buildASpace

const querystring = require('querystring')
const fs = require('mz/fs')
const path = require('path')
const axios = require('axios')
const btoa = require('btoa')
const env = require('./env')
const console = require('./lib/robo')
const github = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    common: {
      authorization: `token ${env.BUILD_A_SPACE}`,
      accept: [
        `application/vnd.github.black-panther-preview+json`, // Community https://developer.github.com/v3/community
        `application/vnd.github.scarlet-witch-preview+json` // CoC https://developer.github.com/v3/codes_of_conduct/
      ]
    }
  }
})
const lintPackageJson = require('./lib/lintPackageJson.js')

// TODO Check that repoName is valid
// TODO Export properly

async function buildASpace (repoName, diffs) {
  // https://docs.travis-ci.com/user/environment-variables/
  github.repoName = repoName || env.TRAVIS_REPO_SLUG

  await github.get(`/repos/${github.repoName}`).catch(err => {
    if (err) {
      console.robofire('That is not a valid GitHUb repository!')
      console.log('')
      process.exit(1)
    }
  })

  console.robolog(`Let's get some documentation up in here. Creating pull request ...`)

  // who am I?
  const {data: user} = await github.get('/user')
  console.robolog(`Signed in as ${user.login}. Looking if I already created a pull request.`)
  // console.log(user)
  github.user = user.login
  await initPRandBranch()

  const communityFiles = await checkCommunityFiles()

  const files = await bunchFiles(communityFiles)
  const jsFiles = await addJavascriptFiles()

  await createPullRequest(files.concat(jsFiles))
}

async function initPRandBranch () {
  // Do I have a pending pull request?
  const query = querystring.stringify({
    type: 'pr',
    author: github.user.login,
    is: 'open',
    repo: github.repoName
  }, ' ', ':')

  const {data: pullRequestsResult} = await github.get(`/search/issues?q=${query}`)
  const pullRequestNumbers = pullRequestsResult.items.map(pr => pr.number)

  // if there are more than a single pull request, then we have a problem, because
  // I don’t know which one to update. So I’ll ask you for help :)
  if (pullRequestsResult.total_count > 1) {
    console.robolog('🤖🆘 Oh oh, I don’t know how to handle more than one pull requests. Creating an issue for my human friends')
    const result = await github.post(`/repos/${github.repoName}/issues`, {
      title: '🤖🆘 Too many PRs',
      body: `Dearest humans,

I've run into a problem here. I am trying to update the community docs and to get this repo up-to-scratch. I would usually create a new pull request to let you know about it, or update an existing one. But now there more than one: ${pullRequestNumbers.map(number => `#${number}`).join(', ')}

I don’t know how that happened, did I short-circuit again?

You could really help me by closing all pull requests or leave the one open you want me to keep updating.

Hope you can fix it (and my circuits) soon 🙏`
    })

    const {data: {html_url: issueUrl}} = result
    console.robolog(`🤖🙏 issue created: ${issueUrl}`)
    process.exit(1)
  }

  if (pullRequestsResult.total_count === 1) {
    const pullRequest = pullRequestsResult.items[0]
    console.robolog(`Existing pull-request found: ${pullRequest.html_url}`)

    const {data} = await github.get(`/repos/${github.repoName}/pulls/${pullRequest.number}`)
    github.branchName = data.head.ref // as branchName
  // TODO Enable existing pull request to be fixed and added to
  // await updateFixtures({diffs, github, github.repoName, branchName})
  // console.robolog(`pull-request updated: ${pullRequest.html_url}`)
  }

  console.robolog('No existing pull request found')

  console.robolog(`Looking for last commit sha of ${github.repoName}/git/refs/heads/master`)
  const {data: {object: {sha}}} = await github.get(`/repos/${github.repoName}/git/refs/heads/master`)

  github.branchName = `docs/boost-vitality/${new Date().toISOString().substr(0, 10)}`

  // Gets a 422 sometimes
  const branchExists = await github.get(`/repos/${github.repoName}/branches/${github.branchName}`)
    .catch(err => {
      if (err) {
        console.robolog(`Creating new branch: ${github.branchName} using last sha ${sha}`)
      } // do nothing
    })
  if (!branchExists) {
    await github.post(`/repos/${github.repoName}/git/refs`, {
      ref: `refs/heads/${github.branchName}`,
      sha
    }).catch(err => {
      if (err) {}
      console.robofire('Unable to create a new branch. Do you have access?')
      console.log('')
      process.exit(1)
    })
  } else {
    console.robolog(`Using existing branch: ${github.branchName} using last sha ${sha}`)
  }
}

// TODO Lint the README
// async function lintReadme () {
//   console.robolog(`README linting not yet enabled`)
// }

async function addJavascriptFiles () {
  // Is this a JS repo?
  const {data: language} = await github.get(`/repos/${github.repoName}`)
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
  packageFile.content = Buffer.from(JSON.stringify(newPkg, null, 2)).toString('base64')

  async function getCurrentSha (filename) {
    const {data: {sha: currentSha}} = await github.get(`/repos/${github.repoName}/contents/${filename}?ref=${github.branchName}`)
      .catch(err => {
        if (err) {}
        console.robofire('Unable to get current sha, most likely due to undefined branch.')
      })
    return currentSha
  }

  const commitMessage = {
    path: packageFile.filePath,
    message: `chore: updated fields in the package.json

${packageFile.note.map(note => `- [ ] ${note}`).join('\n')}
    `,
    content: packageFile.content,
    branch: github.branchName,
    sha: await getCurrentSha(packageFile.filePath)
  }

  await github.put(`/repos/${github.repoName}/contents/${packageFile.filePath}?ref=${github.branchName}`, commitMessage).catch(err => {
    if (err) {
      console.robowarn('Unable to add package.json file!', err)
    }
  })

  toCheck.push(packageFile)

  // If travis file exists
  const travisFile = {
    name: 'travis',
    filePath: '.travis.yml',
    note: ['Check if .travis.yml was overwritten or not.']
  }

  travisFile.content = await fs.readFileSync(path.join(__dirname, `fixtures/js/${travisFile.filePath}`)).toString('base64')
  const {status: travisStatus, data: travisContent} = await github.get(`/repos/${github.repoName}/contents/${travisFile.filePath}?ref=${github.branchName}`)
    .catch(err => {
      console.robolog('Unable to find travis file.')
      return err.response
    })
  if (travisStatus !== 404) {
    if (Buffer.from(travisContent.content, 'base64').toString('base64') !== travisFile.content) {
      await github.put(`/repos/${github.repoName}/contents/${travisFile.filePath}?ref=${github.branchName}`, {
        path: travisFile.filePath,
        message: 'ci: adding travis file with Greenkeeper and semantic-release enabled',
        content: travisFile.content,
        branch: github.branchName,
        sha: await getCurrentSha(travisFile.filePath)
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

async function checkCommunityFiles () {
  // what is the community vitality like?
  const {data: community} = await github.get(`/repos/${github.repoName}/community/profile`)
    .catch(err => {
      console.robofire('Unable to get community profile. Check your headers.')
      return err
    })

  const defaultChecks = [
    {
      name: 'readme',
      filePath: 'README.md',
      note: ['Update your README. It is only specced out, and will need more work. I suggest [standard-readme](https://github.com/RichardLitt/standard-readme) for this.']
    },
    {
      name: 'license',
      // TODO You don't need all caps for License, and it doesn't need to be a markdown file
      filePath: 'LICENSE',
      note: [`Check that the license name and year is correct. I've added the MIT license, which should suit most purposes.`]
    },
    // TODO Parse in the Contributing section from the README
    {
      name: 'contributing',
      filePath: 'CONTRIBUTING.md',
      note: ['Update the Contributing guide to include any repository-specific requests, or to point to a global Contributing document.']
    },
    {
      name: 'code_of_conduct',
      filePath: 'CODE_OF_CONDUCT.md',
      note: []
    }
  ]

  let toCheck = []

  async function existsInBranch (file) {
    if (!community.files[file.name]) {
      // Check if file exists already in the branch
      const {status} = await github.get(`/repos/${github.repoName}/contents/${file.filePath}?ref=${github.branchName}`)
      .catch(err => err)
      if (status !== 200) {
        let fileContent

        if (file.name === 'readme') {
          fileContent = Buffer.from(`# ${github.repoName.split('/')[1]}

TODO This needs to be filled out!`)

          console.robowarn('You need to fill out the README manually!')

          file.content = fileContent.toString('base64')
        } else {
          fileContent = await fs.readFileSync(path.join(__dirname, `fixtures/${file.filePath}`))
            .toString('utf8')

          if (file.name === 'code_of_conduct') {
            fileContent = fileContent.replace('[INSERT EMAIL ADDRESS]', github.user.email)
            file.note.push(`Check the email in the Code of Conduct. We've added in ${github.user.email}.`)
          }

          file.content = btoa(fileContent)
        }

        toCheck.push(file)
      }
    }
  }

  await Promise.all(defaultChecks.map(async file => existsInBranch(file)))

  return toCheck
}

// This function bunches up multiple file changes into the same commit.
// It depends on a files object: { name, filepath, content, note }.
async function bunchFiles (filesToCheck) {
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

  async function getFileBlob (file) {
    console.robolog(`Adding ${file.name} file`)

    // Create a blob
    const {data: blob} = await github.post(`/repos/${github.repoName}/git/blobs`, {
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

  // change the content somehow and post a new blob object with that new content, getting a blob SHA back
  const newBlobs = await Promise.all(filesToCheck.map(async file => getFileBlob(file)))

  if (newBlobs.length !== 0) {
    const newTree = tree.concat(newBlobs)

    // post a new tree object with that file path pointer replaced with your new blob SHA getting a tree SHA back
    const {data: {sha: newTreeSha}} = await github.post(`/repos/${github.repoName}/git/trees`, {
      tree: newTree,
      base_tree: treeSha
    })

    // create a new commit object with the current commit SHA as the parent and the new tree SHA, getting a commit SHA back
    const {data: {sha: newCommitSha}} = await github.post(`/repos/${github.repoName}/git/commits`, {
      message: `docs: adding community docs`,
      tree: newTreeSha,
      parents: [currentCommitSha]
    })

    // update the reference of your branch to point to the new commit SHA
    await github.post(`/repos/${github.repoName}/git/refs/heads/${github.branchName}`, {
      sha: newCommitSha
    }).catch(err => {
      if (err) {
        console.log('Unable to update refs with new commit')
      }
    })
  }
  return filesToCheck
}

async function createPullRequest (files) {
  if (github.branchName === 'master') {
    console.robolog(`No changes (you've run this already), or there is some other issue.`)
    console.log()
    return
  }

  const body = `Dearest humans,

You are missing some important community files. I am adding them here for you!

Here are some things you should do manually before merging this Pull Request:

${files.map(file => file.note.map(note => `- [ ] ${note}`).join('\n')).join('\n')}
`
  console.robolog(`Creating pull request`)

  const {data} = await github.post(`/repos/${github.repoName}/pulls`, {
    title: `Add community documentation`,
    head: github.branchName,
    base: 'master',
    body: body
  })
  console.robolog(`Pull request created: ${data.html_url}`)
}
