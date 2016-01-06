"use strict";

var DummyBackuper = require('./dummyBackuper');
var AWS = require('aws-sdk');
var async = require('async');
var treehash = require('treehash');

const limitSize = 1048576;
const bigPartSize = 1048576 * 10;

class GlacierBackuper extends DummyBackuper {
  constructor(config,database,logger,fileQueue) {
    super(config,database,logger,fileQueue);
    AWS.config.update(config.aws);
    this.glacier = new AWS.Glacier();
  }

  sendFile(file,callback) {
    if (file.stats.size <= limitSize) {
      this.sendFileNormal(file,callback);
    } else if (file.stats.size <= bigPartSize) {
      this.sendFileMultipart(file,callback,limitSize);
    } else {
      this.sendFileMultipart(file,callback,bigPartSize);
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
          'archiveDescription': file.path.replace(/[^\x00-\x7F]/g, ''),
          'body': data,
          'checksum': treehash.getTreeHashFromBuffer(data)
        };
        _this.glacier.uploadArchive(params,function(err,data) {
          callback(err);
        })
      }
    });
  }

  sendFileMultipart(file,callbackOuter,partSize) {
    var _this = this;
    _this.logger.info('Will use multipart upload.');
    var treehashSum = treehash.createTreeHashStream ();
    var seg = 0;
    async.waterfall([
      function(callback) {
        var params = {
          'accountId': '-',
          'vaultName': _this.config.glacierVaultName,
          'archiveDescription': file.path.replace(/[^\x00-\x7F]/g, ''),
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
          stream.pause();
          var thisPartSize = chunk.length < partSize ? chunk.length : partSize;
          var range = 'bytes ' + seg + '-' + ((seg + thisPartSize) - 1) + '/*';
          _this.logger.info('Uploading ' + file.path + ' ' + range + ' (' + Math.round(seg/file.stats.size * 100) + '%)');
          var params = {
            'accountId': '-',
            'vaultName': _this.config.glacierVaultName,
            'uploadId': uploadId,
            'body': chunk,
            'checksum': treehash.getTreeHashFromBuffer(chunk),
            'range': range
          };
          treehashSum.update(chunk);
          seg += thisPartSize;
          _this.glacier.uploadMultipartPart(params,function(err,data) {
            if (err) {
              stream.pause();
              callback(err);
            }
            stream.resume();
            if (seg == file.stats.size) {
              callback(err,uploadId);
            }
          });
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
