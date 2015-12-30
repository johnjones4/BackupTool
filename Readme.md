# Backup Tool

## Description

_Backup Tool_ is a command line utility for backing up filesystem data to Amazon
Web Services. (Either S3 or Glacier.) The tool is written in a way such that
other backup services can be added in the future. To backup files, the tool
first recursively parses the configured backup folders, marks the
presence of new files, and marks modified files. Then, it backs up all files
whose modified date is greater than or equal too their last backup date. If a
backup fails, the file's backup priority gets pushed down until the next time
the file is updated.

## Installation

Create a file named `.backuptool.json` in your home directory. The contents of
the file should be the following:

```
{
  "backupDirs": [
    "/Users/homefolder"
  ],
  "ignore": [
    ".*"
  ],
  "backupManifestFile": "/Users/homefolder/.backupfiles.sqlite3",
  "glacierVaultName": "",
  "s3BucketName": "",
  "aws": {
    "accessKeyId": "",
    "secretAccessKey": "",
    "region": ""
  }
}
```

### Parameter Descriptions

* **backupDirs** An array of directories to recursively backup.
* **ignore** An array of glob-style ignore directives.
* **backupManifestFile** The path where tool should store its backup manifest.
* **glacierVaultName** or **s3BucketName** These are the destination names for backups. Use either or to indicate use of Glacier or S3 for backup storage.
* **aws** This is a set of properties that is passed directly to the AWS API.

## Usage

Todo
