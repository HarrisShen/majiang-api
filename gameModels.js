const {
    getTiles, shuffleArray,
    havePong, haveKong, haveChow,
    getKongTile, isHuPai,
} = require('./gameUtils');
const { v4: uuidv4 } = require('uuid');

class MahjongGame {
    constructor(
        tiles, players, currPlayer = 0, status = 0,
        winner = [], playerActions = [], lastAction = ''
    ) {
        this.tiles = tiles.map((t) => parseInt(t));
        this.players = players;
        this.currPlayer = currPlayer; // by setting this, dealer/banker can be effectively set
        this.status = status; // 0 - ready/over, 1 - playing/to discard, 2 - diciding, no playing tiles
        this.winner = winner;
        this.playerActions = playerActions;
        this.waitingFor = [];
        this.actionList = {win: [], kong: [], pong: [], chow: []}; // three tier of actions, 0 - win, 1 - pong/kong, 2 - chow
        this.lastAction = lastAction;
    }

    toJSON() {
        return {
            tiles: this.tiles,
            playerHands: this.getPlayerHands(),
            playerWaste: this.getPlayerWaste(),
            playerShows: this.getPlayerShows(),
            currPlayer: this.currPlayer,
            playerActions: this.playerActions,
            lastAction: this.lastAction,
            winner: this.winner,
            status: this.status,
        };
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

    sortPlayerHand(i = null) {
        if(i === null) i = this.currPlayer;
        this.players[i].sortHand();
    }

    sortAllHands() {
        [0, 1, 2, 3].forEach(i => this.players[i].sortHand());
    }

    getPlayerWaste() {
        return this.players.map((player) => player.getWaste());
    }

    getPlayerShows() {
        return this.players.map((player) => player.getShow());
    }

    getPlayerShow(i = null) {
        if (i === null) i = this.currPlayer;
        return this.players[i].show;
    }

    setPlayerShow(i = null, newShow) {
        if (i === null) i = this.currPlayer;
        this.players[i].setShow(newShow);
    }

    getPlayerToAct() {
        // Deduce decision requirement from player actions
        // Player to discard not included
        if(this.status === 1) return [this.currPlayer];
        if(this.status === 2) return [0, 1, 2, 3].filter(i => Object.values(this.playerActions[i]).some(v => v));
        return [-1];
    }

    async dumpToRedis(client, gameID = null) {
        if(!client.isOpen) await client.connect();
        if(gameID === null) gameID = uuidv4();
        const gamePrefix = 'game:' + gameID;
        await client.set(gamePrefix + ':tiles', this.tiles.join(','));
        await client.set(gamePrefix + ':currPlayer', this.currPlayer);
        await client.set(gamePrefix + ':status', this.status);
        await client.set(gamePrefix + ':winner', this.winner.join());
        await client.set(gamePrefix + ':playerActions', JSON.stringify(this.playerActions));
        await client.set(gamePrefix + ':lastAction', this.lastAction);
        let playerPrefix;
        for(let i = 0; i < 4; i++) {
            playerPrefix = gamePrefix + ':players:' + i;
            await client.set(playerPrefix + ':hand', this.players[i].hand.join(','));
            await client.set(playerPrefix + ':waste', this.players[i].waste.join(','));
            await client.set(playerPrefix + ':show', this.players[i].show.join(','));
            await client.set(playerPrefix + ':bot', this.players[i].bot);
        }
        return gameID;
    }

    static async loadFromRedis(client, gameID) {
        if(!client.isOpen)
            await client.connect();
        const gamePrefix = 'game:' + gameID;
        let tiles = await client.get(gamePrefix + ':tiles');
        tiles = (tiles !== '' ? tiles.split(',') : []);
        const currPlayer = await client.get(gamePrefix + ':currPlayer');
        const status = await client.get(gamePrefix + ':status');
        let winner = await client.get(gamePrefix + ':winner');
        winner = (winner !== '' ? winner.split(',') : []);
        const playerActions = await client.get(gamePrefix + ':playerActions');
        const lastAction = await client.get(gamePrefix + ':lastAction');
        let playerPrefix, playerTiles, bot;
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
            bot = await client.get(playerPrefix + ':bot');
            players.push(new Player( ...playerTiles, bot ));
        }
        return new MahjongGame(
            tiles.map(t => parseInt(t)), players, parseInt(currPlayer),
            parseInt(status), winner, JSON.parse(playerActions), lastAction
        );
    }

