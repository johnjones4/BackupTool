"use strict";

var DummyBackuper = require('./dummyBackuper');
var AWS = require('aws-sdk');
var fs = require('fs');

class S3Backuper extends DummyBackuper {
  constructor(config,database,logger,fileQueue) {
    super(config,database,logger,fileQueue);
    AWS.config.update(config.aws);
    this.s3 = new AWS.S3();
  }

  sendFile(file,callback) {
    var params = {
      'Bucket': this.config.s3BucketName,
      'Key': file.path.replace(/[^\x00-\x7F]/g, ''),
      'Body': this.fileQueue.createReadStream(file.path),
      'ACL': 'private'
    };
    this.s3.upload(params, function(err,data) {
      callback(err);
    });
  }
}

module.exports = S3Backuper;
