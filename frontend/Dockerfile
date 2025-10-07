FROM node:18-slim

WORKDIR /app

COPY package*.json ./

# Install all dependencies, including devDependencies
RUN npm install

COPY . .

# Build frontend
RUN npm run build

# Install serve globally to serve the build
RUN npm install -g serve

EXPOSE 3000

# Health check for Render
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

# Start serve
CMD ["serve", "-s", "build", "-l", "3000"]
