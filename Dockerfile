# Build
FROM node:14 as build

WORKDIR /opt/chatdacs

COPY . .

RUN npm ci --production \
  && rm ./plugins/go-cqhttp/go-cqhttp_windows_amd64.exe \
  && rm ./plugins/go-cqhttp/go-cqhttp.bat \
  && cd ./plugins/ \
  && npm ci --production \
  && rm package.json \
  && rm package-lock.json

# Run

FROM node:14

WORKDIR /opt/chatdacs

COPY --from=build /opt/chatdacs ./

EXPOSE 80

CMD node .