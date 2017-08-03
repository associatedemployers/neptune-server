const { basename } = require('path'),
      cwd          = __dirname,
      mongoose     = require('mongoose'),
      attachments  = require('../_util/schema-attachments');

const { Schema, ObjectId: Relationship } = mongoose;

let schema = new Schema({
  created: {
    type: Date,
    default: Date.now,
    index: true
  }
});

module.exports = require('mongoose-create-model')(
  basename(cwd),
  attachments(schema, cwd)
);
