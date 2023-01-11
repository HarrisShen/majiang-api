var express = require('express');
var router = express.Router();
const bodyParser = require('body-parser');

const redis = require('redis');
const client = redis.createClient();

const gameModel = require('../gameModels');
const MahjongGame = gameModel.MahjongGame;
const Player = gameModel.Player;

router.use(bodyParser.urlencoded({ extended: false }));
router.use(bodyParser.json());

/* GET initialized game info */
router.get('/', async function(req, res, next) {
  let status = req.query.status;
  const payload = {};
  const players = [null,'rd','rd','rd'].map(b => new Player([], [], [], b));
  if(status === "init") {
    const mjGame = new MahjongGame([], players);
    mjGame.start();
    if(mjGame.checkActions()) mjGame.status = 2;
    payload['tiles'] = mjGame.tiles;
    payload['playerHands'] = mjGame.getPlayerHands();
    payload['currPlayer'] = [mjGame.currPlayer];
    payload['playerActions'] = mjGame.playerActions;
    payload['status'] = mjGame.status;
    await mjGame.dumpToRedis(client);
  }
  res.send(payload);
});

/* PUT - receiving and responding to player actions */
router.put('/', async function(req, res, next) {
  const mjGame = await MahjongGame.loadFromRedis(client);
  mjGame.applyAction(
    req.body['action'], req.body['pid'],
    req.body['action'] === 'discard'? req.body['tid'] : null);
  console.log(mjGame.currPlayer);
  console.log(mjGame.players[mjGame.currPlayer].hand);
  await mjGame.dumpToRedis(client);
  res.send({
    tiles: mjGame.tiles,
    playerHands: mjGame.getPlayerHands(),
    playerWaste: mjGame.getPlayerWaste(),
    playerShows: mjGame.getPlayerShows(),
    currPlayer: [mjGame.currPlayer],
    playerActions: mjGame.playerActions,
    winner: mjGame.winner,
    status: mjGame.status,
  });

  // let needAct = mjGame.getPlayerToAct(); // Now just assume at most one player need to act
  // needAct = needAct.length === 0? mjGame.currPlayer : needAct[0];
  // while(mjGame.players[needAct].isBot()) {
  //   let [action, pid, tid] = mjGame.players[mjGame.currPlayer].makeDecision();
  //   mjGame.applyAction(action, pid, tid);
  //   res.send({
  //     tiles: mjGame.tiles,
  //     playerHands: mjGame.getPlayerHands(),
  //     playerWaste: mjGame.getPlayerWaste(),
  //     playerShows: mjGame.getPlayerShows(),
  //     currPlayer: [mjGame.currPlayer],
  //     playerActions: mjGame.playerActions,
  //     winner: mjGame.winner,
  //     status: mjGame.status,
  //   });
  // } 
});

router.post('/', async function(req, res, next) {
  const players = req.body.playerHands.map((hand) => new Player(hand, [], []));
  const tiles = req.body.tiles.reverse();
  const mjGame = new MahjongGame(tiles, players, 0, 1);
  if(mjGame.checkActions()) mjGame.status = 2;
  await mjGame.dumpToRedis(client);
  res.send({
    tiles: mjGame.tiles,
    playerHands: mjGame.getPlayerHands(),
    currPlayer: [mjGame.currPlayer],
    playerActions: mjGame.playerActions,
    winner: mjGame.winner,
    status: mjGame.status,
  })
});

module.exports = router;
