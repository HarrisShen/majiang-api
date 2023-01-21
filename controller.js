const client = require('redis').createClient();

const { nanoid } = require('nanoid');

async function createTable() {
  if (!client.isOpen) await client.connect();
  const tableID = nanoid(4);
  await client.set('table:' + tableID, 1);
  return tableID;
}

async function tableExists(tableID) {
  if (!client.isOpen) await client.connect();
  const res = await client.get('table:' + tableID);
  return res === '1';
}

async function addPlayer(tableID, playerID) {
  if (!client.isOpen) await client.connect();
  await client.set('player:' + playerID + ':table', tableID);
  await client.rPush('table:' + tableID + ':players:', playerID);
}

async function getPlayers(tableID) {
  if (!client.isOpen) await client.connect();
  const players = await client.lRange('table:' + tableID + ':players:', 0, -1);
  return players;
}

module.exports = { createTable, tableExists, addPlayer, getPlayers };