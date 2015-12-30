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
}

module.exports = GlacierBackuper;
