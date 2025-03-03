FROM node:22.12.0-slim

# Install required system dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg libssl3 python3 make g++ && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm i

# Rebuild bcrypt inside the container
RUN npm rebuild bcrypt --build-from-source

# Copy the rest of the application
COPY . .

# Build the TypeScript files
RUN npx prisma generate

# Expose the app's port
EXPOSE 8081

# Start the app
CMD ["npm", "run", "dev"]
