function log(event, details) {
  const time = new Date().toISOString();
  const extra =
    details === undefined
      ? ""
      : ` ${typeof details === "string" ? details : JSON.stringify(details)}`;
  console.log(`${time} ${event}${extra}`);
}

module.exports = { log };
