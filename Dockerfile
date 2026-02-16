FROM node:18.20.0-alpine

WORKDIR /app

# Copy root package files
COPY package.json package-lock.json* ./

# Copy backend folder
COPY backend ./backend

# Install backend dependencies
WORKDIR /app/backend
RUN npm install --production --legacy-peer-deps

# Expose port
EXPOSE 8080

# Start server
CMD ["npm", "start"]
