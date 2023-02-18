const gameClient = require('redis').createClient();

// const gameModel = require('./game/models/MahjongGame');
// const MahjongGame = gameModel.MahjongGame;
const Game = require('./game/models/SichuanMahjong');
const Player = require('./game/models/Player');

async function startGame(botType, dealer = -1) {
  const payload = {};
  const players = botType.map(b => new Player([], [], [], b));
  if (dealer === -1) {
    dealer = Math.floor(Math.random() * 4); // choose dealer (first to play) randomly
  }
  const mjGame = new Game([], players, dealer);
  mjGame.start();
  if(mjGame.checkActions()) mjGame.status = 2;
  payload.gameState = mjGame.toJSON();
  payload.gameID = await mjGame.dumpToRedis(gameClient);
  return payload;
}

async function act(gameID, action, pid, tid) {
  const mjGame = await Game.loadFromRedis(gameClient, gameID);
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
  const mjGame = await Game.loadFromRedis(gameClient, gameID);
  let needAct = mjGame.getPlayerToAct();
  for (i of needAct) {
    if (i === -1) break;
    if (mjGame.players[i].isBot()) {
      let [action, pid, tid] = mjGame.makeDecision(i);
      mjGame.applyAction(action, pid, tid);
      console.log(action, pid, tid);
      await mjGame.dumpToRedis(gameClient, gameID);
      return {
        gameID: gameID,
        gameState: mjGame.toJSON()
      };
    }
  }
  return {};
}

module.exports = { startGame, act, continueGame };