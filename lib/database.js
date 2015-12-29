var sqlite3 = require('sqlite3').verbose();

var Database = function(config) {
  this.config = config;
}

Database.prototype.connect = function(callback) {
  var _this = this;
  _this.db = new sqlite3.Database(this.config.backupManifestFile, function(err) {
    if (err) {
      callback(err);
    } else {
      _this.install(callback);
    }
  });
}

Database.prototype.install = function(callback) {
  this.db.exec('CREATE TABLE IF NOT EXISTS File (path TEXT PRIMARY KEY, modified INTEGER NOT NULL)',callback);
}

Database.prototype.checkFile = function(absPath,fsModifiedTime,callback) {
  var _this = this;
  this.db.all('SELECT modified FROM File WHERE path = ?',[absPath],function(err,rows) {
    if (err) {
      callback(err);
    } else if (rows && rows.length == 0) {
      _this.db.run('INSERT INTO File (path,modified) VALUES (?,?)',[absPath,fsModifiedTime],function(err) {
        callback(err,true);
      });
    } else if (rows && rows[0].modified < fsModifiedTime) {
      _this.db.run('UPDATE File SET modified = ? WHERE path = ?',[fsModifiedTime,absPath],function(err) {
        callback(err,true);
      });
    } else {
      callback(null,false);
    }
  })
}

module.exports = Database;
