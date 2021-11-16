import { Client } from 'ldapts';
import { Pool } from './pool';
import { Cache } from './cache';
import { AuthCallback, IPluginAuth, Logger, PluginOptions } from '@verdaccio/types';

export type LDAPConfig = {
  ldapURL: string;
  ldapConnections?: number;
  bindDN: string;
  bindPW: string;
  searchBase: string;
  searchFilter: string;
  groupBase: string;

  cacheDuration?: number;
};

export default class LDAPAuth implements IPluginAuth<LDAPConfig> {
  private logger: Logger;
  private pool: Pool<Client>;
  private cache: Cache;

  public constructor(private config: LDAPConfig, stuff: PluginOptions<LDAPConfig>) {
    this.logger = stuff.logger;
    this.config = config;
    this.pool = new Pool(() => new Client({ url: this.config.ldapURL }), this.config.ldapConnections || 10);
    this.cache = new Cache(this.config.cacheDuration);
    return this;
  }

  public authenticate(user: string, password: string, callback: AuthCallback): void {
    const groups = this.cache.get(user, password);
    if (groups !== null) {
      callback(null, groups);
      return;
    }

    (async () => {
      let client = await this.pool.getInstance();
      if (!client.isConnected) {
        this.pool.remove(client);
        client = await this.pool.getInstance();
      }
      try {
        await client.bind(this.config.bindDN, this.config.bindPW);
        const result = await client.search(this.config.searchBase, {
          scope: 'one',
          filter: this.config.searchFilter.replace('{{username}}', user)
        });
        if (result.searchEntries.length !== 1) {
          throw new Error(`Failed to receive user ${result.searchEntries}`);
        }
        const userDn = result.searchEntries[0].dn;
        const groupsResult = await client.search(this.config.groupBase, {
          scope: 'one',
          filter: `uniqueMember=${userDn}`,
        });
        await client.unbind();
        await client.bind(userDn, password);

        const groupsList = groupsResult.searchEntries.map(group => group.cn as string); // We assume CN is unique.
        this.cache.put(user, password, groupsList);
        return groupsList;
      } catch (err: any) {
        this.logger.warn(`LDAP query failed, ${err}`, err);
        throw err;
      } finally {
        try {
          this.logger.trace('Trying last unbind');
          await client.unbind();
        } catch {
          this.logger.warn(`Final unbind failed, maybe connection is closed or user was invalid`);
        } finally {
          if (client.isConnected) {
            this.pool.putBack(client);
          } else {
            this.pool.remove(client);
          }
        }
      }
    })().then(groups => {
      this.logger.trace(`Auth OK for user ${user}: ${groups}`);
      callback(null, groups)
    }, err => {
      this.logger.trace(`Auth Fail for user ${user}: ${err}`);
      callback(err, false)
    });
  }
}
