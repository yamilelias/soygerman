FROM node:22-bookworm-slim

ENV BAILEYS_DATA_PATH=/data/baileys

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

EXPOSE 3001
CMD ["node", "index.js"]
