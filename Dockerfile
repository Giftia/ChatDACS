# Build
FROM node:26.13.0-bookworm AS build

WORKDIR /opt/chatdacs

COPY . .

RUN npm ci --omit=dev

# Run

FROM node:26.13.0-bookworm

WORKDIR /opt/chatdacs

COPY --from=build /opt/chatdacs ./

EXPOSE 80

CMD ["node", "index.js"]
