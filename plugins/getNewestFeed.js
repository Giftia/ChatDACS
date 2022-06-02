module.exports = {
  插件名: "最新本子插件",
  指令: "^[/!]?(最新本子|最新投稿|绅士仓库)$",
  版本: "1.0",
  作者: "Giftina",
  描述: "从 https://cangku.icu/feed 获取最新投稿",
  使用示例: "最新本子",
  预期返回: "[返回仓库的随机最新投稿]",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    return { type: "text", content: await getNewestFeed() };
  },
};

const Parser = require("rss-parser");
const rssParser = new Parser({
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36",
    "cookie": "_pk_id.5.5493=624755173cc9fa9a.1653387381.; remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d=eyJpdiI6ImtBbHBNMm1mUGpuWWpnbDVhNVQzbEE9PSIsInZhbHVlIjoibXA0aUZsRGdQdWFnNys1K2ozYmU0UEkwQ2hZRUQzVkI3aTZrazIyNmF2SzRHZjdRMW1WWEhzTzhTRVQzQkdcL09hRTZpSms1VGNpcUM4UFZURWNpNTdNYkJZSjdRSHlcL3JTZkIwekJnYlBrRE5MUk1yRGFzeWVMS0xxYmNNS3JjOUpKVDA4Mkx1NzZTY2tuQmxXbWhTUjlDM2c4V3YwcEtVc0FId2crRDlaTkU9IiwibWFjIjoiYjE5YTQ1YjIwNDgzZDJhMjBjMzFjNjE4YzRkNWUwOGUxOWNhNTgxNDdlMzlkZGM5ZTYxNmQyMDgwN2Y4MTRkYyJ9; XSRF-TOKEN=eyJpdiI6ImRqVmRQcHgrUGxTWTErOHZJTHVNRHc9PSIsInZhbHVlIjoielphRWpYb3FZQTFyWm1EZ09rR2txaGZSZG9mdWZwcjJPRTltRTNMXC9KZDJva3RCODB4a0tHMDJsQlNKM0k0RGgiLCJtYWMiOiI1MGRmNzM1MDYyZTQwYzMzZTc1ZDM4MGI3MDIzZjVmMDFlODQyZjliMmU5YmY2YjZjNDYzNmM5MzY0ZjI2MTkxIn0%3D; cangku_laravel_session=eyJpdiI6InNMMXZUbTNZbG5saWQza1FhTHVRM2c9PSIsInZhbHVlIjoiMVAxT1YzUlRyWmdjZGJLQTRZdVJIcUJHWkx4Y1o0XC9wYmJmQ3FxNlR3d2d5WllnSzJQK1dRS1RSUnVSR2FDaisiLCJtYWMiOiJiMjVhYmE4ZDliOWJhNjAxMjQ5MjkxMDFlNDY2OWNiNTlmNTNlMzY0NGYwNjczYTRlMDRmNWJjZTIzOWIwYjg0In0%3D",
  },
});

/**
 * 从 https://cangku.icu/feed 获取最新投稿
 */
async function getNewestFeed() {
  const feed = await rssParser.parseURL("https://cangku.icu/feed");
  //随机返回一个feed.items
  const item = feed.items[Math.floor(Math.random() * feed.items.length)];
  const title = item.title;
  //介绍预览，截取前50个字符
  const description = item.contentSnippet.slice(0, 50) + "...";
  const link = item.link;

  const result = `${title}
预览：${description}

${link}`;

  return result;
}
