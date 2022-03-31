module.exports = {
  "env": {
    "commonjs": true,
    "es2021": true,
    "node": true
  },
  "extends": "eslint:recommended",
  "parserOptions": {
    "ecmaVersion": "latest"
  },
  "rules": {
    "indent": [
      "warn",
      2
    ],
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
  }
};
