# ============================================================================
# Stage 1: Build Frontend
# ============================================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/Frontend

# Copy only package files (cache layer)
COPY Frontend/package*.json ./

# Install dependencies (cached unless package files change)
RUN npm ci --legacy-peer-deps

# Copy source code
COPY Frontend/src ./src
COPY Frontend/public ./public

# Build frontend (this will be cached unless src/public changes)
RUN npm run build

# ============================================================================
# Stage 2: Build Backend Dependencies  
# ============================================================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/Backend

# Copy only package files (cache layer)
COPY Backend/package*.json ./

# Install production dependencies only
RUN npm ci --legacy-peer-deps --omit=dev

# ============================================================================
# Stage 3: Production Runtime
# ============================================================================
FROM node:20-alpine

# Set working directory
WORKDIR /app/Backend

# Copy production dependencies from builder stage
COPY --from=backend-builder /app/Backend/node_modules ./node_modules

# Copy backend source code
COPY Backend/*.js ./

# Copy .env file (if present) - can be overridden by environment variables
COPY Backend/.env* ./

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/Frontend/build ../Frontend/build

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "server.js"]

