class BackNode {
    constructor(l, i, dif) {
        this.difference = null;
        this.level = l;
        this.index = i;
        this.freq = 1;
        this.nextP = null;
        this.preP = null;
        if (dif) {
            this.difference = dif;
        }
    }
}

module.exports = {BackNode}