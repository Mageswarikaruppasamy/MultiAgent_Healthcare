FROM node:18-slim

WORKDIR /app

# Copy only package.json and package-lock.json for dependency caching
COPY package*.json ./

# Install dependencies (this will create node_modules)
RUN npm install

# Copy all other files after dependencies
COPY . .

# Make vite explicitly executable (if local)
RUN chmod +x ./node_modules/.bin/vite

# Build frontend
RUN npx vite build

# Install serve globally
RUN npm install -g serve

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
