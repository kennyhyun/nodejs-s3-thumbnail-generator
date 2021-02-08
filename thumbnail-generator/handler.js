'use strict';
const dotenv = require('dotenv');
const sharp = require('sharp');
const path = require('path');
const axios = require('axios');

const { STAGE = '' } = process.env;
const suffix = STAGE ? `.${STAGE}` : '';
const { error: envError } = dotenv.config({ path: path.resolve(process.cwd(), `.env${suffix}`) });
if (envError) {
  console.log('WARN: Trying to load .env due to', envError.message);
  const { error } = dotenv.config();
  if (error) console.log('WARN:', error.message);
}

const { getTargetDimension, querySourceDimension } = require('./dimension');
const {
  headObject,
  writeStreamToSourceBucket,
  createTargetBucket,
  getSourceStream,
  getTargetStream,
  headSourceObject,
} = require('./s3Client');

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

const MIME_JPEG = 'image/jpeg';
const MIME_PNG = 'image/png';
const MimeMap = {
  jpg: MIME_JPEG,
  jpeg: MIME_JPEG,
  png: MIME_PNG,
};

const getContentType = (filename = '') => {
  const [ext = ''] = filename.split('.').slice(-1);
  const type = MimeMap[ext.toLowerCase()];
  if (!type) throw new Error(`Mime type for ${ext} was not found`);
  return type;
};

const generateThumbnail = async ({ sourceDimension, width, height, location }) => {
  const context = {};
  const promise = new Promise((resolve, reject) => {
    context.reject = reject;
  });
  const targetDimension = width && height ? { width, height } : getTargetDimension({ width, height, sourceDimension });
  createTargetBucket(context);
  const transform = sharp()
    .rotate()
    .resize(targetDimension)
    .jpeg({ quality: 80 });

  const returnKey = await Array(3)
    .fill()
    .reduce(async (success, _, retryCount) => {
      const ret = await success.catch(e => {
        console.warn('Resize Error:', e.message, 'Retrying', retryCount);
        return null;
      });
      if (ret) return ret;
      const inputStream = getSourceStream({ context, location });
      const { thumbKey, stream: outputStream } = getTargetStream({ context, ...targetDimension, location });
      const converterStream = inputStream.pipe(transform);
      converterStream.pipe(outputStream);
      return Promise.race([
        new Promise((resolve, reject) => {
          outputStream.on('finish', () => resolve(thumbKey));
          outputStream.on('close', () => resolve(thumbKey));
          inputStream.on('error', e => reject(e));
          outputStream.on('error', e => reject(e));
          converterStream.on('error', e => reject(e));
        }),
        promise,
      ]);
    }, Promise.resolve());
  return returnKey;
};

const Prefix = '/thumbnails';
const DuplicatePrefix = '/images';

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
    const key = await generateThumbnail({
      sourceDimension,
      width: width && Number(width),
      height: height && Number(height),
      location,
    });
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

const duplicate = async event => {
  try {
    const {
      pathParameters: { proxy },
      queryStringParameters: { duplicate },
    } = event;
    if (duplicate) {
      try {
        const contentType = getContentType(proxy);
        const head = await headSourceObject({ key: proxy }).catch(() => {});
        if (head && head.ContentLength) {
          console.log('Skipping dupliate exising file', proxy, head.ContentLength);
        } else {
          const { data } = await axios({
            method: 'get',
            url: duplicate,
            responseType: 'stream',
          });
          await writeStreamToSourceBucket({ stream: data, key: proxy, url: duplicate, contentType }).catch(
            console.warn
          );
        }
      } catch (e) {
        console.warn(e.message);
      }
    }
    return {
      statusCode: 301,
      headers: {
        Location: path.join(DuplicatePrefix, proxy),
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

Object.assign(module.exports, { generate, duplicate, hello });
