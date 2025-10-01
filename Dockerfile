# Use a lightweight Node image
FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the code
COPY . .

# Expose port (must match the one your app uses)
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
