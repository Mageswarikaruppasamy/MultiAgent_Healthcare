FROM node:18-slim

# Install build dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install devDependencies too
RUN npm install

COPY . .

# Explicitly use local vite from node_modules
RUN ./node_modules/.bin/vite build

# Install serve globally to run build
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]
