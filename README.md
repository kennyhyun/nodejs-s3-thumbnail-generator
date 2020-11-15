# nodejs-s3-thumbnail-generator

A CDN solution using AWS S3 and Lambda

![prod system](https://raw.githubusercontent.com/kennyhyun/nodejs-s3-thumbnail-generator/main/AWS%20thumnail%20CDN%20solution%20-%20aws%20infra%20for%20thumbnails.svg)

![dev system](https://raw.githubusercontent.com/kennyhyun/nodejs-s3-thumbnail-generator/main/nginx%20front%20for%20thumbnails%20-%20test%20env%20for%20aws.svg)

This is still in progress

## Goal

- [ ] Provide Prod solution via Amazon Marketplace
- [ ] Provide Dev environment same as prod environment (from the view point of frontend and thumbnail generator)

## Generator API

- Use Sharp library
  - use stream to download and upload the images
- On the fly generation with the width and/or height provided
- The generator Lambda can be customised and updated

## TODOs

- Dev env
  - [ ] docker-compose with traefik
  - [ ] minio
  - [ ] nginx with 307 redirect
  - [ ] serverless offline generator in docker
    - `${width}x${height}`
    - `x${height}`
    - `${width}x`
- Prod env
  - [ ] cloudformation
