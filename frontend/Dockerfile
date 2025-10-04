FROM node:18-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --prefer-binary

COPY . .

RUN npm run build

RUN npm install -g serve

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

CMD ["serve", "-s", "build", "-l", "3000"]

