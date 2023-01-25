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
  }

  async removePlayer(tableID, playerID) {
    await this.client.del('player:' + playerID + ':table');
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
}

module.exports = { RedisManager };
