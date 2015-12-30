"use strict";

var sqlite3 = require('sqlite3');
var async = require('async');

class Database {
  constructor(config) {
    this.config = config;
  }

  connect(callback) {
    var _this = this;
    _this.db = new sqlite3.Database(this.config.backupManifestFile, function(err) {
      if (err) {
        callback(err);
      } else {
        _this.install(callback);
      }
    });
  }

  disconnect() {
    this.db.close();
  }

  install(callback) {
    this.db.exec('CREATE TABLE IF NOT EXISTS File (path TEXT PRIMARY KEY, modified INTEGER NOT NULL, backedup INTEGER NOT NULL)',callback);
  }

  touchFile(absPath,fsModifiedTime,callback) {
    var _this = this;
    this.db.all('SELECT modified FROM File WHERE path = ?',[absPath],function(err,rows) {
      if (err) {
        callback(err);
      } else if (rows && rows.length == 0) {
        _this.db.run('INSERT INTO File (path,modified,backedup) VALUES (?,?,0)',[absPath,fsModifiedTime],function(err) {
          callback(err,true);
        });
      } else if (rows && rows[0].modified < fsModifiedTime) {
        _this.db.run('UPDATE File SET modified = ? WHERE path = ?',[fsModifiedTime,absPath],function(err) {
          callback(err,true);
        });
      } else {
        callback(null,false);
      }
    });
  }

  getNextFileForBackup(done) {
    var _this = this;
    async.waterfall([
      function(callback) {
        _this.db.all('SELECT path FROM File WHERE modified >= backedup LIMIT 1',[],function(err,rows) {
          if (err) {
            callback(err);
          } else if (rows && rows.length > 0) {
            callback(null,rows[0].path);
          } else {
            callback(null,null);
          }
        });
      },
      function(path,callback) {
        if (path) {
          _this.db.run('UPDATE File SET backedup = ? WHERE path = ?',[Date.now(),path],function(err) {
            callback(err,path);
          });
        } else {
          callback();
        }
      }
    ],done);
  }

  getBackupStatus(done) {
    var _this = this;
    async.waterfall([
      function(callback) {
        _this.db.all('SELECT path FROM File WHERE modified >= backedup',[],function(err,rows) {
          if (err) {
            callback(err);
          } else {
            callback(null,rows ? rows.length : 0);
          }
        });
      },
      function(part,callback) {
        _this.db.all('SELECT path FROM File',[],function(err,rows) {
          if (err) {
            callback(err);
          } else {
            callback(null,part,rows ? rows.length : 0);
          }
        });
      }
    ],done);
  }

}

module.exports = Database;
