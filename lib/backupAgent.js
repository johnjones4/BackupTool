"use strict";

var path = require('path');
var async = require('async');
var minimatch = require('minimatch');

class BackupAgent {
  constructor(config,database,logger,fileQueue) {
    this.database = database;
    this.logger = logger;
    this.config = config;
    this.fileQueue = fileQueue;
  }

  execute(done) {
    var _this = this;
    this.traversals = 0;
    this.config.backupDirs.forEach(function(path) {
      _this.traverseDirectoryForBackup(path,function() {
        _this.traversals--;
        if (_this.traversals == 0) {
          done();
        }
      });
    });
  }

  traverseDirectoryForBackup(dir,done) {
    var _this = this;
    _this.logger.info('Checking directory "' + dir + '"');
    this.fileQueue.readdir(dir,function(err,files) {
      _this.traversals++;
      if (err) {
        _this.logger.error(err);
      }
      if (files && files.length > 0) {
        _this.makeFileObjects(dir,files,function(err,fileObjs) {
          if (err) {
            _this.logger.error(err);
          }
          if (fileObjs && fileObjs.length > 0) {
            _this.findBackupFiles(fileObjs,function(err,files) {
              if (err) {
                _this.logger.error(err);
              }
              if (files) {
                files.forEach(function(file) {
                  _this.logger.info('File "' + file.path + '" modified since last check.');
                });
              }
              done();
            });

            fileObjs
              .filter(function(fileObj) {
                return fileObj.stats && fileObj.stats.isDirectory() && _this.fileIsNotIgnored(fileObj.path);
              })
              .forEach(function(fileObj) {
                _this.traverseDirectoryForBackup(fileObj.path,done);
              });
          } else {
            done();
          }
        });
      } else {
        done();
      }
    });
  }

  makeFileObjects(dir,files,callback) {
    var _this = this;
    var absPaths = files.map(function(file) {
      return path.join(dir,file);
    });
    async.parallel(absPaths.map(function(absPath) {
      return function(callback) {
        _this.fileQueue.stat(absPath,function(err,stats) {
          callback(err,{
            'stats': stats,
            'path': absPath
          });
        });
      }
    }),callback);
  }

  findBackupFiles(fileObjs,callback) {
    var _this = this;
    var filesToBackup = fileObjs.filter(function(file) {
      return _this.fileIsNotIgnored(file.path) && file.path != _this.config.backupManifestFile && file.stats && file.stats.isFile();
    });
    async.parallel(filesToBackup.map(function(file) {
      return function(callback) {
        var modTime = Math.max(file.stats.mtime,file.stats.ctime);
        _this.database.touchFile(file.path,modTime,file.stats.size,function(err,shouldBackup) {
          callback(err,{
            'path': file.path,
            'shouldBackup': shouldBackup
          });
        });
      }
    }),function(err,files) {
      if (err) {
        callback(err);
      } else {
        var validFiles = files
          .filter(function(file) {
            return file.shouldBackup;
          });
        callback(null,validFiles);
      }
    });
  }

  fileIsNotIgnored(file) {
    return this.config.ignore.reduce(function(last,pattern) {
      return last + (minimatch(file, pattern, { matchBase: true }) ? 1 : 0);
    },0) == 0;
  }
}

module.exports = BackupAgent;
