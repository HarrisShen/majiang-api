const gameUtils = require('./gameUtils');

class MahjongGame {
    constructor(tiles, players, currPlayer = 0, status = 0, winner = [], playerActions = []) {
        this.tiles = tiles.map((t) => parseInt(t));
        this.players = players;
        this.currPlayer = currPlayer;
        this.status = status; // 0 - ready/over, 1 - playing/to discard, 2 - diciding, no playing tiles
        this.winner = winner;
        this.playerActions = playerActions;
    }

    getHandSize(i) {
        return this.players[i].getHandSize();
    }

    getPlayerHands() {
        return this.players.map((player) => player.getHand());
    }

    getPlayerHand(i = null) {
        if(i === null) i = this.currPlayer;
        return this.players[i].hand;
    }

    setPlayerHand(i = null, newHand) {
        if(i === null) i = this.currPlayer;
        this.players[i].setHand(newHand);
    }

    setPlayerHands(newPlayerHands) {
        [0, 1, 2, 3].forEach(i => {
            this.players[i].setHand(newPlayerHands[i]);
        });
    }

    getPlayerWaste() {
        return this.players.map((player) => player.getWaste());
    }

    getPlayerShows() {
        return this.players.map((player) => player.getShow());
    }

    async dumpToRedis(client) {
        if(!client.isOpen)
            await client.connect();
        const gamePrefix = 'game';
        await client.set(gamePrefix + ':tiles', this.tiles.join());
        await client.set(gamePrefix + ':currPlayer', this.currPlayer);
        await client.set(gamePrefix + ':status', this.status);
        await client.set(gamePrefix + ':winner', this.winner.join());
        await client.set(gamePrefix + ':playerActions', serialize(this.playerActions));
        let playerPrefix;
        for(let i = 0; i < 4; i++) {
            playerPrefix = gamePrefix + ':players:' + i;
            await client.set(playerPrefix + ':hand', this.players[i].hand.join(','));
            await client.set(playerPrefix + ':waste', this.players[i].waste.join(','));
            await client.set(playerPrefix + ':show', this.players[i].show.join(','));
        }
    }

    static async loadFromRedis(client) {
        if(!client.isOpen)
            await client.connect();
        const gamePrefix = 'game';
        let tiles = await client.get(gamePrefix + ':tiles');
        tiles = (tiles !== '' ? tiles.split(',') : []);
        const currPlayer = await client.get(gamePrefix + ':currPlayer');
        const status = await client.get(gamePrefix + ':status');
        let winner = await client.get(gamePrefix + ':winner');
        winner = (winner !== '' ? winner.split(',') : []);
        const playerActions = await client.get(gamePrefix + ':playerActions');
        let playerPrefix, playerTiles;
        const players = [];
        for(let i = 0; i < 4; i++) {
            playerTiles = [];
            playerPrefix = gamePrefix + ':players:' + i;
            playerTiles.push(
                await client.get(playerPrefix + ':hand')
                    .then((s) => s !== '' ? s.split(',') : []));
            playerTiles.push(
                await client.get(playerPrefix + ':waste')
                    .then((s) => s !== '' ? s.split(',') : []));
            playerTiles.push(
                await client.get(playerPrefix + ':show')
                    .then((s) => s !== '' ? s.split(',') : []));
            players.push(new Player( ...playerTiles ));
        }
        return new MahjongGame(
            tiles.map(t => parseInt(t)), players,
            parseInt(currPlayer), parseInt(status),
            winner, deserialize(playerActions)
        );
    }

    nextPlayer() {
        this.currPlayer = (this.currPlayer + 1) % 4;
    }

    drawTile() {
        const tile = this.tiles.pop();
        this.players[this.currPlayer].addHand(tile);
    }

    nextStep() {
        this.nextPlayer();
        this.drawTile();
        if(this.checkActions()) this.status = 2;
    }

    start() {
        this.tiles = gameUtils.getTiles();
        gameUtils.shuffleArray(this.tiles);
        while(this.getHandSize(this.currPlayer) < 14){
            this.drawTile();
            if(this.getHandSize(this.currPlayer) === 14) break;
            this.nextPlayer();
        }
        this.status = 1;
    }

    discard(tid) {
        return this.players[this.currPlayer].discard(tid);
    }

    checkChuck(tile) {
        // Dian Pao/Fang Pao
        // This is the only situation where more than one players' decision
        // is required to proceed
        return [0, 1, 2, 3].filter((i) => (
            i !== this.currPlayer && this.players[i].checkHuPai(tile)
        ));
    }

    checkPong(tile) {
        for(let i = 0; i < 4; i++) {
            if(i !== this.currPlayer && this.players[i].checkPong(tile)) 
                return i;
        }
        return -1;
    }

