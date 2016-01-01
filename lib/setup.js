"use strict";
var path = require('path');
var async = require('async');
var plist = require('plist');
var fs = require('fs');

class Setup {
  constructor() {
    this.question = 0;
    this.results = {};
    this.configOutput = {};
    this.homeDir = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    this.questions = [
      {
        'slug': 'backupDirs',
        'question': 'Enter the directories you want to backup separated by commas:',
        'default': this.homeDir,
        'csv': true
      },
      {
        'slug': 'ignore',
        'question': 'Enter the file and directory patterns you want to no backup separated by commas:',
        'default': '.*',
        'csv': true
      },
      {
        'slug': 'backupManifestFile',
        'question': 'Enter the path of where you want to save the backup manifest file:',
        'default': path.join(this.homeDir,'.backupfiles.sqlite3'),
      },
      {
        'slug': 'service',
        'question': 'Use Glacier or S3?',
        'default': 'glacier',
        'choices': ['glacier','s3'],
        'noWrite': true,
      },
      {
        'slug': 'glacierVaultName',
        'question': 'Glacier vault name:',
        'condition': function(results) {
          return results.service == 'glacier';
        }
      },
      {
        'slug': 's3BucketName',
        'question': 'S3 bucket name:',
        'condition': function(results) {
          return results.service == 's3';
        }
      },
      {
        'slug': 'aws.accessKeyId',
        'question': 'Enter your AWS access key ID:'
      },
      {
        'slug': 'aws.secretAccessKey',
        'question': 'Enter your AWS secret access key:'
      },
      {
        'slug': 'aws.region',
        'question': 'Enter your AWS region:'
      },
      {
        'slug': 'interval',
        'question': 'How often (never, hourly, daily, weekly, monthly) should the backup run?',
        'choices': ['never','hourly','daily','weekly'],
        'default': 'daily',
        'noWrite': true
      },
      {
        'slug': 'path',
        'question': 'Enter the destination of the config file:',
        'default': path.join(process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'],'.backuptool.json'),
        'noWrite': true
      }
    ];
  }

  start() {
    var _this = this;
    var stdin = process.openStdin();
    stdin.addListener("data", function(data) {
      _this.handleAnswer(data.toString().trim());
    });
    this.nextQuestion();
  }

  nextQuestion() {
    if (this.question < this.questions.length) {
      var question = this.getCurrentQuestion();
      if (question.condition && !question.condition(this.results)) {
        this.question++;
        this.nextQuestion();
      } else {
        var prompt = question.question + ' ';
        if (question.default) {
          prompt += '[' + question.default + '] ';
        }
        console.log(prompt);
      }
    } else {
      this.writeConfigs();
    }
  }

  handleAnswer(answer) {
    var question = this.getCurrentQuestion();
    if (question) {
      if (question.default && answer == '') {
        answer = question.default;
      }
      if (question.choices && question.choices.indexOf(answer) == -1) {
        console.error('Your answer must be one of the following: ' + question.choices.join(', '));
        this.nextQuestion();
        return;
      }
      if (question.csv) {
        answer = answer.split(',');
      }
      this.results[question.slug] = answer;
      if (typeof question.noWrite == 'undefined' || question.noWrite === false) {
        var accessPaths = question.slug.split('.');
        var obj = this.configOutput;
        while(accessPaths.length > 1) {
          var selector = accessPaths.shift();
          if (!obj[selector]) {
            obj[selector] = {};
          }
          obj = obj[selector];
        }
        obj[accessPaths[0]] = answer;
      }
      this.question++;
      this.nextQuestion();
    }
  }

  getCurrentQuestion() {
    return this.questions[this.question];
  }

  writeConfigs() {
    var _this = this;
    async.waterfall([
      function(callback) {
        fs.writeFile(_this.results.path,JSON.stringify(_this.configOutput,null,'  '),callback);
      },
      function(callback) {
        if (_this.results.interval != 'never') {
          if (process.platform == 'darwin') {
            var macLaunchdPlist = {
              'Disabled': false,
              'EnvironmentVariables': {
                'PATH': '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/sbin'
              },
              'Label': 'com.johnjonesfour.backuptool',
              'ProgramArguments': ['/usr/local/bin/backuptool','--config'],
              'RunAtLoad': false,
              'StartInterval': 0
            };
            macLaunchdPlist.ProgramArguments.push(_this.results.path);
            if (_this.results.interval == 'hourly') {
              macLaunchdPlist.StartInterval = 3600;
            } else if (_this.results.interval == 'daily') {
              macLaunchdPlist.StartInterval = 86400;
            } else if (_this.results.interval == 'weekly') {
              macLaunchdPlist.StartInterval = 604800;
            }
            var outPlist = plist.build(macLaunchdPlist);
            fs.writeFile(path.join(_this.homeDir,'Library/LaunchAgents/com.johnjonesfour.backuptool.plist'),outPlist,callback);
          } else {
            callback();
          }
        } else {
          callback();
        }
      }
    ],function(err) {
      if (err) {
        console.error(err);
      }
      process.exit(err == null ? 0 : -1);
    })
  }
}

module.exports = Setup;
