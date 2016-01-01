"use strict";
var path = require('path');
var fs = require('fs');

class Setup {
  constructor() {
    this.question = 0;
    this.results = {};
    this.configOutput = {};
    var homeDir = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
    this.questions = [
      {
        'slug': 'backupDirs',
        'question': 'Enter the directories you want to backup separated by commas:',
        'default': homeDir,
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
        'default': path.join(homeDir,'.backupfiles.sqlite3'),
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
      fs.writeFile(this.results.path,JSON.stringify(this.configOutput,null,'  '),function(err) {
        if (err) {
          console.error(err);
        }
        process.exit(0);
      });
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
}

module.exports = Setup;
