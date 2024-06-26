FROM node:18
ENV TZ Europe/Paris
COPY ./api /home/node/app/api
# Will be replaced in /home/node/app/api/public during deployment
COPY ./api/public /tmp/public
WORKDIR /home/node/app/api
RUN npm install --no-bin-links
CMD ["node", "api.js"]
