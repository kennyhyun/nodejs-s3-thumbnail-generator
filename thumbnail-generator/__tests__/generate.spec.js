const S3 = {
  upload: jest.fn().mockImplementation(({ Body }) => {
    setTimeout(() => Body.emit('close'), 100);
    return {
      promise: jest.fn().mockResolvedValue(),
    };
  }),
  headObject: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({
      AcceptRanges: 'bytes',
      LastModified: new Date('2020-11-15T12:28:49.000Z'),
      ContentLength: 84995,
      ETag: '"00000000000000000000000000000000-1"',
      ContentType: 'image/jpeg',
      Metadata: { width: '960', height: '540' },
    }),
  })),
  getObject: jest.fn().mockImplementation(() => ({
    createReadStream: jest.fn().mockImplementation(() => {
      const stream = {
        on: jest.fn(),
        pipe: jest.fn(),
      };
      stream.on.mockImplementation((method, cb) => {
        if (method === 'finish') setTimeout(cb, 1000);
        return stream;
      });
      stream.pipe.mockReturnValue(stream);
      return stream;
    }),
  })),
  createBucket: jest.fn(),
  copyObject: jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue(),
  })),
};

const mockS3 = ({ return: { headObject } = {} } = {}) => {
  jest.doMock('aws-sdk', () => ({
    S3: jest.fn().mockImplementation(() => ({
      ...S3,
      ...(headObject
        ? {
            headObject: jest.fn().mockImplementation(() => ({
              promise: jest.fn().mockResolvedValue(headObject),
            })),
          }
        : {}),
    })),
  }));
};

jest.doMock('probe-image-size', () =>
  jest.fn().mockResolvedValue({
    width: 960,
    height: 540,
  })
);

const event = proxy => ({
  pathParameters: { proxy },
});

describe('generate', () => {
  beforeEach(() => {
    jest.resetModules();
  });
  it('should return 400 error if no dimension provided', async () => {
    const { generate } = await import('../handler');
    const resp = await generate(event('foo/bar/image.jpg'));
    console.log(resp);
    expect(resp).toEqual(
      expect.objectContaining({
        statusCode: 400,
      })
    );
  });
  it('should return 500 if it fails to generate the thumbnail', async () => {
    jest.dontMock('aws-sdk');
    const { generate } = await import('../handler');
    const resp = await generate(event('32x32/image.jpg'));
    console.log(resp);
    expect(resp).toEqual(
      expect.objectContaining({
        statusCode: 500,
      })
    );
  });
  it('should return 301 after generating the thumbnail', async () => {
    mockS3();
    const { generate } = await import('../handler');
    const resp = await generate(event('32x32/image.jpg'));
    console.log(resp);
    expect(resp).toEqual(
      expect.objectContaining({
        statusCode: 301,
        headers: expect.objectContaining({ Location: '/thumbnails/32x32/image.jpg' }),
      })
    );
  });
  it('should return 301 with calculated size for width only requests', async () => {
    mockS3();
    const { generate } = await import('../handler');
    const resp = await generate(event('32x/image.jpg'));
    console.log(resp);
    expect(S3.copyObject).not.toBeCalled();
    expect(resp).toEqual(
      expect.objectContaining({
        statusCode: 301,
        headers: expect.objectContaining({ Location: '/thumbnails/32x18/image.jpg' }),
      })
    );
  });
  it('should update metadata when there is no metadata in the source', async () => {
    mockS3({
      return: {
        headObject: {
          Metadata: {},
        },
      },
    });
    const aws = await import('aws-sdk');
    const { generate } = await import('../handler');
    const resp = await generate(event('32x/image.jpg'));
    console.log(resp);
    expect(S3.copyObject).toBeCalledWith(expect.objectContaining({ Metadata: { width: '960', height: '540' } }));
    expect(resp).toEqual(
      expect.objectContaining({
        statusCode: 301,
        headers: expect.objectContaining({ Location: '/thumbnails/32x18/image.jpg' }),
      })
    );
  });
});
