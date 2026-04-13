const path = require("path");
const Module = require("module");

const backendNodeModules = path.resolve(__dirname, "node_modules");

process.env.NODE_PATH = process.env.NODE_PATH
    ? `${process.env.NODE_PATH}${path.delimiter}${backendNodeModules}`
    : backendNodeModules;

Module._initPaths();

require("./app.js");
