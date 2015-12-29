var fs = require('fs');
var path = require('path');
var async = require('async');
var minimatch = require('minimatch');

var BackupAgent = function(config,database,logger,transmitter) {
  this.database = database;
  this.logger = logger;
  this.transmitter = transmitter;
  this.config = config;
}

BackupAgent.prototype.execute = function() {
  var _this = this;
  this.config.backupDirs.forEach(function(path) {
    _this.traverseDirectoryForBackup(path);
  });
}

BackupAgent.prototype.traverseDirectoryForBackup = function(dir) {
  var _this = this;
  fs.readdir(dir,function(err,files) {
    if (err) {
      _this.logger.error(err);
    } else if (files && files.length > 0) {
      _this.makeFileObjects(dir,files,function(err,fileObjs) {
        if (err) {
          _this.logger.error(err);
        } else if (fileObjs && fileObjs.length > 0) {
          _this.findBackupFiles(fileObjs,function(err,files) {
            if (err) {
              _this.logger.error(err);
            } else if (files) {
              files.forEach(function(file) {
                _this.transmitter.sendFile(file,function(err) {
                  if (err) {
                    _this.logger.error(file.path,err);
                  }
                });
              });
            }
          });

          fileObjs
            .filter(function(fileObj) {
              return fileObj.stats.isDirectory() && _this.fileIsNotIgnored(fileObj.path);
            })
            .forEach(function(fileObj) {
              _this.traverseDirectoryForBackup(fileObj.path);
            });
        }
      });
    }
  })
}

BackupAgent.prototype.makeFileObjects = function(dir,files,callback) {
  var absPaths = files.map(function(file) {
    return path.join(dir,file);
  });
  async.parallel(absPaths.map(function(absPath) {
    return function(callback) {
      fs.stat(absPath,function(err,stats) {
        callback(err,{
          'stats': stats,
          'path': absPath
        });
      });
    }
  }),callback);
}

BackupAgent.prototype.findBackupFiles = function(fileObjs,callback) {
  var _this = this;
  var filesToBackup = fileObjs.filter(function(file) {
    return _this.fileIsNotIgnored(file.path) && file.path != _this.config.backupManifestFile && file.stats.isFile();
  });
  async.parallel(filesToBackup.map(function(file) {
    return function(callback) {
      var modTime = Math.max(file.stats.mtime,file.stats.ctime);
      _this.database.checkFile(file.path,modTime,function(err,shouldBackup) {
        callback(err,{
          'path': file.path,
          'stats': file.stats,
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

BackupAgent.prototype.fileIsNotIgnored = function(file) {
  return this.config.ignore.reduce(function(last,pattern) {
    return last + (minimatch(file, pattern, { matchBase: true }) ? 1 : 0);
  },0) == 0;
}

module.exports = BackupAgent;
