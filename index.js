var Database = require('./lib/database');
var BackupAgent = require('./lib/backupAgent');
var GlacierTransmitter = require('./lib/transmitters/glacierTransmitter.js');
var S3Transmitter = require('./lib/transmitters/s3Transmitter.js');
var DummyTransmitter = require('./lib/transmitters/dummyTransmitter.js');

var argv = require('minimist')(process.argv.slice(2),{
  'default': {
    'config': 'backuptool.json'
  }
});

var config = require(argv.config);

var database = new Database(config);
var transmitter;

if (config.glacierVaultName) {
  transmitter = new GlacierTransmitter(config);
} else if (config.s3BucketName) {
  transmitter = new S3Transmitter(config);
} else {
  transmitter = new DummyTransmitter();
}

database.connect(function(err) {
  if (err) {
    console.error(err);
  } else {
    var agent = new BackupAgent(config,database,console,transmitter);
    agent.execute();
  }
});
