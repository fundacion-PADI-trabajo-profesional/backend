FROM node:22

WORKDIR /app

# Copiar todo el source (necesario para resolver la dependencia file:.. del workspace)
COPY . .

# Instalar dependencias raíz
RUN npm install

# Instalar dependencias de functions (el postinstall ya corre prisma generate con una URL dummy)
RUN npm install --prefix functions

# Compilar TypeScript (src/ → lib/)
RUN npm run build --prefix functions

EXPOSE 8080

CMD ["node", "functions/lib/server.local.js"]