module.exports = buildASpace

const querystring = require('querystring')
const fs = require('mz/fs')
const path = require('path')
const axios = require('axios')
const env = require('./env')
const console = require('./lib/robo')

// TODO Check that repoName is valid
// TODO Export properly

async function buildASpace (repoName, diffs) {
  console.log('')
  console.robolog(`Let's get some documentation up in here. Creating pull request ...`)

  // https://docs.travis-ci.com/user/environment-variables/
  repoName = repoName || env.TRAVIS_REPO_SLUG
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

  // who am I?
  const {data: {login}} = await github.get('/user')
  console.robolog(`Signed in as ${login}. Looking if I already created a pull request.`)

  const { branchName } = await initPRandBranch(github, login, repoName)

  const communityFiles = await checkCommunityFiles(github, repoName, branchName)

  const files = await bunchFiles(github, repoName, branchName, communityFiles)
  const jsFiles = await addJavascriptFiles(github, repoName, branchName)

  await createPullRequest(github, repoName, branchName, files.concat(jsFiles))
}

async function initPRandBranch (github, login, repoName) {
  // Do I have a pending pull request?
  const query = querystring.stringify({
    type: 'pr',
    author: login,
    is: 'open',
    repo: repoName
  }, ' ', ':')

  const {data: pullRequestsResult} = await github.get(`/search/issues?q=${query}`)
  const pullRequestNumbers = pullRequestsResult.items.map(pr => pr.number)

  // if there are more than a single pull request, then we have a problem, because
  // I don’t know which one to update. So I’ll ask you for help :)
  if (pullRequestsResult.total_count > 1) {
    console.robolog('🤖🆘 Oh oh, I don’t know how to handle more than one pull requests. Creating an issue for my human friends')
    const result = await github.post(`/repos/${repoName}/issues`, {
      title: '🤖🆘 Too many PRs',
      body: `Dearest humans,

I've run into a problem here. I am trying to update the community docs and to get this repo up-to-scratch. I would usually create a new pull request to let you know about it, or update an existing one. But now there more than one: ${pullRequestNumbers.map(number => `#${number}`).join(', ')}

I don’t know how that happened, did I short-circuit again?

You could really help me by closing all pull requests or leave the one open you want me to keep updating.

Hope you can fix it (and my circuits) soon 🙏`
    })

    const {data: {html_url: issueUrl}} = result
    console.robolog(`🤖🙏 issue created: ${issueUrl}`)
    return
  }

  if (pullRequestsResult.total_count === 1) {
    const pullRequest = pullRequestsResult.items[0]
    console.robolog(`Existing pull-request found: ${pullRequest.html_url}`)

    const {data} = await github.get(`/repos/${repoName}/pulls/${pullRequest.number}`)
    const branchName = data.head.ref
  // TODO Enable existing pull request to be fixed and added to
  // await updateFixtures({diffs, github, repoName, branchName})
  // console.robolog(`pull-request updated: ${pullRequest.html_url}`)
    return {branchName}
  }

  console.robolog('No existing pull request found')

  console.robolog(`Looking for last commit sha of ${repoName}/git/refs/heads/master`)
  const {data: {object: {sha}}} = await github.get(`/repos/${repoName}/git/refs/heads/master`)

  const branchName = `docs/boost-vitality/${new Date().toISOString().substr(0, 10)}`

  // Gets a 422 sometimes
  const branchExists = await github.get(`/repos/${repoName}/branches/${branchName}`)
    .catch(err => {
      if (err) {
        console.robolog(`Creating new branch: ${branchName} using last sha ${sha}`)
      } // do nothing
    })
  if (!branchExists) {
    await github.post(`/repos/${repoName}/git/refs`, {
      ref: `refs/heads/${branchName}`,
      sha
    }).catch(err => {
      console.robofire('Unable to create a new branch. Do you have access?')
      return err
    })
  } else {
    console.robolog(`Using existing branch: ${branchName} using last sha ${sha}`)
  }

  return {branchName}
}

// TODO Lint the README
// async function lintReadme (github, repoName, branchName) {
//   console.robolog(`README linting not yet enabled`)
// }

async function addJavascriptFiles (github, repoName, branchName) {
  // Is this a JS repo?
  const {data: language} = await github.get(`/repos/${repoName}`)
  if (!language === 'JavaScript') return

  console.robolog('Assuming this is a JavaScript repository, checking...')

  let toCheck = []

  // package.json checks
  const {status, data: npm} = await github.get(`/repos/${repoName}/contents/package.json`).catch(err => err)
  if (status === 404) {
    console.robowarn('There is no package.json. Is this not checked into npm?')
    return
  }
  console.robolog('npm file exists! No checks yet implemented, however.')
  const fileContent = JSON.parse(Buffer.from(npm.content, 'base64'))
  if (!fileContent.scripts.test || fileContent.scripts.test.indexOf('no test specified') === -1) {
    // TODO Open an issue suggesting that they add tests
    // const query = querystring.stringify({
    //   type: 'issue',
    //   is: 'open',
    //   repo: repoName
    // }, 'tests', ':')

    // const testIssueResult = await github.get(`/search/issues?q=${query}`).catch(err => err)
    // console.log('Here', testIssueResult)

    // const result = await github.post(`/repos/${repoName}/issues`, {
    //   title: 'Add tests',
    //   body: `No tests are specified in the npm manifest. Do you have tests for this repo yet?`
    // })
    //
    // const {data: {html_url: issueUrl}} = result
    // console.log(`🤖🙏 issue opened as a reminder to add tests: ${issueUrl}`)
  }
  // TODO Check if the travis file is exactly the same, anyway
  // If travis file exists
  const travisFile = {
    name: 'travis',
    filePath: '.travis.yml',
    note: 'Check if .travis.yml was overwritten or not.'
  }

  travisFile.content = await fs.readFileSync(path.join(__dirname, `fixtures/js/${travisFile.filePath}`)).toString('base64')
  await github.put(`/repos/${repoName}/contents/${travisFile.filePath}?ref=${branchName}`, {
    path: travisFile.filePath,
    message: 'ci: adding travis file with Greenkeeper and semantic-release enabled',
    content: travisFile.content,
    branch: branchName
  }).catch(err => {
    if (err) {
      console.robowarn('Unable to add travis file!')
    }
  })
  // TODO Open issue to enable greenkeeper

  toCheck.push(travisFile)

  // TODO Check that the package description matches GitHub description
  // TODO Check that the keywords match GitHub topics
  // TODO Check that the homepapge exists
  // TODO Check that `bugs` matches GitHub URL
  // TODO Check that the license matches
  // TODO Check that the repository matches


  return toCheck
}

async function checkCommunityFiles (github, repoName, branchName) {
  // what is the community vitality like?
  const {data: community} = await github.get(`/repos/${repoName}/community/profile`)
    .catch(err => {
      console.robofire('Unable to get community profile. Check your headers.')
      return err
    })

  const defaultChecks = [
    {
      name: 'readme',
      filePath: 'README.md',
      note: 'Update your README. It is only specced out, and will need more work. I suggest [standard-readme](https://github.com/RichardLitt/standard-readme) for this.'
    },
    {
      name: 'license',
      // TODO You don't need all caps for License, and it doesn't need to be a markdown file
      filePath: 'LICENSE',
      note: `Check that the license name and year is correct. I've added the MIT license, which should suit most purposes.`
    },
    // TODO Parse in the Contributing section from the README
    {
      name: 'contributing',
      filePath: 'CONTRIBUTING.md',
      note: 'Update the Contributing guide to include any repository-specific requests, or to point to a global Contributing document.'
    },
    {
      name: 'code_of_conduct',
      filePath: 'CODE_OF_CONDUCT.md',
      note: 'Update the email address in the Code of Conduct: the default is currently richard.littauer@gmail.com.'
    }
  ]

  let toCheck = []

  async function existsInBranch (file) {
    if (!community.files[file.name]) {
      // Check if file exists already in the branch
      const {status} = await github.get(`/repos/${repoName}/contents/${file.filePath}?ref=${branchName}`)
      .catch(err => err)
      if (status !== 200) {
        let fileContent

        if (file.name === 'readme') {
          fileContent = Buffer.from(`# ${repoName.split('/')[1]}

TODO This needs to be filled out!`).toString('base64')
          console.robowarn('You need to fill out the README manually!')
        } else {
          fileContent = await fs.readFileSync(path.join(__dirname, `fixtures/${file.filePath}`)).toString('base64')
        }

        file.content = fileContent
        toCheck.push(file)
      }
    }
  }

  await Promise.all(defaultChecks.map(async file => existsInBranch(file)))

  return toCheck
}

// This function bunches up multiple file changes into the same commit.
// It depends on a files object: { name, filepath, content, note }.
async function bunchFiles (github, repoName, branchName, filesToCheck) {
  // Always work off of master, for now. TODO Enable other dev branches
  // get the current commit object and current tree
  const {
    data: {commit: {sha: currentCommitSha}},
    data: {commit: {commit: {tree: {sha: treeSha}}}}
  } = await github.get(`/repos/${repoName}/branches/master`)

  // retrieve the content of the blob object that tree has for that particular file path
  const {data: {tree}} = await github.get(`/repos/${repoName}/git/trees/${treeSha}`)

  async function getFileBlob (file) {
    console.robolog(`Adding ${file.name} file`)

    // Create a blob
    const {data: blob} = await github.post(`/repos/${repoName}/git/blobs`, {
      content: file.content,
      encoding: 'base64'
    }).catch(err => {
      if (err) {}
      console.robofire(`I can't post to a foreign repo! Do you have access?`)
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
    const {data: {sha: newTreeSha}} = await github.post(`/repos/${repoName}/git/trees`, {
      tree: newTree,
      base_tree: treeSha
    })

    // create a new commit object with the current commit SHA as the parent and the new tree SHA, getting a commit SHA back
    const {data: {sha: newCommitSha}} = await github.post(`/repos/${repoName}/git/commits`, {
      message: `docs: adding community docs`,
      tree: newTreeSha,
      parents: [currentCommitSha]
    })

    // update the reference of your branch to point to the new commit SHA
    await github.post(`/repos/${repoName}/git/refs/heads/${branchName}`, {
      sha: newCommitSha
    }).catch(err => {
      if (err) {
        console.log('Unable to update refs with new commit')
      }
    })
  }
  return filesToCheck
}

async function createPullRequest (github, repoName, branchName, files) {
  if (branchName === 'master') {
    console.robolog(`No changes (you've run this already), or there is some other issue.`)
    console.log()
    return
  }

  const body = `Dearest humans,

You are missing some important community files. I am adding them here for you!

Here are some things you should do manually before merging this Pull Request:

${files.map(file => `- [ ] ${file.note}`).join('\n')}
`
  console.robolog(`Creating pull request`)
  const {data} = await github.post(`/repos/${repoName}/pulls`, {
    title: `Add community documentation`,
    head: branchName,
    base: 'master',
    body: body
  })
  console.robolog(`Pull request created: ${data.html_url}`)
  console.log('')
}
