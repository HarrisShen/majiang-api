module.exports = (io, socket, redisMng) => {
  const req = socket.request;

  socket.on('table:create', async () => {
    console.log('create table');
    const tableID = await redisMng.createTable();
    req.session.tableID = tableID;
    socket.join(tableID);
    console.log('table created: ' + tableID);
    await redisMng.addPlayer(tableID, req.session.playerID);
    socket.emit('table:update', {
      source: 'create',
      tableID: tableID,
      players: [req.session.playerID],
      playerReady: [false],
    });
  });

  socket.on('table:leave', async (callback) => {
    console.log('leave table');
    const tableID = req.session.tableID;
    req.session.tableID = '';
    await redisMng.removePlayer(tableID, req.session.playerID);
    socket.leave(tableID);
    const players = await redisMng.getPlayers(tableID);
    const playerReady = await redisMng.getPlayerReady(tableID);
    console.log(players);
    console.log('table:' + tableID + ' left');
    io.to(tableID).emit('table:update', {
      source: 'leave',
      players: players,
      playerReady: playerReady
    });
    callback({tableID: ''});
  });

  socket.on('table:join', async (tableID, callback) => {
    console.log('joining table');
    if(!req.session.playerID) {
      req.session.playerID = 'User-' + nanoid(8);
    }
    try {
      await redisMng.addPlayer(tableID, req.session.playerID);
    } catch (error) {
      console.log(error.message);
      callback({error: error.message});
      return;
    }
    req.session.tableID = tableID;
    socket.join(tableID);
    const players = await redisMng.getPlayers(tableID);
    const playerReady = await redisMng.getPlayerReady(tableID);
    console.log(players);
    console.log('table:' + tableID + ' joined');
    const data = {
      source: 'join',
      players: players,
      playerReady: playerReady,
    }
    io.to(tableID).emit('table:update', data);
    callback(data);
  });
};