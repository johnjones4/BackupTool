var Database = require('./lib/database');
var BackupAgent = require('./lib/backupAgent');
var GlacierTransmitter = require('./lib/transmitters/glacierTransmitter.js');
var S3Transmitter = require('./lib/transmitters/s3Transmitter.js');
var config = require('./config');

var database = new Database(config);
var transmitter = new GlacierTransmitter(config);

database.connect(function(err) {
  if (err) {
    console.error(err);
  } else {
    var agent = new BackupAgent(config,database,console,transmitter);
    agent.execute();
  }
})
