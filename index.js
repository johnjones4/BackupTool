#! /usr/bin/env node

var Database = require('./lib/database');
var BackupAgent = require('./lib/backupAgent');
var Setup = require('./lib/setup');
var GlacierBackuper = require('./lib/backupers/glacierBackuper.js');
var S3Backuper = require('./lib/backupers/s3Backuper.js');
var DummyBackuper = require('./lib/backupers/dummyBackuper.js');
var FileQueue = require('filequeue');
var Joi = require('joi');
var Schemas = require('./lib/schemas');
var path = require('path');

var argv = require('minimist')(process.argv.slice(2),{
  'default': {
    'config': path.join(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'],'.backuptool.json'),
    'logging': 'error'
  }
});

var config;
var database;
var logger = configLogger();

if (argv._.length == 1 && argv._[0] == 'backup') {
  initConfigAndDB();
  database.connect(function(err) {
    if (err) {
      logger.error(err);
    } else {
      backup();
    }
  });
} else if (argv._.length == 1 && argv._[0] == 'status') {
  initConfigAndDB();
  database.connect(function(err) {
    if (err) {
      logger.error(err);
    } else {
      status();
    }
  });
} else if (argv._.length == 1 && argv._[0] == 'setup') {
  setup();
} else {
  usage();
}

function configLogger() {
  var logger = {
    'error': function() {},
    'log': function() {},
    'info': function() {}
  };

  if (argv.logging == 'error' || argv.logging == 'info') {
    logger.error = console.error;
  }
  if (argv.logging == 'info') {
    logger.log = console.log;
    logger.info = console.info;
  }

  return logger;
}

function initConfigAndDB() {
  config = require(argv.config);
  // Validate configuration before attempting to read DB
  Joi.attempt(config, Schemas.config);
  database = new Database(config);
}

function backup() {
  var fileQueue = new FileQueue(100);
  var backuper;
  var agent = new BackupAgent(config,database,logger,fileQueue);
  agent.execute(function(err) {
    if (err) {
      logger.error(err);
    } else {
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
      });
    }
  });
}

function status() {
  process.stdout.write('Waiting for status ...');
  var interval = setInterval(function() {
    database.getBackupStatus(function(err,part,total) {
      if (err) {
        logger.error(err);
      } else if (total > 0) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(Math.round((total - part) / total * 100) + '% (' + (total - part) + '/' + total + ')');
        if (part == 0) {
          clearInterval(interval);
          process.exit(0);
        }
      }
    });
  },500);
}

function setup() {
  var setup = new Setup();
  setup.start();
}

function usage() {
  console.error('Usage: backuptool [--config /path/to/file.json] [--logging <error|info>] <backup|status|setup>');
}
