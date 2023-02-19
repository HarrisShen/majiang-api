const {
    getTiles, shuffleArray,
    havePong, haveKong, haveChow,
    getKongTile, isHuPai,
} = require('../gameUtils');
const { v4: uuidv4 } = require('uuid');

// const rules = require('./rules.json');

const initAction = require('./initAction');
const Player = require('./Player');

class MahjongGame {
    constructor(
        tiles = [], players = [], currPlayer = 0, status = 0, winner = [],
        playerActions = null, waitingFor = [], actionList = null, lastAction = ''
    ) {
        this.tiles = tiles.map((t) => parseInt(t));
        this.players = players;
        this.currPlayer = currPlayer; // by setting this at beginning, dealer/banker can be effectively set
        this.status = status; // 0 - ready/over, 1 - playing/to discard, 2 - diciding, no playing tiles
        this.winner = winner;
        if (playerActions === null) {
            playerActions = [];
            for(let i = 0; i < 4; i++)
                playerActions.push(initAction());
        }
        this.playerActions =  playerActions;
        this.waitingFor = waitingFor;
        this.actionList = actionList === null ? initAction(() => []) : actionList; // three tier of actions, 0 - win, 1 - pong/kong, 2 - chow
        this.lastAction = lastAction;
    }

    toJSON() {
        return {
            tiles: this.tiles,
            players: this.players.map((player) => player.toJSON()),
            currPlayer: this.currPlayer,
            playerActions: this.playerActions,
            lastAction: this.lastAction,
            waitingFor: this.waitingFor,
            actionList: this.actionList,
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
        // Decision requirement from player actions
        if(this.status === 1) return [this.currPlayer];
        if (this.status === 2) return this.waitingFor;
        return [-1];
    }

    async dumpToRedis(client, gameID = null) {
        if(!client.isOpen) await client.connect();
        if(gameID === null) gameID = uuidv4();
        const gamePrefix = 'game:' + gameID;
        await client.set(gamePrefix, JSON.stringify(this.toJSON()));
        return gameID;
    }

    static async loadFromRedis(client, gameID) {
        if(!client.isOpen)
            await client.connect();
        const gamePrefix = 'game:' + gameID;
        let gameData = await client.get(gamePrefix);
        gameData = JSON.parse(gameData);
        gameData.players = gameData.players.map((player) => Player.fromJSON(player));
        return Object.assign(new this.prototype.constructor(), gameData);
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
        this.tiles = getTiles(false);
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
        [0, 1, 2, 3].forEach((i) => (
            this.playerActions[i]['hu'] = (i !== this.currPlayer 
                && this.players[i].checkHuPai(tile))
        ));
    }

    checkPong(tile) {
        for(let i = 0; i < 4; i++) {
            if(i !== this.currPlayer && this.players[i].checkPong(tile)) 
                this.playerActions[i]['pong'] = true;
        }
    }

    checkKong(tile) {
        for(let i = 0; i < 4; i++) {
            if(i !== this.currPlayer && this.players[i].checkKong(tile))
                this.playerActions[i]['kong'] = true;
        }
    }

    checkChow(tile) {
        const nextP = (this.currPlayer + 1) % 4;
        const chowType = this.players[nextP].checkChow(tile);
        if(chowType.length > 0) {
            this.playerActions[nextP]['chow'] = chowType.map(
                ct => tile - ct
            );
        }
    }

    checkSelf() {
        this.playerActions[this.currPlayer] = {
            pong: false,
            kong: this.tiles.length > 0 && this.players[this.currPlayer].checkKong(),
            chow: false,
            hu: this.players[this.currPlayer].checkHuPai()
        };
        if (this.playerActions[this.currPlayer]['kong']) {
            this.playerActions[this.currPlayer]['kong'] = getKongTile(this.getPlayerHand());
        }
    }

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
            this.checkChow(discardTile);     
        }
        for(let i = 0; i < 4; i++) {
            if (Object.values(this.playerActions[i]).some(x => x)) {
                this.waitingFor.push(i);
            }
        }
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

    commitChow(actPlayer, chowStart = null) {
        // 2: 1,2,x; 1: 1,x,2; 0: x,2,3
        if (chowStart === null) {
            chowStart = this.playerActions[actPlayer]['chow'][0];
        }
        const chowTile = this.players[this.currPlayer].waste.pop();
        const newHand = this.getPlayerHand(actPlayer).slice();
        for (let i = 0; i < 3; i++) {
            if (chowStart + i === chowTile) continue;
            let idxToRemove = newHand.indexOf(chowStart + i);
            newHand.splice(idxToRemove, 1);
        }
        this.setPlayerHand(actPlayer, newHand);

        this.players[actPlayer].show = this.players[actPlayer].show.concat(
            [chowStart, chowStart + 1, chowStart + 2]
        );
        this.checkActions();
        this.playerActions[actPlayer] = initAction();
        this.currPlayer = actPlayer;
        this.status = 1;
    }

    commitHu(actPlayers) {
        if (actPlayers[0] !== this.currPlayer) {
            const winnerTile = this.players[this.currPlayer].waste.pop();
            actPlayers.forEach(actPlayer => {
                this.players[actPlayer].addHand(winnerTile);
            });
        }
        this.winner = actPlayers;
        this.status = 0;
    }

    applyAction(action, pid, tid) {
        this.lastAction = action;
        if(action === 'discard') {
            const discardTile = this.discard(tid);
            this.sortPlayerHand();
            if(this.checkActions(discardTile)) this.status = 2;
            else this.nextStep();
            return;
        }
        this.waitingFor.splice(this.waitingFor.indexOf(pid), 1);
        if (action === 'cancel') {
            this.playerActions[pid] = initAction();
        } else {
            this.actionList[action].push([pid, tid]);
        }

        if (this.waitingFor.length !== 0) return;

        if (this.actionList['hu'].length > 0) {
            this.commitHu(this.actionList['hu'].map(x => x[0]));
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
        this.actionList = initAction(() => []);
    }

    makeDecision(pid) {
        return this.players[pid].makeDecision(pid, this.playerActions[pid], this.status);
    }
}

module.exports = MahjongGame;