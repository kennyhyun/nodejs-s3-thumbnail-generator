const AWS = require('aws-sdk');

const {
  SOURCE_BUCKET_NAME: SourceBucketName = 'images',
  TARGET_BUCKET_NAME: TargetBucketName = 'thumbnails',
  REGION: Region = 'ap-southeast-2',
  S3_HOST,
} = process.env;

const s3Client = new AWS.S3({ endpoint: S3_HOST, s3ForcePathStyle: true });

const getS3Client = () => s3Client;

Object.assign(module.exports, {
  getS3Client,
  get s3Client() {
    return getS3Client();
  },
});
