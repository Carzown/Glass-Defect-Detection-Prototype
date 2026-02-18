FROM node:20-alpine

WORKDIR /app

# Copy entire repository
COPY . .

# Install backend dependencies
WORKDIR /app/Backend
RUN npm ci --legacy-peer-deps

# Set production environment
ENV NODE_ENV=production

# Expose ports (API on 5000, WebSocket on /ws endpoint)
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000), (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["npm", "start"]
