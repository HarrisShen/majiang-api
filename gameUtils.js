const sum = (arr) => arr.reduce((a, b) => a + b, 0);

function getTiles() {
    let tiles = [];
    for(let i = 1; i < 4; i ++) {
        for(let j = 1; j < 10; j++) {
            tiles = tiles.concat(Array(4).fill(i * 10 + j));
        }
    }
    for (let i = 0; i < 7; i++) {
        tiles = tiles.concat(Array(4).fill(40 + 2 * i + 1));
    }
    return tiles;
  }
  
const shuffleArray = array => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

function countTiles(hand) {
    const counter = {};
    hand.forEach((t) => {
        if(!(t in counter)) 
            counter[t] = 0;
        counter[t]++;
    });
    return counter;
}

function havePong(hand, tile) {
    const counter = countTiles(hand);
    return counter[tile] === 2;
}

function haveKong(hand, show, tile = null) {
    const handCounter = countTiles(hand);
    if(tile !== null) return handCounter[tile] === 3;
    for(let val of Object.values(handCounter)) {
        if(val === 4) return true;
    }
    const showCounter = countTiles(show); // check return Kong
    for(let key of Object.keys(handCounter)) {
        if(showCounter[key] === 3) return true;
    }
    return false;
}

function haveChow(hand, tile) {
    const counter = countTiles(hand);
    const chowType = [];
    if (counter[tile - 2] && counter[tile - 1]) chowType.push(2);
    if (counter[tile - 1] && counter[tile + 1]) chowType.push(1);
    if (counter[tile + 1] && counter[tile + 2]) chowType.push(0);
    return chowType;
}

function getKongTile(hand) {
    const counter = countTiles(hand);
    const kong_tiles = [];
    for(let [tile, val] of Object.entries(counter)) {
        if(val === 4) kong_tiles.push(parseInt(tile));
    }
    return kong_tiles;
}

function isHuPai(hand) {
    // Check if the hand is HuPai
    // First, check at least a pair is present in hand
    // Then, check the hand without the pair is all made by 3 groups (or "meld")
    if(hand.length % 3 !== 2) return false;

    const counter = countTiles(hand);
    for(const [k, v] of Object.entries(counter)) {
        let new_counter = Object.assign({}, counter);
        if(v >= 2) {
            new_counter[k] -= 2;
            if(new_counter[k] === 0)
                delete new_counter[k];
            if(isMelds(new_counter)) return true;
        }
    }

    return false;
}

function isMelds(counter) {
    // helper function to check if it is HuPai
    // All tiles left in hand should be able to form melds - like "1","2","3" or "1","1","1"
    if(sum(Object.values(counter)) === 0) return true;
    for(const [k, v] of Object.entries(counter)) {
        let int_k = parseInt(k);
        let new_counter = Object.assign({}, counter);
        if(v >= 3) {
            new_counter[k] -= 3;
            if(new_counter[k] === 0)
                delete new_counter[k];
            if(isMelds(new_counter)) return true;
        } else if((int_k + 1) in new_counter && (int_k + 2) in new_counter) {
            for(let i = 0; i < 3; i++) {
                new_counter[int_k + i]--;
                if(new_counter[int_k + i] === 0)
                    delete new_counter[int_k + i];
            }
            if(isMelds(new_counter)) return true;
        }
    }
    return false;
}

module.exports = {
    getTiles,
    shuffleArray,
    havePong,
    haveKong,
    haveChow,
    getKongTile,
    isHuPai,
}

// const counter = countTiles([1,2,2,3,3,4,97,98,99]);
// console.log(groupBy3(counter));

// let hand = [1,2,3,4,4];
// console.log(isHuPai(hand)); // true

// hand = [1,2,3,4,5];
// console.log(isHuPai(hand)); // false

// hand = [1,2,2,3,3,4,4,5];
// console.log(isHuPai(hand)); // false

// hand = [2,2];
// console.log(isHuPai(hand)); // true

// hand = [1];
// console.log(isHuPai(hand)); // false

// hand = [1,2,2,3,3,4,4,4];
// console.log(isHuPai(hand)); // true

// hand = [1,1,1,1,2,3,3,3];
// console.log(isHuPai(hand)); // true

// hand = [1,1,1,2,2,3,3,3];
// console.log(isHuPai(hand)); // true