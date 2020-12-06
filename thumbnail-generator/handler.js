'use strict';
const dotenv = require('dotenv');
const sharp = require('sharp');
const path = require('path');

const { STAGE = '' } = process.env;
const suffix = STAGE ? `.${STAGE}` : '';
const { error: envError } = dotenv.config({ path: path.resolve(process.cwd(), `.env${suffix}`) });
if (envError) {
  console.log('WARN: Trying to load .env due to', envError.message);
  const { error } = dotenv.config();
  if (error) console.log('WARN:', error.message);
}

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
    if (!(location && (width || height))) return { statusCode: 400 };
    const sourceDimension = await querySourceDimension(location);
    const { width: tWidth, height: tHeight } = getTargetDimension({ width, height, sourceDimension });
    if (tWidth !== width || tHeight !== height)
      return {
        statusCode: 301,
        headers: {
          Location: path.join(Prefix, `${tWidth}x${tHeight}`, location),
        },
      };
    const key = await generateThumbnail({ width: width && Number(width), height: height && Number(height), location });
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
