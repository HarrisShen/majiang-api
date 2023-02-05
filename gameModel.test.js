const test = require('node:test');
const assert = require('node:assert');

const { MahjongGame, Player } = require('./gameModels');

function arrayEquals(a, b) {
  return Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((val, index) => val === b[index]);
}

test('No self Pong'), (t) => {
  const tiles = [11, 11, 11];
  const playerParams = [
    [[12,12,12,13], [16,16,16,16], [15,15,15], 'no'],
    [[19,19,19,31], [], [], 'no'],
    [[21], [], [], 'no'],
    [[31], [], [], 'no'],
  ];
  const players = [0, 1, 2, 3].map(i => new Player(...playerParams[i]));
  const mjGame = new MahjongGame(tiles, players, 0, 1);
  mjGame.checkActions();
  assert(!mjGame.playerActions[0].pong);
  mjGame.applyAction('discard', 0, 0);
  assert(mjGame.status !== 2);
  assert(!mjGame.playerActions[0].pong);
  mjGame.applyAction('discard', 1, 0);
  assert(mjGame.status !== 2);
  assert(!mjGame.playerActions[1].pong);
}

test('return Kong test', (t) => {
  const tiles = [11, 11, 11];
  const playerParams = [
    [[12,12,12,13,13,13,14,15], [16,16,16,16], [15,15,15], 'no'],
    [[19], [], [], 'no'],
    [[21], [], [], 'no'],
    [[31], [], [], 'no'],
  ];
  const players = [0, 1, 2, 3].map(i => new Player(...playerParams[i]));
  const mjGame = new MahjongGame(tiles, players, 0, 1);
  mjGame.checkActions();
  assert(mjGame.playerActions[0].kong);
  mjGame.applyAction('kong', 0);
  assert(!mjGame.playerActions[0].kong);
  assert(mjGame.getPlayerHand().indexOf(15) === -1);
  assert(arrayEquals(mjGame.getPlayerShow(), [15,15,15,15]));
});

test('no tile no kong', (t) => {
  const tiles = [];
  const playerParams = [
    [[12,12,12,13,13,13,13,14], [], [], 'no'],
    [[19], [], [], 'no'],
    [[21], [], [], 'no'],
    [[31], [], [], 'no'],
  ];
  const players = [0, 1, 2, 3].map(i => new Player(...playerParams[i]));
  const mjGame = new MahjongGame(tiles, players, 0, 1);
  mjGame.checkActions();
  assert(!mjGame.playerActions[0].kong);
});