var async = require('async');
var fs = require('fs');
var path = require('path');
var randomstring = require('randomstring');
var mkdirp = require('mkdirp');

var rootDir = './testData';
var backupFilesDir = path.join(rootDir,'dummyData');
module.exports = {
  logger: {
    'error': function() {},
    'log': function() {},
    'info': function() {}
  },
  generateFiles: function(topTotal,done) {
    var files = [];
    var directories = [];

    var makeFiles = function(dir,n) {
      if (n > 0) {
        for(var i=0; i<n; i++) {
          files.push(path.join(dir,randomstring.generate()));
          var newDirName = path.join(dir,randomstring.generate());
          directories.push(newDirName);
          makeFiles(newDirName,n-1);
        }
      }
    }
    makeFiles('',topTotal);

    async.waterfall([
      function(callback) {
        mkdirp(backupFilesDir, function() {
          callback();
        });
      },
      function(callback) {
        async.waterfall(
          directories.map(function(dir) {
            return function(innerCallback) {
              fs.mkdir(path.join(backupFilesDir,dir),function(err) {
                innerCallback(err);
              });
            };
          }),
          callback
        );
      },
      function(callback) {
        async.parallel(
          files.map(function(file) {
            return function(innerCallback) {
              var data = randomstring.generate();;
              fs.writeFile(path.join(backupFilesDir,file),data,function(err) {
                innerCallback(err);
              });
            };
          }),
          callback
        );
      }
    ],function(err) {
      done(err,files);
    });
  },
  removeFolder: removeFolder

};

function removeFolder(location,done) {
  fs.readdir(location,function(err,files) {
    async.each(files,function(file,callback) {
      var filePath = path.join(location,file);
      fs.stat(filePath,function(err,stat) {
        if (err) {
          callback(err);
        } else if (stat.isDirectory()) {
          removeFolder(filePath,callback);
        } else {
          fs.unlink(filePath,function (err) {
            if (err) {
              callback(err);
            } else {
              callback();
            }
          });
        }
      });
    },function (err) {
      if (err) {
        done(err);
      } else {
        fs.rmdir(location,function(err) {
          done(err);
        });
      }
    });
  });
}