# Use the official Node.js image with Alpine for a smaller footprint
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built artifacts from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Expose the port (Cloud Run sets PORT env var, defaults to 8080)
EXPOSE 8080

# Start the application
CMD ["node", "dist/index.js"]
