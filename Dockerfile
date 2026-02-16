FROM node:18.20.0-alpine

WORKDIR /app

# Copy all files
COPY . .

# Install backend dependencies with clean cache
WORKDIR /app/backend
RUN npm cache clean --force && npm ci --production --no-cache

# Expose port
EXPOSE 8080

# Start server
CMD ["npm", "start"]
