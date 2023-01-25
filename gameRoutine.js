const gameClient = require('redis').createClient();

const gameModel = require('./gameModels');
const MahjongGame = gameModel.MahjongGame;
const Player = gameModel.Player;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startGame(botType) {
  const payload = {};
  const players = botType.map(b => new Player([], [], [], b));
  const mjGame = new MahjongGame([], players);
  mjGame.start();
  if(mjGame.checkActions()) mjGame.status = 2;
  payload.gameState = mjGame.toJSON();
  payload.gameID = await mjGame.dumpToRedis(gameClient);
  return payload;
}

async function act(gameID, action, pid, tid) {
  const mjGame = await MahjongGame.loadFromRedis(gameClient, gameID);
  mjGame.applyAction(action, pid, tid);
  console.log(mjGame.currPlayer);
  console.log(mjGame.players[mjGame.currPlayer].hand);
  await mjGame.dumpToRedis(gameClient, gameID);
  return {
    gameID: gameID,
    gameState: mjGame.toJSON()
  };
}

async function continueGame(gameID, socket) {
  const mjGame = await MahjongGame.loadFromRedis(gameClient, gameID);
  let needAct = mjGame.getPlayerToAct()[0]; // Now just assume at most one player need to act
  while(needAct !== -1 && mjGame.players[needAct].isBot()) {
    console.log(needAct);
    await sleep(1000);
    let [action, pid, tid] = mjGame.makeDecision(needAct);
    mjGame.applyAction(action, pid, tid);
    console.log(action, pid, tid);
    await mjGame.dumpToRedis(gameClient, gameID);
    socket.emit('update', {
      gameID: gameID,
      gameState: mjGame.toJSON()
    });
    needAct = mjGame.getPlayerToAct()[0];
  } 
}

module.exports = { startGame, act, continueGame };