const MahjongGame = require('./MahjongGame');
const initAction = require('./initAction');

class SichuanMahjongGame extends MahjongGame {
  checkActions(tile = null) {
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
}

module.exports = SichuanMahjongGame;