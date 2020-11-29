'use strict';
const Stream = require('stream');
const AWS = require('aws-sdk');

console.log('------------------', process.env);
const {
  SOURCE_BUCKET_NAME: SourceBucketName = 'images',
  TARGET_BUCKET_NAME: TargetBucketName = 'thumbnails',
  REGION: Region = 'ap-southeast-2',
  S3_HOST,
} = process.env;

const sourceS3Config = {
  Bucket: SourceBucketName,
};

const targetS3Config = {
  Bucket: TargetBucketName,
};

const s3Client = new AWS.S3({ endpoint: S3_HOST, s3ForcePathStyle: true });

const getS3Client = () => s3Client;

const getMetadata = obj =>
  Object.keys(obj).reduce((prev, key) => {
    return { ...prev, [key]: `${obj[key]}` };
  }, {});

// const sourcePrefix = '/images';
const getDimensionKey = ({ width, height }) => `${width || ''}x${height || ''}`;

const getTargetStream = ({ context, width, height, location }) => {
  const dimensionKey = getDimensionKey({ width, height });
  const thumbKey = `${dimensionKey}/${location}`;
  const stream = new Stream.PassThrough().on('error', err => context && context.reject(err));
  return {
    stream,
    thumbKey,
    promise: s3Client.upload({ ...targetS3Config, Key: thumbKey, Body: stream }).promise(),
  };
};

const getSourceStream = ({ location, context }) =>
  s3Client
    .getObject({ ...sourceS3Config, Key: location }, err => {
      if (err) {
        context && context.reject(err);
      }
    })
    .createReadStream()
    .on('error', e => context && context.reject(e));

const createTargetBucket = context => {
  // create bucket async
  s3Client.createBucket({ Bucket: TargetBucketName, CreateBucketConfiguration: { LocationConstraint: Region } }, e => {
    if (e && e.code !== 'BucketAlreadyOwnedByYou') {
      context && context.reject(new Error(`Failed to create the bucket: ${e.message}`));
    }
  });
};

const updateMetadata = ({ Bucket, Metadata, Key, ...options }) =>
  s3Client
    .copyObject({
      ...options,
      Key,
      Metadata,
      CopySource: `${Bucket}/${Key}`,
      MetadataDirective: 'REPLACE',
    })
    .promise();

Object.assign(module.exports, {
  getS3Client,
  get s3Client() {
    return getS3Client();
  },
  getMetadata,
  createTargetBucket,
  getTargetStream,
  getSourceStream,
  updateMetadata,
});
