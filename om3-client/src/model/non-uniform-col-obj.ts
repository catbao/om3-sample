import TrendTree from "@/helper/tend-query-tree";
import { getIndexTime } from "@/helper/format-data";
import { utcYear } from "d3";

export class NoUniformColObj {
    col: number;
    tStart: number;
    tEnd: number;
    semanticTStart: number;
    semanticTEnd: number;
    level: number;
    startIndex: number;
    endIndex: number;
    index: number;
    startV: number | undefined;
    endV: number | undefined;
    average: number;
    currentSum: number;
    currentPointNum: number;
    currentRange: Array<Array<number>>;
    ordinalLevelCount: number;
    vRange: Array<number>;
    width: number;
    globalDataLen: number;
    positionInfo: {
        startX: number,
        endX: number,
        minX: number,
        maxX: number;
    }
    minVTimeRange: Array<number>
    maxVTimeRange: Array<number>
    maxLevel: number;
    dataName?: string;
    isMis: boolean;
    shapeMinMax: Array<number>;
    shapeMinT: Array<Array<number>>;
    shapeMaxT: Array<Array<number>>;
    minNodes: Array<TrendTree>;
    maxNodes: Array<TrendTree>;
    realStart: number;
    sementicInterval: number;
    addMin: number;
    addMax: number;
    subMin: number;
    subMax: number;
    multiMin: number;
    multiMax: number;
    divMin: number;
    divMax: number;
    multiAve: number;

    constructor(col: number, tStart: number, tEnd: number, level: number, width: number, globalDataLen: number, maxLevel: number, dataName?: string) {
        this.isMis = false;
        this.startV = undefined;
        this.endV = undefined;
        this.average = 0;
        this.currentSum = 0;
        this.currentPointNum = 0;
        this.currentRange = [];
        this.ordinalLevelCount = 0;
        this.minVTimeRange = [0, 0];
        this.maxVTimeRange = [0, 0];
        this.vRange = [Infinity, -Infinity];
        this.width = width;
        this.col = col;
        this.tStart = tStart;
        this.tEnd = tEnd;
        this.semanticTStart = tStart;
        this.semanticTEnd = tEnd;
        this.level = level;
        this.startIndex = 0;
        this.endIndex = 0;
        this.index = 0;
       
        this.globalDataLen = globalDataLen;
        this.maxLevel = maxLevel
        this.positionInfo = {
            startX: 0,
            endX: 0,
            minX: 0,
            maxX: 0
        }
       
        this.dataName = dataName;
        this.shapeMinMax = [Infinity, -Infinity];
        this.shapeMinT = [];
        this.shapeMaxT = [];
        this.minNodes = [];
        this.maxNodes = [];
        this.realStart = 0;
        this.sementicInterval = 0;
        this.addMin = Infinity;
        this.addMax = -Infinity;
        this.subMin = Infinity;
        this.subMax = -Infinity;
        this.multiMin = Infinity;
        this.multiMax = -Infinity;
        this.divMin = Infinity;
        this.divMax = -Infinity;
        this.multiAve = 0;
    }
    rebuild(col: number, tStart: number, tEnd: number, level: number, width: number, globalDataLen: number, maxLevel: number, dataName?: string) {
        this.width = width;
        this.col = col;
        this.tStart = tStart;
        this.tEnd = tEnd;
        this.level = level;
        this.startIndex = 0;
        this.endIndex = 0;
        this.index = 0;
        this.startV = undefined;
        this.endV = undefined;
        this.average = 0;
        this.currentSum = 0;
        this.currentPointNum = 0;
        this.currentRange = [];
        this.ordinalLevelCount = 0;
        this.vRange[0] = Infinity;
        this.vRange[1] = -Infinity;
        this.globalDataLen = globalDataLen;
        this.maxLevel = maxLevel
        this.positionInfo.startX = 0;
        this.positionInfo.endX = 0;
        this.positionInfo.minX = 0;
        this.positionInfo.maxX = 0;
        this.minVTimeRange[0] = 0;
        this.minVTimeRange[1] = 0;
        this.maxVTimeRange[0] = 0;
        this.maxVTimeRange[1] = 0;
        this.dataName = dataName;
        this.addMin = Infinity;
        this.addMax = -Infinity;
        this.subMin = Infinity;
        this.subMax = -Infinity;
        this.multiMin = Infinity;
        this.multiMax = -Infinity;
        this.divMin = Infinity;
        this.divMax = -Infinity;
        this.multiAve = 0;
    }
    setRealStartAndInterval(start: number, interval: number) {
        this.realStart = start;
        this.sementicInterval = interval;
    }

