const mockS3 = () => {
  jest.doMock('aws-sdk', () => ({
    S3: jest.fn().mockImplementation(() => ({
      upload: jest.fn().mockImplementation(({ Body }) => {
        setTimeout(() => Body.emit('close'), 100);
        return {
          promise: jest.fn().mockResolvedValue(),
        };
      }),
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
    })),
  }));
};

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
  it('should return 302 after generating the thumbnail', async () => {
    mockS3();
    const { generate } = await import('../handler');
    const resp = await generate(event('32x32/image.jpg'));
    console.log(resp);
    expect(resp).toEqual(
      expect.objectContaining({
        statusCode: 302,
        headers: expect.objectContaining({ Location: '/thumbnails/32x32/image.jpg' }),
      })
    );
  });
});
