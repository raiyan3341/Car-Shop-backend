// encode.js
const fs = require("fs");
const key = fs.readFileSync("./assignment-10-bb401-firebase-adminsdk-fbsvc-755194efa8.json", "utf8");
const base64 = Buffer.from(key).toString("base64");
console.log(base64);