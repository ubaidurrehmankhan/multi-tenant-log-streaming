FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
# GOOD: Use npm install (generates package-lock.json if missing)
# TODO: Generate and commit package-lock.json, then switch to npm ci for deterministic builds
RUN npm install
# GOOD: Copy tsconfig files for proper TypeScript compilation
COPY tsconfig*.json ./
# GOOD: Copy source files explicitly (needed for both build and migrations)
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
# Copy compiled JavaScript files
COPY --from=builder /app/dist ./dist
# CRITICAL: Copy src directory (TypeORM migrations need TypeScript source files)
# BAD: Not copying src would cause migrations to fail at runtime
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules ./node_modules
# GOOD: Copy tsconfig for ts-node (used by migration runner)
COPY --from=builder /app/tsconfig*.json ./
COPY package*.json ./
EXPOSE 3000
# CRITICAL: Run migrations before starting server (ensures schema is up-to-date)
# GOOD: Migrations fail-fast if DB schema is incompatible
CMD ["sh", "-c", "npm run migration:run && node dist/main.js"]
