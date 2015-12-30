"use strict";

var DummyBackuper = require('./dummyBackuper');
var AWS = require('aws-sdk');
var async = require('async');
var crypto = require('crypto');

const partSize = 1048576;

class GlacierBackuper extends DummyBackuper {
  constructor(config,database,logger,fileQueue) {
    super(config,database,logger,fileQueue);
    AWS.config.update(config.aws);
    this.glacier = new AWS.Glacier();
  }

  sendFile(file,callback) {
    this.sendFileNormal(file,callback);
    // if (file.stats.size < partSize) {
    //   this.sendFileNormal(file,callback);
    // } else {
    //   this.sendFileMultipart(file,callback);
    // }
  }

  sendFileNormal(file,callback) {
    var _this = this;
    this.fileQueue.readFile(file.path,function(err,data) {
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
    });
  }

  sendFileMultipart(file,callbackOuter) {
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
        var stream = _this.fileQueue.createReadStream(file.path,{
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
          'archiveSize': seg+'',
          'checksum': sha256.digest('hex')
        };
        _this.glacier.completeMultipartUpload(params,function(err,data) {
          callback(err);
          console.log(data);
        })
      }
    ],callbackOuter);
  }
}

module.exports = GlacierBackuper;