    nextPlayer() {
        this.currPlayer = (this.currPlayer + 1) % 4;
    }

    drawTile() {
        if(this.tiles.length === 0) {
            this.status = 0;
            return;
        }
        const tile = this.tiles.pop();
        this.players[this.currPlayer].addHand(tile);
        this.lastAction = 'draw';
    }

    nextStep() {
        this.nextPlayer();
        this.drawTile();
        if(this.status === 0) return;
        if(this.checkActions()) this.status = 2;
    }

    start() {
        this.tiles = getTiles();
        shuffleArray(this.tiles);
        while(this.getHandSize(this.currPlayer) < 14){
            this.drawTile();
            if(this.getHandSize(this.currPlayer) === 14) break;
            this.nextPlayer();
        }
        this.sortAllHands();
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

    checkChow(tile) {
        const nextP = (this.currPlayer + 1) % 4;
        return [nextP, this.players[nextP].checkChow(tile)];
    }

    checkActions(tile = null) {
        const playerActions = [];
        for(let i = 0; i < 4; i++)
          playerActions.push(initAction());
        if(tile === null) {
            playerActions[this.currPlayer] = {
                pong: false,
                kong: this.tiles.length > 0 && this.players[this.currPlayer].checkKong(),
                chow: false,
                hu: this.players[this.currPlayer].checkHuPai()
            };
            if (playerActions[this.currPlayer]['kong']) {
                playerActions[this.currPlayer]['kong'] = getKongTile(this.getPlayerHand());
            }
        } else {
            const discardTile = this.players[this.currPlayer].waste.at(-1);
            const huPlayer = this.checkChuck(discardTile);
            huPlayer.forEach((i) => {
                playerActions[i]['hu'] = true;
            });         

            const pongPlayer = this.checkPong(discardTile);
            const kongPlayer = this.checkKong(discardTile);
            if (pongPlayer !== -1) {
                playerActions[pongPlayer]['pong'] = true;
            }
            if (kongPlayer !== -1) {
                playerActions[kongPlayer]['kong'] = true;
            }

            // chow disabled for now
            // const [chowPlayer, chowType] = this.checkChow(discardTile);
            // if (chowType !== 0) {
            //     playerActions[chowPlayer]['chow'] = true;
            // }
        }
        // let flag = false;
        for(let i = 0; i < 4; i++) {
            if (Object.values(playerActions[i]).some(x => x)) {
                this.waitingFor.push(i);
            }
        }
        this.playerActions = playerActions;
        return this.waitingFor.length > 0;
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
        if (actPlayer !== this.currPlayer) {
            kongTile = this.players[this.currPlayer].waste.pop();
            this.currPlayer = actPlayer;
        } else {
            kongTile = getKongTile(this.getPlayerHand().concat(this.getPlayerShow()))[0];
            console.log('Kong tile: ' + kongTile);
        }
        this.setPlayerHand(null, this.getPlayerHand().filter(
            (tile) => tile !== kongTile
        ));
        console.log(this.getPlayerHand());
        this.setPlayerShow(null, this.getPlayerShow().filter(
            (tile) => tile !== kongTile
        ).concat(Array(4).fill(kongTile)));
        this.drawTile();
        this.status = this.checkActions() ? 2 : 1;
    }

    commitChow(actPlayer, chowType) {
        // 0: 1,2,x; 1: 1,x,2; 2: x,2,3
        const chowTile = this.players[this.currPlayer].waste.pop();
        const newHand = this.getPlayerHand(actPlayer).slice();
        let offset = chowType == 2 ? chowType - 2 : 1;
        let idxToRemove = newHand.indexOf(chowTile + offset);
        newHand.splice(idxToRemove);
        offset = chowType == 0 ? -1 : chowType;
        idxToRemove = newHand.indexOf(chowTile + offset);
        newHand.splice(idxToRemove);
        this.setPlayerHand(actPlayer, newHand);

        this.players[actPlayer].show = this.players[actPlayer].show.concat(
            [chowTile - chowType - 2, chowTile - chowType - 1, chowTile - chowType]
        );
        this.checkActions();
        this.playerActions[actPlayer] = initAction();
        this.currPlayer = actPlayer;
        this.status = 1;
    }

    commitHu(actPlayers) {
        if(actPlayers.length > 1) {
            const winnerTile = this.players[this.currPlayer].waste.pop();
            actPlayers.forEach(actPlayer => {
                this.players[actPlayer].addHand(winnerTile);
            });
        }
        this.winner = actPlayers;
        this.status = 0;
    }

    applyAction(action, pid, tid = null) {
        this.lastAction = action;
        if(action === 'discard') {
            const discardTile = this.discard(tid);
            this.sortPlayerHand();
            if(this.checkActions(discardTile)) this.status = 2;
            else this.nextStep();
            return;
        }
        this.waitingFor.splice(this.waitingFor.indexOf(pid), 1);
        this.actionList[action].push([pid, tid]);

        if (this.waitingFor.length !== 0) return;

        if (this.actionList['win'].length > 0) {
            this.commitHu(this.actionList['win'].map(x => x[0]));
        } else if (this.actionList['kong'].length > 0) {
            this.commitKong(this.actionList['kong'][0][0]);
        } else if (this.actionList['pong'].length > 0) {
            this.commitPong(this.actionList['pong'][0][0]);
        } else if (this.actionList['chow'].length > 0) {
            this.commitChow(...this.actionList['chow'][0]);
        } else {
            this.status = 1;
            if(pid !== this.currPlayer) this.nextStep();
        }
    }

    makeDecision(pid) {
        return this.players[pid].makeDecision(pid, this.playerActions[pid]);
    }
}

class Player {
    constructor(hand, waste, show, bot = 'no') {
        this.hand = hand.map(t => parseInt(t));
        this.waste = waste.map(t => parseInt(t));
        this.show = show.map(t => parseInt(t));
        this.bot = bot;
    }

