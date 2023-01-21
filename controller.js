const client = require('redis').createClient();

const { nanoid } = require('nanoid');

async function createTable() {
  if(!client.isOpen) await client.connect();
  const tableID = nanoid(4);
  await client.set('table:' + tableID, 1);
  return tableID;
}

async function tableExists(tableID) {
  if(!client.isOpen) await client.connect();
  const res = await client.get('table:' + tableID);
  return res === '1';
}

module.exports = { createTable, tableExists };