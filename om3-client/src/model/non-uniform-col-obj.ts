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
    addMin: [number, number];
    addMax: [number, number];
    subMin: [number, number];
    subMax: [number, number];
    multiMin: [number, number];
    multiMax: [number, number];
    divMin: [number, number];
    divMax: [number, number];
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
        this.addMin = [-1, Infinity];
        this.addMax = [-1, -Infinity];
        this.subMin = [-1, Infinity];
        this.subMax = [-1, -Infinity];
        this.multiMin = [-1, Infinity];
        this.multiMax = [-1, -Infinity];
        this.divMin = [-1, Infinity];
        this.divMax = [-1, -Infinity];
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
        this.addMin = [-1, Infinity];
        this.addMax = [-1, -Infinity];
        this.subMin = [-1, Infinity];
        this.subMax = [-1, -Infinity];
        this.multiMin = [-1, Infinity];
        this.multiMax = [-1, -Infinity];
        this.divMin = [-1, Infinity];
        this.divMax = [-1, -Infinity];
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

    computeTransform(p: TrendTree, p2:Array<TrendTree>, type: number, currentFlagInfo: any, currentFlagInfo2: any, transform_symbol: any) {
        // let p = pp, p2 = pp2;
        const pp = p, pp2 = p2.slice();
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
        // console.log("transform_symbol:",transform_symbol);
        let symbol = transform_symbol;
        if((type === 1 || type === 7 || type ===8 || type === 9) && symbol == '+'){
            // let p = pp, p2 = pp2;
            let min1 = p.yArray[1];
            let min2 = 0;
            for(let i=0;i<p2.length;i++){
                min2 += p2[i].yArray[1];
            } 
            let max1 = p.yArray[2];
            let max2 = 0;
            for(let i=0;i<p2.length;i++){
                max2 += p2[i].yArray[2];
            }

            let min = (min1 + min2);
            let max = (max1 + max2);
            let tempMin;
            let tempMax;
            let minIndex: [number, number];
            minIndex = [-1, Infinity];
            let maxIndex: [number, number];
            maxIndex = [-1, -Infinity];

            let alternativeNodes = [];
            let alternativeNodes2 = [];
            // let p = pp, p2 = pp2;
            while(max > -10000){
                let temp_minL = 0, temp_minR = 0;
                if(!p._leftChild && !p._rightChild){
                    let minL = 0, minR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        minL += p.yArray[1];
                        minR += p.yArray[2];
                    } 
                    else{
                        minL += p.yArray[2];
                        minR += p.yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][p.index * 2 + 1] === 0){
                            minL += p2[i].yArray[1];
                            minR += p2[i].yArray[2];
                        }
                        else{
                            minL += p2[i].yArray[2];
                            minR += p2[i].yArray[1];
                        }
                    }
                    if(minL < minR){
                        min = minL;
                        minIndex = [p.index * 2, min];
                    }
                    else{
                        min = minR;
                        minIndex = [p.index * 2 + 1, min];
                    }
                    if(min < this.addMin[1]){
                        this.addMin = minIndex;
                    }
                    // let nodeFlagInfo2 = currentFlagInfo2[p.index * 2 + 1];
                    // if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                    //     min = p.yArray[1] + p2.yArray[1];
                    //     minIndex = [p.index * 2, min];
                    // }
                    // else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                    //     min = p.yArray[1] + p2.yArray[1];
                    //     minIndex = [p.index * 2 + 1, min];
                    // }
                    // else if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 1){
                    //     // min = Math.min(p.yArray[1] + p2.yArray[2], p.yArray[2] + p2.yArray[1]);
                    //     if(p.yArray[1] + p2.yArray[2] < p.yArray[2] + p2.yArray[1]){
                    //         min = p.yArray[1] + p2.yArray[2];
                    //         minIndex = [p.index * 2, p.yArray[1] + p2.yArray[2]];
                    //     }
                    //     else{
                    //         min = p.yArray[2] + p2.yArray[1];
                    //         minIndex = [p.index * 2 + 1, p.yArray[2] + p2.yArray[1]];
                    //     }
                    // }
                    // else{
                    //     if(p.yArray[1] + p2.yArray[2] < p.yArray[2] + p2.yArray[1]){
                    //         min = p.yArray[1] + p2.yArray[2];
                    //         minIndex = [p.index * 2 + 1, p.yArray[1] + p2.yArray[2]];
                    //     }
                    //     else{
                    //         min = p.yArray[2] + p2.yArray[1];
                    //         minIndex = [p.index * 2, p.yArray[2] + p2.yArray[1]];
                    //     }
                    // }
                    break;
                }
                if(p._leftChild){
                    temp_minL = p._leftChild.yArray[1];
                    for(let i=0;i<p2.length;++i){
                        if(p2[i]._leftChild !== null){
                            temp_minL += p2[i]._leftChild!.yArray[1];
                        }
                    }
                }
                if(p._rightChild){
                    temp_minR = p._rightChild.yArray[1];
                    for(let i=0;i<p2.length;++i){
                        if(p2[i]._rightChild !== null){
                            temp_minR += p2[i]._rightChild!.yArray[1];
                        }
                    }
                }
                if(temp_minL <= temp_minR && p._leftChild){
                    let tempNode = [];
                    tempMin = temp_minL;
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._rightChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._rightChild);
                    }
                    tempNode.push(temp_minR);
                    alternativeNodes.push(tempNode);
                    p = p._leftChild;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._leftChild!;
                    }
                }
                else if(temp_minL > temp_minR && p._rightChild){
                    let tempNode = [];
                    tempMin = temp_minR;
                    // alternativeNodes.push([p, p2, p._leftChild, p2._leftChild, temp_minL]);
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._leftChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._leftChild);
                    }
                    tempNode.push(temp_minL);
                    p = p._rightChild;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._rightChild!;
                    }
                    alternativeNodes.push(tempNode);
                }
            }
            // console.log("The bottom min(+):", minIndex);
            p = pp, p2 = pp2;
            while(max > -10000){
                let temp_maxL = 0, temp_maxR = 0;
                // if(!p._leftChild && !p._rightChild){
                //     let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                //     let nodeFlagInfo2 = currentFlagInfo2[p.index * 2 + 1];
                    
                //     if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                //         max = p.yArray[2] + p2.yArray[2];
                //         maxIndex = [p.index * 2 + 1, max];
                //     }
                //     else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                //         max = p.yArray[2] + p2.yArray[2];
                //         maxIndex = [p.index * 2, max];
                //     }
                //     else if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 1){
                //         // min = Math.min(p.yArray[1] + p2.yArray[2], p.yArray[2] + p2.yArray[1]);
                //         if(p.yArray[1] + p2.yArray[2] > p.yArray[2] + p2.yArray[1]){
                //             max = p.yArray[1] + p2.yArray[2];
                //             maxIndex = [p.index * 2, p.yArray[1] + p2.yArray[2]];
                //         }
                //         else{
                //             max = p.yArray[2] + p2.yArray[1];
                //             maxIndex = [p.index * 2 + 1, p.yArray[2] + p2.yArray[1]];
                //         }
                //     }
                //     else{
                //         if(p.yArray[1] + p2.yArray[2] > p.yArray[2] + p2.yArray[1]){
                //             max = p.yArray[1] + p2.yArray[2];
                //             maxIndex = [p.index * 2 + 1, p.yArray[1] + p2.yArray[2]];
                //         }
                //         else{
                //             max = p.yArray[2] + p2.yArray[1];
                //             maxIndex = [p.index * 2, p.yArray[2] + p2.yArray[1]];
                //         }
                //     }
                //     break;
                // }
                if(!p._leftChild && !p._rightChild){
                    let maxL = 0, maxR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        maxL += p.yArray[1];
                        maxR += p.yArray[2];
                    } 
                    else{
                        maxL += p.yArray[2];
                        maxR += p.yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][p.index * 2 + 1] === 0){
                            maxL += p2[i].yArray[1];
                            maxR += p2[i].yArray[2];
                        }
                        else{
                            maxL += p2[i].yArray[2];
                            maxR += p2[i].yArray[1];
                        }
                    }
                    if(maxL > maxR){
                        max = maxL;
                        maxIndex = [p.index * 2, max];
                    }
                    else{
                        max = maxR;
                        maxIndex = [p.index * 2 + 1, max];
                    }
                    if(max > this.addMax[1]){
                        this.addMax = maxIndex;
                    }
                    break;
                }
                if(p._leftChild){
                    temp_maxL = p._leftChild.yArray[2];
                    for(let i=0;i<p2.length;++i){
                        if(p2[i]._leftChild !== null){
                            temp_maxL += p2[i]._leftChild!.yArray[2];
                        }
                    }
                }
                if(p._rightChild){
                    temp_maxR = p._rightChild.yArray[2];
                    for(let i=0;i<p2.length;++i){
                        if(p2[i]._leftChild !== null){
                            temp_maxR += p2[i]._rightChild!.yArray[2];
                        }
                    }
                }
                if(temp_maxL <= temp_maxR && p._rightChild){
                    let tempNode = [];
                    tempMax = temp_maxR;
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._leftChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._leftChild);
                    }
                    tempNode.push(temp_maxL);
                    alternativeNodes2.push(tempNode);
                    p = p._rightChild!;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._rightChild!;
                    }
                }
                else if(temp_maxL > temp_maxR && p._leftChild){
                    let tempNode = [];
                    tempMax = temp_maxL;
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._rightChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._rightChild);
                    }
                    tempNode.push(temp_maxR);
                    alternativeNodes2.push(tempNode);
                    p = p._leftChild!;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._leftChild!;
                    }
                }
            }
            // console.log("The bottom max(+):", maxIndex);
            p = pp, p2 = pp2;
            while(alternativeNodes.length > 0){
                let pop:any = alternativeNodes.pop();
                if(pop === undefined ) continue;
                // console.log("pop:", pop);
                if(Number(pop[pop.length-1]) > min) continue;
                // min = this.updateMinValue(p![0], min, alternativeNodes);
                let len = pop.length;
                let temp_minL = 0, temp_minR = 0;
                if(!pop[Math.floor(len/2)]._leftChild && !pop[Math.floor(len/2)]._rightChild){
                    let minL = 0, minR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[pop[Math.floor(len/2)].index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        minL += pop[Math.floor(len/2)].yArray[1];
                        minR += pop[Math.floor(len/2)].yArray[2];
                    } 
                    else{
                        minL += pop[Math.floor(len/2)].yArray[2];
                        minR += pop[Math.floor(len/2)].yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][pop[Math.floor(len/2)].index * 2 + 1] === 0){
                            minL += pop[Math.floor(len/2)+i+1].yArray[1];
                            minR += pop[Math.floor(len/2)+i+1].yArray[2];
                        }
                        else{
                            minL += pop[Math.floor(len/2)+i+1].yArray[2];
                            minR += pop[Math.floor(len/2)+i+1].yArray[1];
                        }
                    }
                    if(minL < minR){
                        min = minL;
                        minIndex = [pop[Math.floor(len/2)].index * 2, min];
                    }
                    else{
                        min = minR;
                        minIndex = [pop[Math.floor(len/2)].index * 2 + 1, min];
                    }
                    if(min < this.addMin[1]){
                        this.addMin = minIndex;
                    }
                    // let nodeFlagInfo1 = currentFlagInfo[(pop[2].index) * 2 + 1];
                    // let nodeFlagInfo2 = currentFlagInfo2[(pop[2].index) * 2 + 1];
                    // if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                    //     // min = Math.min(pop[2].yArray[1] + pop[3].yArray[1], min);
                    //     if(pop[2].yArray[1] + pop[3].yArray[1] < min){
                    //         min = pop[2].yArray[1] + pop[3].yArray[1];
                    //         minIndex = [pop[2].index * 2, min]
                    //     }
                    // }
                    // else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                    //     // min = Math.min(pop[2].yArray[1] + pop[3].yArray[1], min);
                    //     if(pop[2].yArray[1] + pop[3].yArray[1] < min){
                    //         min = pop[2].yArray[1] + pop[3].yArray[1];
                    //         minIndex = [pop[2].index * 2 + 1, min]
                    //     }
                    // }
                    // else if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 1){
                    //     // min = Math.min(Math.min(pop[2].yArray[1] + pop[3].yArray[2], pop[2].yArray[2] + pop[3].yArray[1]), min);
                    //     if(pop[2].yArray[1] + pop[3].yArray[2] < min){
                    //         min = pop[2].yArray[1] + pop[3].yArray[2];
                    //         minIndex = [pop[2].index * 2, min]
                    //     }
                    //     else if(pop[2].yArray[2] + pop[3].yArray[1] < min){
                    //         min = pop[2].yArray[2] + pop[3].yArray[1];
                    //         minIndex = [pop[2].index * 2 + 1, min]
                    //     }
                    // }
                    // else{
                    //     if(pop[2].yArray[1] + pop[3].yArray[2] < min){
                    //         min = pop[2].yArray[1] + pop[3].yArray[2];
                    //         minIndex = [pop[2].index * 2 + 1, min]
                    //     }
                    //     else if(pop[2].yArray[2] + pop[3].yArray[1] < min){
                    //         min = pop[2].yArray[2] + pop[3].yArray[1];
                    //         minIndex = [pop[2].index * 2, min]
                    //     }
                    // }
                    continue;
                }
                if(pop[Math.floor(len/2)]._leftChild){
                    let index = Math.floor(len / 2);
                    for(let i = index; i < index * 2; ++i){
                        temp_minL += pop[i]._leftChild.yArray[1];
                    }
                    // temp_minL = (pop[2]._leftChild.yArray[1] + pop[3]._leftChild.yArray[1]);
                    if(temp_minL < min){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._leftChild);
                        }
                        tempNode.push(temp_minL);
                        alternativeNodes.push(tempNode);
                    }
                }
                if(pop[Math.floor(len/2)]._rightChild){
                    // temp_minR = (pop[2]._rightChild.yArray[1] + pop[3]._rightChild.yArray[1]);
                    // if(temp_minR < min)
                    //     alternativeNodes.push([pop[2], pop[3], pop[2]._rightChild, pop[3]._rightChild, temp_minR]);
                    let index = Math.floor(len / 2);
                    for(let i = index; i < index * 2; ++i){
                        temp_minR += pop[i]._rightChild.yArray[1];
                    }
                    // temp_minL = (pop[2]._leftChild.yArray[1] + pop[3]._leftChild.yArray[1]);
                    if(temp_minR < min){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._rightChild);
                        }
                        tempNode.push(temp_minR);
                        alternativeNodes.push(tempNode);
                    }
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
            p = pp, p2 = pp2;
            while(alternativeNodes2.length > 0){
                let pop:any = alternativeNodes2.pop();
                if(pop === undefined ) continue;
                // let p:[TrendTree, number] = alternativeNodes.pop();
                // console.log("pop:", pop);
                // console.log("pop[0]:", pop![0]);
                // console.log("pop[4]:", pop![4]);
                if(Number(pop[pop.length-1]) < max) continue;
                let len = pop.length;
                let temp_maxL = 0, temp_maxR = 0;
                if(!pop[Math.floor(len/2)]._leftChild && !pop[Math.floor(len/2)]._rightChild){
                    let maxL = 0, maxR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[pop[Math.floor(len/2)].index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        maxL += pop[Math.floor(len/2)].yArray[1];
                        maxR += pop[Math.floor(len/2)].yArray[2];
                    } 
                    else{
                        maxL += pop[Math.floor(len/2)].yArray[2];
                        maxR += pop[Math.floor(len/2)].yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][p.index * 2 + 1] === 0){
                            maxL += pop[Math.floor(len/2)+i+1].yArray[1];
                            maxR += pop[Math.floor(len/2)+i+1].yArray[2];
                        }
                        else{
                            maxL += pop[Math.floor(len/2)+i+1].yArray[2];
                            maxR += pop[Math.floor(len/2)+i+1].yArray[1];
                        }
                    }
                    if(maxL > maxR){
                        max = maxL;
                        maxIndex = [pop[Math.floor(len/2)].index * 2, max];
                    }
                    else{
                        max = maxR;
                        maxIndex = [pop[Math.floor(len/2)].index * 2 + 1, max];
                    }
                    if(max > this.addMax[1]){
                        this.addMax = maxIndex;
                    }
                    // let nodeFlagInfo1 = currentFlagInfo[(pop[2].index) * 2 + 1];
                    // let nodeFlagInfo2 = currentFlagInfo2[(pop[2].index) * 2 + 1];
                    // if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                    //     // min = Math.min(pop[2].yArray[1] + pop[3].yArray[1], min);
                    //     if(pop[2].yArray[2] + pop[3].yArray[2] > max){
                    //         max = pop[2].yArray[2] + pop[3].yArray[2];
                    //         maxIndex = [pop[2].index * 2 + 1, max]
                    //     }
                    // }
                    // else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                    //     // min = Math.min(pop[2].yArray[1] + pop[3].yArray[1], min);
                    //     if(pop[2].yArray[1] + pop[3].yArray[1] > max){
                    //         max = pop[2].yArray[2] + pop[3].yArray[2];
                    //         maxIndex = [pop[2].index * 2, max]
                    //     }
                    // }
                    // else if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 1){
                    //     // min = Math.min(Math.min(pop[2].yArray[1] + pop[3].yArray[2], pop[2].yArray[2] + pop[3].yArray[1]), min);
                    //     if(pop[2].yArray[1] + pop[3].yArray[2] > max){
                    //         max = pop[2].yArray[1] + pop[3].yArray[2];
                    //         maxIndex = [pop[2].index * 2, max]
                    //     }
                    //     else if(pop[2].yArray[2] + pop[3].yArray[1] > max){
                    //         max = pop[2].yArray[2] + pop[3].yArray[1];
                    //         maxIndex = [pop[2].index * 2 + 1, max]
                    //     }
                    // }
                    // else{
                    //     if(pop[2].yArray[1] + pop[3].yArray[2] > max){
                    //         max = pop[2].yArray[1] + pop[3].yArray[2];
                    //         maxIndex = [pop[2].index * 2 + 1, max]
                    //     }
                    //     else if(pop[2].yArray[2] + pop[3].yArray[1] > max){
                    //         max = pop[2].yArray[2] + pop[3].yArray[1];
                    //         maxIndex = [pop[2].index * 2, max]
                    //     }
                    // }
                    continue;
                }
                if(pop[Math.floor(len/2)]._leftChild){
                    // temp_maxL = (pop[2]._leftChild.yArray[2] + pop[3]._leftChild.yArray[2]);
                    // if(temp_maxL > max)
                    //     alternativeNodes2.push([pop[2], pop[3], pop[2]._leftChild, pop[3]._leftChild, temp_maxL]);
                    let index = Math.floor(len / 2);
                    for(let i = index; i < index * 2; ++i){
                        temp_maxL += pop[i]._leftChild.yArray[2];
                    }
                    if(temp_maxL > max){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._leftChild);
                        }
                        tempNode.push(temp_maxL);
                        alternativeNodes.push(tempNode);
                    }
                }
                if(pop[Math.floor(len/2)]._rightChild){
                    // temp_maxR = (pop[2]._rightChild.yArray[2] + pop[3]._rightChild.yArray[2]);
                    // if(temp_maxR > max)
                    //     alternativeNodes2.push([pop[2], pop[3], pop[2]._rightChild, pop[3]._rightChild, temp_maxR]);
                    let index = Math.floor(len / 2);
                    for(let i = index; i < index * 2; ++i){
                        temp_maxR += pop[i]._rightChild.yArray[2];
                    }
                    if(temp_maxR > max){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._rightChild);
                        }
                        tempNode.push(temp_maxR);
                        alternativeNodes.push(tempNode);
                    }
                }
            }
            // console.log("The final max(+):", maxIndex);          
            // console.log("The final min(+):", minIndex);
            if(min < this.addMin[1]){
                this.addMin = minIndex;
            }
            if(max > this.addMax[1]){
                this.addMax = maxIndex;
            }
        }
        else if((type === 1 || type === 7 || type ===8 || type === 9) && symbol == '-'){
            // let p = pp, p2 = pp2;
            let min1 = p.yArray[1];
            let min2 = 0;
            for(let i=0;i<p2.length;i++){
                min2 += p2[i].yArray[1];
            }  
            let max1 = p.yArray[2];
            let max2 = 0;
            for(let i=0;i<p2.length;i++){
                max2 += p2[i].yArray[2];
            }

            let min = (min1 - max2);
            let max = (max2 - min1);
            let tempMin;
            let tempMax;
            let minIndex: [number, number];
            minIndex = [-1, Infinity];
            let maxIndex: [number, number];
            maxIndex = [-1, -Infinity];

            let alternativeNodes = [];
            let alternativeNodes2 = [];
            while(max > -100000){
                let temp_minL = 0, temp_minR = 0;
                if(!p._leftChild && !p._rightChild){
                    let minL = 0, minR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        minL += p.yArray[1];
                        minR += p.yArray[2];
                    } 
                    else{
                        minL += p.yArray[2];
                        minR += p.yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][p.index * 2 + 1] === 0){
                            minL -= p2[i].yArray[1];
                            minR -= p2[i].yArray[2];
                        }
                        else{
                            minL -= p2[i].yArray[2];
                            minR -= p2[i].yArray[1];
                        }
                    }
                    if(minL < minR){
                        min = minL;
                        minIndex = [p.index * 2, min];
                    }
                    else{
                        min = minR;
                        minIndex = [p.index * 2 + 1, min];
                    }
                    if(min < this.subMin[1]){
                        this.subMin = minIndex;
                    }
                    // let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    // let nodeFlagInfo2 = currentFlagInfo2[p.index * 2 + 1];
                    // if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                    //     min = Math.min(p.yArray[1] - p2.yArray[1], p.yArray[2] - p2.yArray[2]);
                    // }
                    // else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                    //     min = Math.min(p.yArray[1] - p2.yArray[1], p.yArray[2] - p2.yArray[2]);
                    // }
                    // else{
                    //     min = Math.min(p.yArray[1] - p2.yArray[2], p.yArray[2] - p2.yArray[1]);
                    // }
                    break;
                }
                if(p._leftChild){
                    // temp_minL = (p._leftChild.yArray[1] - p2._leftChild.yArray[2]);
                    temp_minL = p._leftChild.yArray[1];
                    for(let i=0;i<p2.length;++i){
                        if(p2[i]._leftChild !== null){
                            temp_minL -= p2[i]._leftChild!.yArray[2];
                        }
                    }
                }
                if(p._rightChild){
                    // temp_minR = (p._rightChild.yArray[1] - p2._rightChild.yArray[2]);
                    temp_minR = p._rightChild.yArray[1];
                    for(let i=0;i<p2.length;++i){
                        if(p2[i]._rightChild !== null){
                            temp_minR -= p2[i]._rightChild!.yArray[2];
                        }
                    }
                }
                if(temp_minL <= temp_minR && p._leftChild){
                    // tempMin = temp_minL;
                    // alternativeNodes.push([p, p2, p._rightChild, p2._rightChild, temp_minR]);
                    // p = p._leftChild;
                    // p2 = p2._leftChild;
                    let tempNode = [];
                    tempMin = temp_minL;
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._rightChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._rightChild);
                    }
                    tempNode.push(temp_minR);
                    alternativeNodes.push(tempNode);
                    p = p._leftChild;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._leftChild!;
                    }
                }
                else if(temp_minL > temp_minR && p._rightChild){
                    // tempMin = temp_minR;
                    // alternativeNodes.push([p, p2, p._leftChild, p2._leftChild, temp_minL]);
                    // p = p._rightChild;
                    // p2 = p2._rightChild;
                    let tempNode = [];
                    tempMin = temp_minR;
                    // alternativeNodes.push([p, p2, p._leftChild, p2._leftChild, temp_minL]);
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._leftChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._leftChild);
                    }
                    tempNode.push(temp_minL);
                    p = p._rightChild;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._rightChild!;
                    }
                    alternativeNodes.push(tempNode);
                }
            }
            console.log("The bottom min(-):", minIndex);
            p = pp, p2 = pp2;
            while(max > -100000){
                let temp_maxL = 0, temp_maxR = 0;
                if(!p._leftChild && !p._rightChild){
                    let maxL = 0, maxR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        maxL += p.yArray[1];
                        maxR += p.yArray[2];
                    } 
                    else{
                        maxL += p.yArray[2];
                        maxR += p.yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][p.index * 2 + 1] === 0){
                            maxL -= p2[i].yArray[1];
                            maxR -= p2[i].yArray[2];
                        }
                        else{
                            maxL -= p2[i].yArray[2];
                            maxR -= p2[i].yArray[1];
                        }
                    }
                    if(maxL > maxR){
                        max = maxL;
                        maxIndex = [p.index * 2, max];
                    }
                    else{
                        max = maxR;
                        maxIndex = [p.index * 2 + 1, max];
                    }
                    if(max > this.subMax[1]){
                        this.subMax = maxIndex;
                    }
                    // let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    // let nodeFlagInfo2 = currentFlagInfo2[p.index * 2 + 1];
                    // if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                    //     max = Math.max(p.yArray[1] - p2.yArray[1], p.yArray[2] - p2.yArray[2]);
                    // }
                    // else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                    //     max = Math.max(p.yArray[1] - p2.yArray[1], p.yArray[2] - p2.yArray[2]);
                    // }
                    // else{
                    //     max = Math.max(p.yArray[1] - p2.yArray[2], p.yArray[2] - p2.yArray[1]);
                    // }
                    break;
                }
                if(p._leftChild){
                    // temp_maxL = (p._leftChild.yArray[2] - p2._leftChild.yArray[1]);
                    temp_maxL = p._leftChild.yArray[2];
                    for(let i=0;i<p2.length;++i){
                        if(p2[i]._leftChild !== null){
                            temp_maxL -= p2[i]._leftChild!.yArray[1];
                        }
                    }
                }
                if(p._rightChild){
                    // temp_maxR = (p._rightChild.yArray[2] - p2._rightChild.yArray[1]);
                    temp_maxR = p._rightChild.yArray[2];
                    for(let i=0;i<p2.length;++i){
                        if(p2[i]._leftChild !== null){
                            temp_maxR -= p2[i]._rightChild!.yArray[1];
                        }
                    }
                }
                if(temp_maxL <= temp_maxR && p._rightChild){
                    // alternativeNodes.push([p, p2, p._rightChild, p2._rightChild, temp_maxL]);
                    // p = p._leftChild;
                    // p2 = p2._leftChild;
                    let tempNode = [];
                    tempMax = temp_maxR;
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._leftChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._leftChild);
                    }
                    tempNode.push(temp_maxL);
                    alternativeNodes2.push(tempNode);
                    p = p._rightChild;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._rightChild!;
                    }
                }
                else if(temp_maxL > temp_maxR && p._leftChild){
                    // alternativeNodes.push([p, p2, p._leftChild, p2._leftChild, temp_maxR]);
                    // p = p._rightChild;
                    // p2 = p2._rightChild;
                    let tempNode = [];
                    tempMax = temp_maxL;
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._rightChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._rightChild);
                    }
                    tempNode.push(temp_maxR);
                    alternativeNodes2.push(tempNode);
                    p = p._leftChild;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._leftChild!;
                    }
                }
            }
            console.log("The bottom max(-):", maxIndex);
            p = pp, p2 = pp2;
            while(alternativeNodes.length > 0){
                // console.log("alternativeNodes:", alternativeNodes);
                let pop:any = alternativeNodes.pop();
                if(pop === undefined ) continue;
                // let p:[TrendTree, number] = alternativeNodes.pop();
                // console.log("pop:", pop);
                if(Number(pop[pop.length-1]) > min) continue;
                // min = this.updateMinValue(p![0], min, alternativeNodes);
                let temp_minL = 0, temp_minR = 0;
                let len = pop.length;
                if(!pop[Math.floor(len/2)]._leftChild && !pop[Math.floor(len/2)]._rightChild){
                    let minL = 0, minR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[pop[Math.floor(len/2)].index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        minL += pop[Math.floor(len/2)].yArray[1];
                        minR += pop[Math.floor(len/2)].yArray[2];
                    } 
                    else{
                        minL += pop[Math.floor(len/2)].yArray[2];
                        minR += pop[Math.floor(len/2)].yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][pop[Math.floor(len/2)].index * 2 + 1] === 0){
                            minL -= pop[Math.floor(len/2)+i+1].yArray[1];
                            minR -= pop[Math.floor(len/2)+i+1].yArray[2];
                        }
                        else{
                            minL -= pop[Math.floor(len/2)+i+1].yArray[2];
                            minR -= pop[Math.floor(len/2)+i+1].yArray[1];
                        }
                    }
                    if(minL < minR){
                        min = minL;
                        minIndex = [pop[Math.floor(len/2)].index * 2, min];
                    }
                    else{
                        min = minR;
                        minIndex = [pop[Math.floor(len/2)].index * 2 + 1, min];
                    }
                    if(min < this.subMin[1]){
                        this.subMin = minIndex;
                    }
                    // let nodeFlagInfo1 = currentFlagInfo[(pop[2].index) * 2 + 1];
                    // let nodeFlagInfo2 = currentFlagInfo2[(pop[2].index) * 2 + 1];
                    // if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                    //     min = Math.min(Math.min(pop[2].yArray[1] - pop[3].yArray[1], pop[2].yArray[2] - pop[3].yArray[2]), min);
                    // }
                    // else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                    //     min = Math.min(Math.min(pop[2].yArray[1] - pop[3].yArray[1], pop[2].yArray[2] - pop[3].yArray[2]), min);
                    // }
                    // else{
                    //     min = Math.min(Math.min(pop[2].yArray[1] - pop[3].yArray[2], pop[2].yArray[2] - pop[3].yArray[1]), min);
                    // }
                    continue;
                }
                if(pop[Math.floor(len/2)]._leftChild){
                    // temp_minL = (pop[2]._leftChild.yArray[1] - pop[3]._leftChild.yArray[2]);
                    // if(temp_minL < min)
                    //     alternativeNodes.push([pop[2], pop[3], pop[2]._leftChild, pop[3]._leftChild, temp_minL]);
                    let index = Math.floor(len / 2);
                    temp_minL = pop[index]._leftChild.yArray[1];
                    for(let i = index + 1; i < index * 2; ++i){
                        temp_minL -= pop[i]._leftChild.yArray[2];
                    }
                    // temp_minL = (pop[2]._leftChild.yArray[1] + pop[3]._leftChild.yArray[1]);
                    if(temp_minL < min){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._leftChild);
                        }
                        tempNode.push(temp_minL);
                        alternativeNodes.push(tempNode);
                    }
                }
                if(pop[Math.floor(len/2)]._rightChild){
                    // temp_minR = (pop[2]._rightChild.yArray[1] - pop[3]._rightChild.yArray[2]);
                    // if(temp_minR < min)
                    //     alternativeNodes.push([pop[2], pop[3], pop[2]._rightChild, pop[3]._rightChild, temp_minR]);
                    let index = Math.floor(len / 2);
                    temp_minR = pop[index]._rightChild.yArray[1];
                    for(let i = index + 1; i < index * 2; ++i){
                        temp_minR -= pop[i]._rightChild.yArray[2];
                    }
                    // temp_minL = (pop[2]._leftChild.yArray[1] + pop[3]._leftChild.yArray[1]);
                    if(temp_minR < min){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._rightChild);
                        }
                        tempNode.push(temp_minR);
                        alternativeNodes.push(tempNode);
                    }
                }
                // console.log("The final min(-):", min);
                // this.subMin = Math.min(min, this.subMin);
            }
            p = pp, p2 = pp2;
            while(alternativeNodes2.length > 0){
                // console.log("alternativeNodes2:", alternativeNodes2);
                let pop:any = alternativeNodes2.pop();
                if(pop === undefined ) continue;
                // console.log("pop:", pop);
                if(Number(pop[pop.length-1]) < max) continue;
                let len = pop.length;
                let temp_maxL = 0, temp_maxR = 0;
                if(!pop[Math.floor(len/2)]._leftChild && !pop[Math.floor(len/2)]._rightChild){
                    let maxL = 0, maxR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[pop[Math.floor(len/2)].index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        maxL += pop[Math.floor(len/2)].yArray[1];
                        maxR += pop[Math.floor(len/2)].yArray[2];
                    } 
                    else{
                        maxL += pop[Math.floor(len/2)].yArray[2];
                        maxR += pop[Math.floor(len/2)].yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][pop[Math.floor(len/2)].index * 2 + 1] === 0){
                            maxL -= pop[Math.floor(len/2)+i+1].yArray[1];
                            maxR -= pop[Math.floor(len/2)+i+1].yArray[2];
                        }
                        else{
                            maxL -= pop[Math.floor(len/2)+i+1].yArray[2];
                            maxR -= pop[Math.floor(len/2)+i+1].yArray[1];
                        }
                    }
                    if(maxL > maxR){
                        max = maxL;
                        maxIndex = [pop[Math.floor(len/2)].index * 2, max];
                    }
                    else{
                        max = maxR;
                        maxIndex = [pop[Math.floor(len/2)].index * 2 + 1, max];
                    }
                    if(max > this.subMax[1]){
                        this.subMax = maxIndex;
                    }
                    // let nodeFlagInfo1 = currentFlagInfo[(pop[2].index) * 2 + 1];
                    // let nodeFlagInfo2 = currentFlagInfo2[(pop[2].index) * 2 + 1];
                    // if(nodeFlagInfo1 === 0 && nodeFlagInfo2 === 0){
                    //     max = Math.max(Math.max(pop[2].yArray[1] - pop[3].yArray[1], pop[2].yArray[2] - pop[3].yArray[2]), max);
                    // }
                    // else if(nodeFlagInfo1 === 1 && nodeFlagInfo2 === 1){
                    //     max = Math.max(Math.max(pop[2].yArray[1] - pop[3].yArray[1], pop[2].yArray[2] - pop[3].yArray[2]), max);
                    // }
                    // else{
                    //     max = Math.max(Math.max(pop[2].yArray[1] - pop[3].yArray[2], pop[2].yArray[2] - pop[3].yArray[1]), max);
                    // }
                    continue;
                }
                if(pop[Math.floor(len/2)]._leftChild){
                    // temp_maxL = (pop[2]._leftChild.yArray[2] - pop[3]._leftChild.yArray[1]);
                    // if(temp_maxL > max)
                    //     alternativeNodes.push([pop[2], pop[3], pop[2]._leftChild, pop[3]._leftChild, temp_maxL]);
                    let index = Math.floor(len / 2);
                    temp_maxL = pop[index]._leftChild.yArray[2];
                    for(let i = index + 1; i < index * 2; ++i){
                        temp_maxL -= pop[i]._leftChild.yArray[1];
                    }
                    if(temp_maxL > max){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._leftChild);
                        }
                        tempNode.push(temp_maxL);
                        alternativeNodes2.push(tempNode);
                    }
                }
                if(pop[Math.floor(len/2)]._rightChild){
                    // temp_maxR = (pop[2]._rightChild.yArray[2] - pop[3]._rightChild.yArray[1]);
                    // if(temp_maxR > max)
                    //     alternativeNodes.push([pop[2], pop[3], pop[2]._rightChild, pop[3]._rightChild, temp_maxR]);
                    let index = Math.floor(len / 2);
                    temp_maxR = pop[index]._rightChild.yArray[2];
                    for(let i = index; i < index * 2; ++i){
                        temp_maxR -= pop[i]._rightChild.yArray[1];
                    }
                    if(temp_maxR > max){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._rightChild);
                        }
                        tempNode.push(temp_maxR);
                        alternativeNodes2.push(tempNode);
                    }
                }
            }
                     
            console.log("The final min(-):", minIndex);
            console.log("The final max(-):", maxIndex); 
            if(min < this.subMin[1]){
                this.subMin = minIndex;
            }
            if(max > this.subMax[1]){
                this.subMax = maxIndex;
            }
        }
        else if((type === 1 || type === 7 || type ===8 || type === 9) && symbol === '*'){
            // let p = pp, p2 = pp2;
            let min1 = p.yArray[1];
            let min2 = 1;
            for(let i=0;i<p2.length;i++){
                min2 *= p2[i].yArray[1];
            }   
            let max1 = p.yArray[2];
            let max2 = 1;
            for(let i=0; i<p2.length; ++i){
                max2 *= p2[i].yArray[2];
            } 
            let min = (min1 * min2);
            let max = (max1 * max2);
            let minIndex : [number, number];
            minIndex = [-1, Infinity];
            let maxIndex: [number, number];
            maxIndex = [-1, -Infinity];

            let alternativeNodes = [];
            let alternativeNodes2 = [];
            while(max > -Infinity){
                let temp_minL = 0, temp_minR = 0;
                if(!p._leftChild && !p._rightChild){
                    let minL = 0, minR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        minL += p.yArray[1];
                        minR += p.yArray[2];
                    } 
                    else{
                        minL += p.yArray[2];
                        minR += p.yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][p.index * 2 + 1] === 0){
                            minL *= p2[i].yArray[1];
                            minR *= p2[i].yArray[2];
                        }
                        else{
                            minL *= p2[i].yArray[2];
                            minR *= p2[i].yArray[1];
                        }
                    }
                    if(minL < minR){
                        min = minL;
                        minIndex = [p.index * 2, min];
                    }
                    else{
                        min = minR;
                        minIndex = [p.index * 2 + 1, min];
                    }
                    if(min < this.multiMin[1]){
                        this.multiMin = minIndex;
                    }
                    break;
                }
                if(p._leftChild){
                    // temp_minL = Math.min(p._leftChild.yArray[1] * p2[0]._leftChild!.yArray[1], p._leftChild.yArray[1] * p2[0]._leftChild!.yArray[2], p._leftChild.yArray[2] * p2[0]._leftChild!.yArray[1], p._leftChild.yArray[2] * p2[0]._leftChild!.yArray[2]);
                    let tempArray = [];
                    tempArray.push(p._leftChild.yArray[1]);
                    tempArray.push(p._leftChild.yArray[2]);
                    for(let i = 0; i<p2.length; ++i){
                        let len = tempArray.length;
                         for(let j = 0; j<len; ++j){
                            tempArray.push(tempArray[j] * p2[i]._leftChild!.yArray[1]);
                            tempArray.push(tempArray[j] * p2[i]._leftChild!.yArray[2]);
                        }
                        for(let j = 0; j<len; ++j){
                            tempArray.shift();
                        }   
                    }
                    // console.log(tempArray);
                    temp_minL = Math.min(...tempArray);
                }
                if(p._rightChild){
                    // temp_minR = Math.min(p._rightChild.yArray[1] * p2[0]._rightChild!.yArray[1], p._rightChild.yArray[1] * p2[0]._rightChild!.yArray[2], p._rightChild.yArray[2] * p2[0]._rightChild!.yArray[1], p._rightChild.yArray[2] * p2[0]._rightChild!.yArray[2]);
                    let tempArray = [];
                    tempArray.push(p._rightChild.yArray[1]);
                    tempArray.push(p._rightChild.yArray[2]);
                    for(let i = 0; i<p2.length; ++i){
                        let len = tempArray.length;
                         for(let j = 0; j<len; ++j){
                            tempArray.push(tempArray[j] * p2[i]._rightChild!.yArray[1]);
                            tempArray.push(tempArray[j] * p2[i]._rightChild!.yArray[2]);
                        }   
                        for(let j = 0; j<len; ++j){
                            tempArray.shift();
                        }   
                    }
                    // console.log(tempArray);
                    temp_minR = Math.min(...tempArray);
                }
                if(temp_minL <= temp_minR && p._leftChild){
                    let tempNode = [];
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._rightChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._rightChild);
                    }
                    tempNode.push(temp_minR);
                    alternativeNodes.push(tempNode);
                    p = p._leftChild;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._leftChild!;
                    }
                }
                else if(temp_minL > temp_minR && p._rightChild){
                    let tempNode = [];
                    // alternativeNodes.push([p, p2, p._leftChild, p2._leftChild, temp_minL]);
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._leftChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._leftChild);
                    }
                    tempNode.push(temp_minL);
                    p = p._rightChild;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._rightChild!;
                    }
                    alternativeNodes.push(tempNode);
                }
            }
            console.log("The bottom min(*):", minIndex);
            p = pp, p2 = pp2;
            while(max > -Infinity){
                let temp_maxL = 0, temp_maxR = 0;
                if(!p._leftChild && !p._rightChild){
                    let maxL = 0, maxR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[p.index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        maxL += p.yArray[1];
                        maxR += p.yArray[2];
                    } 
                    else{
                        maxL += p.yArray[2];
                        maxR += p.yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][p.index * 2 + 1] === 0){
                            maxL *= p2[i].yArray[1];
                            maxR *= p2[i].yArray[2];
                        }
                        else{
                            maxL *= p2[i].yArray[2];
                            maxR *= p2[i].yArray[1];
                        }
                    }
                    if(maxL > maxR){
                        max = maxL;
                        maxIndex = [p.index * 2, max];
                    }
                    else{
                        max = maxR;
                        maxIndex = [p.index * 2 + 1, max];
                    }
                    if(max > this.multiMax[1]){
                        this.multiMax = maxIndex;
                    }
                    break;
                }
                if(p._leftChild){
                    // temp_minL = Math.min(p._leftChild.yArray[1] * p2[0]._leftChild!.yArray[1], p._leftChild.yArray[1] * p2[0]._leftChild!.yArray[2], p._leftChild.yArray[2] * p2[0]._leftChild!.yArray[1], p._leftChild.yArray[2] * p2[0]._leftChild!.yArray[2]);
                    let tempArray = [];
                    tempArray.push(p._leftChild.yArray[1]);
                    tempArray.push(p._leftChild.yArray[2]);
                    for(let i = 0; i<p2.length; ++i){
                        let len = tempArray.length;
                         for(let j = 0; j<len; ++j){
                            tempArray.push(tempArray[j] * p2[i]._leftChild!.yArray[1]);
                            tempArray.push(tempArray[j] * p2[i]._leftChild!.yArray[2]);
                        }   
                        for(let j = 0; j<len; ++j){
                            tempArray.shift();
                        }   
                    }
                    // console.log(tempArray);
                    temp_maxL = Math.max(...tempArray);
                }
                if(p._rightChild){
                    // temp_minR = Math.min(p._rightChild.yArray[1] * p2[0]._rightChild!.yArray[1], p._rightChild.yArray[1] * p2[0]._rightChild!.yArray[2], p._rightChild.yArray[2] * p2[0]._rightChild!.yArray[1], p._rightChild.yArray[2] * p2[0]._rightChild!.yArray[2]);
                    let tempArray = [];
                    tempArray.push(p._rightChild.yArray[1]);
                    tempArray.push(p._rightChild.yArray[2]);
                    for(let i = 0; i<p2.length; ++i){
                        let len = tempArray.length;
                         for(let j = 0; j<len; ++j){
                            tempArray.push(tempArray[j] * p2[i]._rightChild!.yArray[1]);
                            tempArray.push(tempArray[j] * p2[i]._rightChild!.yArray[2]);
                        }   
                        for(let j = 0; j<len; ++j){
                            tempArray.shift();
                        }   
                    }
                    // console.log(tempArray);
                    temp_maxR = Math.max(...tempArray);
                }
                if(temp_maxL <= temp_maxR && p._rightChild){
                    let tempNode = [];
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._leftChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._leftChild);
                    }
                    tempNode.push(temp_maxL);
                    alternativeNodes2.push(tempNode);
                    p = p._rightChild;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._rightChild!;
                    }
                }
                else if(temp_maxL > temp_maxR && p._leftChild){
                    let tempNode = [];
                    // alternativeNodes.push([p, p2, p._leftChild, p2._leftChild, temp_minL]);
                    tempNode.push(p);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]);
                    }
                    tempNode.push(p._rightChild);
                    for(let i=0;i<p2.length;++i){
                        tempNode.push(p2[i]._rightChild);
                    }
                    tempNode.push(temp_maxR);
                    alternativeNodes2.push(tempNode);
                    p = p._leftChild;
                    for(let i=0;i<p2.length;++i){
                        p2[i] = p2[i]._leftChild!;
                    }
                }
            }
            console.log("The bottom max(*):", maxIndex);
            p = pp, p2 = pp2;
            while(alternativeNodes.length > 0){
                let pop:any = alternativeNodes.pop();
                if(pop === undefined ) continue;
                if(Number(pop[pop.length-1]) > min) continue;
                let len = pop.length;
                let temp_minL = 0, temp_minR = 0;
                if(!pop[Math.floor(len/2)]._leftChild && !pop[Math.floor(len/2)]._rightChild){
                    let minL = 0, minR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[pop[Math.floor(len/2)].index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        minL += pop[Math.floor(len/2)].yArray[1];
                        minR += pop[Math.floor(len/2)].yArray[2];
                    } 
                    else{
                        minL += pop[Math.floor(len/2)].yArray[2];
                        minR += pop[Math.floor(len/2)].yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][pop[Math.floor(len/2)].index * 2 + 1] === 0){
                            minL *= pop[Math.floor(len/2)+i+1].yArray[1];
                            minR *= pop[Math.floor(len/2)+i+1].yArray[2];
                        }
                        else{
                            minL *= pop[Math.floor(len/2)+i+1].yArray[2];
                            minR *= pop[Math.floor(len/2)+i+1].yArray[1];
                        }
                    }
                    if(minL > minR){
                        min = minL;
                        minIndex = [pop[Math.floor(len/2)].index * 2, min];
                    }
                    else{
                        min = minR;
                        minIndex = [pop[Math.floor(len/2)].index * 2 + 1, min];
                    }
                    if(min < this.multiMin[1]){
                        this.multiMin = minIndex;
                    }
                    continue;
                }
                if(pop[Math.floor(len/2)]._leftChild){
                    let index = Math.floor(len / 2);
                    let tempArray = [];
                    tempArray.push(pop[index]._leftChild.yArray[1]);
                    tempArray.push(pop[index]._leftChild.yArray[2]);
                    for(let i = index+1; i<index*2; ++i){
                        let len = tempArray.length;
                         for(let j = 0; j<len; ++j){
                            tempArray.push(tempArray[j] * pop[i]._leftChild!.yArray[1]);
                            tempArray.push(tempArray[j] * pop[i]._leftChild!.yArray[2]);
                        }   
                        for(let j = 0; j<len; ++j){
                            tempArray.shift();
                        }   
                    }
                    // console.log(tempArray);
                    temp_minL = Math.min(...tempArray);

                    if(temp_minL < min){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._leftChild);
                        }
                        tempNode.push(temp_minL);
                        alternativeNodes.push(tempNode);
                    }
                }
                if(pop[Math.floor(len/2)]._rightChild){
                    let index = Math.floor(len / 2);
                    let tempArray = [];
                    tempArray.push(pop[index]._rightChild.yArray[1]);
                    tempArray.push(pop[index]._rightChild.yArray[2]);
                    for(let i = index+1; i<index*2; ++i){
                        let len = tempArray.length;
                         for(let j = 0; j<len; ++j){
                            tempArray.push(tempArray[j] * pop[i]._rightChild!.yArray[1]);
                            tempArray.push(tempArray[j] * pop[i]._rightChild!.yArray[2]);
                        }   
                        for(let j = 0; j<len; ++j){
                            tempArray.shift();
                        }   
                    }
                    // console.log(tempArray);
                    temp_minR = Math.min(...tempArray);
                    if(temp_minR < min){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._rightChild);
                        }
                        tempNode.push(temp_minR);
                        alternativeNodes.push(tempNode);
                    }
                }
            }
            p = pp, p2 = pp2;
            while(alternativeNodes2.length > 0){
                // console.log("alternativeNodes2:", alternativeNodes2);
                let pop:any = alternativeNodes2.pop();
                if(pop === undefined ) continue;
                // console.log("pop:", pop);
                if(Number(pop[pop.length-1]) < max) continue;
                let len = pop.length;
                let temp_maxL = 0, temp_maxR = 0;
                if(!pop[Math.floor(len/2)]._leftChild && !pop[Math.floor(len/2)]._rightChild){
                    let maxL = 0, maxR = 0;
                    let nodeFlagInfo1 = currentFlagInfo[pop[Math.floor(len/2)].index * 2 + 1];
                    if(nodeFlagInfo1 === 0){
                        maxL += pop[Math.floor(len/2)].yArray[1];
                        maxR += pop[Math.floor(len/2)].yArray[2];
                    } 
                    else{
                        maxL += pop[Math.floor(len/2)].yArray[2];
                        maxR += pop[Math.floor(len/2)].yArray[1];
                    }
                    for(let i=0; i<currentFlagInfo2.length;++i){
                        if(currentFlagInfo2[i][pop[Math.floor(len/2)].index * 2 + 1] === 0){
                            maxL *= pop[Math.floor(len/2)+i+1].yArray[1];
                            maxR *= pop[Math.floor(len/2)+i+1].yArray[2];
                        }
                        else{
                            maxL *= pop[Math.floor(len/2)+i+1].yArray[2];
                            maxR *= pop[Math.floor(len/2)+i+1].yArray[1];
                        }
                    }
                    if(maxL > maxR){
                        max = maxL;
                        maxIndex = [pop[Math.floor(len/2)].index * 2, max];
                    }
                    else{
                        max = maxR;
                        maxIndex = [pop[Math.floor(len/2)].index * 2 + 1, max];
                    }
                    if(max > this.multiMax[1]){
                        this.multiMax = maxIndex;
                    }
                    continue;
                }
                if(pop[Math.floor(len/2)]._leftChild){
                    let index = Math.floor(len / 2);
                    let tempArray = [];
                    tempArray.push(pop[index]._leftChild.yArray[1]);
                    tempArray.push(pop[index]._leftChild.yArray[2]);
                    for(let i = index+1; i<index*2; ++i){
                        let len = tempArray.length;
                         for(let j = 0; j<len; ++j){
                            tempArray.push(tempArray[j] * pop[i]._leftChild!.yArray[1]);
                            tempArray.push(tempArray[j] * pop[i]._leftChild!.yArray[2]);
                        }   
                        for(let j = 0; j<len; ++j){
                            tempArray.shift();
                        }   
                    }
                    // console.log(tempArray);
                    temp_maxL = Math.max(...tempArray);
                    if(temp_maxL > max){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._leftChild);
                        }
                        tempNode.push(temp_maxL);
                        alternativeNodes2.push(tempNode);
                    }
                }
                if(pop[Math.floor(len/2)]._rightChild){
                    let index = Math.floor(len / 2);
                    let tempArray = [];
                    tempArray.push(pop[index]._rightChild.yArray[1]);
                    tempArray.push(pop[index]._rightChild.yArray[2]);
                    for(let i = index+1; i<index*2; ++i){
                        let len = tempArray.length;
                         for(let j = 0; j<len; ++j){
                            tempArray.push(tempArray[j] * pop[i]._rightChild!.yArray[1]);
                            tempArray.push(tempArray[j] * pop[i]._rightChild!.yArray[2]);
                        }   
                        for(let j = 0; j<len; ++j){
                            tempArray.shift();
                        }   
                    }
                    // console.log(tempArray);
                    temp_maxR = Math.max(...tempArray);
                    if(temp_maxR > max){
                        let tempNode = [];
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]);
                        }
                        for(let i = index; i < index * 2; ++i){
                            tempNode.push(pop[i]._rightChild);
                        }
                        tempNode.push(temp_maxR);
                        alternativeNodes2.push(tempNode);
                    }
                }
            }
            console.log("The final min(*):", minIndex);
            console.log("The final max(*):", maxIndex);
            if(min < this.multiMin[1]){
                this.multiMin = minIndex;
            }
            if(max > this.multiMax[1]){
                this.multiMax = maxIndex;
            }
        }
        else if((type === 1 || type === 7 || type ===8 || type === 9) && symbol === 'avg'){
            let avg1 = p.yArray[3];
            let avg2 = 0;
            for(let i=0;i<p2.length;i++){
                avg2 += p2[i].yArray[3];
            }
            let avg = (avg1+avg2)/(1+p2.length);
            let currentAvg = this.currentPointNum * this.multiAve;
            if(this.ordinalLevelCount === 0){
                this.multiAve = avg;
            }
            else{
                let currentSum = this.multiAve * (this.currentPointNum - pTRange) + avg * pTRange;
                let average = currentSum / this.currentPointNum;
                this.multiAve = average;
            }
        }
    }


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
