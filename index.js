var Database = require('./lib/database');
var BackupAgent = require('./lib/backupAgent');
var GlacierBackuper = require('./lib/backupers/glacierBackuper.js');
var S3Backuper = require('./lib/backupers/s3Backuper.js');
var DummyBackuper = require('./lib/backupers/dummyBackuper.js');
var FileQueue = require('filequeue');

var argv = require('minimist')(process.argv.slice(2),{
  'default': {
    'config': 'backuptool.json'
  }
});

console.log(argv);

var config = require(argv.config);

var database = new Database(config);
var fileQueue = new FileQueue(100);
var backuper;

database.connect(function(err) {
  if (err) {
    console.error(err);
  } else {
    var agent = new BackupAgent(config,database,console,fileQueue);
    agent.execute(function() {
      // if (config.glacierVaultName) {
      //   backuper = new GlacierBackuper(config,database,console,fileQueue);
      // } else if (config.s3BucketName) {
      if (config.s3BucketName) {
        backuper = new S3Backuper(config,database,console,fileQueue);
      } else {
        backuper = new DummyBackuper(config,database,console,fileQueue);
      }

      backuper.execute(function() {
        database.disconnect();
        process.exit(0);
      })
    });
  }
});
