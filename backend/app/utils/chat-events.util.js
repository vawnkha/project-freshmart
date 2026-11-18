let publisher = null;
function setChatPublisher(value) { publisher = value; }
async function emitChat(event, payload, customerId, except) {
  if (publisher) await publisher(event, payload, String(customerId), except);
}
module.exports = { setChatPublisher, emitChat };
