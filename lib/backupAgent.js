"use strict";

var path = require('path');
var async = require('async');
var minimatch = require('minimatch');
var fs = require('fs');

class BackupAgent {
  constructor(config,database,logger,fileQueue) {
    this.database = database;
    this.logger = logger;
    this.config = config;
    this.fileQueue = fileQueue;
  }

  execute(done) {
    var _this = this;
    var n = this.config.backupDirs.length;
    async.parallel(
      this.config.backupDirs.map(function(path) {
        return function(callback) {
          _this.traverseDirectoryForBackup(path,callback);
        }
      }),
      done
    )
  }

  clean(done) {
    var _this = this;
    async.waterfall([
      function(next) {
        _this.database.getAllFiles(next);
      },
      function(files,next) {
        async.series(
          files.map(function(file) {
            return function(next1) {
              fs.exists(file.path,function(exists) {
                _this.logger.info('File at "' + file.path + '" exists? ' + exists);
                next1(null,{
                  'path': file.path,
                  'exists': exists
                });
              });
            }
          }),
          next
        )
      },
      function(files,next) {
        async.series(
          files
            .filter(function(file) {
              return !file.exists;
            })
            .map(function(file) {
              return function(next1) {
                _this.logger.info('Removing "' + file.path + '" from database');
                _this.database.removeFileFromDatabase(file.path,next1);
              }
            }),
          next
        )
      }
    ],function(err) {
      done(err);
    });
  }

  traverseDirectoryForBackup(dir,done) {
    var _this = this;
    _this.logger.info('Checking directory "' + dir + '"');
    async.waterfall([
      function(callback) {
        _this.fileQueue.readdir(dir,callback);
      },
      function(files,callback) {
        if (files && files.length > 0) {
          _this.makeFileObjects(dir,files,callback);
        } else {
          callback(null,[]);
        }
      },
      function(fileObjs,callback) {
        if (fileObjs && fileObjs.length > 0) {
          _this.findBackupFiles(fileObjs,function(err,files) {
            if (err) {
              callback(err);
            } else if (files) {
              files.forEach(function(file) {
                _this.logger.info('File "' + file + '" modified since last check.');
              });
              callback(null,fileObjs);
            } else {
              callback(null,fileObjs);
            }
          });
        } else {
          callback(null,fileObjs);
        }
      },
      function(fileObjs,callback) {
        if (fileObjs) {
          var directories = fileObjs
            .filter(function(fileObj) {
              return fileObj.stats && fileObj.stats.isDirectory() && _this.fileIsNotIgnored(fileObj.path);
            });

          if (directories.length > 0) {
            async.parallel(
              directories.map(function(fileObj) {
                return function(callback1) {
                  _this.traverseDirectoryForBackup(fileObj.path,callback1);
                }
              }),
              callback
            );
          } else {
            callback();
          }
        } else {
          callback();
        }
      }
    ],done);
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
          })
          .map(function(file) {
            return file.path;
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
