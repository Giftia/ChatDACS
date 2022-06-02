module.exports = {
  插件名: "猫语翻译器插件",
  指令: "^[/!]?喵嗷(.*)|^[/!]?猫语(.*)",
  版本: "2.0",
  作者: "Giftina",
  描述: "可以将文本加密为 `喵嗷呜` 格式的喵语，也可将喵语解密成原始文本。解密不需要猫语前缀，直接原样发送即可。原作 https://github.com/ezshine/chrome-extension-catroom",
  使用示例: "喵嗷嗷嗷嗷呜~嗷呜喵嗷喵嗷嗷~嗷嗷嗷~",
  预期返回: "喵~",

  execute: async function (msg, userId, userName, groupId, groupName, options) {
    if (msg.includes("猫语")) {
      const rawString = msg.replace(/^[/!]?猫语/, "")?.trim();
      return { type: "text", content: toBeast(rawString) };
    } else {
      return { type: "text", content: fromBeast(msg) };
    }
  },
};

/**
 * author: 大帅老猿
 * repository: https://github.com/ezshine/chrome-extension-catroom
 */
const beastDictArr = ["喵", "嗷", "呜", "~"];

function toBeast(rawStr) {
  let charArr = rawStr.split("");
  let unicodeHexStr = "";
  for (let i = 0; i < charArr.length; i++) {
    let charHexStr = charArr[i].charCodeAt(0).toString(16);
    while (charHexStr.length < 4) {
      charHexStr = "0" + charHexStr;
    }
    unicodeHexStr += charHexStr;
  }
  let k = 0;
  let unicodeHexStrArr = unicodeHexStr.split("");
  let beastStr = "";
  for (let i = 0; i < unicodeHexStrArr.length; i++) {
    let unicodeHexCharValue = parseInt("0x" + unicodeHexStrArr[i]);
    k = unicodeHexCharValue + (i % 0x10);
    if (k >= 0x10) {
      k = k - 0x10;
    }
    beastStr += beastDictArr[parseInt(k / 4)] + beastDictArr[(k % 4)];
  }
  return "喵嗷" + beastStr + "~";
}

function fromBeast(decoratedBeastStr) {
  let beastStr = decoratedBeastStr.substring(2, decoratedBeastStr.length - 1);
  let unicodeHexStr = "";
  let beastStrArr = beastStr.split("");
  for (let i = 0; i <= (beastStr.length - 2); i += 2) {
    let beastCharStr = "";
    let pos1 = 0;
    beastCharStr = beastStrArr[i];
    for (; pos1 <= 3; pos1++) {
      if (beastCharStr == beastDictArr[pos1]) {
        break;
      }
    }
    let pos2 = 0;
    beastCharStr = beastStrArr[i + 1];
    for (; pos2 <= 3; pos2++) {
      if (beastCharStr == beastDictArr[pos2]) {
        break;
      }
    }
    let k = (pos1 * 4) + pos2;
    let unicodeHexCharValue = k - (parseInt(i / 2) % 0x10);
    if (unicodeHexCharValue < 0) {
      unicodeHexCharValue += 0x10;
    }
    unicodeHexStr += unicodeHexCharValue.toString(16);
  }
  let rawStr = "";
  let start = 0;
  let end = 4;
  while (end <= unicodeHexStr.length) {
    let charHexStr = unicodeHexStr.substring(start, end);
    let charStr = String.fromCharCode(parseInt("0x" + charHexStr));
    rawStr += charStr;
    start += 4;
    end += 4;
  }
  return rawStr;
}
