require("dotenv").config();

const { server } = require("./app");
const config = require("./app/config");
const MongoDB = require("./app/utils/mongodb.util");
const RbacService = require("./app/services/rbac.service");

async function startServer() {
  try {
    await MongoDB.connect(config.db.uri);
    console.log("Connected to the database!");
    await new RbacService(MongoDB.client).ensureDefaults();
    console.log("RBAC defaults are ready!");

    const PORT = config.app.port;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Cannot connect to the database:", error);
    process.exit();
  }
}

startServer();
