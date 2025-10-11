# Stage 1: Build the app
FROM node:18-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# Build the production files (Vite outputs to 'dist')
RUN npm run build

# Stage 2: Serve the app
FROM node:18-slim

# Install serve to run the build
RUN npm install -g serve

# Set working directory
WORKDIR /app

# Copy build output from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 3000

# Serve the app
CMD ["serve", "-s", "dist", "-l", "3000"]
