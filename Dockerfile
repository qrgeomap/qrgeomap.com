FROM node:18-alpine as builder

# Crear el directorio de trabajo
WORKDIR /app

# Instalar Ionic CLI y Angular CLI globalmente dentro del contenedor
RUN npm install -g @ionic/cli @angular/cli
#RUN npm install @angular-devkit/build-angular --force

# Copiar los archivos de dependencias primero (mejora la caché de Docker)
COPY package*.json ./

# Instalar las dependencias
RUN npm install

# Copiar el resto del proyecto
COPY . .

# Exponer el puerto que usará Ionic
EXPOSE 8100

# Comando para iniciar la aplicación
CMD ["ionic", "serve", "--host", "0.0.0.0", "--port", "8100"]
