FROM node:6.9.3

WORKDIR /app
COPY ../openradiation-api-github/api/package.json /app
RUN npm install
COPY ../openradiation-api-github /app
CMD ["node", "api/api.js"]