# Stage 1: Build the app
FROM node:18-slim AS builder

WORKDIR /app

# Install global Vite so it's executable
RUN npm install -g vite

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# Build the production files
RUN vite build

# Stage 2: Serve the app
FROM node:18-slim

# Install serve globally
RUN npm install -g serve

WORKDIR /app

# Copy the built files from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
