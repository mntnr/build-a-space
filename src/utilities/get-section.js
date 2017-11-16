const vfile = require('vfile')
const unified = require('unified')
const parse = require('remark-parse')
const find = require('./find-section')

module.exports = getSection

function getSection (buf, title) {
  const file = vfile(buf)
  let section

  // Use the section from the readme, if there is one.
  const processor = unified()
    .use(parse)
    .use(find(title, {includeHeading: true}, found))

  // Parse and process the readme
  processor.runSync(processor.parse(file), file)

  return section

  function found (doc) {
    section = doc
  }
}
