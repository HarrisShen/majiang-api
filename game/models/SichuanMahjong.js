const MahjongGame = require('./MahjongGame');
const initAction = require('./initAction');

class SichuanMahjongGame extends MahjongGame {
  constructor(
    tiles = [], players = [], currPlayer = 0, status = 0, winner = [],
    playerActions = null, waitingFor = [], actionList = null, lastAction = '',
    forbid = null
  ) {
    super(
      tiles, players, currPlayer, status, winner,
      playerActions, waitingFor, actionList, lastAction
    );
    this.forbid = forbid === null ? [0, 0, 0, 0] : forbid;
  }

  toJSON() {
    const json = super.toJSON();
    json.forbid = this.forbid;
    return json;
  }

  checkActions(tile = null) {
    this.waitingFor = [0, 1, 2, 3].filter(i => this.forbid[i] === 0);
    if (this.waitingFor.length > 0) return true;

    for(let i = 0; i < 4; i++)
      this.playerActions[i] = initAction();
    if(tile === null) {
      this.checkSelf();
    } else {
      const discardTile = this.players[this.currPlayer].waste.at(-1);
      this.checkChuck(discardTile);
      this.checkPong(discardTile);
      this.checkKong(discardTile);   
    }
    for(let i = 0; i < 4; i++) {
      if (Object.values(this.playerActions[i]).some(x => x)) {
        this.waitingFor.push(i);
      }
    }
    return this.waitingFor.length > 0;
  }

  applyAction(action, pid, tid) {
    if (action === 'forbid') {
      this.forbid[pid] = tid;
      this.waitingFor.splice(this.waitingFor.indexOf(pid), 1);
      if (this.waitingFor.length === 0) {
        this.status = 1;
      }
      return;
    }

    super.applyAction(action, pid, tid);
  }

}

module.exports = SichuanMahjongGame;