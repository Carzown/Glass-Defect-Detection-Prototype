FROM node:20-alpine

WORKDIR /app

# Copy backend package files
COPY Backend/package.json Backend/package-lock.json ./Backend/

# Install backend dependencies
WORKDIR /app/Backend
RUN npm ci --legacy-peer-deps

# Copy backend source code
COPY Backend/. ./

# Expose ports (API on PORT env var or 3000, WebSocket on 8080)
EXPOSE 3000 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000), (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
# The app runs on PORT env var (default 3000) 
# For WebSocket connections, ensure WS_PORT is set or use 8080
CMD ["npm", "start"]