    setTStart(t: number) {
        this.tStart = t;
    }
    setTEnd(t: number) {
        this.tEnd = t;
    }

    setSemanticTStart(t: number) {
        this.semanticTStart = t;
        this.tStart = Math.floor((this.semanticTStart - this.realStart) / this.sementicInterval);
    }
    setSemanticTEnd(t: number) {
        this.semanticTEnd = t;
        this.tEnd = Math.floor((this.semanticTEnd - this.realStart) / this.sementicInterval) - 1;
    }
    getEndRange() {
        const index = Math.floor(this.tEnd / 2);
        if (index % 2 === 0) {
            return [index, index + 1];
        } else {
            return [index - 1, index];
        }
    }
    getStartRange() {
        const index = Math.floor(this.tStart / 2);
        if (index % 2 === 0) {
            return [index, index + 1];
        } else {
            return [index - 1, index];
        }
    }
    // 1 完全属于该列  2 与该列相交   3 大于该列 4 完全小于该列 5 不完全小于该列
    isContain(p: TrendTree) {
        const pL = p.level;
        const pTRange = (2 ** this.maxLevel) / (2 ** pL);
        const pTimeS = p.index * pTRange;
        const pTimeE = pTRange + pTimeS - 1;
        if (this.tStart === pTimeS) {
            this.startV = p.yArray[0];
        }
        if (this.tEnd === pTimeE) {
            this.endV = p.yArray[3];
        }
        if (pTimeE >= this.globalDataLen) {
            if (pTimeS <= this.tEnd) {
                if (p.yArray[1] < this.vRange[0]) {
                    this.vRange[0] = p.yArray[1];
                    const tRange = getIndexTime(p.level, p.index, this.maxLevel);
                    this.minVTimeRange = [tRange.startT, tRange.endT];
                }
                if (p.yArray[2] > this.vRange[1]) {
                    this.vRange[1] = p.yArray[2];
                    const tRange = getIndexTime(p.level, p.index, this.maxLevel);
                    this.maxVTimeRange = [tRange.startT, tRange.endT];
                }
            }
            return 6;
        }
        if (pTimeS >= this.tStart && pTimeE <= this.tEnd) {
            if (p.yArray[1] < this.vRange[0]) {
                this.vRange[0] = p.yArray[1];
                const tRange = getIndexTime(p.level, p.index, this.maxLevel);
                this.minVTimeRange = [tRange.startT, tRange.endT];
            }
            if (p.yArray[2] > this.vRange[1]) {
                this.vRange[1] = p.yArray[2];
                const tRange = getIndexTime(p.level, p.index, this.maxLevel);
                this.maxVTimeRange = [tRange.startT, tRange.endT];
            }
            return 1;
        } else if (pTimeS <= this.tEnd && pTimeE > this.tEnd) {
            return 2;
        } else if (pTimeS > this.tEnd) {
            return 3
        } else if (pTimeE < this.tStart) {
            // debugger
            return 4;
        } else if (pTimeE >= this.tStart) {
            //debugger
            return 5
        } else {
            console.log(p, this)
            throw new Error("time out of range")
        }
    }
    isMissContain(p: TrendTree) {
        const pL = p.level;
        const pTRange = (2 ** this.maxLevel) / (2 ** pL);
        const pTimeS = p.index * pTRange;
        const pTimeE = pTRange + pTimeS - 1;

        if (pTimeE >= this.globalDataLen) {
            return 6;
        }
        if (pTimeS >= this.tStart && pTimeE <= this.tEnd) {
            if(pTimeS==this.tStart&&pTimeE==this.tEnd){
                return 7;
            }else if(pTimeS===this.tStart){
                return 8;
            }else if(pTimeE===this.tEnd){
                return 9;
            }else if(p.gapFlag!=='NO'){
                return 10
            }
            //console.log(pTimeS,pTimeE,this.tStart,this.tEnd)
            return 1;
        } else if (pTimeS <= this.tEnd && pTimeE > this.tEnd) {
            return 2;
        } else if (pTimeS > this.tEnd) {
            return 3
        } else if (pTimeE < this.tStart) {
            return 4;
        } else if (pTimeE >= this.tStart) {
            return 5
        } else {
            console.log(p, this)
            throw new Error("time out of range")
        }
    }
    containColumnRange(p: TrendTree, type: number) {
        if (p.nodeType === "NULL") {
            return
        }
        if ( p.yArray[1] === undefined || p.yArray[2] === undefined) {
            debugger
            throw new Error("error val")
        }
        const pL = p.level;
        const pTRange = (2 ** this.maxLevel) / (2 ** pL);
        const pTimeS = p.index * pTRange;
        const pTimeE = pTRange + pTimeS - 1;
        if (this.tStart === pTimeS) {
            // throw new Error("cannot use this val")
            // this.startV = p.yArray[0];
        }
        if (this.tEnd === pTimeE) {
            // throw new Error("cannot use this val")
            // this.endV = 0;//p.yArray[3];
        }
        if (type === 6) {
            // console.log(pTimeE)
            // console.log(this.globalDataLen)
            // console.error("type 6");
            //throw new Error("type 8")
        }
        if (type === 1||type===7||type===8||type===9) {
            if (p.yArray[1] < this.vRange[0]) {
                this.vRange[0] = p.yArray[1];
                const tRange = getIndexTime(p.level, p.index, this.maxLevel);
                this.minVTimeRange = [tRange.startT, tRange.endT];
            }
            if (p.yArray[2] > this.vRange[1]) {
                this.vRange[1] = p.yArray[2];
                const tRange = getIndexTime(p.level, p.index, this.maxLevel);
                this.maxVTimeRange = [tRange.startT, tRange.endT];
            }
            if(this.ordinalLevelCount === 0){
                this.average = p.yArray[3];
                this.currentSum += p.yArray[3] * pTRange;
                this.currentPointNum += pTRange;
                this.currentRange.push([pTimeS, pTimeE]);
                this.ordinalLevelCount++;
            }
            else{
                // let levelDif = 2 ** this.ordinalLevelCount;
                // // let newAverage = (this.average + (1 / levelDif) * p.yArray[3]) / (1 + (1 / levelDif));
                // let newAverage = (this.average * (levelDif - 1) * 2 + p.yArray[3]) / (levelDif * 2 - 1);
                // this.average = newAverage;
                this.currentSum += p.yArray[3] * pTRange;
                this.currentPointNum += pTRange;
                this.average = this.currentSum / this.currentPointNum;
                this.currentRange.push([pTimeS, pTimeE]);
                this.ordinalLevelCount++;
            }
            // if (p.parent && p.parent.nodeType === 'LEFTNULL') {
            //     this.startV = p.yArray[0];
            // }
            // if (p.parent && p.parent.nodeType === 'RIGHTNULL') {
            //     if (this.endV! > p.yArray[3]) {
            //         throw new Error("dddddddddddd")
            //     }
            //     this.endV = p.yArray[3];
            // }
        }
        return;
    }

