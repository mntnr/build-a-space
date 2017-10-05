const test = require('ava').test
const lint = require('../lib/lintPackageJson.js')

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
  t.is(notes[0], 'We expected the repository url in the `package.json` to be https://github.com/test/test.git, and it wasn\'t. Is this intentional?')
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
