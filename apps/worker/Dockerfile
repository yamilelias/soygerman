FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    WWEBJS_DATA_PATH=/data/wwebjs

WORKDIR /app
COPY package.json .npmrc ./
RUN npm install --omit=dev
COPY . .

EXPOSE 3001
CMD ["node", "index.js"]
