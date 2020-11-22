import { generate } from '../handler';

const event = proxy => ({
  pathParameters: { proxy },
});

describe('generate', () => {
  it('should return 400 error if no dimension provided', async () => {
    const resp = await generate(event('foo/bar/image.jpg'));
    expect(resp).toEqual(
      expect.objectContaining({
        statusCode: 400,
      })
    );
  });
  it('should return 500 if it fails to generate the thumbnail', async () => {
    const resp = await generate(event('32x32/image.jpg'));
    expect(resp).toEqual(
      expect.objectContaining({
        statusCode: 500,
      })
    );
  });
});

describe('generate with mock AWS SDK', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('aws-sdk', () => ({
      S3: jest.fn().mockImplementation(() => ({
        upload: jest.fn().mockImplementation(({ Body }) => {
          setTimeout(() => Body.emit('close'), 100);
          return {
            promise: jest.fn().mockResolvedValue(),
          };
        }),
        getObject: jest.fn().mockImplementation(() => ({
          createReadStream: jest.fn(),
        })),
        createBucket: jest.fn().mockImplementation(() => ({
          promise: jest.fn().mockResolvedValue(),
        })),
      })),
    }));
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should return 302 after generating the thumbnail', async () => {
    const { generate: mockGenerate } = await import('../handler');
    const resp = await mockGenerate(event('32x32/image.jpg'));
    expect(resp).toEqual(
      expect.objectContaining({
        statusCode: 302,
        headers: expect.objectContaining({ Location: '/thumbnails/32x32/image.jpg' }),
      })
    );
  });
});
