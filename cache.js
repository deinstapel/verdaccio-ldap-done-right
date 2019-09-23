class Cache {
  constructor(expiry, logger) {
    this.cache = new Map();
    this.logger = logger;
    this.expiry = expiry || 300000;
  }
  put(user, pw, groups) {
    const userEntry = this.cache.get(user);
    if (userEntry && userEntry.pw === pw) {
      userEntry.expiry = +Date.now() + this.expiry;
      userEntry.groups = groups;
      return;
    }
    this.cache.set(user, { pw, expiry: +Date.now() + this.expiry, groups });
  }

  get(user, pw) {
    const userEntry = this.cache.get(user);
    if (!userEntry) {
      return null;
    }
    if (userEntry.expiry < +Date.now()) {
      this.cache.delete(user);
      return null;
    }
    return userEntry.pw === pw ? userEntry.groups : null;
  }
}

module.exports = Cache;
