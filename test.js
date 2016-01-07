var assert = require('assert');
var fs = require('fs');
var randomstring = require('randomstring');
var BackupAgent = require('./lib/backupAgent');
var FileQueue = require('filequeue');
var Database = require('./lib/database');
var path = require('path');
var async = require('async');

var rootDir = './testData';
var backupFilesDir = path.join(rootDir,'dummyData');

var ignoredFilename = 'ignoreThisFile';
var ignoredExtension = '*.someExtension';

var config = {
  'backupDirs': [
    backupFilesDir
  ],
  'ignore': [
    ignoredFilename,
    ignoredExtension
  ],
  'backupManifestFile': './backupData/backupfiles.sqlite3'
};

var logger = {
  'error': function() {},
  'log': function() {},
  'info': function() {}
};

describe('BackupAgent',function() {
  var files;
  before(function(done) {
    async.waterfall([
      function(callback) {
        fs.mkdir(rootDir,callback);
      },
      function(callback) {
        fs.mkdir(backupFilesDir,callback);
      },
      function(callback) {
        generateFiles(5,function(err,madeFiles) {
          if (err) {
            callback(err);
          } else {
            files = madeFiles;
            callback();
          }
        });
      }
    ],done);
  });

  after(function(done) {
    removeFolder(rootDir, done);
  });

  describe('fileIsNotIgnored',function() {
    var agent;
    before(function() {
      agent = new BackupAgent(config,null,logger,new FileQueue(100));
    });

    it('Ignores configured globs',function() {
      assert.strictEqual(agent.fileIsNotIgnored(ignoredFilename),false);
      assert.strictEqual(agent.fileIsNotIgnored(randomstring.generate() + ignoredExtension),false);
    });

    it('Does not ignore non-configured globs',function() {
      assert.strictEqual(agent.fileIsNotIgnored(randomstring.generate() + '.' + randomstring.generate()),true);
      assert.strictEqual(agent.fileIsNotIgnored(randomstring.generate() + '.' + randomstring.generate()),true);
    });
  });

  describe('makeFileObjects',function() {
    var agent;
    before(function() {
      agent = new BackupAgent(config,null,logger,new FileQueue(100));
    });

    it('Finds the generated files',function(done) {
      agent.makeFileObjects(backupFilesDir,files,function(err,_files) {
        if (err) {
          done(err);
        } else {
          assert.strictEqual(files.length,_files.length);
          files.forEach(function(file) {
            var absPath = path.join(backupFilesDir,file);
            var index = _files.findIndex(function(item) {
              return item.path == absPath;
            });
            assert(index >= 0);
            assert(_files[index].stats.size > 0);
          });
          done();
        }
      });
    });
  });

  describe('findBackupFiles',function() {
    var agent;
    var database;
    var touchedFiles = [];
    before(function() {
      database = {
        'touchFile': function(absPath,fsModifiedTime,size,callback) {
          callback(null,touchedFiles.indexOf(absPath) >= 0);
        }
      };
      touchedFiles = files
        .filter(function(item,i) {
          return i % 2 == 0;
        })
        .map(function(file) {
          return path.join(backupFilesDir,file)
        });
      agent = new BackupAgent(config,database,logger,new FileQueue(100));
    });

    it('Finds the modified files',function(done) {
      agent.makeFileObjects(backupFilesDir,files,function(err,fileObjs) {
        if (err) {
          done(err);
        } else {
          agent.findBackupFiles(fileObjs,function(err,validFiles) {
            if (err) {
              done(err);
            } else {
              assert.strictEqual(validFiles.length,touchedFiles.length);
              validFiles.sort();
              touchedFiles.sort();
              for(var i=0; i<validFiles.length; i++) {
                assert.strictEqual(validFiles[i],touchedFiles[i]);
              }
              done();
            }
          });
        }
      });
    });
  });

  describe('traverseDirectoryForBackup',function() {
    var database;
    var agent;
    before(function() {
      database = {
        'touchFile': function(absPath,fsModifiedTime,size,callback) {
          callback(null,true);
        }
      };
      agent = new BackupAgent(config,database,logger,new FileQueue(100));
    });

    it('Executes without error',function(done) {
      agent.traverseDirectoryForBackup(backupFilesDir,done);
    });
  });

  describe('execute',function() {
    var database;
    var agent;
    before(function() {
      database = {
        'touchFile': function(absPath,fsModifiedTime,size,callback) {
          callback(null,true);
        }
      };
      agent = new BackupAgent(config,database,logger,new FileQueue(100));
    });

    it('Executes without error',function(done) {
      agent.execute(done);
    });
  });
});

function generateFiles(topTotal,done) {
  var files = [];
  var directories = [];

  var makeFiles = function(dir,n) {
    if (n > 0) {
      for(var i=0; i<n; i++) {
        files.push(path.join(dir,randomstring.generate()));
        var newDirName = path.join(dir,randomstring.generate());
        directories.push(newDirName);
        makeFiles(newDirName,n-1);
      }
    }
  }
  makeFiles('',topTotal);

  async.waterfall([
    function(callback) {
      async.waterfall(
        directories.map(function(dir) {
          return function(innerCallback) {
            fs.mkdir(path.join(backupFilesDir,dir),function(err) {
              innerCallback(err);
            });
          };
        }),
        callback
      );
    },
    function(callback) {
      async.parallel(
        files.map(function(file) {
          return function(innerCallback) {
            var data = randomstring.generate();;
            fs.writeFile(path.join(backupFilesDir,file),data,function(err) {
              innerCallback(err);
            });
          };
        }),
        callback
      );
    }
  ],function(err) {
    done(err,files);
  });
}

function removeFolder(location,done) {
  fs.readdir(location,function(err,files) {
    async.each(files,function(file,callback) {
      var filePath = path.join(location,file);
      fs.stat(filePath,function(err,stat) {
        if (err) {
          callback(err);
        } else if (stat.isDirectory()) {
          removeFolder(filePath,callback);
        } else {
          fs.unlink(filePath,function (err) {
            if (err) {
              callback(err);
            } else {
              callback();
            }
          });
        }
      });
    },function (err) {
      if (err) {
        done(err);
      } else {
        fs.rmdir(location,function(err) {
          done(err);
        });
      }
    });
  });
}
