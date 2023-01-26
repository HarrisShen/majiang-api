module.exports = (io, socket, redisMng) => {
  const req = socket.request;

  socket.on('table:create', async () => {
    console.log('create table');
    const playerID = req.session.playerID;
    const tableID = await redisMng.createTable();
    req.session.tableID = tableID;
    socket.join(tableID);
    socket.join(playerID);
    console.log('table created: ' + tableID);
    await redisMng.addPlayer(tableID, playerID);
    socket.emit('table:update', {
      source: 'create',
      tableID: tableID,
      players: [playerID],
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
    // if(!req.session.playerID) {
    //   req.session.playerID = 'User-' + nanoid(8);
    // }
    const playerID = req.session.playerID;
    try {
      await redisMng.addPlayer(tableID, playerID);
    } catch (error) {
      console.log(error.message);
      callback({error: error.message});
      return;
    }
    req.session.tableID = tableID;
    socket.join(tableID);
    socket.join(playerID);
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