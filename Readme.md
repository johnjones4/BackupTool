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

Todo

## Usage

Todo
