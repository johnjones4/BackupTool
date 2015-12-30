var Database = require('./lib/database');
var BackupAgent = require('./lib/backupAgent');
var GlacierBackuper = require('./lib/backupers/glacierBackuper.js');
var S3Backuper = require('./lib/backupers/s3Backuper.js');
var DummyBackuper = require('./lib/backupers/dummyBackuper.js');
var FileQueue = require('filequeue');
var path = require('path');

var argv = require('minimist')(process.argv.slice(2),{
  'default': {
    'config': path.join(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'],'.backuptool.json')
  }
});

var config = require(argv.config);
var database = new Database(config);
var logger = console;

database.connect(function(err) {
  if (err) {
    logger.error(err);
  } else {
    if (argv._.length == 1 && argv._[0] == 'backup') {
      var fileQueue = new FileQueue(100);
      var backuper;
      var agent = new BackupAgent(config,database,logger,fileQueue);
      agent.execute(function() {
        if (config.glacierVaultName) {
          backuper = new GlacierBackuper(config,database,logger,fileQueue);
        } else if (config.s3BucketName) {
          backuper = new S3Backuper(config,database,logger,fileQueue);
        } else {
          backuper = new DummyBackuper(config,database,logger,fileQueue);
        }
        backuper.execute(function() {
          database.disconnect();
          process.exit(0);
        })
      });
    } else if (argv._.length == 1 && argv._[0] == 'status') {
      process.stdout.write('Waiting for status ...');
      var interval = setInterval(function() {
        database.getBackupStatus(function(err,part,total) {
          if (err) {
            logger.error(err);
          } else if (total > 0) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(Math.round((total - part) / total * 100) + '%');
            if (part == 0) {
              clearInterval(interval);
              process.exit(0);
            }
          }
        });
      },500);
    } else {
      logger.error('Usage: backuptool [--config /path/to/file.json] <backup|status>')
    }
  }
});
