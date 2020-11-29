FROM node:14.15.0-alpine3.12 as builder
RUN apk add python3 make g++

ENV NODE_ENV=test

WORKDIR /app

COPY package.json /app
COPY yarn.lock /app

RUN yarn

FROM node:14.15.0-alpine3.12
WORKDIR /app
COPY --from=builder /app/node_modules node_modules
#COPY . /app

COPY package.json /app/
COPY serverless.yml /app/
COPY thumbnail-generator/*.js /app/thumbnail-generator/

CMD [ "yarn", "run", "serverless", "offline" ]
