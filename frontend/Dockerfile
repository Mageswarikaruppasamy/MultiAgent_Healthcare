FROM node:18-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --prefer-binary --include=dev

COPY . .

RUN npx vite build

RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]
