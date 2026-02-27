FROM node:20-alpine

# Copy entire repo to /app
COPY . /app

# Build Frontend
WORKDIR /app/Frontend
RUN npm install --legacy-peer-deps && npm run build

# Install Backend dependencies
WORKDIR /app/Backend
RUN npm install --legacy-peer-deps

# Copy .env for production environment (contains Supabase credentials, overridable via ENV variables)
COPY Backend/.env .env 2>/dev/null || true
# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "server.js"]
