# Single image: builds the React client, serves it from the Express server.
FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci || npm install
COPY client ./
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json server/
RUN cd server && (npm ci --omit=dev || npm install --omit=dev)
COPY server server
COPY --from=client /app/client/dist client/dist
EXPOSE 4000
CMD ["node", "server/src/index.js"]
