'use strict';
const sharp = require('sharp');
const path = require('path');
const AWS = require('aws-sdk');
const config = require('dotenv').config();
const Stream = require('stream');

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

const hello = async event => {
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Go Serverless v1.0! Your function executed successfully!',
        input: event,
      },
      null,
      2
    ),
  };
  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};

const sourcePrefix = '/images';
const getDimensionKey = ({ width, height }) => `${width || ''}x${height || ''}`;
const getTargetStream = ({ width, height, location }) => {
  const dimensionKey = getDimensionKey({ width, height });
  const thumbKey = `${dimensionKey}/${location}`;
  const stream = new Stream.PassThrough();
  return {
    stream,
    thumbKey,
    promise: s3Client.upload({ ...targetS3Config, Key: thumbKey, Body: stream }).promise(),
  };
};
const getSourceStream = ({ location }) => {
  return s3Client.getObject({ ...sourceS3Config, Key: location }).createReadStream();
};

const generateThumbnail = async ({ width, height, location }) => {
    const transform = sharp()
      .rotate()
      .resize({ width, height })
      .jpeg({ quality: 80 });
    const inputStream = getSourceStream({ location });
    await s3Client
      .createBucket({ Bucket: TargetBucketName, CreateBucketConfiguration: { LocationConstraint: Region } })
      .promise()
      .catch(e => {
        if (e.code !== 'BucketAlreadyOwnedByYou') throw e;
      });
    const { thumbKey, stream: outputStream, promise } = getTargetStream({ width, height, location });
    const pipe = inputStream.pipe(transform).pipe(outputStream);
    return Promise.all([
      new Promise((resolve, reject) => {
        inputStream.on('finish', () => resolve(thumbKey));
        pipe.on('close', () => resolve(thumbKey));
        pipe.on('error', err => reject(err));
        inputStream.on('error', err => reject(err));
        inputStream.on('close', () => resolve(thumbKey));
        outputStream.on('error', err => reject(err));
        /*
    outputStream.on('error', err => reject(err));
    outputStream.on('close', () => resolve(thumbKey));
*/
      }),
      promise,
    ]);
};

const Prefix = '/thumbnails';

const generate = async event => {
  try {
    const {
      pathParameters: { proxy },
    } = event;
    const [, width, height, location] = proxy.match(/^([0-9]+)?x([0-9]+)?\/(.*)$/) || [];
    if ((width || height) && location) {
      await generateThumbnail({ width: width && Number(width), height: height && Number(height), location });
      return {
        statusCode: 302,
        headers: {
          Location: `${Prefix}/${getDimensionKey({ width, height })}/${location}`,
        },
      };
    }
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: e.message }),
    };
  }
  return {
    statusCode: 400,
    body: JSON.stringify({
      message: 'Go Serverless v1.0! Your function executed successfully!',
      input: event,
    }),
  };
};

Object.assign(module.exports, { generate, hello });
