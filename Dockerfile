FROM node:20-alpine

WORKDIR /app

# Copy Backend folder specifically
COPY Backend/ ./Backend/

# Install backend dependencies
RUN cd Backend && npm install --legacy-peer-deps --no-optional || npm install --legacy-peer-deps

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Expose port (API + WebSocket on same port)
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start backend server from Backend directory
WORKDIR /app/Backend
CMD ["node", "server.js"]
