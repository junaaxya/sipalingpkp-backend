FROM node:18-alpine
WORKDIR /app
# Menyalin file package terlebih dahulu untuk optimasi cache
COPY package*.json ./
RUN npm install --production
# Menyalin seluruh kode sumber
COPY . .
EXPOSE 3000
CMD ["node", "src/app.js"]