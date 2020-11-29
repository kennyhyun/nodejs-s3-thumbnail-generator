'use strict';
const sharp = require('sharp');
const path = require('path');
const config = require('dotenv').config();
const Stream = require('stream');

const { getTargetDimension, getSourceDimension } = require('./dimension');
const { s3Client } = require('./s3Client');

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

const getTargetStream = ({ context, width, height, location }) => {
  const dimensionKey = getDimensionKey({ width, height });
  const thumbKey = `${dimensionKey}/${location}`;
  const stream = new Stream.PassThrough().on('error', err => context.reject(err));
  return {
    stream,
    thumbKey,
    promise: s3Client.upload({ ...targetS3Config, Key: thumbKey, Body: stream }).promise(),
  };
};

const getSourceStream = ({ location, context }) =>
  s3Client
    .getObject({ ...sourceS3Config, Key: location }, (err, data) => {
      if (err) {
        context.reject(err);
      }
    })
    .createReadStream()
    .on('error', e => context.reject(e));

const createTargetBucket = context => {
  // create bucket async
  s3Client.createBucket({ Bucket: TargetBucketName, CreateBucketConfiguration: { LocationConstraint: Region } }, e => {
    if (e && e.code !== 'BucketAlreadyOwnedByYou') {
      context.reject(new Error(`Failed to create the bucket: ${e.message}`));
    }
  });
};

const generateThumbnail = async ({ width, height, location }) => {
  const context = {};
  const promise = new Promise((resolve, reject) => {
    context.reject = reject;
  });
  const sourceDimension = await getSourceDimension(location);
  const targetDimension = width && height ? { width, height } : getTargetDimension({ width, height, sourceDimension });
  createTargetBucket(context);
  const inputStream = getSourceStream({ context, location });
  const transform = sharp()
    .rotate()
    .resize(targetDimension)
    .jpeg({ quality: 80 });
  const { thumbKey, stream: outputStream } = getTargetStream({ context, ...targetDimension, location });
  inputStream.pipe(transform).pipe(outputStream);
  return Promise.race([
    new Promise((resolve, reject) => {
      inputStream.on('finish', () => resolve(thumbKey));
      inputStream.on('close', () => resolve(thumbKey));
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
    if ((!width && !height) || !location) return { statusCode: 400 };
    if (!(width && height)) {
      const sourceDimension = await getSourceDimension(location);
      const { width: tWidth, height: tHeight } = getTargetDimension({ width, height, sourceDimension });
      return {
        statusCode: 307,
        headers: {
          Location: path.join(Prefix, `${tWidth}x${tHeight}`, location),
        },
      };
    }
    const key = await generateThumbnail({ width: width && Number(width), height: height && Number(height), location });
    return {
      statusCode: 302,
      headers: {
        Location: path.join(Prefix, key),
      },
    };
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: e.message }),
    };
  }
};

Object.assign(module.exports, { generate, hello });
