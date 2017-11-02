const test = require('ava').test
const fs = require('fs')
const path = require('path')

// TODO Make a more useful test. This literally just tests .replace on fs.
test('replaces email in code of conduct', async t => {
  const replacedFile = await fs.readFileSync(path.join(__dirname, `../fixtures/CODE_OF_CONDUCT.md`))
    .toString('utf8')
    .replace('[INSERT EMAIL ADDRESS]', 'test@example.com')

  const expectedFile = await fs.readFileSync(path.join(__dirname, `fixtures/CODE_OF_CONDUCT.md`))
      .toString('utf8')

  t.is(replacedFile, expectedFile)
})
