FROM node:20-alpine

WORKDIR /app

# Copy all files
COPY . .

# Install backend dependencies
WORKDIR /app/backend
RUN npm install --production

# Expose port
EXPOSE 8080

# Start server
CMD ["npm", "start"]
