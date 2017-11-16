const position = require('unist-util-position')
const range = require('mdast-util-heading-range')

module.exports = find

function find (heading, opts, callback) {
  if (callback === undefined) {
    callback = opts
    opts = undefined
  }

  return attacher

  function attacher () {
    return transformer
  }

  function transformer (tree, file) {
    var found = false

    /* Search for `heading`, call `onfind` if found. */
    range(tree, heading, onfind)

    /* Call `callback` if not found. */
    if (!found) {
      callback()
    }

    function onfind (start, nodes) {
      /* Include the heading if given `includeHeading`. */
      var heading = (opts || {}).includeHeading === true
      var begin = heading ? start : nodes[0]
      var initial = position.start(begin).offset
      var final = position.end(nodes[nodes.length - 1]).offset

      /* If there’s content, call `callback` with the doc. */
      if (initial !== undefined && final !== undefined) {
        found = true
        callback(file.toString('utf8').slice(initial, final))
      }
    }
  }
}
