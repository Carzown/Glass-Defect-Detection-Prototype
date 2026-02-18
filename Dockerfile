FROM node:20-alpine

WORKDIR /app

# Copy Backend source directly to /app (flatten structure)
COPY Backend/ ./

# Verify files are present
RUN test -f package.json || (echo "ERROR: package.json not found!" && exit 1)

# Install dependencies
RUN npm install --legacy-peer-deps

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "server.js"]
