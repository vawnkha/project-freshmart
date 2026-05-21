const RbacService = require("../../services/rbac.service");

async function seedDefaults(client) {
  const rbacService = new RbacService(client);
  await rbacService.ensureDefaults();

  return {
    rbac: true,
  };
}

module.exports = {
  seedDefaults,
};
