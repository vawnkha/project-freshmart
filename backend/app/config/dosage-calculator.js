const { read } = require("./environment");
module.exports = Object.freeze({
  maxAreaM2: read("DOSAGE_MAX_AREA_M2"),
  maxDepthM: read("DOSAGE_MAX_DEPTH_M"),
  maxFeedWeightKg: read("DOSAGE_MAX_FEED_WEIGHT_KG"),
  maxPackages: read("DOSAGE_MAX_PACKAGES"),
  requestsPerMinute: read("DOSAGE_REQUESTS_PER_MINUTE"),
});
