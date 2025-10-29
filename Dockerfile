# ----------------------------------------------------------------------------
# 1. Build Stage: Compiles the application and builds native modules
# ----------------------------------------------------------------------------
FROM node:20.16.0-slim AS build

# Install necessary build dependencies for native modules (e.g., bcrypt)
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential python3 make g++ && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev) with cache
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Rebuild bcrypt to ensure correct binary for target image (only if installed)
RUN npm ls bcrypt >/dev/null 2>&1 && npm rebuild bcrypt --build-from-source || true

# Copy application source code
COPY . .

# Generate Prisma Client and build TypeScript/JavaScript code
RUN npx prisma generate && \
    npm run build 

# ----------------------------------------------------------------------------
# 2. Production Stage: Smaller runtime image with only necessary files
# ----------------------------------------------------------------------------
FROM node:20.16.0-slim AS production

# Install runtime dependencies (fewer than build stage)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libssl3 ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# 1. Copy package files (needed for tools that check dependencies)
COPY --from=build /usr/src/app/package*.json ./

# 2. Copy the node_modules from the build stage (native modules built correctly)
COPY --from=build /usr/src/app/node_modules ./node_modules

# 3. Prune dev dependencies
RUN npm prune --production

# 4. Copy built code and prisma folder
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma

EXPOSE 8081
EXPOSE 8084

# Deploy migrations, then start the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]