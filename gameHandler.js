const { startGame, act, continueGame } = require('./gameRoutine');

function cleanPayload(payload, playerID, players) {
  // hiding information of others from specified player
  const newPayload = JSON.parse(JSON.stringify(payload));
  const idx = players.indexOf(playerID);
  const gameState = newPayload.gameState;
  gameState.tiles = gameState.tiles.length;
  if (gameState.status !== 0) {
    // Only perform hiding when game is still ongoing
    let handLength;
    for (let i = 0; i < 4; i++) {
      if (i === idx) continue;
      handLength = gameState.playerHands[i].length;
      gameState.playerHands[i] = Array(handLength).fill(0);
    } 
  }
  newPayload.gameState = gameState;
  return newPayload;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = (io, socket, redisMng) => {
  const req = socket.request;

  socket.on('game:ready', async () => {
    const tableID = req.session.tableID
    const playerID = req.session.playerID;
    console.log(playerID + ': readiness change');
    await redisMng.changePlayerReady(playerID);
    let playerReady = await redisMng.getPlayerReady(tableID);
    const tableLimit = await redisMng.getTableLimit(tableID);
    let payload = {};
    if (playerReady.length === tableLimit && playerReady.every(x => x)) {
      // reset readiness of each player
      const players = await redisMng.getPlayers(tableID);
      console.log(players);
      players.forEach(
        p => redisMng.changePlayerReady(p)
      );
      playerReady = await redisMng.getPlayerReady(tableID);

      console.log('game start');
      let botType;
      if (tableLimit === 1) {
        botType = ['no', 'rd', 'rd', 'rd'];
      } else {
        botType = ['no', 'no', 'no', 'no'];
      }
      payload = await startGame(botType);
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

  socket.on('game:action', async (action, pid, tid) => {
    if (action === null) {
      // renew gameID once game starts
      req.session.gameID = await redisMng.fetchGame(req.session.tableID);
    }
    const players = await redisMng.getPlayers(req.session.tableID);
    const gameID = req.session.gameID;
    let payload;
    if (action !== null) {
      payload = await act(gameID, action, pid, tid);
      if (players.length === 4) {
        players.forEach(p => io.in(p).emit(
          'game:update',
          cleanPayload(payload, p, players)
        ));
        return;
      }
      socket.emit('game:update', cleanPayload(payload, players[0], players));     
    }
    // If action is null, it means to kick start the game for single player
    payload = await continueGame(gameID);
    while (payload.gameID) {
      await sleep(1000);
      socket.emit('game:update', cleanPayload(payload, players[0], players));
      payload = await continueGame(gameID);
    }
  });
};