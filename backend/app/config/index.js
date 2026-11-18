const { read } = require("./environment");
module.exports = { app: { port: read("PORT") }, db: { uri: read("MONGODB_URI") } };