    checkKong(tile) {
        for(let i = 0; i < 4; i++) {
            if(i !== this.currPlayer && this.players[i].checkKong(tile))
                return i;
        }
        return -1;
    }

    checkActions(tile = null) {
        const playerActions = [];
        for(let i = 0; i < 4; i++)
          playerActions.push(initAction());
        if(tile === null) {
            playerActions[this.currPlayer] = {
                pong: false,
                kong: this.players[this.currPlayer].checkKong(),
                chow: false,
                hu: this.players[this.currPlayer].checkHuPai()
            };
        } else {
            const discardTile = this.players[this.currPlayer].waste.at(-1);
            const pongPlayer = this.checkPong(discardTile);
            const kongPlayer = this.checkKong(discardTile);
            const huPlayer = this.checkChuck(discardTile);
            if(pongPlayer !== -1) {
                playerActions[pongPlayer]['pong'] = true;
            }
            if(kongPlayer !== -1) {
                playerActions[kongPlayer]['kong'] = true;
            }
            huPlayer.forEach((i) => {
                playerActions[i]['hu'] = true;
            });
        }
        let flag = false;
        for(let i = 0; i < 4; i++) {
            for(let v of Object.values(playerActions[i])){
                if(v) {
                    flag = true;
                    break;
                }
            }
        }
        this.playerActions = playerActions;
        return flag;
    }

    commitPong(actPlayer) {
        const pongTile = this.players[this.currPlayer].waste.pop();
        this.setPlayerHand(actPlayer, this.getPlayerHand(actPlayer).filter(
            (tile) => tile !== pongTile
        ));
        this.players[actPlayer].show = this.players[actPlayer].show.concat(
            Array(3).fill(pongTile)
        );
        this.checkActions();
        this.playerActions[actPlayer] = initAction();
        this.currPlayer = actPlayer;
        this.status = 1;
    }

    commitKong(actPlayer) {
        let kongTile;
        if(actPlayer !== this.currPlayer) {
            kongTile = this.players[this.currPlayer].waste.pop();
            this.currPlayer = actPlayer;
        } else {
            kongTile = gameUtils.getKongTile(this.getPlayerHand())[0];
            console.log('Kong tile: ' + kongTile);
        }
        this.setPlayerHand(null, this.getPlayerHand().filter(
            (tile) => tile !== kongTile
        ));
        console.log(this.getPlayerHand());
        this.players[this.currPlayer].show = this.players[this.currPlayer].show.concat(
            Array(4).fill(kongTile)
        );
        this.drawTile();
        this.status = this.checkActions() ? 2 : 1;
    }

    commitHu(actPlayer) {
        if(actPlayer !== this.currPlayer) {
            const winnerTile = this.players[this.currPlayer].waste.pop();
            this.players[actPlayer].addHand(winnerTile, false);
        }
        this.winner.push(actPlayer);
        this.status = 0;
    }
}

class Player {
    constructor(hand, waste, show) {
        this.hand = hand.map(t => parseInt(t));
        this.waste = waste.map(t => parseInt(t));
        this.show = show.map(t => parseInt(t));
    }

    getHand() {
        return this.hand;
    }

    getHandSize() {
        return this.hand.length;
    }

    setHand(newHand) {
        this.hand = newHand;
    }

    getWaste() {
        return this.waste;
    }

    getShow() {
        return this.show;
    }
    
    addHand(tile, sort = true) {
        this.hand.push(tile);
        if(sort) this.hand = this.hand.sort();
    }

    discard(tid) {
        const discardTile = this.hand[tid];
        this.waste.push(discardTile);
        this.hand.splice(tid, 1);
        return discardTile;
    }

    checkHuPai(tile = null) {
        if(tile === null)
            return gameUtils.isHuPai(this.hand);
        return gameUtils.isHuPai(this.hand.concat([tile]));
    }

    checkPong(tile) {
        return gameUtils.havePong(this.hand, tile);
    }

    checkKong(tile = null) {
        return gameUtils.haveKong(this.hand, tile);
    }
}

const initAction = () => ({
    pong: false,
    kong: false,
    chow: false,
    hu: false,
});

function serialize(actions) {
    let actionsStr = '';
    for(let i = 0; i < 4; i++) {
        for(let k of ['pong', 'kong', 'chow', 'hu']) {
            actionsStr += (actions[i][k]? '1' : '0');
        }
    }
    return actionsStr;
}

function deserialize(actionsStr) {
    const actions = [{}, {}, {}, {}];
    const keys = ['pong', 'kong', 'chow', 'hu'];
    for(let i = 0; i < 4; i++) {
        for(let j = 0; j < 4; j++) {
            actions[i][keys[j]] = (actionsStr[i * 4 + j] === '1');
        }
    }
    return actions;
}

module.exports = {
    MahjongGame: MahjongGame,
    Player: Player,
};