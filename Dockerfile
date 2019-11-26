FROM node:6.9.3

WORKDIR /app
COPY api/package.json /app
RUN npm install
COPY . /app
CMD ["node", "api/api.js"]