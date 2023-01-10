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
  const players = [0,0,0,0].map(() => new Player([], [], []));
  if(status === "init") {
    const mjGame = new MahjongGame([], players);
    mjGame.start();
    mjGame.checkActions();
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
  let discardTile;
  let haveAction = false;
  if(req.body['action'] === 'discard') {
    const tid = req.body['tid'];
    discardTile = mjGame.discard(tid);
    haveAction = mjGame.checkActions(discardTile);
    if(haveAction) mjGame.status = 2;
    else mjGame.nextStep();
  } else if(req.body['action'] === 'pong') {
    mjGame.commitPong(req.body['pid']);
  } else if(req.body['action'] === 'kong') {
    mjGame.commitKong(req.body['pid']);
  } else if(req.body['action'] === 'win') {
    mjGame.commitHu(req.body['pid']);
  } else if(req.body['action'] === 'cancel') {
    mjGame.status = 1;
    if(req.body['pid'] !== mjGame.currPlayer) {
      mjGame.nextStep();
    }
  }
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
