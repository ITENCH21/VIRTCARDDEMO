FROM nginx:1.25-alpine

# Удаляем дефолтную конфигурацию
RUN rm /etc/nginx/conf.d/default.conf

# Копируем нашу конфигурацию
COPY nginx.conf /etc/nginx/nginx.conf

# Создаем директории для статических файлов
RUN mkdir -p /static /media

# Устанавливаем права
RUN chown -R nginx:nginx /static /media

# Экспортируем порт
EXPOSE 80

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
