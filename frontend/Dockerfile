# Stage 1: Build the app
FROM node:18-slim AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# Build using npx to ensure proper execution
RUN npx vite build

# Stage 2: Serve the app
FROM node:18-slim

# Install serve globally
RUN npm install -g serve

WORKDIR /app

# Copy the built files from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
