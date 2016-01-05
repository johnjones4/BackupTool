"use strict";

var DummyBackuper = require('./dummyBackuper');
var AWS = require('aws-sdk');
var crypto = require('crypto');
var fs = require('fs');

class S3Backuper extends DummyBackuper {
  constructor(config,database,logger,fileQueue) {
    super(config,database,logger,fileQueue);
    AWS.config.update(config.aws);
    this.s3 = new AWS.S3();
  }

  sendFile(file,callback) {
    var self = this;
    var params = {
      'Bucket': this.config.s3BucketName,
      'Key': file.path,
      'Body': this.fileQueue.createReadStream(file.path),
      'ACL': 'private'
    };

    // Get binary hash of file to send as ContentMD5 header
    this.awsHash(file.path, function(err, hash) {
      if (err) {
          callback(err);
          return;
      }
      params.ContentMD5 = hash;
      self.s3.upload(params, function(err,data) {
          callback(err);
      });
    });
  }

  /**
   * Streams a file to md5 digest and DOES NOT convert to hex digest.
   * AWS requires that the digest be converted to base64 instead of hexadecimal
   * This is used to send the ContentMD5 header, allowing S3 to verify that the file
   * has been uploaded without being corrupted.
   */
  awsHash(file, callback) {
    var sum = crypto.createHash('md5');
    var fileStream = fs.createReadStream(file);
    fileStream.on('error', function(err) {
      return callback(err, null);
    });

    fileStream.on('data', function(chunk) {
      try {
        sum.update(chunk);
      } catch (ex) {
        return callback(ex, null);
      }
    });

    fileStream.on('end', function() {
      var digest = sum.digest();
      return callback(null, new Buffer(digest).toString('base64'));
    });
  }
}

module.exports = S3Backuper;
