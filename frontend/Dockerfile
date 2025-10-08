FROM node:18-slim

# Install build dependencies
RUN apt-get update && apt-get install -y \
    git curl build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# Install devDependencies so vite is available
RUN npm install --legacy-peer-deps

COPY . .

# Ensure vite binary is executable
RUN chmod +x ./node_modules/.bin/vite

# Run build
RUN npx vite build

# Install serve to run build
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]
