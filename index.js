module.exports = buildASpace

const querystring = require('querystring')
const fs = require('mz/fs')
const path = require('path')
const axios = require('axios')
const env = require('./env')

// TODO Check that repoName is valid
// TODO Export properly

console.robolog = function (message) {
  return console.log('🤖  ' + message)
}

console.robowarn = function (message) {
  return console.log('🔥  ' + message)
}

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

  await addCommunityFiles(github, repoName, branchName)
  await addJavascriptFiles(github, repoName, branchName)

  if (branchName === 'master') {
    console.robolog(`No changes (you've run this already), or there is some other issue.`)
    console.log()
    return
  }

  console.robolog(`Creating pull request`)
  const {data} = await github.post(`/repos/${repoName}/pulls`, {
    title: `Add community documentation`,
    head: branchName,
    base: 'master',
    body: `Dearest humans,

You are missing some important community files. I am adding them here for you!`
  })
  console.robolog(`Pull request created: ${data.html_url}`)
  console.log('')
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
    console.log(branchName)
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
      console.robowarn('Unable to create a new branch')
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

  // package.json checks
  const {status, data: npm} = await github.get(`/repos/${repoName}/contents/package.json`).catch(err => err)
  if (status === 404) {
    console.robolog('There is no package.json. Is this not checked into npm?')
    return
  }
  console.robolog('npm file exists! No checks yet implemented, however.')
  // const fileContent = JSON.parse(Buffer.from(npm.content, 'base64'))
  // if (!fileContent.scripts.test || fileContent.scripts.test === "echo \"Error: no test specified\" && exit 1") {
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
  // }

  // TODO Check that the package description matches GitHub description
  // TODO Check that the keywords match GitHub topics
  // TODO Check that the homepapge exists
  // TODO Check that `bugs` matches GitHub URL
  // TODO Check that the license matches
  // TODO Check that the repository matches

  // TODO Add travis file for semantic-release and greenkeeper
  // TODO Add in semantic-release
  // TODO Open issue to enable greenkeeper
}

async function addCommunityFiles (github, repoName, branchName) {
  // what is the community vitality like?
  const {data: community} = await github.get(`/repos/${repoName}/community/profile`)

  // TODO Automatically get CovGen from GitHub
  // const covgen = await github.get(`/codes_of_conduct/contributor_covenant`)
  // console.robolog(covgen)

  async function addFile (filename, fileEnding) {
    // Check that the file hasn't already been added in the branch
    const {status} = await github.get(`/repos/${repoName}/contents/${filename}${fileEnding}?ref=${branchName}`).catch((err) => err)
    if (status === 200) return

    const fileContent = await fs.readFileSync(path.join(__dirname, `fixtures/${filename}${fileEnding}`)).toString('base64')

    console.robolog(`Updating fixture file for ${filename}`)
    await github.put(`/repos/${repoName}/contents/${filename}${fileEnding}`, {
      content: fileContent,
      branch: branchName,
      message: `docs: adding ${filename}`
    })
  }

  // TODO Parse in the Contributing section from the README
  // TODO Don't just fail on issue
  // TODO Add all of the community docs in one go
  // if (!community.files.readme) await addFile('README', '.md')
  if (!community.files.code_of_conduct) await addFile('CODE_OF_CONDUCT', '.md')
  if (!community.files.contributing) await addFile('CONTRIBUTING', '.md')
  // TODO You don't need all caps for License, and it doesn't need to be a markdown file
  if (!community.files.license) await addFile('LICENSE')
}
