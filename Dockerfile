FROM node:18

# Crear directorio de trabajo
WORKDIR /usr/src/app

# Instalar dependencias
COPY package*.json ./
RUN npm install --only=production

# Copiar el resto del código
COPY . .

# Exponer el puerto que usa Cloud Run (8080 por defecto)
EXPOSE 8080

# Comando para arrancar la app
CMD [ "npm", "start" ]