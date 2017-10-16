function joinNotes (arr) {
  return arr.map(file => {
    if (file) {
      return file.note.map(note => `- [ ] ${note}`).join('\n')
    }
  }).join('\n')
}

module.exports = {
  joinNotes
}
