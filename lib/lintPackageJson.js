const githubPreviewHeaders = [
  `application/vnd.github.mercy-preview+json`, // Topics https://developer.github.com/v3/repos/#replace-all-topics-for-a-repository
  `application/vnd.github.drax-preview+json` // Licenses https://developer.github.com/v3/licenses/
]

module.exports = async function lintPackageJson (github, pkg) {
  const notesForUser = []

  // Add in the headers we need for these calls
  githubPreviewHeaders.map(header => github.defaults.headers.common.accept.push(header))

  // Set the package description to match the GitHub description
  const {data: {description: ghDescription, topics, license}} = await github.get(`/repos/${github.repoName}`)
  if (ghDescription !== pkg.description) {
    if (ghDescription && !pkg.description) pkg.description = ghDescription
    if (!ghDescription && pkg.description) {
      const {data} = await github.patch(`/repos/${github.repoName}`, {
        description: pkg.description,
        name: github.repoName
      }).catch(err => {
        if (err) {}
        console.robowarn(`Unable to set GitHub description using \`package.json\` description.`)
        notesForUser.push(`Add a GitHub description. Your \`package.json\` description should work.`)
      })
      if (data.description === pkg.description) {
        console.robolog(`I set the GitHub description to match the \`package.json\` description.`)
      }
    }
    notesForUser.push(`Check the \`package.json\` description. It didn't match the GitHub description for the repository.`)
  }

  // Check that the keywords match GitHub topics
  // Note: This uses a GitHub preview header, and may break.
  const allKeywords = topics.concat(pkg.keywords)
  if (allKeywords !== topics) {
    pkg.keywords = allKeywords
    notesForUser.push(`Check the \`package.json\` keywords. We added some from your GitHub topics.`)
    const {data} = await github.put(`/repos/${github.repoName}/topics`, {
      names: allKeywords
    }).catch(err => {
      if (err) {
        return false
      }
      console.robowarn('Unable to set GitHub topics using `package.json` keywords.')
      notesForUser.push(`Add the \`package.json\` keywords as GitHub topics on your repository homepage.`)
    })
    if (data && data.topics === allKeywords) {
      console.robolog('I set the GitHub topics to include all `package.json` keywords.')
    }
  }

  // Check that the homepage exists
  if (!pkg.homepage) {
    pkg.homepage = `https://github.com/${github.repoName}`
    notesForUser.push(`Check that the homepage in the \`package.json\` is OK. Another one besides your GitHub repo might work.`)
  }
  // Check that `bugs` matches GitHub URL
  if (!pkg.bugs) {
    pkg.bugs = `https://github.com/${github.repoName}/issues`
  } else if (pkg.bugs !== `https://github.com/${github.repoName}/issues`) {
    notesForUser.push(`Check that the bugs field in the package.json is OK. It doesn't match what we'd expect, which would be https://github.com/${github.repoName}/issues`)
  }
  // Check that the license matches
  if (pkg.license !== license.spdx_id) {
    notesForUser.push(`Update the license in your \`package.json\`. It did not match what we found on GitHub, and we were unable to resolve this.`)
  }

  // Check that the repository matches
  // TODO Add unit tests
  // TODO Enable this, too: JSON.parse({'type': 'git', 'url': `https://github.com/${github.repoName}.git`}).toString()
  const expectedRepoUrl = github.repoName
  if (!pkg.repository) {
    pkg.repository = {
      'type': 'git',
      'url': `https://github.com/${github.repoName}.git`
    } // username/repo is also valid https://docs.npmjs.com/files/package.json#repository
  } else if (pkg.repository !== expectedRepoUrl) {
    notesForUser.push(`We expected the repository field in the \`package.json\` to be ${expectedRepoUrl}, and it wasn't. Is this intentional?`)
  }

  if (!pkg.contributors) {
    pkg.contributors = [pkg.author]
    notesForUser.push(`If there are more contributors, add them to the Contributors field in the \`package.json\`.`)
  }

  // Tests
  if (!pkg.scripts.test || pkg.scripts.test.indexOf('no test specified') !== -1) {
    notesForUser.push(`Add some tests! There aren't any currently set.`)
    // TODO Open an issue suggesting that they add tests
    // const query = querystring.stringify({
    //   type: 'issue',
    //   is: 'open',
    //   repo: github.repoName
    // }, 'tests', ':')

    // const testIssueResult = await github.get(`/search/issues?q=${query}`).catch(err => err)
    // console.log('Here', testIssueResult)

    // const result = await github.post(`/repos/${github.repoName}/issues`, {
    //   title: 'Add tests',
    //   body: `No tests are specified in the npm manifest. Do you have tests for this repo yet?`
    // })
    //
    // const {data: {html_url: issueUrl}} = result
    // console.log(`🤖🙏 issue opened as a reminder to add tests: ${issueUrl}`)
  }

  return {pkg, notesForUser}
}
