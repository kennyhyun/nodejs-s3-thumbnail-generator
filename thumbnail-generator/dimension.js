'use strict';
const probe = require('probe-image-size');
const { s3Client, getMetadata, updateMetadata } = require('./s3Client');

const { SOURCE_BUCKET_NAME: SourceBucketName = 'images' } = process.env;

const sourceS3Config = {
  Bucket: SourceBucketName,
};

const floor = f => Math.floor(f.toPrecision(15));

const calcHeight = ({ dimension: { width: w, height: h }, width }) => floor((width * h) / w);
const calcWidth = ({ dimension: { width: w, height: h }, height }) => floor((height * w) / h);

const getMaximumWithRatio = (dimension, ratio) => {
  const sourceRatio = dimension.width / dimension.height;
  if (sourceRatio > ratio) {
    return { height: dimension.height, width: floor(ratio * dimension.height) };
  }
  return { height: floor(dimension.width / ratio), width: dimension.width };
};

const getTargetDimension = ({ sourceDimension: dimension, width, height }) => {
  if (!(dimension.width && dimension.height)) {
    console.warn(`cannot get the source dimension, assuming as a square image`);
    return { width: width || height, height: height || width };
  }
  if (width && height) {
    if (dimension.width >= width && dimension.height >= height) {
      return { width, height };
    }
    const ratio = width / height;
    return getMaximumWithRatio(dimension, ratio);
  } else if (width) {
    if (dimension.width >= width) return { width, height: calcHeight({ dimension, width }) };
    return { ...dimension };
  }
  if (dimension.height >= height) return { height, width: calcWidth({ dimension, height }) };
  return { ...dimension };
};

const querySourceDimension = async location => {
  try {
    const context = {};
    const promise = new Promise((resolve, reject) => {
      context.reject = reject;
    });
    const obj = await s3Client
      .headObject({ ...sourceS3Config, Key: location })
      .promise()
      .catch(() => ({}));
    const { Metadata: { width, height } = {} } = obj;
    if (width && height) return { width: Number(width), height: Number(height) };
    // get the meatadata
    const strm = s3Client
      .getObject({ ...sourceS3Config, Key: location }, err => {
        if (err) {
          context.reject(err);
        }
      })
      .createReadStream()
      .on('error', e => context.reject(e));
    const info = await Promise.race([probe(strm), promise]).catch(() => ({}));
    updateMetadata({
      options: { ...sourceS3Config, Key: location },
      Metadata: getMetadata(info),
      headObject: obj,
    }).catch(e => {
      console.error(e);
    });
    return info;
  } catch (e) {
    console.log('Error:', e.message);
    return {};
  }
};

Object.assign(module.exports, {
  querySourceDimension,
  getTargetDimension,
});
