export class Cache {
  private cache = new Map<string, any>();

  constructor(private expiry = 300000) { }

  public put(user: string, pw: string, groups: string[]): void {
    const userEntry = this.cache.get(user);
    if (userEntry && userEntry.pw === pw) {
      userEntry.expiry = +Date.now() + this.expiry;
      userEntry.groups = groups;
      return;
    }
    this.cache.set(user, { pw, expiry: +Date.now() + this.expiry, groups });
  }

  public get(user: string, pw: string): string[] | null {
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
