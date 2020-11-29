# nodejs-s3-thumbnail-generator

A CDN solution using AWS S3 and Lambda

![prod system](https://raw.githubusercontent.com/kennyhyun/nodejs-s3-thumbnail-generator/main/AWS%20thumbnail%20CDN%20solution%20-%20aws%20infra%20for%20thumbnails.svg)

![dev system](https://raw.githubusercontent.com/kennyhyun/nodejs-s3-thumbnail-generator/main/AWS%20thumbnail%20CDN%20solution%20-%20dev%20env%20for%20aws.svg)

This is still in progress

## Goal

- [ ] Provide Prod solution via Amazon Marketplace
- [x] Provide Dev environment same as prod environment (from the view point of frontend and thumbnail generator)

Check the dev console in action!

https://user-images.githubusercontent.com/5399854/100533417-24bfea00-3258-11eb-85f7-c9b85288f507.png

## Generator API

- Use Sharp library
  - use stream to download and upload the images
- On the fly generation with the width and/or height provided
- The generator Lambda can be customised and updated

## TODOs

- Dev env
  - [x] docker-compose with traefik
  - [x] minio
  - [ ] nginx with 307 redirect
  - [x] serverless offline generator in docker
    - `${width}x${height}`
    - `x${height}`
    - `${width}x`
- Prod env
  - [ ] cloudformation
