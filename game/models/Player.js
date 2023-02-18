const {
    getTiles, shuffleArray,
    havePong, haveKong, haveChow,
    getKongTile, isHuPai,
} = require('../gameUtils');

class Player {
    constructor(hand, waste, show, bot = 'no') {
        this.hand = hand.map(t => parseInt(t));
        this.waste = waste.map(t => parseInt(t));
        this.show = show.map(t => parseInt(t));
        this.bot = bot;
    }

    toJSON() {
        return {
            hand: this.hand,
            waste: this.waste,
            show: this.show,
            bot: this.bot,
        };
    }

    static fromJSON(json) {
        return new Player(json.hand, json.waste, json.show, json.bot);
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
        if(playerAction['chow']) {
            return ['chow', pid, null];
        }
        return ['discard', pid, Math.floor(Math.random() * this.hand.length)];
    }
}

module.exports = Player;