node:18-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci --prefer-binary

COPY . .

RUN npm run build

RUN npm install -g serve

EXPOSE 3000


CMD ["serve", "-s", "build", "-l", "3000"]