FROM node:6.9.3
ENV TZ Europe/Paris
COPY ./api /home/node/app/api
# Will be replaced in /home/node/app/api/public during deployment
COPY ./api/public /tmp/public
WORKDIR /home/node/app/api
RUN npm install
CMD ["node", "api.js"]