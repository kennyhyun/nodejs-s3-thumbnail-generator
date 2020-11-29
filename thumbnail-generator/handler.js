'use strict';
const sharp = require('sharp');
const path = require('path');
require('dotenv');

const { getTargetDimension, querySourceDimension } = require('./dimension');
const { createTargetBucket, getSourceStream, getTargetStream } = require('./s3Client');

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

const generateThumbnail = async ({ width, height, location }) => {
  const context = {};
  const promise = new Promise((resolve, reject) => {
    context.reject = reject;
  });
  const sourceDimension = await querySourceDimension(location);
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
      outputStream.on('finish', () => resolve(thumbKey));
      outputStream.on('close', () => resolve(thumbKey));
      inputStream.on('error', e => reject(e));
      outputStream.on('error', e => reject(e));
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
      const sourceDimension = await querySourceDimension(location);
      const { width: tWidth, height: tHeight } = getTargetDimension({ width, height, sourceDimension });
      return {
        statusCode: 301,
        headers: {
          Location: path.join(Prefix, `${tWidth}x${tHeight}`, location),
        },
      };
    }
    const key = await generateThumbnail({ width: width && Number(width), height: height && Number(height), location });
    console.log('resolved');
    return {
      statusCode: 301,
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
