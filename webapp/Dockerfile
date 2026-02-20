FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Runtime stage: copy built files to the bind-mounted volume at startup
FROM alpine:3.19
COPY --from=build /app/dist /build
CMD ["cp", "-r", "/build/.", "/app/dist/"]
