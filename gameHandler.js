const { startGame, act, continueGame } = require('./gameRoutine');

module.exports = (io, socket, redisMng) => {
  const req = socket.request;

  socket.on('game:ready', async () => {
    const tableID = req.session.tableID
    const playerID = req.session.playerID;
    console.log(playerID + ': readiness change');
    await redisMng.changePlayerReady(playerID);
    let playerReady = await redisMng.getPlayerReady(tableID);
    let payload = {};
    if (playerReady.length === 4 && playerReady.every(x => x)) {
      // reset readiness of each player
      const players = await redisMng.getPlayers(tableID);
      players.forEach(
        p => redisMng.changePlayerReady(p)
      );
      playerReady = await redisMng.getPlayerReady(tableID);

      console.log('game start');
      payload = await startGame(Array(4).fill('no'));
      payload.start = true;
      const gameID = payload.gameID;
      console.log(gameID);
      await redisMng.bindGame(tableID, gameID);
      console.log(req.session.playerID);
      io.to(tableID).emit('game:update', payload);
      socket.emit('game:update', payload);
    }
    payload = {
      source: 'ready',
      playerReady: playerReady,
    };
    io.to(tableID).emit('table:update', payload);
    socket.emit('table:update', payload);
  });

  socket.on('game:renew-id', async (callback) => {
    req.session.gameID = await redisMng.fetchGame(req.session.tableID);
    callback({status: 'OK'});
  });

  socket.on('game:action', async (action, pid, tid) => {
    const gameID = req.session.gameID;
    const data = await act(gameID, action, pid, tid);
    io.to(req.session.tableID).emit('game:update', data);
    socket.emit('game:update', data);
    await continueGame(gameID, socket);
  });
};