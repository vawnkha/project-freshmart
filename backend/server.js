require("dotenv").config();

const { server } = require("./app");
const config = require("./app/config");
const MongoDB = require("./app/utils/mongodb.util");
const RbacService = require("./app/services/rbac.service");
const { ensureMongoIndexes } = require("./app/database/indexes");
const { validateRuntimeConfig } = require("./app/config/security");
const { startOutboxWorker } = require("./app/workers/outbox.worker");
const { startPaypalReconciliationWorker } = require("./app/workers/paypal-reconciliation.worker");

async function startServer() {
  try {
    validateRuntimeConfig();
    await MongoDB.connect(config.db.uri);
    console.log("Connected to the database!");
    await ensureMongoIndexes(MongoDB.client);
    console.log("MongoDB indexes are ready!");
    await new RbacService(MongoDB.client).ensureDefaults();
    console.log("RBAC defaults are ready!");
    startOutboxWorker(MongoDB.client);
    require("./app/workers/expiry.worker").startExpiryWorker(MongoDB.client);
    if (process.env.PAYPAL_RECONCILIATION_ENABLED === "true") startPaypalReconciliationWorker(MongoDB.client);

    const PORT = config.app.port;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Cannot connect to the database:", error);
    process.exitCode = 1;
  }
}

startServer();
