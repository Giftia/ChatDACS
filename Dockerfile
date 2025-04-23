# Build
FROM node:22 as build

WORKDIR /opt/chatdacs

COPY . .

RUN npm ci --production &&
  rm package.json &&
  rm package-lock.json &&
  rm ./plugins/go-cqhttp/go-cqhttp_windows_amd64.exe &&
  rm ./plugins/go-cqhttp/go-cqhttp.bat &&
  cd ./plugins/ &&
  npm ci --production &&
  rm package.json &&
  rm package-lock.json

# Run

FROM node:22

WORKDIR /opt/chatdacs

COPY --from=build /opt/chatdacs ./

EXPOSE 80

CMD node .
