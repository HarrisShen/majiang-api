const express = require('express');
const router = express.Router();
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
  let payload = {};
  if(status === "init") {
    const players = ['no','rd','rd','rd'].map(b => new Player([], [], [], b));
    const mjGame = new MahjongGame([], players);
    mjGame.start();
    if(mjGame.checkActions()) mjGame.status = 2;
    payload = mjGame.toJSON();
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
  res.send(mjGame.toJSON());

  console.log('after send');
  let needAct = mjGame.getPlayerToAct(); // Now just assume at most one player need to act
  needAct = needAct.length === 0? mjGame.currPlayer : needAct[0];
  while(mjGame.players[needAct].isBot()) {
    console.log(needAct);
    await sleep(2000);
    let [action, pid, tid] = mjGame.makeDecision(needAct);
    mjGame.applyAction(action, pid, tid);
    console.log(action, pid, tid);
    await mjGame.dumpToRedis(client);
    req.io.emit('update', mjGame.toJSON());
    needAct = mjGame.getPlayerToAct();
    needAct = needAct.length === 0? mjGame.currPlayer : needAct[0];
  } 
});

router.post('/', async function(req, res, next) {
  const players = req.body.playerHands.map((hand) => new Player(hand, [], []));
  const tiles = req.body.tiles.reverse();
  const mjGame = new MahjongGame(tiles, players, 0, 1);
  if(mjGame.checkActions()) mjGame.status = 2;
  await mjGame.dumpToRedis(client);
  res.send(mjGame.toJSON());
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = router;
