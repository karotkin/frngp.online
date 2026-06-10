# Статика frngp.online за nginx
FROM nginx:1.27-alpine

# htpasswd для basic-auth
RUN apk add --no-cache apache2-utils

# конфиг сайта
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# хук генерации .htpasswd из env при старте контейнера
COPY nginx/40-htpasswd.sh /docker-entrypoint.d/40-htpasswd.sh
RUN chmod +x /docker-entrypoint.d/40-htpasswd.sh

# контент
WORKDIR /usr/share/nginx/html
COPY index.html styles.css favicon.svg ./
COPY *.jsx ./
COPY uploads/ ./uploads/
COPY screenshots/ ./screenshots/

EXPOSE 80
