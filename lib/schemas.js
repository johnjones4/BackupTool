"use strict";

var Joi = require('joi');

module.exports = {
  config: Joi.object().keys({
    backupDirs: Joi.array().items(Joi.string()).required(),
    ignore: Joi.array().items(Joi.string()).required(),
    backupManifestFile: Joi.string().required(),
    glacierVaultName: Joi.string(),
    s3BucketName: Joi.string(),
    aws: Joi.object().keys({
      "accessKeyId": Joi.string().required(),
      "secretAccessKey": Joi.string().required(),
      "region": Joi.string().required()
    })
  }).nand('glacierVaultName', 's3BucketName')
};
