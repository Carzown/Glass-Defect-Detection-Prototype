FROM node:20-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package.json backend/package-lock.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --legacy-peer-deps

# Copy backend source code
COPY backend/. ./

# Expose port
EXPOSE 8080

# Start server
CMD ["npm", "start"]
