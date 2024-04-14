// import store from "@/store";
// import axios from "axios";

const TOTAL_LEVELS = 31
class TrendTree {
    // parent;
    // _leftChild;
    // _rightChild;
    // preP;
    // nextP;
    // yArray
    // difference
    // level
    // index
    // freq
    // previousSibling
    // nextSibling
    // linkedListnext
    // linkedListPrev
    // trendRange
    // timeRange
    // nodeType
    // gapFlag
    //fetcher: TreeNodeFetchers
    constructor(parent, leftChild = true, index = 0, yArray, dif, nodeType) {
        this.nodeType='O'
        if(nodeType){
            this.nodeType=nodeType
        }
        this.parent = parent;
        
        this._leftChild = null;
        this._rightChild = null;
        this.yArray = [0, 0, 0, 0, 0];//Time-min,Val-min,Val-max,T-max
        this.difference = null;

        this.level = 0;
        this.freq = 0;
        this.previousSibling = null;
        this.nextSibling = null;
        this.linkedListPrev = null;
        this.linkedListnext = null;
        this.nextP = null;
        this.preP = null
        this.trendRange = [0, 0];
        if (yArray) {
            this.yArray = yArray;
        }
        if (dif) {
            this.difference = dif;
        }
        if (parent) {
            this.level = parent.level + 1;
            //this.fetcher = parent.fetcher;
            if (leftChild) {
                this.index = 2 * index;
                //@ts-ignore
                this.parent._leftChild = this;
            } else {
                this.index = 2 * index + 1;
                //@ts-ignore
                this.parent._rightChild = this;
            }
        } else {
            this.index = 0;
            //this.fetcher = new TreeNodeFetcher()
        }
        if (this.level > TOTAL_LEVELS) {
            throw new Error("This level is protected")
        }
        this.timeRange = [];
        if(parent===null){
            this.gapFlag='NO';
        }else{
            if(parent.gapFlag==='NO'){
                this.gapFlag='NO'
            }else if(parent.gapFlag==='L'){
                if(parent.nodeType==='LEFTNULL'){
                    if(leftChild){
                        this.gapFlag='NO'
                    }else{
                        this.gapFlag='L'
                    }
                }else{
                    if(leftChild){
                        this.gapFlag='L'
                    }else{
                        this.gapFlag='NO'
                    }
                }
                
            }else{
                if(parent.nodeType==='RIGHTNULL'){
                    if(leftChild){
                        this.gapFlag='R';
                    }else{
                        this.gapFlag='NO';
                    }
                }else{
                    if(leftChild){
                        this.gapFlag='NO';
                    }else{
                        this.gapFlag='R';
                    }
                }
                
            }
        }
    }
    get isLeafNode() {
        return this.level >= TOTAL_LEVELS - 2;
    }
    get levelNums() {
        return Math.pow(2, this.level);
    }

    getTimeRange(globalDataLen) {
        if (this.timeRange.length > 0) {
            return [this.timeRange[0], this.timeRange[1]];
        }
        const nodeDataRange = globalDataLen / (2 ** this.level);
        this.timeRange[0] = this.index * nodeDataRange;
        this.timeRange[1] = this.timeRange[0] + nodeDataRange - 1;
        return [this.timeRange[0], this.timeRange[1]];
    }
    data(startIndex) {
        if (this.level <= TOTAL_LEVELS) {
            return this.yArray.map((y, i) => {
                return {
                    x: this.index - startIndex,
                    y
                }
            })
        } else {
            return [{ x: this.index - startIndex, y: this.yArray[0] }, { x: this.index - startIndex, y: this.yArray[3] }]
        }
    }
   
}

module.exports = {TrendTree}