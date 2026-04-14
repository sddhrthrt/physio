FROM node:alpine
WORKDIR /app
COPY server.js .
COPY public ./public
EXPOSE 3000
CMD ["node", "server.js"]
