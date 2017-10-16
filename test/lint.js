const test = require('ava').test
const lint = require('../lib/lintPackageJson.js')
const axios = require('axios')
const console = require('../lib/robo')

// Silence all consoles. Brittle, but works.
if (process.env.npm_config_argv.indexOf('--verbose') === -1) {
  console.robolog = console.robofire = console.robowarn = () => {}
}

const github = axios.create({
  baseURL: 'https://api.example.com',
  headers: {
    common: {}
  }
})

// checkHomepage
test('homepage will update if it does not exist', async t => {
  const pkg = {}
  await lint.checkHomepage(pkg, 'test/test', [])
  t.is(pkg.homepage, 'https://github.com/test/test')
})

test('homepage will not update if it does exist', async t => {
  const pkg = {homepage: 'test.com'}
  await lint.checkHomepage(pkg, 'test/test', [])
  t.is(pkg.homepage, 'test.com')
})

test('homepage will not update if it does exist', async t => {
  const notes = []
  await lint.checkHomepage({}, 'test/test', notes)
  t.is(notes[0], 'Check that the homepage in the `package.json` is OK. Another one besides your GitHub repo might work.')
})

// checkRepository
test('homepage will update if it does not exist', async t => {
  const pkg = {}
  await lint.checkRepository(pkg, 'test/test', [])
  t.deepEqual(pkg.repository, {
    'type': 'git',
    'url': `https://github.com/test/test.git`
  })
})

test('homepage will not update if it does exist', async t => {
  const pkg = {repository: true}
  await lint.checkRepository(pkg, 'test/test', [])
  t.is(pkg.repository, true)
})

test('homepage will add a note it does exist and doesnt match', async t => {
  const pkg = {repository: true}
  const notes = []
  await lint.checkRepository(pkg, 'test/test', notes)
  t.is(notes[0], 'We expected the repository url in the `package.json` to be https://github.com/test/test, and it wasn\'t. Is this intentional?')
})

test('homepage will not add a note if does exist and is expected', async t => {
  const pkg = {
    'repository': {
      'type': 'git',
      'url': `https://github.com/test/test.git`
    }
  }
  const notes = []
  await lint.checkRepository(pkg, 'test/test', notes)
  t.deepEqual(notes, [])
})

// checkKeywords
// TODO Find ways of hitting actual API and testing these
// TODO Finish testing checkKeywords
test('checkKeywords will do nothing if there are no topics', async t => {
  const github = null
  const pkg = {keywords: []}
  const notesForUser = []
  const topics = []
  await lint.checkKeywords(github, pkg, topics, notesForUser)
  t.deepEqual(pkg.keywords, [])
  t.deepEqual(notesForUser, [])
})

test('checkKeywords will create a keywords field if it doesn\'t exist', async t => {
  const github = null
  const pkg = {}
  const notesForUser = []
  const topics = []
  await lint.checkKeywords(github, pkg, topics, notesForUser)
  t.deepEqual(pkg.keywords, [])
})

test('checkKeywords will return nothing if github is not working', async t => {
  github.repoName = 'test'
  const pkg = {keywords: ['fail']}
  const topics = ['test']
  const notesForUser = []
  const err = await lint.checkKeywords(github, pkg, topics, notesForUser)
  t.is(notesForUser.includes('Add these keywords (from your `package.json`) as GitHub topics to your repo: "test", "fail".'), true)
  t.is(err, undefined)
})
