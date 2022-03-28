"use strict";

const path = require("path");
const externals = _externals();

module.exports = {
  mode: "production",
  entry: ".",
  externals: externals,
  // externals : { 
  //     sqlite3 : "commonjs sqlite3",
  // },
  target: "node",
  output: {
    path: path.resolve(__dirname, "."),
    filename: "onServer.js"
  },
  node: {
    __dirname: true
  },
  module: {
    rules: [
      {
        use: {
          loader: "babel-loader",
          options: {
            presets: [["@babel/preset-env", {
              "targets": {
                "node": true
              }
            }]]
          }
        },
        test: /\.js$/,
        exclude: path.resolve(__dirname, "node_modules/")
      }
    ]
  },
  optimization: {
    minimize: true
  }
};

function _externals() {
  const manifest = require("./package.json");
  const dependencies = manifest.dependencies;
  let externals = {};
  for (let p in dependencies) {
    externals[p] = "commonjs " + p;
  }
  externals.sqlite3 = "commonjs sqlite3";
  console.log(externals);
  return externals;
}
