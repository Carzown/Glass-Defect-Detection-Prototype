FROM node:20-alpine

# Copy entire repo to /app
COPY . /app

# Install dependencies from Backend directory
WORKDIR /app/Backend
RUN npm install --legacy-peer-deps

# Copy .env for production environment (contains Supabase credentials, overridable via ENV variables)
COPY Backend/.env .env

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
