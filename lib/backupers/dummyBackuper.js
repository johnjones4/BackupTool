"use strict";

class DummyBackuper {
  constructor(config,database,logger,fileQueue) {
    this.database = database;
    this.logger = logger;
    this.config = config;
    this.fileQueue = fileQueue;
    this.intervalTime = 1000;
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
                _this.logger.info('Will Backup "' + path + '"');
                var obj = {
                  'path': path,
                  'stats': stats
                };
                _this.sendFile(obj,function(err) {
                  if (err) {
                    _this.logger.error(err);
                    _this.database.resetBackupDate(path,function(err) {
                      if (err) {
                        _this.logger.error(err);
                      }
                      _this.backupInProgress = false;
                    });
                  } else {
                    _this.backupInProgress = false;
                  }
                });
              } else {
                _this.logger.info('Empty file at ' + path);
                _this.backupInProgress = false;
              }
            });
          } else {
            clearInterval(_this.interval);
            done();
          }
        });
      }
    },this.intervalTime);
  }

  sendFile(file,callback) {
    callback();
  }
}

module.exports = DummyBackuper;
