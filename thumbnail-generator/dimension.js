const probe = require('probe-image-size');
const { s3Client } = require('./s3Client');

const {
  SOURCE_BUCKET_NAME: SourceBucketName = 'images',
} = process.env;

const sourceS3Config = {
  Bucket: SourceBucketName,
};

const floor = f => Math.floor(f.toPrecision(15));
const calcHeight = ({ dimension: { width: w, height: h }, width }) => floor((width * h) / w);
const calcWidth = ({ dimension: { width: w, height: h }, height }) => floor((height * w) / h);

const getTargetDimension = ({ sourceDimension: dimension, width, height }) => {
  if (!(dimension.width && dimension.height)) {
    console.warn(`cannot get the source dimension, assuming as a square image`);
    return { width: width || height, height: height || width };
  }
  if (width && height) {
    return { width, height };
  } else if (width) {
    return { width, height: calcHeight({ dimension, width }) };
  }
  return { height, width: calcWidth({ dimension, height }) };
};

const getSourceDimension = async location => {
  try {
    const context = {};
    const promise = new Promise((resolve, reject) => {
      context.reject = reject;
    });
    const obj = (await s3Client.headObject({ ...sourceS3Config, Key: location }).promise()) || {};
    const {
      Metadata: { width, height },
    } = obj;
    if (width && height) return { width: Number(width), height: Number(height) };
    const strm = s3Client
      .getObject({ ...sourceS3Config, Key: location }, (err, data) => {
        if (err) {
          context.reject(err);
        }
      })
      .createReadStream()
      .on('error', e => context.reject(e));
    const info = await Promise.race([probe(strm), promise]).catch(() => ({}));
    // TODO: update meta asyncronously
    return info;
  } catch (e) {
    console.log('Error:', e.message);
    return {};
  }
};

Object.assign(module.exports, {
  getSourceDimension,
  getTargetDimension,
});
