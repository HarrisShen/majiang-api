const gameClient = require('redis').createClient();

const gameModel = require('./gameModels');
const MahjongGame = gameModel.MahjongGame;
const Player = gameModel.Player;

async function startGame(botType, dealer = -1) {
  const payload = {};
  const players = botType.map(b => new Player([], [], [], b));
  if (dealer === -1) {
    dealer = Math.floor(Math.random() * 4); // choose dealer (first to play) randomly
  }
  const mjGame = new MahjongGame([], players, dealer);
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

async function continueGame(gameID) {
  const mjGame = await MahjongGame.loadFromRedis(gameClient, gameID);
  let needAct = mjGame.getPlayerToAct()[0]; // Now just assume at most one player need to act
  if (needAct !== -1 && mjGame.players[needAct].isBot()) {
    let [action, pid, tid] = mjGame.makeDecision(needAct);
    mjGame.applyAction(action, pid, tid);
    console.log(action, pid, tid);
    await mjGame.dumpToRedis(gameClient, gameID);
    return {
      gameID: gameID,
      gameState: mjGame.toJSON()
    };    
  }
  return {};
}

module.exports = { startGame, act, continueGame };