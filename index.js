var Database = require('./lib/database');
var BackupAgent = require('./lib/backupAgent');
var GlacierTransmitter = require('./lib/transmitters/glacierTransmitter.js');
var S3Transmitter = require('./lib/transmitters/s3Transmitter.js');
var DummyTransmitter = require('./lib/transmitters/dummyTransmitter.js');
var FileQueue = require('filequeue');

var argv = require('minimist')(process.argv.slice(2),{
  'default': {
    'config': 'backuptool.json'
  }
});

var config = require(argv.config);

var database = new Database(config);
var fileQueue = new FileQueue(100);
var transmitter;

if (config.glacierVaultName) {
  transmitter = new GlacierTransmitter(config,fileQueue);
} else if (config.s3BucketName) {
  transmitter = new S3Transmitter(config,fileQueue);
} else {
  transmitter = new DummyTransmitter();
}

database.connect(function(err) {
  if (err) {
    console.error(err);
  } else {
    var agent = new BackupAgent(config,database,console,transmitter,fileQueue);
    agent.execute();
  }
});
