FROM node:22-slim
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --omit=dev
COPY backend/src ./src
ENV NODE_ENV=production DB_PATH=/data/musicroom.db LOG_DIR=/data/logs
VOLUME /data
EXPOSE 4000
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.js"]
