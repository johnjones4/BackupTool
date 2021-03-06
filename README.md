# Backup Tool

[![NPM](https://nodei.co/npm/backuptool.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/backuptool/)

[![NPM](https://nodei.co/npm-dl/backuptool.png)](https://nodei.co/npm/backuptool/)

[![Build Status](https://travis-ci.org/johnjones4/BackupTool.svg?branch=master)](https://travis-ci.org/johnjones4/BackupTool)

## Description

_Backup Tool_ is a command line utility for backing up filesystem data to Amazon
Web Services. (Either S3 or Glacier.) The tool is written in a way such that
other backup services can be added in the future. To backup files, the tool
first recursively parses the configured backup folders, marks the
presence of new files, and marks modified files. Then, it backs up all files
whose modified date is greater than or equal too their last backup date. If a
backup fails, the file's backup priority gets pushed down until the next time
the file is updated.

If you'd like to contribute - and please do - see our [Contributing](https://github.com/johnjones4/BackupTool/blob/master/CONTRIBUTING.md) guidelines for more information.

**Mac Users:** check out
[BackupTool-Mac-Status](https://github.com/johnjones4/BackupTool-Mac-Status),
a Mac app that displays the percent-complete of BackupTool in the Mac status
bar.

## Installation

Install the command line tool globally using *npm's* `-g` option:

```
# sudo npm install backuptool -g
```

Then, run the interactive setup by running:

```
# backuptool setup
```

Finally, it is recommended to run the first backup with verbose logging so that
you can track the first pass at backing up all files:

```
# backuptool backup --logging info
```

## Config File Parameter Descriptions

* **backupDirs** An array of directories to recursively backup.
* **ignore** An array of glob-style ignore directives.
* **backupManifestFile** The path where tool should store its backup manifest.
* **glacierVaultName** or **s3BucketName** These are the destination names for backups. Use either or to indicate use of Glacier or S3 for backup storage.
* **aws** This is a set of properties that is passed directly to the AWS API.

## Usage

### General Usage

```
backuptool [--config /path/to/file.json] [--logging <error|info>] <backup|status|setup>
```

### Options

* **--config** By default, _backuptool_ looks for the file `.backuptool.json` in the running user's home directory, but this option can override that.
* **--logging** Change the logging level of the tool. By default it is set to _error_.

### Commands

* **backup** Execute the backup program
* **status** Print the percent-complete of the current backup.
