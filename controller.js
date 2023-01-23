const client = require('redis').createClient();

const { nanoid } = require('nanoid');

async function createTable() {
  if (!client.isOpen) await client.connect();
  const tableID = nanoid(4);
  await client.sAdd('table', tableID);
  return tableID;
}

async function tableExists(tableID) {
  if (!client.isOpen) await client.connect();
  const res = await client.sIsMember('table', tableID);
  return res;
}

async function addPlayer(tableID, playerID) {
  if (!client.isOpen) await client.connect();
  if (!(await tableExists(tableID))) throw Error('Table ' + tableID + ' not found');
  const tableSize = await client.lLen('table:' + tableID + ':players');
  if (tableSize === 4) throw Error('Table ' + tableID + ' is full');

  await client.set('player:' + playerID + ':table', tableID);
  await client.rPush('table:' + tableID + ':players', playerID);
}

async function removePlayer(tableID, playerID) {
  if (!client.isOpen) await client.connect();
  await client.del('player:' + playerID + ':table');
  await client.lRem('table:' + tableID + ':players', 1, playerID);
  const tableSize = await client.lLen('table:' + tableID + ':players');
  if (tableSize === 0) {
    await client.del('table:' + tableID + ':players');
    await client.sRem('table', tableID);
  }
}

async function getPlayers(tableID) {
  if (!client.isOpen) await client.connect();
  const players = await client.lRange('table:' + tableID + ':players', 0, -1);
  return players;
}

module.exports = { createTable, tableExists, addPlayer, removePlayer, getPlayers };