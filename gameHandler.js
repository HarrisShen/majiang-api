const { startGame, act, continueGame } = require('./gameRoutine');

function cleanPayload(payload, playerID, players) {
  // hiding information of others from specified player
  const newPayload = JSON.parse(JSON.stringify(payload));
  const idx = players.indexOf(playerID);
  const gameState = newPayload.gameState;
  gameState.tiles = gameState.tiles.length;
  let handLength;
  for (let i = 0; i < 4; i++) {
    if (i === idx) continue;
    handLength = gameState.playerHands[i].length;
    gameState.playerHands[i] = Array(handLength).fill(0);
  }
  newPayload.gameState = gameState;
  return newPayload;
}

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
      players.forEach(p => io.in(p).emit(
        'game:update',
        cleanPayload(payload, p, players)
      ));
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
    const players = await redisMng.getPlayers(req.session.tableID);
    const gameID = req.session.gameID;
    const payload = await act(gameID, action, pid, tid);
    players.forEach(p => io.in(p).emit(
      'game:update', 
      cleanPayload(payload, p, players)
    ));
    await continueGame(gameID, socket);
  });
};