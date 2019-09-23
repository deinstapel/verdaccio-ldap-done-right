class Deferred {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

class Pool {
  constructor(factory, limit) {
    this.idleInstances = [];
    this.allInstances = [];
    this.waitings = [];
    this.factory = factory;
    this.limit = limit;
  }

  getInstance() {
    if (this.allInstances.length < this.limit) {
      const instance = this.factory();
      this.allInstances.push(instance);
      return Promise.resolve(instance);
    }
    if (this.idleInstances.length > 0) {
      const inst = this.idleInstances.shift();
      return Promise.resolve(inst);
    }
    const d = new Deferred();
    this.waitings.push(d);
    return d.promise;
  }

  putBack(instance) {
    if (this.allInstances.findIndex(j => j === instance) === -1) {
      // Instance is not contained in allInstances, i.e. connection loss.
      return;
    }
    if (this.waitings.length > 0) {
      const p = this.waitings.shift();
      p.resolve(instance);
      return;
    }
    this.idleInstances.push(instance);
  }

  remove(instance) {
    this.allInstances = this.allInstances.filter(j => j === instance);
  }
}

module.exports = Pool;
