// Module requires
var assert = require('assert');
var async = require('async');
var AWS = require('aws-sdk');
var FileQueue = require('filequeue');
var fs = require('fs');
var path = require('path');

// Classes
var Database = require('./../lib/database');
var S3Backuper = require('./../lib/backupers/s3Backuper');
var BackupAgent = require('./../lib/backupAgent');


// Local variables
var helpers = require('./helpers/index');
var rootDir = './testData';
var backupFilesDir = path.join(rootDir,'dummyData');


var config = {
  'backupDirs': [
    backupFilesDir
  ],
  'ignore': [
    'ignoreThisFile',
    '*.someExtension'
  ],
  'backupManifestFile': path.join(rootDir,'backupfiles.sqlite3'),
  'aws': {
    accessKeyId: '',
    secretAccessKey: ''
  }
};

describe('Backupers',function() {
  describe('s3Backuper',function() {
    var backuper;
    var database;
    var files;
    var touchedFiles = [];
    var s3;
    config.aws.accessKeyId = "dsdsfdsfdsfdfs";
    config.aws.secretAccessKey = "fsdfsfdfdssdffsd";
    config.aws.s3ForcePathStyle = true; // Required for mac testing on fakes3
    config.aws.endpoint = new AWS.Endpoint('http://localhost:4567');
    config.s3BucketName = "testBucket";
    AWS.config.update(config.aws);
    s3 = new AWS.S3(config.aws);
    before(function(done) {
      async.waterfall([
        function(callback) {
          helpers.generateFiles(5,function(err, madeFiles) {
            if (err) {
              callback(err);
            } else {
              files = madeFiles;
              callback();
            }
          });
        },
        function(callback) {
          database = {
            'touchFile': function(absPath,fsModifiedTime,size,callback) {
              callback(null,touchedFiles.indexOf(absPath) >= 0);
            }
          };
          touchedFiles = files
            .filter(function(item,i) {
              return i % 2 == 0;
            })
            .map(function(file) {
              return path.join(backupFilesDir,file)
            });
          callback();
        },
        function(callback) {
          var params = {
            Bucket: 'testBucket',
            ACL: 'private',
            CreateBucketConfiguration: {
              LocationConstraint: 'us-east-1'
            },
            GrantFullControl: "yes"
          };
          s3.createBucket(params, function(err, msg) {
            callback();
          });
        }
      ], done);

      backuper = new S3Backuper(config, database,helpers.logger, new FileQueue(100));
    });

    it('should be able to upload a file to S3 vis upload function', function(done) {
      this.timeout(6000);
      var obj = {
        'path': backupFilesDir + "/" + files[0]
      };

      obj.stat = fs.statSync(obj.path);
      backuper.sendFile(obj, function(err, data) {
        assert.equal(err, null);
        s3.headObject({
          Bucket: 'testBucket',
          Key: obj.path
        }, function (err, data) {
          assert.equal(data.ContentLength, obj.stat.size);
          done();
        });
      });
    });

    after(function(done) {
      helpers.removeFolder(rootDir, done);
    });
  });
});


