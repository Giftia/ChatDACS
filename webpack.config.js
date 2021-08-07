'use strict';

var path = require('path');
var webpack = require('webpack');
let externals = _externals();
module.exports = {
    mode: 'production',
    entry: '.',
    externals: externals,
    // externals : { 
    //     sqlite3 : "commonjs sqlite3",
    // },
    target: 'node',
    output: {
        path: path.resolve(__dirname, '.'),
        filename: 'onServer.js'
    },
    node: {
        __dirname: true
    },
    module: {
        rules: [
            {
                use: {
                    loader: 'babel-loader',
                    options: {
                        plugins: [ BabelPlugin ],
                        presets: [['@babel/preset-env', {
                            "targets": {
                                "node": true
                            }
                        }]]
                    }
                },
                test: /\.js$/,
                //exclude: /node_modules/
            }
        ]
    },
    optimization: {
        minimize: true
    }
};

function _externals() {
    let manifest = require('./package.json');
    let dependencies = manifest.dependencies;
    let externals = {};
    for (let p in dependencies) {
        externals[p] = 'commonjs ' + p;
    }
    externals.sqlite3 = "commonjs sqlite3";
    console.log(externals);
    return externals;
}
