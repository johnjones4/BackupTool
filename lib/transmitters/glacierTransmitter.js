var AWS = require('aws-sdk');
var fs = require('fs');

var GlacierTransmitter = function(config) {
  AWS.config.update(config.aws);
  this.config = config;
  this.glacier = new AWS.Glacier();
}

GlacierTransmitter.prototype.sendFile = function(file,callback) {
  var _this = this;
  fs.readFile(file,function(err,data) {
    if (err) {
      callback(err);
    } else if (data) {
      console.log(data.length)
      var params = {
        'vaultName': _this.config.glacierVaultName,
        'archiveDescription': file,
        'body': data
      };
      _this.glacier.uploadArchive(params, function(err,data) {
        console.log(data);
        callback(err);
      });
    } else {
      callback('No file to read');
    }
  })
}

module.exports = GlacierTransmitter;
