# GOOD: Multi-stage build for optimized production image
FROM node:20-alpine AS builder

WORKDIR /app

# CRITICAL: Accept API URL as build argument (Vite embeds env vars at build time)
# BAD: Setting env vars at runtime won't work with Vite (static build)
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copy package files
COPY package*.json ./

# Install dependencies
# GOOD: Use npm install (generates package-lock.json if missing)
# TODO: Generate and commit package-lock.json, then switch to npm ci for deterministic builds
RUN npm install

# Copy source files
COPY . .

# Build the application
# GOOD: VITE_API_URL is baked into the bundle at this step
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