    computeTransform(p: TrendTree, p2:TrendTree, type: number, currentFlagInfo: any, currentFlagInfo2: any) {
        if (p.nodeType === "NULL") {
            return
        }
        if ( p.yArray[1] === undefined || p.yArray[2] === undefined) {
            debugger
            throw new Error("error val")
        }
        const pL = p.level;
        const pTRange = (2 ** this.maxLevel) / (2 ** pL);
        const pTimeS = p.index * pTRange;
        const pTimeE = pTRange + pTimeS - 1;
        let symbol = 'add_min';
        if((type === 1 || type === 7 || type ===8 || type === 9) && symbol === 'add_min'){
            let min1 = p.yArray[1];
            let min2 = p2.yArray[1];   

            let min = (min1 + min2);
            let max = (p.yArray[2] + p2.yArray[2]);
            let tempMin;

            let alternativeNodes = [];
            while(max > 0){
                let temp_minL:number = min, temp_minR:number = min;
                if(!p._leftChild && !p._rightChild){
                    let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    let nodeFlagInfo2 = currentFlagInfo2[p.index * 2 + 1];
                    if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                        min = p.yArray[1] + p2.yArray[1];
                    }
                    else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                        min = p.yArray[1] + p2.yArray[1];
                    }
                    else{
                        min = Math.min(p.yArray[1] + p2.yArray[2], p.yArray[2] + p2.yArray[1]);
                    }
                    break;
                }
                if(p._leftChild && p2._leftChild){
                    temp_minL = (p._leftChild.yArray[1] + p2._leftChild.yArray[1]);
                }
                if(p._rightChild && p2._rightChild){
                    temp_minR = (p._rightChild.yArray[1] + p2._rightChild.yArray[1]);
                }
                if(temp_minL <= temp_minR && p._leftChild && p2._leftChild){
                   
                    tempMin = temp_minL;
                    alternativeNodes.push([p, p2, p._rightChild, p2._rightChild, temp_minR]);
                    p = p._leftChild;
                    p2 = p2._leftChild;
                }
                else if(temp_minL > temp_minR && p._rightChild && p2._rightChild){
                    
                    tempMin = temp_minR;
                    alternativeNodes.push([p, p2, p._leftChild, p2._leftChild, temp_minL]);
                    p = p._rightChild;
                    p2 = p2._rightChild;
                }
            }
            console.log("The bottom min(+):", min);
            while(alternativeNodes.length > 0){
                let pop:any = alternativeNodes.pop();
                if(pop === undefined ) continue;
                // console.log("pop:", pop);
                // console.log("pop[0]:", pop![0]);
                // console.log("pop[4]:", pop![4]);
                if(Number(pop[4]) > min) continue;
                // min = this.updateMinValue(p![0], min, alternativeNodes);
                let temp_minL:number = min, temp_minR:number = min;
                if(!pop[2]._leftChild && !pop[3]._rightChild){
                    let nodeFlagInfo1 = currentFlagInfo[(pop[2].index) * 2 + 1];
                    let nodeFlagInfo2 = currentFlagInfo2[(pop[2].index) * 2 + 1];
                    if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                        min = Math.min(pop[2].yArray[1] + pop[3].yArray[1], min);
                    }
                    else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                        min = Math.min(pop[2].yArray[1] + pop[3].yArray[1], min);
                    }
                    else{
                        min = Math.min(Math.min(pop[2].yArray[1] + pop[3].yArray[2], pop[2].yArray[2] + pop[3].yArray[1]), min);
                    }
                    continue;
                }
                if(pop[2]._leftChild && pop[2]._leftChild){
                    temp_minL = (pop[2]._leftChild.yArray[1] + pop[3]._leftChild.yArray[1]);
                    if(temp_minL < min)
                        alternativeNodes.push([pop[2], pop[3], pop[2]._leftChild, pop[3]._leftChild, temp_minL]);
                }
                if(pop[2]._rightChild && pop[2]._rightChild){
                    temp_minR = (pop[2]._rightChild.yArray[1] + pop[3]._rightChild.yArray[1]);
                    if(temp_minR < min)
                        alternativeNodes.push([pop[2], pop[3], pop[2]._rightChild, pop[3]._rightChild, temp_minR]);
                }
                // if(pop[2]._leftChild && pop[3]._rightChild){
                //     // tempMin = temp_minL;
                //     if(temp_minL < min)
                //         alternativeNodes.push([pop[2], pop[3], pop[2]._leftChild, pop[3]._leftChild, temp_minL]);
                //     if(temp_minR < min)
                //         alternativeNodes.push([pop[2], pop[3], pop[2]._rightChild, pop[3]._rightChild, temp_minR]);
                //     // p = p._leftChild;
                //     // p2 = p2._leftChild;
                // }
                // else if(temp_minL > temp_minR && pop[2]._leftChild && pop[3]._rightChild){    
                //     tempMin = temp_minR;
                //     alternativeNodes.push([pop[2], pop[3], pop[2]._leftChild, pop[3]._leftChild, temp_minL]);
                //     // p = p._rightChild;
                //     // p2 = p2._rightChild;
                // }
            }
            console.log("The final min(+):", min);
            this.addMin = Math.min(min, this.addMin);
        }
        if((type === 1 || type === 7 || type ===8 || type === 9) && symbol === 'add_max'){
            let max1 = p.yArray[2];
            let max2 = p2.yArray[2];

            let max = (max1 + max2);
            let tempMax;

            let alternativeNodes = [];
            while(max > 0){
                let temp_maxL:number = max, temp_maxR:number = max;
                if(!p._leftChild && !p._rightChild){
                    let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    let nodeFlagInfo2 = currentFlagInfo2[p.index * 2 + 1];
                    if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                        max = p.yArray[2] + p2.yArray[2];
                    }
                    else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                        max = p.yArray[2] + p2.yArray[2];
                    }
                    else{
                        max = Math.max(p.yArray[1] + p2.yArray[2], p.yArray[2] + p2.yArray[1]);
                    }
                    break;
                }
                if(p._leftChild && p2._leftChild){
                    temp_maxL = (p._leftChild.yArray[2] + p2._leftChild.yArray[2]);
                }
                if(p._rightChild && p2._rightChild){
                    temp_maxR = (p._rightChild.yArray[2] + p2._rightChild.yArray[2]);
                }
                if(temp_maxL <= temp_maxR && p._leftChild && p2._leftChild){
                   
                    tempMax = temp_maxR;
                    alternativeNodes.push([p, p2, p._rightChild, p2._rightChild, temp_maxL]);
                    p = p._leftChild;
                    p2 = p2._leftChild;
                }
                else if(temp_maxL > temp_maxR && p._rightChild && p2._rightChild){
                    
                    tempMax = temp_maxL;
                    alternativeNodes.push([p, p2, p._leftChild, p2._leftChild, temp_maxR]);
                    p = p._rightChild;
                    p2 = p2._rightChild;
                }
            }
            console.log("The bottom max(+):", max);
            while(alternativeNodes.length > 0){
                let pop:any = alternativeNodes.pop();
                if(pop === undefined ) continue;
                // let p:[TrendTree, number] = alternativeNodes.pop();
                console.log("pop:", pop);
                console.log("pop[0]:", pop![0]);
                console.log("pop[4]:", pop![4]);
                if(Number(pop[4]) < max) continue;
            
                let temp_maxL:number = max, temp_maxR:number = max;
                if(!pop[2]._leftChild && !pop[3]._rightChild){
                    let nodeFlagInfo1 = currentFlagInfo[(pop[2].index) * 2 + 1];
                    let nodeFlagInfo2 = currentFlagInfo2[(pop[2].index) * 2 + 1];
                    if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                        max = Math.max(pop[2].yArray[2] + pop[3].yArray[2], max);
                    }
                    else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                        max = Math.max(pop[2].yArray[2] + pop[3].yArray[2], max);
                    }
                    else{
                        max = Math.max(Math.max(pop[2].yArray[1] + pop[3].yArray[2], pop[2].yArray[2] + pop[3].yArray[1]), max);
                    }
                    continue;
                }
                if(pop[2]._leftChild && pop[2]._leftChild){
                    temp_maxL = (pop[2]._leftChild.yArray[2] + pop[3]._leftChild.yArray[2]);
                    if(temp_maxL > max)
                        alternativeNodes.push([pop[2], pop[3], pop[2]._leftChild, pop[3]._leftChild, temp_maxL]);
                }
                if(pop[2]._rightChild && pop[2]._rightChild){
                    temp_maxR = (pop[2]._rightChild.yArray[2] + pop[3]._rightChild.yArray[2]);
                    if(temp_maxR > max)
                        alternativeNodes.push([pop[2], pop[3], pop[2]._rightChild, pop[3]._rightChild, temp_maxR]);
                }
            }
            console.log("The final max(+):", max);
            this.addMax = Math.max(max, this.addMax);
        }
        if((type === 1 || type === 7 || type ===8 || type === 9) && symbol === 'sub_min'){
            let min1 = p.yArray[1];
            let min2 = p2.yArray[1];  
            let max1 = p.yArray[2];
            let max2 = p2.yArray[2];

            let min = (min1 - max2);
            let max = (p.yArray[2] + p2.yArray[2]);
            let tempMin;

            let alternativeNodes = [];
            while(max > 0){
                let temp_minL:number = min, temp_minR:number = min;
                if(!p._leftChild && !p._rightChild){
                    let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    let nodeFlagInfo2 = currentFlagInfo2[p.index * 2 + 1];
                    if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                        min = Math.min(p.yArray[1] - p2.yArray[1], p.yArray[2] - p2.yArray[2]);
                    }
                    else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                        min = Math.min(p.yArray[1] - p2.yArray[1], p.yArray[2] - p2.yArray[2]);
                    }
                    else{
                        min = Math.min(p.yArray[1] - p2.yArray[2], p.yArray[2] - p2.yArray[1]);
                    }
                    break;
                }
                if(p._leftChild && p2._leftChild){
                    temp_minL = (p._leftChild.yArray[1] - p2._leftChild.yArray[2]);
                }
                if(p._rightChild && p2._rightChild){
                    temp_minR = (p._rightChild.yArray[1] + p2._rightChild.yArray[2]);
                }
                if(temp_minL <= temp_minR && p._leftChild && p2._leftChild){
                   
                    tempMin = temp_minL;
                    alternativeNodes.push([p, p2, p._rightChild, p2._rightChild, temp_minR]);
                    p = p._leftChild;
                    p2 = p2._leftChild;
                }
                else if(temp_minL > temp_minR && p._rightChild && p2._rightChild){
                    
                    tempMin = temp_minR;
                    alternativeNodes.push([p, p2, p._leftChild, p2._leftChild, temp_minL]);
                    p = p._rightChild;
                    p2 = p2._rightChild;
                }
            }
            console.log("The bottom min(-):", min);
            while(alternativeNodes.length > 0){
                let pop:any = alternativeNodes.pop();
                if(pop === undefined ) continue;
                // let p:[TrendTree, number] = alternativeNodes.pop();
                console.log("pop:", pop);
                console.log("pop[0]:", pop![0]);
                console.log("pop[4]:", pop![4]);
                if(Number(pop[4]) > min) continue;
                // min = this.updateMinValue(p![0], min, alternativeNodes);
                let temp_minL:number = min, temp_minR:number = min;
                if(!pop[2]._leftChild && !pop[3]._rightChild){
                    let nodeFlagInfo1 = currentFlagInfo[(pop[2].index) * 2 + 1];
                    let nodeFlagInfo2 = currentFlagInfo2[(pop[2].index) * 2 + 1];
                    if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                        min = Math.min(Math.min(pop[2].yArray[1] - pop[3].yArray[1], pop[2].yArray[2] - pop[3].yArray[2]), min);
                    }
                    else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                        min = Math.min(Math.min(pop[2].yArray[1] - pop[3].yArray[1], pop[2].yArray[2] - pop[3].yArray[2]), min);
                    }
                    else{
                        min = Math.min(Math.min(pop[2].yArray[1] - pop[3].yArray[2], pop[2].yArray[2] - pop[3].yArray[1]), min);
                    }
                    continue;
                }
                if(pop[2]._leftChild && pop[2]._leftChild){
                    temp_minL = (pop[2]._leftChild.yArray[1] - pop[3]._leftChild.yArray[2]);
                    if(temp_minL < min)
                        alternativeNodes.push([pop[2], pop[3], pop[2]._leftChild, pop[3]._leftChild, temp_minL]);
                }
                if(pop[2]._rightChild && pop[2]._rightChild){
                    temp_minR = (pop[2]._rightChild.yArray[1] - pop[3]._rightChild.yArray[2]);
                    if(temp_minR < min)
                        alternativeNodes.push([pop[2], pop[3], pop[2]._rightChild, pop[3]._rightChild, temp_minR]);
                }
                console.log("The final min(-):", min);
                this.subMin = Math.min(min, this.subMin);
            }
        }
        if((type === 1 || type === 7 || type ===8 || type === 9) && symbol === 'sub_max'){
            let min1 = p.yArray[1];
            let min2 = p2.yArray[2];
            let max1 = p.yArray[2];
            let max2 = p2.yArray[2];

            let min = (min1 + min2);
            let max = (max1 + max2);
            let tempMax;

            let alternativeNodes = [];
            while(max > 0){
                let temp_maxL:number = max, temp_maxR:number = max;
                if(!p._leftChild && !p._rightChild){
                    let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    let nodeFlagInfo2 = currentFlagInfo2[p.index * 2 + 1];
                    if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                        max = Math.max(p.yArray[1] - p2.yArray[1], p.yArray[2] - p2.yArray[2]);
                    }
                    else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                        max = Math.max(p.yArray[1] - p2.yArray[1], p.yArray[2] - p2.yArray[2]);
                    }
                    else{
                        max = Math.max(p.yArray[1] - p2.yArray[2], p.yArray[2] - p2.yArray[1]);
                    }
                    break;
                }
                if(p._leftChild && p2._leftChild){
                    temp_maxL = (p._leftChild.yArray[2] - p2._leftChild.yArray[1]);
                }
                if(p._rightChild && p2._rightChild){
                    temp_maxR = (p._rightChild.yArray[2] - p2._rightChild.yArray[1]);
                }
                if(temp_maxL <= temp_maxR && p._leftChild && p2._leftChild){
                   
                    // tempMax = temp_maxR;
                    alternativeNodes.push([p, p2, p._rightChild, p2._rightChild, temp_maxL]);
                    p = p._leftChild;
                    p2 = p2._leftChild;
                }
                else if(temp_maxL > temp_maxR && p._rightChild && p2._rightChild){
                    
                    // tempMax = temp_maxL;
                    alternativeNodes.push([p, p2, p._leftChild, p2._leftChild, temp_maxR]);
                    p = p._rightChild;
                    p2 = p2._rightChild;
                }
            }
            console.log("The bottom max(-):", max);
            while(alternativeNodes.length > 0){
                let pop:any = alternativeNodes.pop();
                if(pop === undefined ) continue;
                // let p:[TrendTree, number] = alternativeNodes.pop();
                console.log("pop:", pop);
                console.log("pop[0]:", pop![0]);
                console.log("pop[4]:", pop![4]);
                if(Number(pop[4]) < max) continue;
            
                let temp_maxL:number = max, temp_maxR:number = max;
                if(!pop[2]._leftChild && !pop[3]._rightChild){
                    let nodeFlagInfo1 = currentFlagInfo[(pop[2].index) * 2 + 1];
                    let nodeFlagInfo2 = currentFlagInfo2[(pop[2].index) * 2 + 1];
                    if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                        max = Math.max(Math.max(pop[2].yArray[1] - pop[3].yArray[1], pop[2].yArray[2] - pop[3].yArray[2]), max);
                    }
                    else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                        max = Math.max(Math.max(pop[2].yArray[1] - pop[3].yArray[1], pop[2].yArray[2] - pop[3].yArray[2]), max);
                    }
                    else{
                        max = Math.max(Math.max(pop[2].yArray[1] - pop[3].yArray[2], pop[2].yArray[2] - pop[3].yArray[1]), max);
                    }
                    continue;
                }
                if(pop[2]._leftChild && pop[2]._leftChild){
                    temp_maxL = (pop[2]._leftChild.yArray[2] - pop[3]._leftChild.yArray[1]);
                    if(temp_maxL > max)
                        alternativeNodes.push([pop[2], pop[3], pop[2]._leftChild, pop[3]._leftChild, temp_maxL]);
                }
                if(pop[2]._rightChild && pop[2]._rightChild){
                    temp_maxR = (pop[2]._rightChild.yArray[2] - pop[3]._rightChild.yArray[1]);
                    if(temp_maxR > max)
                        alternativeNodes.push([pop[2], pop[3], pop[2]._rightChild, pop[3]._rightChild, temp_maxR]);
                }
            }
            console.log("The final max(-):", max);
            this.subMax = Math.max(max, this.subMax);
        }
        if((type === 1 || type === 7 || type ===8 || type === 9) && symbol === 'multi_min'){
            let min1 = p.yArray[1];
            let min2 = p2.yArray[1]; 
            let max1 = p.yArray[2];
            let max2 = p2.yArray[2];  

            let min = (min1 + min2);
            let max = (p.yArray[2] + p2.yArray[2]);
            let tempMin;

            let alternativeNodes = [];
            while(max > 0){
                let temp_minL:number = min, temp_minR:number = min;
                if(!p._leftChild && !p._rightChild){
                    let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    let nodeFlagInfo2 = currentFlagInfo2[p.index * 2 + 1];
                    if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                        min = Math.min(p.yArray[1] * p2.yArray[1], p.yArray[2] * p2.yArray[2]);
                    }
                    else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                        min = Math.min(p.yArray[1] * p2.yArray[1], p.yArray[2] * p2.yArray[2]);
                    }
                    else{
                        min = Math.min(p.yArray[1] * p2.yArray[2], p.yArray[2] * p2.yArray[1]);
                    }
                    break;
                }
                if(p._leftChild && p2._leftChild){
                    temp_minL = Math.min(p._leftChild.yArray[1] * p2._leftChild.yArray[1], p._leftChild.yArray[1] * p2._leftChild.yArray[2], p._leftChild.yArray[2] * p2._leftChild.yArray[1], p._leftChild.yArray[2] * p2._leftChild.yArray[2]);
                }
                if(p._rightChild && p2._rightChild){
                    temp_minR = Math.min(p._rightChild.yArray[1] * p2._rightChild.yArray[1], p._rightChild.yArray[1] * p2._rightChild.yArray[2], p._rightChild.yArray[2] * p2._rightChild.yArray[1], p._rightChild.yArray[2] * p2._rightChild.yArray[2]);
                }
                if(temp_minL <= temp_minR && p._leftChild && p2._leftChild){
                   
                    tempMin = temp_minL;
                    alternativeNodes.push([p, p2, p._rightChild, p2._rightChild, temp_minR]);
                    p = p._leftChild;
                    p2 = p2._leftChild;
                }
                else if(temp_minL > temp_minR && p._rightChild && p2._rightChild){
                    
                    tempMin = temp_minR;
                    alternativeNodes.push([p, p2, p._leftChild, p2._leftChild, temp_minL]);
                    p = p._rightChild;
                    p2 = p2._rightChild;
                }
            }
            console.log("The bottom min(*):", min);
            while(alternativeNodes.length > 0){
                let pop:any = alternativeNodes.pop();
                if(pop === undefined ) continue;
                // console.log("pop:", pop);
                // console.log("pop[0]:", pop![0]);
                // console.log("pop[4]:", pop![4]);
                if(Number(pop[4]) > min) continue;
                // min = this.updateMinValue(p![0], min, alternativeNodes);
                let temp_minL:number = min, temp_minR:number = min;
                if(!pop[2]._leftChild && !pop[3]._rightChild){
                    let nodeFlagInfo1 = currentFlagInfo[(pop[2].index) * 2 + 1];
                    let nodeFlagInfo2 = currentFlagInfo2[(pop[2].index) * 2 + 1];
                    if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                        min = Math.min(pop[2].yArray[1] * pop[3].yArray[1], pop[2].yArray[2] * pop[3].yArray[2], min);
                    }
                    else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                        min = Math.min(pop[2].yArray[1] + pop[3].yArray[1], pop[2].yArray[2] * pop[3].yArray[2], min);
                    }
                    else{
                        min = Math.min(pop[2].yArray[1] * pop[3].yArray[2], pop[2].yArray[2] * pop[3].yArray[1], min);
                    }
                    continue;
                }
                if(pop[2]._leftChild && pop[2]._leftChild){
                    temp_minL = Math.min(pop[2]._leftChild.yArray[1] * pop[3]._leftChild.yArray[1], pop[2]._leftChild.yArray[1] * pop[3]._leftChild.yArray[2], pop[2]._leftChild.yArray[2] * pop[3]._leftChild.yArray[1], pop[2]._leftChild.yArray[2] * pop[3]._leftChild.yArray[2]);
                    if(temp_minL < min)
                        alternativeNodes.push([pop[2], pop[3], pop[2]._leftChild, pop[3]._leftChild, temp_minL]);
                }
                if(pop[2]._rightChild && pop[2]._rightChild){
                    temp_minR = Math.min(pop[2]._rightChild.yArray[1] * pop[3]._rightChild.yArray[1], pop[2]._rightChild.yArray[1] * pop[3]._rightChild.yArray[2], pop[2]._rightChild.yArray[2] * pop[3]._rightChild.yArray[1], pop[2]._rightChild.yArray[2] * pop[3]._rightChild.yArray[2]);
                    if(temp_minR < min)
                        alternativeNodes.push([pop[2], pop[3], pop[2]._rightChild, pop[3]._rightChild, temp_minR]);
                }
            }
            console.log("The final min(*):", min);
            this.multiMin = Math.min(min, this.multiMin);
        }
    }

    // updateMinValue(p: any, min: number, alternativeNodes: any[]) {
    //     while(1){

    //     }
    //     return min;
    // }

    addLastVal(v: number, p?: any) {
        if (v === undefined) {
            return
        }
        this.endV = v

        let index = p.index * 2;
        let rangeArray = this.currentRange;
        let max = 0;
        for(let i=0;i<rangeArray.length;++i){
            if(rangeArray[i][1] > max) max = rangeArray[i][1];
        }
        if(index > max && index === max+1){
            this.currentRange.push([index]);
        }
        this.currentSum += v;
        this.currentPointNum += 1;
        this.average = this.currentSum / this.currentPointNum;
    }
    addFirstVal(v: number, p?: any) {
        if (v === undefined) {
            return
        }
        this.startV = v;

        let index = p.index * 2 + 1;
        let rangeArray = this.currentRange;
        let min = rangeArray[0][0];
        for(let i=0;i<rangeArray.length;++i){
            if(rangeArray[i][0] < min) min = rangeArray[i][0];
        }
        if(min > index && index === min-1){
            this.currentRange.push([index]);
        }
        this.currentSum += v;
        this.currentPointNum += 1;
        this.average = this.currentSum / this.currentPointNum;
    }
    forceMerge(val: number, index?: number) {
        if (val === undefined) {
            throw new Error("undefine")
            return
        }
        if (val < this.vRange[0]) {
            this.vRange[0] = val;
        }
        if (val > this.vRange[1]) {
            this.vRange[1] = val;
        }

    }
    mergeLast(k: number, b: number) {
        const val = k * this.tEnd + b;
        if (val === undefined) {
            throw new Error("undefine")
            return
        }
        if (val > this.vRange[1]) {
            this.vRange[1] = val;
        }
        if (val < this.vRange[0]) {
            this.vRange[0] = val;
        }
        this.endV = val;
    }
    mergeFirst(k: number, b: number) {
        const val = k * this.tStart + b;
        if (val === undefined) {
            throw new Error("undefine")
            return
        }
        if (val > this.vRange[1]) {
            this.vRange[1] = val;
        }
        if (val < this.vRange[0]) {
            this.vRange[0] = val;
        }
        this.startV = val;
    }
    checkIsMis() {
        if (this.vRange[0] === Infinity || this.vRange[1] === -Infinity) {
            this.isMis = true
        }
        return this.isMis
    }

}
