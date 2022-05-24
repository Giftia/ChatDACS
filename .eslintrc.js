module.exports = {
  "parserOptions": {
    "ecmaVersion": "latest"
  },
  "rules": {
    "linebreak-style": [
      "warn",
      "windows"
    ],
    "quotes": [
      "error",
      "double"
    ],
    "semi": [
      "error",
      "always"
    ],
    "no-unused-vars": "warn",
    "node/shebang": "off",
  },
  "extends": [
    "eslint:recommended",
    "plugin:node/recommended",
    "prettier"
  ],
};
