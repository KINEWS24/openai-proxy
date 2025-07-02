# Dockerfile für einfachen Node.js Express Proxy

FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD [ "node", "index.js" ]
