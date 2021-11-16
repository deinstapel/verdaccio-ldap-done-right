export class Deferred<T> {
  public promise: Promise<T>;
  public resolve!: (value: T | PromiseLike<T>) => void;
  public reject!: (reason?: any) => void;
  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

export class Pool<T> {

  private idleInstances: T[] = [];
  private allInstances: T[] = [];
  private waitings: Deferred<T>[] = [];

  constructor(private factory: () => T, private limit: number) { }

  public async getInstance(): Promise<T> {
    if (this.allInstances.length < this.limit) {
      const instance = await this.factory();
      this.allInstances.push(instance);
      return instance;
    }
    if (this.idleInstances.length > 0) {
      const inst = this.idleInstances.shift();
      return inst!;
    }
    const d = new Deferred<T>();
    this.waitings.push(d);
    return d.promise;
  }

  public putBack(instance: T): void {
    if (this.allInstances.findIndex(j => j === instance) === -1) {
      // Instance is not contained in allInstances, i.e. connection loss.
      return;
    }
    if (this.waitings.length > 0) {
      const p = this.waitings.shift();
      p!.resolve(instance);
      return;
    }
    this.idleInstances.push(instance);
  }

  public remove(instance: T): void {
    this.allInstances = this.allInstances.filter(j => j === instance);
  }
}
