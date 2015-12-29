"use strict";

class DummyBackuper {
  constructor(config,database,logger,fileQueue) {
    this.database = database;
    this.logger = logger;
    this.config = config;
    this.fileQueue = fileQueue;
    this.interval = 1000;
    this.backupInProgress = false;
  }

  execute(done) {
    var _this = this;
    _this.backupInProgress = false;
    _this.interval = setInterval(function() {
      if (!_this.backupInProgress) {
        _this.backupInProgress = true;
        _this.database.getNextFileForBackup(function(err,path) {
          if (err) {
            _this.logger.error(err);
          }
          if (path) {
            _this.fileQueue.stat(path,function(err,stats) {
              if (err) {
                _this.logger.error(err);
              }
              if (stats && stats.size > 0) {
                var obj = {
                  'path': path,
                  'stats': stats
                };
                _this.sendFile(obj,function(err) {
                  if (err) {
                    _this.logger.error(err);
                  } else {
                    _this.logger.info('Backed Up "' + path + '"');
                  }
                  _this.backupInProgress = false;
                });
              }
            });
          } else {
            done();
          }
        });
      }
    },this.interval);
  }

  sendFile(file,callback) {
    this.logger.info('Will backup "' + file.path + '"');
    callback();
  }
}

module.exports = DummyBackuper;
