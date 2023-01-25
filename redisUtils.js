const { nanoid } = require('nanoid');

class RedisManager {
  constructor(client) {
    this.client = client;
    if(!this.client.isOpen) {
      this.client.connect().catch(console.error);
    }
  }

  async createTable() {
    const tableID = nanoid(4);
    await this.client.sAdd('table', tableID);
    return tableID;
  }

  async tableExists(tableID) {
    const res = await this.client.sIsMember('table', tableID);
    return res;
  }

  async addPlayer(tableID, playerID) {
    if (!(await this.tableExists(tableID))) throw Error('Table ' + tableID + ' not found');
    const tableSize = await this.client.lLen('table:' + tableID + ':players');
    if (tableSize === 4) throw Error('Table ' + tableID + ' is full');

    await this.client.set('player:' + playerID + ':table', tableID);
    await this.client.rPush('table:' + tableID + ':players', playerID);
    await this.client.set('player:' + playerID + ':ready', '0');
  }

  async removePlayer(tableID, playerID) {
    await this.client.del('player:' + playerID + ':table');
    await this.client.del('player:' + playerID + ':ready');
    await this.client.lRem('table:' + tableID + ':players', 1, playerID);
    const tableSize = await this.client.lLen('table:' + tableID + ':players');
    if (tableSize === 0) {
      await this.client.del('table:' + tableID + ':players');
      await this.client.sRem('table', tableID);
    }
  }

  async getPlayers(tableID) {
    const players = await this.client.lRange('table:' + tableID + ':players', 0, -1);
    return players;
  }

  async changePlayerReady(playerID) {
    const ready = await this.client.get('player:' + playerID + ':ready');
    await this.client.set(
      'player:' + playerID + ':ready',
      ready === '1' ? '0' : '1'
    );
  }

  async getPlayerReady(tableID) {
    const players = await this.client.lRange('table:' + tableID + ':players', 0, -1);
    return await Promise.all(players.map(async (p) => {
      const r = await this.client.get('player:' + p + ':ready');
      return r === '1';
    }));
  }
}

module.exports = { RedisManager };
