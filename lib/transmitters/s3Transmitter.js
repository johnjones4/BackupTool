var AWS = require('aws-sdk');
var fs = require('fs');

var S3Transmitter = function(config) {
  AWS.config.update(config.aws);
  this.config = config;
  this.s3 = new AWS.S3();
}

S3Transmitter.prototype.sendFile = function(file,callback) {
  var params = {
    'Bucket': this.config.s3BucketName,
    'Key': file.path,
    'Body': fs.createReadStream(file.path),
    'ACL': 'private'
  };
  this.s3.upload(params, function(err,data) {
    callback(err);
  });
}

module.exports = S3Transmitter;