    isBot() {
        return this.bot !== 'no';
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

    setShow(newShow) {
        this.show = newShow;
    }
    
    addHand(tile) {
        this.hand.push(tile);
    }

    sortHand() {
        this.hand.sort();
    }

    discard(tid) {
        const discardTile = this.hand[tid];
        this.waste.push(discardTile);
        this.hand.splice(tid, 1);
        return discardTile;
    }

    checkHuPai(tile = null) {
        if(tile === null)
            return isHuPai(this.hand);
        return isHuPai(this.hand.concat([tile]));
    }

    checkPong(tile) {
        return havePong(this.hand, tile);
    }

    checkKong(tile = null) {
        // check ming/an/rao(return) kong
        return haveKong(this.hand, this.show, tile);
    }

    checkChow(tile) {
        return haveChow(this.hand, tile);
    }

    makeDecision(pid, playerAction) {
        if(!this.isBot()) {
            throw new Error('non-bot player ', pid, ' selected');
        }
        if(playerAction['hu']) {
            return ['hu', pid, null];
        }
        if(playerAction['kong']) {
            return ['kong', pid, null];
        }
        if(playerAction['pong']) {
            return ['pong', pid, null];
        }
        return ['discard', pid, Math.floor(Math.random() * this.hand.length)];
    }
}

const initAction = () => ({
    pong: false,
    kong: false,
    chow: false,
    hu: false,
});

// function serialize(actions) {
//     let actionsStr = '';
//     for(let i = 0; i < 4; i++) {
//         for(let k of ['pong', 'kong', 'chow', 'hu']) {
//             actionsStr += (actions[i][k]? '1' : '0');
//         }
//     }
//     return actionsStr;
// }

// function deserialize(actionsStr) {
//     const actions = [{}, {}, {}, {}];
//     const keys = ['pong', 'kong', 'chow', 'hu'];
//     for(let i = 0; i < 4; i++) {
//         for(let j = 0; j < 4; j++) {
//             actions[i][keys[j]] = (actionsStr[i * 4 + j] === '1');
//         }
//     }
//     return actions;
// }

module.exports = {
    MahjongGame: MahjongGame,
    Player: Player,
};