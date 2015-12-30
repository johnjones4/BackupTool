"use strict";

var DummyBackuper = require('./dummyBackuper');
var AWS = require('aws-sdk');
var async = require('async');
var treehash = require('treehash');

const partSize = 1048576;

class GlacierBackuper extends DummyBackuper {
  constructor(config,database,logger,fileQueue) {
    super(config,database,logger,fileQueue);
    AWS.config.update(config.aws);
    this.glacier = new AWS.Glacier();
  }

  sendFile(file,callback) {
    if (file.stats.size <= partSize) {
      this.sendFileNormal(file,callback);
    } else {
      this.sendFileMultipart(file,callback);
    }
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
          'checksum': treehash.getTreeHashFromBuffer(data)
        };
        _this.glacier.uploadArchive(params,function(err,data) {
          callback(err);
        })
      }
    });
  }

  sendFileMultipart(file,callbackOuter) {
    var _this = this;
    _this.logger.info('Will use multipart upload.');
    var treehashSum = treehash.createTreeHashStream ();
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
            _this.logger.info('Upload ID: ' + data.uploadId);
            callback(null,data.uploadId);
          }
        })
      },
      function(uploadId,callback) {
        var stream = _this.fileQueue.createReadStream(file.path,{
          'highWaterMark': partSize
        });
        var nParts = 0;
        stream.on('data', function(chunk) {
          nParts++;
          var thisPartSize = chunk.length < partSize ? chunk.length : partSize;
          var range = 'bytes ' + seg + '-' + ((seg + thisPartSize) - 1) + '/*';
          _this.logger.info('Uploading ' + range);
          var params = {
            'accountId': '-',
            'vaultName': _this.config.glacierVaultName,
            'uploadId': uploadId,
            'body': chunk,
            'checksum': treehash.getTreeHashFromBuffer(chunk),
            'range': range
          };
          _this.glacier.uploadMultipartPart(params,function(err,data) {
            if (err) {
              stream.pause();
              callback(err);
            }
            nParts--;
            if (nParts == 0) {
              callback(err,uploadId);
            }
          });
          treehashSum.update(chunk);
          seg += thisPartSize;
        });
      },
      function(uploadId,callback) {
        _this.logger.info('Completing multipart upload');
        var params = {
          'accountId': '-',
          'vaultName': _this.config.glacierVaultName,
          'uploadId': uploadId,
          'archiveSize': seg+'',
          'checksum': treehashSum.digest()
        };
        _this.glacier.completeMultipartUpload(params,function(err,data) {
          callback(err);
        });
      }
    ],callbackOuter);
  }
}

module.exports = GlacierBackuper;
