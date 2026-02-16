FROM node:20-alpine

WORKDIR /app

# Copy only package files (NOT node_modules)
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --legacy-peer-deps

# Copy source code (but not node_modules)
COPY backend/. ./

# Expose port
EXPOSE 8080

# Start server
CMD ["npm", "start"]
