module.exports = buildASpace

const querystring = require('querystring')
const fs = require('mz/fs')
const path = require('path')
const axios = require('axios')
const btoa = require('btoa')
const env = require('./env')
const console = require('./lib/robo')
const github = axios.create({
  baseURL: env.BASE_URL,
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
const githubHelpers = require('./lib/githubHelpers.js')
const lintPackageJson = require('./lib/lintPackageJson.js')

// TODO Check that repoName is valid
// TODO Export properly

async function buildASpace (repoName, opts) {
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
  github.user = user

  if (opts.fork) {
    github.targetRepo = await githubHelpers.getOrCreateFork(github, opts)
  } else {
    github.targetRepo = github.repoName
  }

  await initPRandBranch(opts)

  const communityFiles = await checkCommunityFiles()

  const files = await githubHelpers.bunchFiles(github, communityFiles)
  const jsFiles = await addJavascriptFiles()

  await createPullRequest(files.concat(jsFiles), opts)
}

async function initPRandBranch (opts) {
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
    if (!opts.test) {
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
    } else {
      console.robolog(`🤖🙏 issue not created, because test.`)
    }
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
  } else {
    console.robolog('No existing pull request found')
    github.branchName = `docs/boost-vitality/${new Date().toISOString().substr(0, 10)}`
  }

  console.robolog(`Looking for last commit sha of ${github.repoName}/git/refs/heads/master`)
  const {data: {object: {sha}}} = await github.get(`/repos/${github.repoName}/git/refs/heads/master`)

  await githubHelpers.getOrCreateBranch(github, sha)
}

async function addJavascriptFiles () {
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
  packageFile.content = Buffer.from(JSON.stringify(newPkg, null, 2)).toString('base64')

  const commitMessage = {
    path: packageFile.filePath,
    message: `chore: updated fields in the package.json

${packageFile.note.map(note => `- [ ] ${note}`).join('\n')}
    `,
    content: packageFile.content,
    branch: github.branchName,
    sha: await githubHelpers.getCurrentSha(github, packageFile.filePath)
  }

  await github.put(`/repos/${github.targetRepo}/contents/${packageFile.filePath}?ref=${github.branchName}`, commitMessage).catch(err => {
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
      await github.put(`/repos/${github.targetRepo}/contents/${travisFile.filePath}?ref=${github.branchName}`, {
        path: travisFile.filePath,
        message: 'ci: adding travis file with Greenkeeper and semantic-release enabled',
        content: travisFile.content,
        branch: github.branchName,
        sha: await githubHelpers.getCurrentSha(github, travisFile.filePath)
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
    if (community && !community.files[file.name]) {
      // Check if file exists already in the branch
      const {status} = await github.get(`/repos/${github.targetRepo}/contents/${file.filePath}?ref=${github.branchName}`)
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

async function createPullRequest (files, opts) {
  if (github.branchName === 'master') {
    console.robolog(`No changes (you've run this already), or there is some other issue.`)
    console.log()
    return
  }

  function joinNotes (arr) {
    return arr.map(file => {
      if (file) {
        return file.note.map(note => `- [ ] ${note}`).join('\n')
      }
    }).join('\n')
  }

  const body = `Dearest humans,

You are missing some important community files. I am adding them here for you!

Here are some things you should do manually before merging this Pull Request:

${joinNotes(files)}
`
  console.robolog(`Creating pull request`)

  if (!opts.test) {
    const res = await github.post(`/repos/${github.repoName}/pulls`, {
      title: `Add community documentation`,
      // Where changes are implemented. Format: `username:branch`.
      head: `${github.targetRepo.split('/')[0]}:${github.branchName}`,
      // TODO Use default_branch across tool, not just `master` branch
      base: 'master',
      body: body
    }).catch(async err => {
      const {data: {commit: {sha: oldBranch}}} = await github.get(`/repos/${github.repoName}/branches/master`)
      const {data: {commit: {sha: newBranch}}} = await github.get(`/repos/${github.targetRepo}/branches/${github.branchName}`)
      if (oldBranch === newBranch) {
        console.robofire(`Unable to create PR because there is no content.`)
      } else {
        console.robofire(`Unable to create PR inexplicably.`, err)
      }
    })
    if (res) {
      console.robolog(`Pull request created: ${res.data.html_url}`)
    }
  } else {
    console.robolog(`Pull request not created, because tests.`)
  }
}
