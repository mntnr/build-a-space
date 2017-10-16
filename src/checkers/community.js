const btoa = require('btoa')
const fs = require('mz/fs')
const path = require('path')
const {bunchFiles} = require('../../lib/githubHelpers.js')

module.exports = async function wrap (github, opts) {
  const files = await community(github)
  return bunchFiles(github, files, {
    test: opts.test,
    message: `docs: adding community docs`
  })
}

async function existsInBranch (github, file, toCheck) {
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
      fileContent = await fs.readFileSync(path.join(__dirname, `../../fixtures/${file.filePath}`))
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

async function community (github) {
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

  await Promise.all(defaultChecks.map(async file => {
    if (community && !community.files[file.name]) {
      existsInBranch(github, file, toCheck)
    }
  }))

  return toCheck
}
