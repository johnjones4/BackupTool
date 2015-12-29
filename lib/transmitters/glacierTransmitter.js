var AWS = require('aws-sdk');
var fs = require('fs');
var async = require('async');
var crypto = require('crypto');

const partSize = 1048576;

var GlacierTransmitter = function(config) {
  AWS.config.update(config.aws);
  this.config = config;
  this.glacier = new AWS.Glacier();
}

GlacierTransmitter.prototype.sendFile = function(file,callback) {
  if (file.stats.size < partSize) {
    this.sendFileNormal(file,callback);
  } else {
    this.sendFileMultipart(file,callback);
  }
}

GlacierTransmitter.prototype.sendFileNormal = function(file,callback) {
  var _this = this;
  fs.readFile(file.path,function(err,data) {
    if (err) {
      callback(err);
    } else if (data && data.length > 0) {
      var params = {
        'accountId': '-',
        'vaultName': _this.config.glacierVaultName,
        'archiveDescription': file.path,
        'body': data,
        'checksum': crypto.createHash('sha256').update(data).digest('hex')
      };
      _this.glacier.uploadArchive(params,function(err,data) {
        callback(err);
      })
    }
  })
}

GlacierTransmitter.prototype.sendFileMultipart = function(file,callbackOuter) {
  var _this = this;
  var sha256 = crypto.createHash('sha256');
  var seg = 0;
  async.waterfall([
    function(callback) {
      var params = {
        'accountId': '-',
        'vaultName': _this.config.glacierVaultName,
        'archiveDescription': file.path,
        'partSize': partSize+''
      };
      _this.glacier.initiateMultipartUpload(params,function(err,data) {
        if (err) {
          callback(err);
        } else {
          callback(null,data.uploadId);
        }
      })
    },
    function(uploadId,callback) {
      var stream = fs.createReadStream(file.path,{
        'highWaterMark': partSize
      });
      stream.on('data', function(chunk) {
        sha256.update(chunk);
        var lastPart = chunk.length < partSize ? (seg + chunk.length) : '*'
        var params = {
          'accountId': '-',
          'vaultName': _this.config.glacierVaultName,
          'uploadId': uploadId,
          'body': chunk,
          'range': 'bytes ' + seg + '-' + (seg + chunk.length) + '/' + lastPart
        };
        _this.glacier.uploadMultipartPart(params,function(err,data) {
          if (err) {
            stream.pause();
            callback(err);
          }
        })
        seg += chunk.length < partSize ? chunk.length : partSize;
      });
      stream.on('end', function() {
        callback(null,uploadId);
      });
    },
    function(uploadId,callback) {
      var params = {
        'accountId': '-',
        'vaultName': _this.config.glacierVaultName,
        'uploadId': uploadId,
        'archiveSize': seg,
        'checksum': sha256.digest('hex')
      };
      _this.glacier.completeMultipartUpload(params,function(err,data) {
        callback(err);
        console.log(data);
      })
    }
  ],callbackOuter);
}

module.exports = GlacierTransmitter;
