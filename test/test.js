const test = require('ava').test
const fs = require('fs')
const path = require('path')
const vfile = require('vfile')
const unified = require('unified')
const parse = require('remark-parse')
const getSection = require('../src/utilities/get-section')
const findSection = require('../src/utilities/find-section')

test('utilities/find-section', t => {
  const buf = fs.readFileSync(path.join(__dirname, 'fixtures', 'readme-with-contributing.md'))

  t.is(
    getSection(buf, 'missing'),
    undefined,
    'should return `undefined` if a section is missing'
  )

  t.is(
    getSection(buf, 'contribute'),
    [
      '## Contribute',
      '',
      'Some longer description.'
    ].join('\n'),
    'should find a section in a buffer'
  )

  t.is(
    getSection(buf, 'license'),
    [
      '## License',
      '',
      'MIT © Richard McRichface'
    ].join('\n'),
    'should find other sections'
  )

  t.is(
    getSection(String(buf), 'contribute'),
    [
      '## Contribute',
      '',
      'Some longer description.'
    ].join('\n'),
    'should find a section in a string'
  )
})

test('utilities/find-section', t => {
  const filePath = path.join(__dirname, 'fixtures', 'readme-with-contributing.md')
  const buf = fs.readFileSync(filePath)
  const file = vfile({path: filePath, contents: buf})
  const tree = unified().use(parse).parse(file)

  t.plan(3)

  findSection('missing', function (section) {
    t.is(
      section,
      undefined,
      'should invoke with `undefined` if a section is missing'
    )
  })()(tree, file)

  findSection('contribute', function (section) {
    t.is(
      section,
      'Some longer description.',
      'should find a section'
    )
  })()(tree, file)

  findSection('contribute', {includeHeading: true}, function (section) {
    t.is(
      section,
      [
        '## Contribute',
        '',
        'Some longer description.'
      ].join('\n'),
      'should include the heading if given `includeHeading: true`'
    )
  })()(tree, file)
})
