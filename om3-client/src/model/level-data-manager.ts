import LevelIndexObj from "./level-index-obj";
import axios from "axios";
import TrendTree from "@/helper/tend-query-tree";
import store, { pushTimeArray } from "@/store";
import * as d3 from 'd3';
import { canCut, checkSetType, computeLosedDataRange, computeLosedDataRangeV1, computeTimeSE, deleteSavedNodeIndex, computeSemanticColumn, convertWaveletToRawTableName, computeLosedDataRangeV1ForRawMinMax, computeTimeSE1 } from "@/helper/util";
import  NoUniformColObj  from "./non-uniform-col-obj";
import { UniformGapObj } from "./uniform-gap-obj";
// import { loadDataForRangeLevel, batchLoadDataForRangeLevelRawMinMax, batchLoadDataForRangeLevel, batchLoadDataForRangeLevel1, batchLoadDataForRangeLevel2MinMaxMiss, batchLoadDataForRangeLevel1MinMaxMiss, batchLoadDataForRangeLevel1WS, batchLoadDataForRangeLevelForMinMaxMiss } from "../api/build_tree"
import { loadDataForRangeLevel, batchLoadDataForRangeLevelRawMinMax, batchLoadDataForRangeLevel, batchLoadDataForRangeLevel1, batchLoadDataForRangeLevel2MinMaxMiss, batchLoadDataForRangeLevel1MinMaxMiss, batchLoadDataForRangeLevel1WS, batchLoadDataForRangeLevelForMinMaxMiss } from "../api/build_tree"
import { constructMinMaxMissTrendTree, constructMinMaxMissTrendTreeMulti, constructMinMaxMissTrendTreeForGetChildTree} from '../helper/wavlet-decoder';

import Cache from "lru-cache"
import { getFlag } from "@/global_state/state";
import { START_LOCATION } from "vue-router";

async function get(url: string) {

    url = 'postgres' + url;

    //const loading = openLoading();
    const { data } = await axios.get(url);
    //loading.close();
    return data;
}

let allTimes: any = []
let allSumTimes: any = []

export default class LevelDataManager {
    levelIndexObjs: Array<LevelIndexObj>
    maxLevel: number
    realDataRowNum: number
    dataName: string
    md5Num?: number
    isShow: boolean
    columnInfos: Array<NoUniformColObj> | null
    curNodeNum: number
    dataCache: Array<TrendTree>
    cacheMap: Map<number, TrendTree>
    cacheHead: TrendTree | null
    cacheTail: TrendTree | null
    maxCacheNodeNum: number
    lruCache: any
    deleteQueue: Array<TrendTree>
    isIntering: boolean
    isEvicting: boolean
    constructor(levelIndexObjs: Array<LevelIndexObj>, dataName: string, maxLevel?: number) {
        this.levelIndexObjs = levelIndexObjs;
        this.maxLevel = maxLevel ? maxLevel : store.state.controlParams.tableMaxLevel;
        this.realDataRowNum = 2 ** (maxLevel ? maxLevel : store.state.controlParams.tableMaxLevel);
        this.dataName = dataName;
        this.isShow = true;
        this.columnInfos = null;
        this.curNodeNum = 0;
        this.dataCache = new Array<TrendTree>();
        this.cacheMap = new Map<number, TrendTree>();
        this.cacheHead = null;
        this.cacheTail = null;
        this.maxCacheNodeNum = 100000
        this.lruCache = null;
        this.initCache();
        this.deleteQueue = [];
        this.isIntering = false;
        this.isEvicting = false
    }


    async getDataMockServer(info: { level: number, start: number, end: number, offset: number, width: number }) {
        const internalLevel = this.maxLevel - info.level;
        const outterLevel = info.level;
        const nextLevel = internalLevel;
        if (nextLevel < 1) {
            throw new Error("level out of range")
        }
        const width = 2 ** Math.ceil(Math.log2(info.width));
        let offset = info.offset

        let end = info.end;
        let start = info.start;
        let focusPoint = start + offset;
        let nextStart = focusPoint - width / 4;
        let nextEnd = focusPoint + width / 4;


        if (nextStart <= start) {
            nextStart = start;
            nextEnd = start + width / 2 - 1;
        }
        if (nextEnd >= end) {
            nextEnd = end;
            nextStart = end - width / 2 + 1;
        }
        const data = await this.getData(outterLevel + 1, nextStart * 2, nextStart * 2 + width - 1);
        return [[offset, 2 * nextStart], data];
    }
    async getData(level: number, start: number, end: number, noRet?: boolean) {
        if (level > this.maxLevel) {
            return []
        }
        let lastFullLevel = 2;
        let nextStart = start;
        let nextEnd = end;
        for (let i = level - 1; i > 1; i--) {
            nextStart = Math.floor(nextStart / 2);
            nextEnd = Math.floor(nextEnd / 2);
            if (this.levelIndexObjs[i] && this.levelIndexObjs[i].isFull) {
                lastFullLevel = i;
                break;
            }
        }
        for (let i = lastFullLevel + 1; i <= level; i++) {
            nextStart = nextStart * 2;
            nextEnd = nextEnd * 2 + 1;
            const losedDataInfo = this.checkLoadedDataInSingalLevel([[i, nextStart, nextEnd]]);
            //debugger
            await batchLoadDataForRangeLevel(losedDataInfo, this);
        }
        if (this.levelIndexObjs[level]) {
            //更新缓存
            // this.updateDataCacheForRange(level, start, end)
            if (noRet) {
                return { data: [], start: 0, end: 0, l: 0 }
            } else {
                if (this.dataName === 'sensor8') {
                    const extraDataLevel = Math.ceil(Math.log2(2 ** this.maxLevel - this.realDataRowNum));
                    if (level >= this.maxLevel - extraDataLevel) {
                        const curExtraLevel = level - (this.maxLevel - extraDataLevel);
                        const fakeRowNum = 2 ** curExtraLevel;
                        if (end >= 2 ** level - fakeRowNum) {
                            end = 2 ** level - fakeRowNum - 1;
                        }
                    }
                    let lastIndex = this.realDataRowNum - 1;
                    for (let i = this.maxLevel; i >= level; i--) {
                        lastIndex = Math.floor(lastIndex / 2);
                    }
                    if (end < start) {
                        return [];
                    }
                    return this.levelIndexObjs[level].getDataByIndex(start, end);
                } else {
                    return this.levelIndexObjs[level].getDataByIndex(start, end);
                }
            }

        } else {
            return { data: [], start: 0, end: 0, l: 0 }
            //throw new Error("cannot get data from data manager");
        }
    }
    async getDataMinMaxMiss(level: number, start: number, end: number, noRet?: boolean) {
        if (level > this.maxLevel) {
            return []
        }
        let lastFullLevel = 2;
        let nextStart = start;
        let nextEnd = end;
        for (let i = level - 1; i > 1; i--) {
            nextStart = Math.floor(nextStart / 2);
            nextEnd = Math.floor(nextEnd / 2);
            if (this.levelIndexObjs[i] && this.levelIndexObjs[i].isFull) {
                lastFullLevel = i;
                break;
            }
        }

        for (let i = lastFullLevel + 1; i <= level; i++) {
            nextStart = nextStart * 2;
            nextEnd = nextEnd * 2 + 1;
            const losedDataInfo = this.checkLoadedDataInSingalLevel([[i, nextStart, nextEnd]]);
            const processLosedDataInfo = [];
            for (let j = 0; j < losedDataInfo.length; j++) {
                const tempInfo = losedDataInfo[j]
                processLosedDataInfo.push([tempInfo[0] - 1, Math.floor(tempInfo[1] / 2), Math.floor(tempInfo[2] / 2)])
            }

            await batchLoadDataForRangeLevel2MinMaxMiss(processLosedDataInfo, this);
        }

        if (this.levelIndexObjs[level]) {
            //更新缓存
            // this.updateDataCacheForRange(level, start, end)
            if (noRet) {
                return { data: [], start: 0, end: 0, l: 0 }
            } else {
                if (this.dataName === 'sensor8') {
                    const extraDataLevel = Math.ceil(Math.log2(2 ** this.maxLevel - this.realDataRowNum));
                    if (level >= this.maxLevel - extraDataLevel) {
                        const curExtraLevel = level - (this.maxLevel - extraDataLevel);
                        const fakeRowNum = 2 ** curExtraLevel;
                        if (end >= 2 ** level - fakeRowNum) {
                            end = 2 ** level - fakeRowNum - 1;
                        }
                    }
                    let lastIndex = this.realDataRowNum - 1;
                    for (let i = this.maxLevel; i >= level; i--) {
                        lastIndex = Math.floor(lastIndex / 2);
                    }
                    if (end < start) {
                        return [];
                    }
                    return this.levelIndexObjs[level].getDataByIndex(start, end);
                } else {
                    return this.levelIndexObjs[level].getDataByIndex(start, end);
                }
            }

        } else {
            return { data: [], start: 0, end: 0, l: 0 }
            //throw new Error("cannot get data from data manager");
        }
    }

    async getDataRawMinMax(level: number, start: number, end: number, noRet?: boolean) {
        if (level > this.maxLevel) {
            return []
        }
        let lastFullLevel = 2;
        let nextStart = start;
        let nextEnd = end;
        //debugger
        for (let i = level - 1; i > 1; i--) {
            nextStart = Math.floor(nextStart / 2);
            nextEnd = Math.floor(nextEnd / 2);
            if (this.levelIndexObjs[i] && this.levelIndexObjs[i].isFull) {
                lastFullLevel = i;
                break;
            }
        }
        for (let i = lastFullLevel + 1; i <= level; i++) {
            nextStart = nextStart * 2;
            nextEnd = nextEnd * 2 + 1;
            const losedDataInfo = this.checkLoadedDataInSingalLevel([[i, nextStart, nextEnd]]);
            //debugger
            await batchLoadDataForRangeLevelRawMinMax(losedDataInfo, this);
        }
        if (this.levelIndexObjs[level]) {
            //更新缓存
            // this.updateDataCacheForRange(level, start, end)
            if (noRet) {
                return { data: [], start: 0, end: 0, l: 0 }
            } else {
                if (this.dataName === 'sensor8') {
                    const extraDataLevel = Math.ceil(Math.log2(2 ** this.maxLevel - this.realDataRowNum));
                    if (level >= this.maxLevel - extraDataLevel) {
                        const curExtraLevel = level - (this.maxLevel - extraDataLevel);
                        const fakeRowNum = 2 ** curExtraLevel;
                        if (end >= 2 ** level - fakeRowNum) {
                            end = 2 ** level - fakeRowNum - 1;
                        }
                    }
                    let lastIndex = this.realDataRowNum - 1;
                    for (let i = this.maxLevel; i >= level; i--) {
                        lastIndex = Math.floor(lastIndex / 2);
                    }
                    if (end < start) {
                        return [];
                    }
                    return this.levelIndexObjs[level].getDataByIndex(start, end);
                } else {
                    return this.levelIndexObjs[level].getDataByIndex(start, end);
                }
            }

        } else {
            return { data: [], start: 0, end: 0, l: 0 }
            //throw new Error("cannot get data from data manager");
        }
    }
    async getDataV1(level: number, start: number, end: number, noRet?: boolean) {
        if (level > this.maxLevel) {
            return [];
        }
        if (this.levelIndexObjs[level]) {

            const hasData = this.levelIndexObjs[level].hasDataForRange(start, end);
            if (hasData.has) {
                return this.levelIndexObjs[level].getDataByIndex(start, end);
            } else {
                const losedRange = hasData.range;

                for (let i = 0; i < losedRange.length; i++) {
                    let l = level - 1;
                    const losedDataOtherLevel = [];
                    for (; l >= 0; l--) {
                        if (this.levelIndexObjs[l].isFull) {
                            break;
                        }
                        const levelHasData = this.levelIndexObjs[l].hasDataForRange(Math.floor(losedRange[i][0] / (2 ** (level - l))), Math.floor(losedRange[i][1] / (2 ** (level - l))));
                        if (levelHasData.has) {
                            break;
                        }
                        losedDataOtherLevel.push([l, Math.floor(losedRange[i][0] / (2 ** (level - l))), Math.floor(losedRange[i][1] / (2 ** (level - l)))]);
                    }
                    await loadDataForRangeLevel(losedDataOtherLevel, this);
                }
                losedRange.forEach(range => {
                    range.unshift(level);
                });
                await loadDataForRangeLevel(losedRange, this);
            }
        } else {
            let l = level - 1;
            const losedDataOtherLevel = [];
            for (; l >= 0; l--) {
                if (this.levelIndexObjs[l] && this.levelIndexObjs[l].isFull) {
                    break;
                }
                if (this.levelIndexObjs[l]) {
                    const levelHasData = this.levelIndexObjs[l].hasDataForRange(Math.floor(start / (2 ** (level - l))), Math.floor(end / (2 ** (level - l))));
                    if (levelHasData.has) {
                        break;
                    }
                }
                losedDataOtherLevel.push([l, Math.floor(start / (2 ** (level - l))), Math.floor(end / (2 ** (level - l)))]);
            }
            losedDataOtherLevel.unshift([level, start, end]);
            await loadDataForRangeLevel(losedDataOtherLevel, this);
        }
        if (this.levelIndexObjs[level]) {
            if (noRet) {
                return []
            } else {
                if (this.dataName === 'sensor8') {
                    const extraDataLevel = Math.ceil(Math.log2(2 ** this.maxLevel - this.realDataRowNum));
                    if (level >= this.maxLevel - extraDataLevel) {
                        const curExtraLevel = level - (this.maxLevel - extraDataLevel);
                        const fakeRowNum = 2 ** curExtraLevel;
                        if (end >= 2 ** level - fakeRowNum) {
                            end = 2 ** level - fakeRowNum - 1;
                        }
                    }
                    let lastIndex = this.realDataRowNum - 1;
                    for (let i = this.maxLevel; i >= level; i--) {
                        lastIndex = Math.floor(lastIndex / 2);
                    }
                    if (end < start) {
                        return [];
                    }
                    return this.levelIndexObjs[level].getDataByIndex(start, end);
                } else {
                    return this.levelIndexObjs[level].getDataByIndex(start, end);
                }
            }
        } else {
            throw new Error("cannot get data from data manager");
        }
    }
    getLoadedData(level: number, start: number, end: number) {
        if (this.levelIndexObjs[level]) {
            if (this.dataName === 'sensor8') {
                const extraDataLevel = Math.ceil(Math.log2(2 ** this.maxLevel - this.realDataRowNum));
                if (level >= this.maxLevel - extraDataLevel) {
                    const curExtraLevel = level - (this.maxLevel - extraDataLevel);
                    const fakeRowNum = 2 ** curExtraLevel;
                    if (end >= 2 ** level - fakeRowNum) {
                        end = 2 ** level - fakeRowNum - 1;
                    }
                }
                if (end < start) {
                    return [];
                }
                return this.levelIndexObjs[level].getDataByIndex(start, end);
            } else {
                return this.levelIndexObjs[level].getDataByIndex(start, end);
            }

        } else {
            throw new Error("cannot get data from data manager");
        }
    }

    checkMonotonicity(nonUniformColObjs: Array<NoUniformColObj>, preIndexArray: Array<number>, needLoadDifNodes: Array<TrendTree>) {
        for (let i = 0; i < needLoadDifNodes.length; i++) {
            const first = needLoadDifNodes[i].yArray[0];
            const minV = needLoadDifNodes[i].yArray[1];
            const maxV = needLoadDifNodes[i].yArray[2];
            const last = needLoadDifNodes[i].yArray[3];
            const pL = needLoadDifNodes[i].level;
            const pTRange = (2 ** this.maxLevel) / (2 ** pL);
            const pTimeS = needLoadDifNodes[i].index * pTRange;
            const pTimeE = pTRange + pTimeS - 1;
            if ((first === minV && last === maxV) || (first === maxV && last === minV)) {
                const k = (last - first) / (pTimeE - pTimeS);
                const b = first - k * pTimeS;
                nonUniformColObjs[preIndexArray[i]].mergeLast(k, b);
                nonUniformColObjs[preIndexArray[i] + 1].mergeFirst(k, b);
                preIndexArray.splice(i, 1);
                needLoadDifNodes.splice(i, 1);
            }
        }
    }
    constructTreeForBatchLoad1(losedRange: Array<Array<number>>, difVals: Array<{ l: number, i: number, dif: Array<number> }>) {
        let count = 0;
        for (let i = 0; i < losedRange.length; i++) {
            const levelRange = losedRange[i];

            const startNode = this.levelIndexObjs[losedRange[i][0]].getTreeNodeStartIndex(losedRange[i][1]);
            let p = startNode;
            const newTreeNode = [];
            for (let j = losedRange[i][1]; j <= losedRange[i][2]; j++) {
                if (p?.index === j && j === difVals[count].i && p.level === difVals[count].l) {
                    //@ts-ignore
                    p.difference = difVals[count].dif;
                    // const yArray1: [number, number, number, number] = [0, 0, 0, 0]
                    // const yArray2: [number, number, number, number] = [0, 0, 0, 0]
                    // yArray1[0] = p.yArray[0];
                    // yArray2[0] = p.yArray[0] - p.difference![0];
                    // yArray1[3] = p.yArray[3] + p.difference![3];
                    // yArray2[3] = p.yArray[3];
                    // if (p.difference![1] < 0) {
                    //     yArray1[1] = p.yArray[1];
                    //     yArray2[1] = p.yArray[1] - p.difference![1];
                    // } else {
                    //     yArray1[1] = p.yArray[1] + p.difference![1];
                    //     yArray2[1] = p.yArray[1]
                    // }
                    // if (p.difference![2] < 0) {
                    //     yArray1[2] = p.yArray[2] + p.difference![2];
                    //     yArray2[2] = p.yArray[2];
                    // } else {
                    //     yArray1[2] = p.yArray[2];
                    //     yArray2[2] = p.yArray[2] - p.difference![2];
                    // }
                    const yArray1: [number, number, number, number, number] = [0, 0, 0, 0, 0]
                    const yArray2: [number, number, number, number, number] = [0, 0, 0, 0, 0]
                    yArray1[0] = p.yArray[0];
                    yArray2[0] = p.yArray[0] - p.difference![0];
                    // yArray1[3] = p.yArray[3] + p.difference![3];
                    // yArray2[3] = p.yArray[3];
                    yArray1[4] = p.yArray[4] + p.difference![4];
                    yArray2[4] = p.yArray[4];
                    if (p.difference![1] < 0) {
                        yArray1[1] = p.yArray[1];
                        yArray2[1] = p.yArray[1] - p.difference![1];
                    } else {
                        yArray1[1] = p.yArray[1] + p.difference![1];
                        yArray2[1] = p.yArray[1]
                    }
                    if (p.difference![2] < 0) {
                        yArray1[2] = p.yArray[2] + p.difference![2];
                        yArray2[2] = p.yArray[2];
                    } else {
                        yArray1[2] = p.yArray[2];
                        yArray2[2] = p.yArray[2] - p.difference![2];
                    }
                    if(p.difference![3] <= 0 || p.difference![3] >= 0){
                        yArray1[3] = (p.yArray[3] * 2 + p.difference![3]) / 2; 
                        yArray2[3] = (p.yArray[3] * 2 - p.difference![3]) / 2; 
                    }
                    const firstNode = new TrendTree(p, true, p.index, yArray1, null);
                    const secondNode = new TrendTree(p, false, p.index, yArray2, null);
                    newTreeNode.push(firstNode);
                    newTreeNode.push(secondNode);
                    p = p.nextSibling;
                    count++;
                    if (p === null || count >= difVals.length) {
                        break;
                    }

                } else {
                    console.log(losedRange[i][0], losedRange[i][1])
                    console.log("lose range:", losedRange, p, p?.index, j);
                    console.log(this.levelIndexObjs);
                    debugger
                    throw new Error("dif not match node");
                }
            }
            for (let j = 0; j < newTreeNode.length - 1; j++) {
                newTreeNode[j].nextSibling = newTreeNode[j + 1];
                newTreeNode[j + 1].previousSibling = newTreeNode[j];
                if (newTreeNode[j].index != newTreeNode[j + 1].index - 1) {
                    throw new Error("sibling index error");
                }
            }
            if (this.levelIndexObjs[losedRange[i][0] + 1]) {
                this.levelIndexObjs[losedRange[i][0] + 1].addLoadedDataRange(newTreeNode[0], [newTreeNode[0].index, newTreeNode[newTreeNode.length - 1].index]);
            } else {
                this.levelIndexObjs[losedRange[i][0] + 1] = new LevelIndexObj(losedRange[i][0] + 1, false);
                this.levelIndexObjs[losedRange[i][0] + 1].addLoadedDataRange(newTreeNode[0], [newTreeNode[0].index, newTreeNode[newTreeNode.length - 1].index]);
            }
        }
    }
    constructTreeForBatchLoad(losedRange: Array<Array<number>>, difVals: Array<{ l: number, i: number, dif: Array<number> }>) {
        let count = 0;
        let nodeNum = 0;
        for (let i = 0; i < losedRange.length; i++) {
            const levelRange = losedRange[i];

            const startNode = this.levelIndexObjs[losedRange[i][0] - 1].getTreeNodeStartIndex(Math.floor(losedRange[i][1] / 2));
            let p = startNode;
            const newTreeNode = [];
            for (let j = Math.floor(losedRange[i][1] / 2); j <= Math.floor(losedRange[i][2] / 2); j++) {
                if (p?.index === j && j === difVals[count].i && p.level === difVals[count].l) {
                    //@ts-ignore
                    p.difference = difVals[count].dif;
                    // const yArray1: [number, number, number, number] = [0, 0, 0, 0]
                    // const yArray2: [number, number, number, number] = [0, 0, 0, 0]
                    // yArray1[0] = p.yArray[0];
                    // yArray2[0] = p.yArray[0] - p.difference![0];
                    // yArray1[3] = p.yArray[3] + p.difference![3];
                    // yArray2[3] = p.yArray[3];
                    // if (p.difference![1] < 0) {
                    //     yArray1[1] = p.yArray[1];
                    //     yArray2[1] = p.yArray[1] - p.difference![1];
                    // } else {
                    //     yArray1[1] = p.yArray[1] + p.difference![1];
                    //     yArray2[1] = p.yArray[1]
                    // }
                    // if (p.difference![2] < 0) {
                    //     yArray1[2] = p.yArray[2] + p.difference![2];
                    //     yArray2[2] = p.yArray[2];
                    // } else {
                    //     yArray1[2] = p.yArray[2];
                    //     yArray2[2] = p.yArray[2] - p.difference![2];
                    // }
                    const yArray1: [number, number, number, number, number] = [0, 0, 0, 0, 0]
                    const yArray2: [number, number, number, number, number] = [0, 0, 0, 0, 0]
                    yArray1[0] = p.yArray[0];
                    yArray2[0] = p.yArray[0] - p.difference![0];
                    // yArray1[3] = p.yArray[3] + p.difference![3];
                    // yArray2[3] = p.yArray[3];
                    yArray1[4] = p.yArray[4] + p.difference![4];
                    yArray2[4] = p.yArray[4];
                    if (p.difference![1] < 0) {
                        yArray1[1] = p.yArray[1];
                        yArray2[1] = p.yArray[1] - p.difference![1];
                    } else {
                        yArray1[1] = p.yArray[1] + p.difference![1];
                        yArray2[1] = p.yArray[1]
                    }
                    if (p.difference![2] < 0) {
                        yArray1[2] = p.yArray[2] + p.difference![2];
                        yArray2[2] = p.yArray[2];
                    } else {
                        yArray1[2] = p.yArray[2];
                        yArray2[2] = p.yArray[2] - p.difference![2];
                    }
                    if(p.difference![3] <= 0 || p.difference![3] >= 0){
                        yArray1[3] = (p.yArray[3] * 2 + p.difference![3]) / 2; 
                        yArray2[3] = (p.yArray[3] * 2 - p.difference![3]) / 2; 
                    }
                    const firstNode = new TrendTree(p, true, p.index, yArray1, null);
                    const secondNode = new TrendTree(p, false, p.index, yArray2, null);
                    this.cacheMap.set(firstNode.index, firstNode);
                    this.cacheMap.set(secondNode.index, secondNode);
                    nodeNum += 2
                    newTreeNode.push(firstNode);
                    newTreeNode.push(secondNode);
                    p = p.nextSibling;
                    count++;
                    if (p === null || count >= difVals.length) {
                        break;
                    }

                } else {
                    console.log(losedRange[i][0] - 1, Math.floor(losedRange[i][1] / 2))
                    console.log("lose range:", losedRange, p, p?.index, j);
                    console.log(this.levelIndexObjs);
                    debugger
                    throw new Error("dif not match node");
                }
            }
            for (let j = 0; j < newTreeNode.length - 1; j++) {
                newTreeNode[j].nextSibling = newTreeNode[j + 1];
                newTreeNode[j + 1].previousSibling = newTreeNode[j];
                if (newTreeNode[j].index != newTreeNode[j + 1].index - 1) {
                    throw new Error("sibling index error");
                }

            }
            if (this.levelIndexObjs[losedRange[i][0]]) {
                this.levelIndexObjs[losedRange[i][0]].addLoadedDataRange(newTreeNode[0], [newTreeNode[0].index, newTreeNode[newTreeNode.length - 1].index]);
            } else {
                this.levelIndexObjs[losedRange[i][0]] = new LevelIndexObj(losedRange[i][0], false);
                this.levelIndexObjs[losedRange[i][0]].addLoadedDataRange(newTreeNode[0], [newTreeNode[0].index, newTreeNode[newTreeNode.length - 1].index]);
            }
        }
    }

    async viewChangeInteraction(currentLevel: number, width: number, timeRange: Array<number>, yScale: any) {
        // console.time("v_c")
        const nonUniformColObjs = computeTimeSE(currentLevel, width, timeRange, this.realDataRowNum, this.maxLevel, this.dataName);
        //drawViewChangeLineChart({ dataManager:this,data: {maxv:0,minv:0,powRenderData:[],noPowRenderData:[]}, startTime: 0, endTime: timeRange[1], algorithm: "trendtree", width:width, height: 600 })
        //context!.commit("addViewChangeQueryNoPowLineChartObj", { dataManager:this,data: nonUniformColObjs, startTime: 0, endTime: timeRange[1], algorithm: "trendtree", width:width, height: 600 });

        let needLoadDifNode: Array<TrendTree> = [];
        let colIndex = 0;
        for (let i = 0; i < this.levelIndexObjs[currentLevel].firstNodes.length; i++) {
            const firtIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][0], this.maxLevel);
            const lastIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][1], this.maxLevel);
            let p = this.levelIndexObjs[currentLevel].firstNodes[i];
            if (firtIndexTimeRange.startT <= timeRange[0] && lastIndexTimeRange.endT >= timeRange[1]) {
                while (p != null) {
                    if (colIndex >= nonUniformColObjs.length) {
                        break;
                        //throw new Error("col index out range");
                    }
                    const type = nonUniformColObjs[colIndex].isContain(p);
                    if (type === 1) {
                        p = p.nextSibling!;
                    } else if (type === 2) {
                        needLoadDifNode.push(p);
                        p = p.nextSibling!;
                    } else if (type === 3) {
                        colIndex++;
                    } else if (type === 5) {
                        p = p.nextSibling!
                    } else if (type === 6) {
                        //throw new Error("error in viewchange")
                        break;
                    } else {
                        p = p.nextSibling!;
                        //throw new Error("node time is little than col");
                    }
                }
            }

        }
        //const draw=drawViewChangeLineChart({width:600,height:600,minv:0,maxv:1000,x:10,y:10})
        //draw(nonUniformColObjs)
        if (needLoadDifNode.length === 0) {
            //debugger
            return nonUniformColObjs;
        }
        let losedDataInfo = computeLosedDataRange(needLoadDifNode);
        if (losedDataInfo.length === 0) {
            return nonUniformColObjs;
        }
        const currentLevelLosedRange = [];
        for (let j = 0; j < losedDataInfo.length; j++) {
            const level = losedDataInfo[j][0];
            const start = losedDataInfo[j][1];
            const end = losedDataInfo[j][2];
            if (this.levelIndexObjs[level]) {

                const hasData = this.levelIndexObjs[level].hasDataForRange(start, end);
                if (!hasData.has) {
                    const losedRange = hasData.range;
                    losedRange.forEach(range => {
                        range.unshift(level);
                        currentLevelLosedRange.push(range);
                    });
                    //debugger
                }
            } else {
                currentLevelLosedRange.push([level, start, end]);
            }
        }
        if (currentLevelLosedRange.length > 0) {
            await batchLoadDataForRangeLevel(currentLevelLosedRange, this);
        }

        let countNum = 1
        while (needLoadDifNode.length > 0) {
            colIndex = 0;
            const tempNeedLoadDifNodes = [];
            const tempQue: Array<TrendTree> = [];

            needLoadDifNode.forEach(v => {
                if (v._leftChild === null || v._rightChild === null) {
                    debugger
                    throw new Error("cannot find next level node");
                }
                tempQue.push(v._leftChild!);
                tempQue.push(v._rightChild!);
            });
            const preColIndex = [];
            for (let i = 0; i < tempQue.length; i++) {
                if (colIndex >= nonUniformColObjs.length) {
                    //break;
                    throw new Error("col index out range");
                }
                const type = nonUniformColObjs[colIndex].isContain(tempQue[i]);
                if (type === 1) {
                    continue;
                } else if (type === 2) {
                    tempNeedLoadDifNodes.push(tempQue[i]);
                    preColIndex.push(colIndex);
                } else if (type === 3) {
                    colIndex++;
                    i--;
                } else if (type === 6) {
                    break;
                } else {
                    continue;
                    // throw new Error("node time is little than col");
                }
            }
            if (preColIndex.length != tempNeedLoadDifNodes.length) {
                throw new Error("cannot memory index");
            }

            for (let i = 0; i < tempNeedLoadDifNodes.length; i++) {
                const con1 = canCut(tempNeedLoadDifNodes[i], nonUniformColObjs[preColIndex[i]], nonUniformColObjs[preColIndex[i] + 1], yScale);
                if (con1) {
                    tempNeedLoadDifNodes.splice(i, 1)
                    preColIndex.splice(i, 1);
                }
            }
            //this.checkMonotonicity(nonUniformColObjs,preColIndex,tempNeedLoadDifNodes);
            needLoadDifNode = tempNeedLoadDifNodes;
            if (needLoadDifNode.length > 0 && needLoadDifNode[0].level === this.maxLevel - 1) {
                //console.log("last level:",needLoadDifNode.length);
                for (let i = 0; i < needLoadDifNode.length; i++) {

                    nonUniformColObjs[preColIndex[i]].addLastVal(needLoadDifNode[i].yArray[0]);
                    nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[0]);
                    nonUniformColObjs[preColIndex[i] + 1].addFirstVal(needLoadDifNode[i].yArray[3]);
                    nonUniformColObjs[preColIndex[i] + 1].forceMerge(needLoadDifNode[i].yArray[3]);
                }
                break;
            }
            if (needLoadDifNode.length === 0) {
                break;
            }
            let losedDataInfo = computeLosedDataRange(needLoadDifNode);
            const currentLevelLosedRange = [];

            for (let j = 0; j < losedDataInfo.length; j++) {
                const level = losedDataInfo[j][0]
                const start = losedDataInfo[j][1]
                const end = losedDataInfo[j][2];
                if (this.levelIndexObjs[level]) {

                    const hasData = this.levelIndexObjs[level].hasDataForRange(start, end);
                    if (!hasData.has) {
                        const losedRange = hasData.range;
                        losedRange.forEach(range => {
                            range.unshift(level);
                            currentLevelLosedRange.push(range);
                        });
                    }
                } else {
                    currentLevelLosedRange.push([level, start, end]);
                }
            }

            await batchLoadDataForRangeLevel(currentLevelLosedRange, this);
        }
        //console.timeEnd("v_c")
        //draw(nonUniformColObjs)
        return nonUniformColObjs;
    }

    async viewChangeInteraction1(currentLevel: number, width: number, timeRange: Array<number>, yScale: any) {
        allTimes = []
        // console.time("v_c")
        const nonUniformColObjs = computeTimeSE(currentLevel, width, timeRange, this.realDataRowNum, this.maxLevel);
        let needLoadDifNode: Array<TrendTree> = [];
        let colIndex = 0;
        for (let i = 0; i < this.levelIndexObjs[currentLevel].firstNodes.length; i++) {
            const firtIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][0], this.maxLevel);
            const lastIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][1], this.maxLevel);
            let p = this.levelIndexObjs[currentLevel].firstNodes[i];
            if (firtIndexTimeRange.startT <= timeRange[0] && lastIndexTimeRange.endT >= timeRange[1]) {
                while (p != null) {
                    if (colIndex >= nonUniformColObjs.length) {
                        break;
                        //throw new Error("col index out range");
                    }
                    const type = nonUniformColObjs[colIndex].isContain(p);
                    if (type === 1) {
                        p = p.nextSibling!;
                    } else if (type === 2) {
                        needLoadDifNode.push(p);
                        p = p.nextSibling!;
                    } else if (type === 3) {
                        colIndex++;
                    } else if (type === 5) {
                        p = p.nextSibling!
                    } else if (type === 6) {
                        // throw new Error("error in viewchange")
                        break;
                    } else {
                        p = p.nextSibling!;
                        //throw new Error("node time is little than col");
                    }
                }
            }

        }
        if (needLoadDifNode.length === 0) {
            const sumTime = allTimes.reduce((pre: any, cur: any) => pre + cur, 0)
            allSumTimes.push(sumTime)
            allTimes = [];
            if (allSumTimes.length >= 50) {
                console.log(allSumTimes)
            }
            //debugger
            return nonUniformColObjs;
        }
        let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
        //console.log(losedDataInfo)
        // if (losedDataInfo.length === 0) {
        //     return nonUniformColObjs;
        // }

        if (losedDataInfo.length > 0) {
            const startTime = new Date().getTime()
            await batchLoadDataForRangeLevel1(losedDataInfo, this);
            allTimes.push(new Date().getTime() - startTime)
        }


        while (needLoadDifNode.length > 0) {
            colIndex = 0;
            const tempNeedLoadDifNodes = [];
            const tempQue: Array<TrendTree> = [];

            needLoadDifNode.forEach(v => {
                if (v._leftChild === null || v._rightChild === null) {
                    console.log(v)
                    console.log(this)
                    debugger
                    throw new Error("cannot find next level node");
                }
                tempQue.push(v._leftChild!);
                tempQue.push(v._rightChild!);
            });
            const preColIndex = [];
            for (let i = 0; i < tempQue.length; i++) {
                if (colIndex >= nonUniformColObjs.length) {
                    break;
                    //throw new Error("col index out range");
                }
                const type = nonUniformColObjs[colIndex].isContain(tempQue[i]);
                if (type === 1) {
                    continue;
                } else if (type === 2) {
                    tempNeedLoadDifNodes.push(tempQue[i]);
                    preColIndex.push(colIndex);
                } else if (type === 3) {
                    colIndex++;
                    i--;
                } else if (type === 6) {
                    break;
                } else {
                    continue;
                    // throw new Error("node time is little than col");
                }
            }
            if (preColIndex.length != tempNeedLoadDifNodes.length) {
                throw new Error("cannot memory index");
            }

            for (let i = 0; i < tempNeedLoadDifNodes.length; i++) {
                if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                    const con1 = canCut(tempNeedLoadDifNodes[i], nonUniformColObjs[preColIndex[i]], nonUniformColObjs[preColIndex[i] + 1], yScale);
                    if (con1) {
                        tempNeedLoadDifNodes.splice(i, 1)
                        preColIndex.splice(i, 1);
                    }
                }

            }
            //this.checkMonotonicity(nonUniformColObjs,preColIndex,tempNeedLoadDifNodes);
            needLoadDifNode = tempNeedLoadDifNodes;
            if (needLoadDifNode.length > 0 && needLoadDifNode[0].level === this.maxLevel - 1) {
                //console.log("last level:",needLoadDifNode.length);
                for (let i = 0; i < needLoadDifNode.length; i++) {

                    nonUniformColObjs[preColIndex[i]].addLastVal(needLoadDifNode[i].yArray[0]);
                    nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[0]);

                    if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                        nonUniformColObjs[preColIndex[i] + 1].addFirstVal(needLoadDifNode[i].yArray[3]);
                        nonUniformColObjs[preColIndex[i] + 1].forceMerge(needLoadDifNode[i].yArray[3]);
                    }

                }
                break;
            }
            if (needLoadDifNode.length === 0) {
                break;
            }
            let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
            if (losedDataInfo.length > 0) {
                const startTime = new Date().getTime()
                await batchLoadDataForRangeLevel1(losedDataInfo, this);
                allTimes.push(new Date().getTime() - startTime)
            }

        }
        const sumTime = allTimes.reduce((pre: any, cur: any) => pre + cur, 0)
        // console.log(sumTime)
        //allSumTimes.push(sumTime)
        //allTimes = [];
        //if(allSumTimes.length>=50){
        //    console.log(allSumTimes)
        // }
        //console.timeEnd("v_c")
        return nonUniformColObjs;
    }


    checkLoadedDataInSingalLevel(losedDataInfo: Array<Array<number>>) {
        const currentLevelLosedRange = [];
        for (let j = 0; j < losedDataInfo.length; j++) {
            const level = losedDataInfo[j][0]
            const start = losedDataInfo[j][1]
            const end = losedDataInfo[j][2];
            if (this.levelIndexObjs[level]) {

                const hasData = this.levelIndexObjs[level].hasDataForRange(start, end);
                if (!hasData.has) {
                    const losedRange = hasData.range;
                    losedRange.forEach(range => {
                        range.unshift(level);
                        currentLevelLosedRange.push(range);
                    });
                }
            } else {
                currentLevelLosedRange.push([level, start, end]);
            }
        }
        return currentLevelLosedRange
    }
    checkLoadedDataInSingalLevelV1(losedDataInfo: Array<Array<number>>) {
        const currentLevelLosedRange = [];
        for (let j = 0; j < losedDataInfo.length; j++) {
            const level = losedDataInfo[j][0]
            const start = losedDataInfo[j][1]
            const end = losedDataInfo[j][2];
            if (this.levelIndexObjs[level]) {

                const hasData = this.levelIndexObjs[level].hasDataForRange(start, end);
                if (!hasData.has) {
                    const losedRange = hasData.range;
                    losedRange.forEach(range => {
                        range.unshift(level);
                        currentLevelLosedRange.push(range);
                    });
                }
            } else {
                currentLevelLosedRange.push([level, start, end]);
            }
        }
        return currentLevelLosedRange
    }


    getIndexTime(l: number, index: number, maxLevel: number) {
        const gap = 2 ** maxLevel / (2 ** l)
        const startTime = index * gap;
        const endTime = startTime + gap - 1;
        return {
            startT: startTime,
            endT: endTime
        }
    }

    initCache() {
        const options = {
            max: 1000000,
            maxSize: 1000000,
            sizeCalculation: (value: any, key: string) => {
                return 1
            },
            dispose: (value: any, key: string, reason: string) => {
                if (reason === "evict") {
                    console.log(key)
                    this.deleteQueue.push(value);
                }

            },
            disposeAfter: (value: any, key: string, reason: string) => {
                //console.log("dispose after----------------------",key,reason)
            },
            ttl: 1000 * 60 * 60,
            allowStale: false,
            updateAgeOnGet: true,
            updateAgeOnHas: true,

        }
        this.lruCache = new Cache(options);
        this.evictTreeNode()
        return
    }


    evictTreeNode() {
        setInterval(() => {
            if (this.isIntering) {
                return
            }
            this.isEvicting = true
            this.deleteQueue.forEach((curNode) => {
                const l = curNode.level;
                const i = curNode.index;
                this.lruCache.delete(l + "_" + i);
                if (this.levelIndexObjs[l].hasDataForRange(i, i).has) {
                    this.deleteNodeWhithChild(l, i);
                    console.log("evict l:" + l + " i:" + i + " finish!")
                }
            })
            this.isEvicting = false
        }, 1000)

    }


    deleteNodeWhithChild(level: number, index: number) {

        let curLS = index;
        let curRS = index;
        for (let j = level; j < this.maxLevel - 1; j++) {
            if (j == level) {
                curLS = index;
                curRS = index;
            } else {
                curLS = 2 ** (j - level) * curLS;
                curRS = 2 ** (j - level) * curRS + 1;
            }
            const curLLoadedRange = this.levelIndexObjs[j].loadedDataRange;
            const curFirstNodes = this.levelIndexObjs[j].firstNodes;

            if (!curLLoadedRange || !curFirstNodes) {
                break;
            }

            const newFirstNodes: Array<TrendTree> = [];
            const newLoadDataRanges = [];
            for (let i = 0; i < curLLoadedRange.length; i++) {
                const curRange0 = curLLoadedRange[i];
                if (curRange0[1] < curRS) {
                    newFirstNodes.push(curFirstNodes[i]);
                    newLoadDataRanges.push([curRange0[0], curRange0[1]]);
                } else if (curRange0[0] < curLS && curRange0[1] === curLS) {
                    if (curFirstNodes[i].nextSibling) {
                        newLoadDataRanges.push([curRange0[0], curRange0[1] - 1]);
                        newFirstNodes.push(curFirstNodes[i])
                    }
                    let curP = curFirstNodes[i];
                    while (curP) {
                        if (curP.index === curLS) {
                            if (curP.previousSibling) {
                                curP.previousSibling.nextSibling = null
                                curP.previousSibling = null
                            }
                            break;
                        }
                        //@ts-ignore
                        curP = curP.nextSibling
                    }
                    if (curP === null) {
                        throw new Error("cannot find range node");
                    }
                } else if (curRange0[0] < curLS && curRange0[1] > curLS && curRange0[1] < curRS) {
                    newFirstNodes.push(curFirstNodes[i]);
                    newLoadDataRanges.push([curRange0[0], curLS - 1]);
                    let curP = curFirstNodes[i];
                    while (curP) {
                        if (curP.index === curLS) {
                            if (curP.previousSibling) {
                                curP.previousSibling.nextSibling = null
                                curP.previousSibling = null
                            }
                            break;
                        }
                        //@ts-ignore
                        curP = curP.nextSibling
                    }
                    if (curP === null) {
                        throw new Error("cannot find range node");
                    }
                } else if (curRange0[0] < curLS && curRange0[1] === curRS) {
                    newFirstNodes.push(curFirstNodes[i]);
                    newLoadDataRanges.push([curRange0[0], curLS - 1]);
                    let curP = curFirstNodes[i];
                    while (curP) {
                        if (curP.index === curLS) {
                            if (curP.previousSibling) {
                                curP.previousSibling.nextSibling = null;
                                curP.previousSibling = null;
                            }
                            break;
                        }
                        //@ts-ignore
                        curP = curP.nextSibling
                    }
                    if (curP === null) {
                        throw new Error("cannot find range node");
                    }

                } else if (curRange0[0] < curLS && curRange0[1] > curRS) {
                    //debugger
                    newFirstNodes.push(curFirstNodes[i]);
                    newLoadDataRanges.push([curRange0[0], curLS - 1])

                    let curP = curFirstNodes[i];
                    while (curP) {
                        if (curP.index === curLS) {
                            if (curP.previousSibling) {
                                curP.previousSibling.nextSibling = null
                                curP.previousSibling = null;
                            }
                        }
                        if (curP.index === curRS) {
                            if (curP.nextSibling) {
                                newFirstNodes.push(curP.nextSibling);
                                newLoadDataRanges.push([curRS + 1, curRange0[1]]);
                                curP.nextSibling.previousSibling = null;
                                curP.nextSibling = null
                            }
                            break;
                        }
                        //@ts-ignore
                        curP = curP.nextSibling
                    }
                    if (curP === null) {
                        throw new Error("cannot find range node");
                    }

                } else if (curRange0[0] === curLS && curRange0[1] > curRS) {
                    let curP = curFirstNodes[i];
                    while (curP) {
                        if (curP.index === curRS) {
                            if (curP.nextSibling) {
                                newFirstNodes.push(curP.nextSibling);
                                newLoadDataRanges.push([curRS + 1, curRange0[1]]);
                                curP.nextSibling.previousSibling = null;
                                curP.nextSibling = null
                            }
                            break;
                        }
                        //@ts-ignore
                        curP = curP.nextSibling
                    }
                    if (curP === null) {
                        throw new Error("cannot find range node");
                    }

                } else if (curRange0[0] === curLS && curRange0[1] === curRS) {
                    continue;
                } else if (curRange0[0] === curLS && curRange0[1] < curRS) {
                    continue
                } else if (curRange0[0] > curLS && curRange0[1] > curRS && curRange0[0] < curRS) {
                    let curP = curFirstNodes[i];
                    while (curP) {
                        if (curP.index === curRS) {
                            if (curP.nextSibling) {
                                newFirstNodes.push(curP.nextSibling);
                                newLoadDataRanges.push([curRS + 1, curRange0[1]]);
                                curP.nextSibling.previousSibling = null;
                                curP.nextSibling = null;
                            }
                            break;
                        }
                        //@ts-ignore
                        curP = curP.nextSibling
                    }
                    if (curP === null) {
                        throw new Error("cannot find range node");
                    }
                } else if (curRange0[0] > curLS && curRange0[0] === curRS) {
                    if (curFirstNodes[i].nextSibling) {
                        newFirstNodes.push(curFirstNodes[i].nextSibling!)
                        newLoadDataRanges.push([curRange0[0] + 1, curRange0[1]])
                        curFirstNodes[i]!.nextSibling!.previousSibling = null
                        curFirstNodes[i].nextSibling = null

                    }

                } else if (curRange0[0] > curRS) {
                    newFirstNodes.push(curFirstNodes[i])
                    newLoadDataRanges.push([curRange0[0], curRange0[1]])
                } else if (curRange0[0] > curLS && curRange0[1] === curRS) {
                    continue
                }
                else {
                    console.log(curRange0, curLS, curRS)
                    throw new Error("range error");

                }
            }

            this.levelIndexObjs[j].loadedDataRange = newLoadDataRanges;
            this.levelIndexObjs[j].firstNodes = newFirstNodes;
        }
    }


    updateMaxCacheSize(size: number) {
        this.maxCacheNodeNum = size;
    }

    
    lruCacheDelete() {
        console.log(this.cacheMap.size)
        if (this.cacheMap.size <= this.maxCacheNodeNum) {

            return
        }
        let needDeleteNum = this.cacheMap.size - this.maxCacheNodeNum
        if (needDeleteNum % 2 != 0) {
            needDeleteNum++
        }
        console.log("delete nums:", needDeleteNum)
        for (let i = this.levelIndexObjs.length - 2; i > 0; i--) {
            if (needDeleteNum <= 0) {
                break
            }
            const levelObj = this.levelIndexObjs[i];
            for (let j = 0; j < levelObj.firstNodes.length; j++) {
                let firstNode = levelObj.firstNodes[j];
                this.levelIndexObjs[firstNode.level + 1].loadedDataRange = [];
                this.levelIndexObjs[firstNode.level + 1].firstNodes = [];
                this.levelIndexObjs[firstNode.level + 1].isFull = false;
                while (firstNode) {
                    if (firstNode._leftChild) {
                        this.cacheMap.delete(firstNode._leftChild.index)
                    }
                    if (firstNode._rightChild) {
                        this.cacheMap.delete(firstNode._rightChild.index)
                    }
                    //@ts-ignore
                    firstNode = firstNode.nextSibling
                    needDeleteNum -= 2;
                }
            }
        }
    }


    async computePowCon(currentLevel: number, width: number, gapNeedNodes: Array<TrendTree>, nonUniformColObjs: Array<NoUniformColObj>) {
        //debugger
        console.log("pwo:", width)
        const times = [];
        let needLoadDifNode: Array<TrendTree> = [];
        if (gapNeedNodes.length % width !== 0) {
            throw new Error("gap node not match widht")
        }
        const timeNum = gapNeedNodes.length / width;
        const groups = new Array<Array<TrendTree>>(width)
        for (let i = 0; i < groups.length; i++) {
            groups[i] = []
        }
        if (timeNum > 1) {
            for (let i = 0; i < gapNeedNodes.length; i++) {
                const groupIdx = Math.floor(i / timeNum)
                groups[groupIdx].push(gapNeedNodes[i])
            }
            for (let i = 0; i < groups.length - 1; i++) {
                const group = groups[i];
                const secGroup = groups[i + 1]
                needLoadDifNode.push(group[group.length - 1])
                needLoadDifNode.push(secGroup[0])
            }
        } else {
            needLoadDifNode = gapNeedNodes;
        }


        let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);


        if (losedDataInfo.length > 0) {
            const levelTime = new Date().getTime()
            await batchLoadDataForRangeLevel1(losedDataInfo, this);
            times.push(new Date().getTime() - levelTime);
        } else {
            times.push(1)
        }
        //debugger
        let columnGapArray: Array<UniformGapObj> = [];
        if (timeNum == 1) {
            for (let i = 0; i < needLoadDifNode.length - 1; i++) {
                // debugger
                if (needLoadDifNode[i]._rightChild && needLoadDifNode[i + 1]._leftChild) {
                    const columnGap = new UniformGapObj(needLoadDifNode[i], needLoadDifNode[i + 1])
                    columnGapArray.push(columnGap);
                } else {
                    throw new Error("children cannot empty")
                }
            }
        } else {
            for (let i = 0; i < needLoadDifNode.length; i += 2) {
                if (needLoadDifNode[i]._rightChild && needLoadDifNode[i + 1]._leftChild) {
                    const columnGap = new UniformGapObj(needLoadDifNode[i], needLoadDifNode[i + 1])
                    columnGapArray.push(columnGap);
                } else {
                    throw new Error("children cannot empty")
                }
            }
            for (let i = 0; i < groups.length - 1; i++) {
                const group1 = groups[i];
                const group2 = groups[i + 1];
                for (let j = 0; j < group1.length - 1; j++) {
                    columnGapArray[i].updateLeftMinMax(group1[j])
                }
                for (let j = 1; j < group2.length; j++) {
                    columnGapArray[i].updateRighetMinMax(group2[j])
                }
            }
        }
        let con = true
        while (con) {
            //debugger
            let isFinish = false
            needLoadDifNode = []
            for (let i = 0; i < columnGapArray.length; i++) {
                const isCut = columnGapArray[i].canCut()
                isFinish = isCut && isFinish
                if (!isCut) {
                    needLoadDifNode.push(columnGapArray[i].firstNode);
                    needLoadDifNode.push(columnGapArray[i].secondNode);
                }
            }
            if (isFinish) {
                break;
            }
            if (needLoadDifNode.length == 0) {
                break
            }
            if (needLoadDifNode.length > 0 && needLoadDifNode[0].level === this.maxLevel - 1) {
                for (let i = 0; i < columnGapArray.length; i++) {
                    const colGap = columnGapArray[i];
                    if (!colGap.isOk) {
                        if (colGap.firstNode && colGap.secondNode) {
                            colGap.lastLevelUpdateMinMax()
                        }
                    }
                }
                break;
            }
            losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
            if (losedDataInfo.length > 0) {
                const levelTime = new Date().getTime()
                await batchLoadDataForRangeLevel1(losedDataInfo, this);
                times.push(new Date().getTime() - levelTime);
            }
            for (let i = 0; i < columnGapArray.length; i++) {
                const colGap = columnGapArray[i];
                if (!colGap.isOk) {
                    if (colGap.firstNode._rightChild && colGap.secondNode._leftChild) {
                        colGap.updateTwoNode(colGap.firstNode, colGap.secondNode);
                    }
                }
            }
        }
        if (nonUniformColObjs.length !== columnGapArray.length + 1) {
            throw new Error("column not match gap")
        }
        for (let i = 0; i < columnGapArray.length; i++) {
            const colGap = columnGapArray[i];
            if (colGap.canUseT) {
                nonUniformColObjs[i].endV = colGap.tOne;
                nonUniformColObjs[i].startV = colGap.tOne;
            }
        }

        if (times.length >= 3) {
            allTimes.push(times[0])
            //allTimes.push(times[1])
        }
        console.log(allTimes)
        console.log(times)
        return nonUniformColObjs

    }


    bfsSearchTree(currentLevel: number, width: number, timeRange: Array<number>, nonUniformColObjs: Array<NoUniformColObj>) {
        let needLoadDifNode: Array<TrendTree> = [];
        let colIndex = 0;
        for (let i = 0; i < this.levelIndexObjs[currentLevel].firstNodes.length; i++) {
            const firtIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][0], this.maxLevel);
            const lastIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][1], this.maxLevel);
            let p = this.levelIndexObjs[currentLevel].firstNodes[i];
            if (firtIndexTimeRange.startT <= timeRange[0] && lastIndexTimeRange.endT >= timeRange[1]) {
                while (p != null) {
                    if (colIndex >= nonUniformColObjs.length) {
                        break;
                        //throw new Error("col index out range");
                    }
                    const type = nonUniformColObjs[colIndex].isContain(p);
                    if (type === 1) {
                        p = p.nextSibling!;
                    } else if (type === 2) {
                        needLoadDifNode.push(p);
                        p = p.nextSibling!;
                    } else if (type === 3) {
                        colIndex++;
                    } else if (type === 5) {
                        p = p.nextSibling!
                    } else if (type === 6) {
                        throw new Error("error in viewchange")
                        break;
                    } else {
                        p = p.nextSibling!;
                        //throw new Error("node time is little than col");
                    }
                }
            }

        }
        if (needLoadDifNode.length === 0) {
            //debugger
            return nonUniformColObjs;
        }

        while (needLoadDifNode.length > 0) {
            colIndex = 0;
            const tempNeedLoadDifNodes = [];
            const tempQue: Array<TrendTree> = [];

            needLoadDifNode.forEach(v => {
                if (v._leftChild === null || v._rightChild === null) {
                    console.log(v)
                    console.log(this)
                    debugger
                    throw new Error("cannot find next level node");
                }
                tempQue.push(v._leftChild!);
                tempQue.push(v._rightChild!);
            });
            const preColIndex = [];
            for (let i = 0; i < tempQue.length; i++) {
                if (colIndex >= nonUniformColObjs.length) {
                    break;
                    //throw new Error("col index out range");
                }
                const type = nonUniformColObjs[colIndex].isContain(tempQue[i]);
                if (type === 1) {
                    continue;
                } else if (type === 2) {
                    tempNeedLoadDifNodes.push(tempQue[i]);
                    preColIndex.push(colIndex);
                } else if (type === 3) {
                    colIndex++;
                    i--;
                } else if (type === 6) {
                    break;
                } else {
                    continue;
                    // throw new Error("node time is little than col");
                }
            }
            if (preColIndex.length != tempNeedLoadDifNodes.length) {
                throw new Error("cannot memory index");
            }

            for (let i = 0; i < tempNeedLoadDifNodes.length; i++) {
                if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                    const con1 = canCut(tempNeedLoadDifNodes[i], nonUniformColObjs[preColIndex[i]], nonUniformColObjs[preColIndex[i] + 1], '');
                    if (con1) {
                        tempNeedLoadDifNodes.splice(i, 1)
                        preColIndex.splice(i, 1);
                    }
                }

            }
            needLoadDifNode = tempNeedLoadDifNodes;
            if (needLoadDifNode.length > 0 && needLoadDifNode[0].level === this.maxLevel - 1) {
                //console.log("last level:",needLoadDifNode.length);
                for (let i = 0; i < needLoadDifNode.length; i++) {

                    nonUniformColObjs[preColIndex[i]].addLastVal(needLoadDifNode[i].yArray[0]);
                    nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[0]);

                    if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                        nonUniformColObjs[preColIndex[i] + 1].addFirstVal(needLoadDifNode[i].yArray[3]);
                        nonUniformColObjs[preColIndex[i] + 1].forceMerge(needLoadDifNode[i].yArray[3]);
                    }
                }
                break;
            }
            if (needLoadDifNode.length === 0) {
                break;
            }
        }
        return nonUniformColObjs;
    }

    async viewChangeInteraction1WS(currentLevel: number, width: number, timeRange: Array<number>, yScale: any, props?: any) {
        // while(this.isEvicting){console.log()};
        this.isIntering = true
        const tagName = "" + Math.random() + "" + Math.random()
        allTimes = []
        // console.time("v_c")
        const nonUniformColObjs = computeTimeSE(currentLevel, width, timeRange, this.realDataRowNum, this.maxLevel);
        let needLoadDifNode: Array<TrendTree> = [];
        let colIndex = 0;
        for (let i = 0; i < this.levelIndexObjs[currentLevel].firstNodes.length; i++) {
            const firtIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][0], this.maxLevel);
            const lastIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][1], this.maxLevel);
            let p = this.levelIndexObjs[currentLevel].firstNodes[i];
            if (firtIndexTimeRange.startT <= timeRange[0] && lastIndexTimeRange.endT >= timeRange[1]) {
                while (p != null) {
                    if (colIndex >= nonUniformColObjs.length) {
                        break;
                        //throw new Error("col index out range");
                    }
                    const type = nonUniformColObjs[colIndex].isContain(p);
                    if (type === 1) {
                        p = p.nextSibling!;
                    } else if (type === 2) {
                        needLoadDifNode.push(p);
                        p = p.nextSibling!;
                    } else if (type === 3) {
                        colIndex++;
                    } else if (type === 5) {
                        p = p.nextSibling!
                    } else if (type === 6) {
                        throw new Error("error in viewchange")
                        break;
                    } else {
                        p = p.nextSibling!;
                        //throw new Error("node time is little than col");
                    }
                }
            }

        }
        if (needLoadDifNode.length === 0) {
            const sumTime = allTimes.reduce((pre: any, cur: any) => pre + cur, 0)
            allSumTimes.push(sumTime)
            await batchLoadDataForRangeLevel1WS([], this, "empty");
            allTimes = [];
            if (allSumTimes.length >= 50) {
                console.log(allSumTimes)
            }
            //debugger
            return nonUniformColObjs;
        }
        let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);


        if (losedDataInfo.length > 0) {
            const startTime = new Date().getTime()
            await batchLoadDataForRangeLevel1WS(losedDataInfo, this, tagName);
            allTimes.push(new Date().getTime() - startTime)
        }


        while (needLoadDifNode.length > 0) {
            colIndex = 0;
            const tempNeedLoadDifNodes = [];
            const tempQue: Array<TrendTree> = [];

            needLoadDifNode.forEach(v => {
                if (v._leftChild === null || v._rightChild === null) {
                    debugger
                    throw new Error("cannot find next level node");
                }
                tempQue.push(v._leftChild!);
                tempQue.push(v._rightChild!);
                const leftHas = this.lruCache.has(v._leftChild.level + "_" + v._leftChild.index);
                const rightHas = this.lruCache.has(v._rightChild.level + "_" + v._rightChild.index);
                // if(!leftHas){
                //     console.log("fddddd",v._leftChild.level)
                // }

            });
            const preColIndex = [];
            for (let i = 0; i < tempQue.length; i++) {
                if (colIndex >= nonUniformColObjs.length) {
                    break;
                    //throw new Error("col index out range");
                }
                const type = nonUniformColObjs[colIndex].isContain(tempQue[i]);
                if (type === 1) {
                    continue;
                } else if (type === 2) {
                    tempNeedLoadDifNodes.push(tempQue[i]);
                    preColIndex.push(colIndex);
                } else if (type === 3) {
                    colIndex++;
                    i--;
                } else if (type === 6) {
                    break;
                } else {
                    continue;
                    // throw new Error("node time is little than col");
                }
            }
            if (preColIndex.length != tempNeedLoadDifNodes.length) {
                throw new Error("cannot memory index");
            }

            for (let i = 0; i < tempNeedLoadDifNodes.length; i++) {
                if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                    const con1 = canCut(tempNeedLoadDifNodes[i], nonUniformColObjs[preColIndex[i]], nonUniformColObjs[preColIndex[i] + 1], yScale);
                    if (con1) {
                        tempNeedLoadDifNodes.splice(i, 1)
                        preColIndex.splice(i, 1);
                    }
                }

            }
            //this.checkMonotonicity(nonUniformColObjs,preColIndex,tempNeedLoadDifNodes);
            needLoadDifNode = tempNeedLoadDifNodes;
            if (needLoadDifNode.length > 0 && needLoadDifNode[0].level === this.maxLevel - 1) {
                //console.log("last level:",needLoadDifNode.length);
                for (let i = 0; i < needLoadDifNode.length; i++) {

                    nonUniformColObjs[preColIndex[i]].addLastVal(needLoadDifNode[i].yArray[0]);
                    nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[0]);

                    if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                        nonUniformColObjs[preColIndex[i] + 1].addFirstVal(needLoadDifNode[i].yArray[3]);
                        nonUniformColObjs[preColIndex[i] + 1].forceMerge(needLoadDifNode[i].yArray[3]);
                    }

                }
                break;
            }
            if (needLoadDifNode.length === 0) {
                break;
            }
            let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
            if (losedDataInfo.length > 0) {
                const startTime = new Date().getTime()
                await batchLoadDataForRangeLevel1WS(losedDataInfo, this, tagName);
                allTimes.push(new Date().getTime() - startTime)
            }

        }
        if (props && props.rootT) {
            console.log("roott:", props.rootT)
            allTimes.push(props.rootT);
        }
        //console.log(allTimes)
        const sumTime = allTimes.reduce((pre: any, cur: any) => pre + cur, 0)
        allSumTimes.push(sumTime);
        if (allSumTimes.length === 6) {
            pushTimeArray(allSumTimes);
            allSumTimes = []
        }

        console.log("AllLevelTime:", allSumTimes);
        await batchLoadDataForRangeLevel1WS(losedDataInfo, this, "empty");
        this.isIntering = false;
        return nonUniformColObjs;
    }


    async viewChangeInteractionFinal(currentLevel: number, width: number, timeRange: Array<number>, yScale: any) {
        console.log(currentLevel, width, timeRange)
        const dataName = this.dataName.includes(".") ? this.dataName.split(".")[1] : this.dataName;
        const currentFlagInfo = store.state.allFlags[this.dataName];
        if (currentFlagInfo === undefined) {
            throw new Error(this.dataName + "get flag faild")
        } else {
            console.log("flag length:", currentFlagInfo.length)
        }

        allTimes = []
        // console.time("v_c")
        const nonUniformColObjs = computeTimeSE(currentLevel, width, timeRange, this.realDataRowNum, this.maxLevel);
        let needLoadDifNode: Array<TrendTree> = [];
        let colIndex = 0;

        for (let i = 0; i < this.levelIndexObjs[currentLevel].firstNodes.length; i++) {
            const firtIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][0], this.maxLevel);
            const lastIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][1], this.maxLevel);
            let p = this.levelIndexObjs[currentLevel].firstNodes[i];

            if (firtIndexTimeRange.startT <= timeRange[0] && lastIndexTimeRange.endT >= timeRange[1]) {
                while (p != null) {
                    if (colIndex >= nonUniformColObjs.length) {
                        break;
                        //throw new Error("col index out range");
                    }
                    const type = nonUniformColObjs[colIndex].isMissContain(p);
                    nonUniformColObjs[colIndex].containColumnRange(p, type);
                    if (type === 1) {
                        p = p.nextSibling!;
                    } else if (type === 2) {
                        needLoadDifNode.push(p);
                        p = p.nextSibling!;
                    } else if (type === 3) {
                        colIndex++;
                    } else if (type === 5) {
                        p = p.nextSibling!
                    } else if (type === 6) {
                        throw new Error("error in viewchange")
                        break;
                    } else {
                        p = p.nextSibling!;
                        //throw new Error("node time is little than col");
                    }
                }
            }

        }

        if (needLoadDifNode.length === 0) {
            return nonUniformColObjs;
        }

        let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);


        if (losedDataInfo.length > 0) {

            await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, this);
        }


        while (needLoadDifNode.length > 0) {
            colIndex = 0;
            const tempNeedLoadDifNodes = [];
            const tempQue: Array<TrendTree> = [];

            needLoadDifNode.forEach(v => {
                if (v._leftChild === null || v._rightChild === null) {
                    console.log(v)
                    console.log(this)
                    debugger
                    throw new Error("cannot find next level node");
                }
                this.lruCache.has(v._leftChild.level + "_" + v._leftChild.index);
                this.lruCache.has(v._rightChild.level + "_" + v._rightChild.index);
                if (v._leftChild.nodeType !== 'NULL') {
                    tempQue.push(v._leftChild!);
                }
                if (v._rightChild.nodeType !== 'NULL') {
                    tempQue.push(v._rightChild!);
                }
            });

            const preColIndex = [];
            for (let i = 0; i < tempQue.length; i++) {
                if (colIndex >= nonUniformColObjs.length) {
                    break;
                    //throw new Error("col index out range");
                }
                const type = nonUniformColObjs[colIndex].isMissContain(tempQue[i]);
                nonUniformColObjs[colIndex].containColumnRange(tempQue[i], type);
                if (type === 1) {
                    continue;
                } else if (type === 2) {
                    tempNeedLoadDifNodes.push(tempQue[i]);
                    preColIndex.push(colIndex);
                } else if (type === 3) {
                    colIndex++;
                    i--;
                } else if (type === 6) {
                    break;
                } else {
                    continue;
                    // throw new Error("node time is little than col");
                }
            }
            if (preColIndex.length != tempNeedLoadDifNodes.length) {
                throw new Error("cannot memory index");
            }

            for (let i = 0; i < tempNeedLoadDifNodes.length; i++) {
                if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                    const con1 = canCut(tempNeedLoadDifNodes[i], nonUniformColObjs[preColIndex[i]], nonUniformColObjs[preColIndex[i] + 1], yScale);
                    if (con1) {
                        tempNeedLoadDifNodes.splice(i, 1)
                        preColIndex.splice(i, 1);
                    }
                }

            }
            //this.checkMonotonicity(nonUniformColObjs,preColIndex,tempNeedLoadDifNodes);
            needLoadDifNode = tempNeedLoadDifNodes;

            if (needLoadDifNode.length > 0 && needLoadDifNode[0].level === this.maxLevel - 1) {

                console.log("last level:", needLoadDifNode.length);

                for (let i = 0; i < needLoadDifNode.length; i++) {
                    const nodeFlag1 = currentFlagInfo[2 * needLoadDifNode[i].index];
                    if (nodeFlag1 === 1) {
                        throw new Error("flag error")
                    }
                    const nodeFlag2 = currentFlagInfo[2 * needLoadDifNode[i].index + 1]
                    if (nodeFlag2 === 0) {
                        nonUniformColObjs[preColIndex[i]].addLastVal(needLoadDifNode[i].yArray[1]);
                        nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[1]);
                        if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                            nonUniformColObjs[preColIndex[i] + 1].addFirstVal(needLoadDifNode[i].yArray[2]);
                            nonUniformColObjs[preColIndex[i] + 1].forceMerge(needLoadDifNode[i].yArray[2]);
                        }
                    } else {
                        nonUniformColObjs[preColIndex[i]].addLastVal(needLoadDifNode[i].yArray[2]);
                        nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[2]);
                        if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                            nonUniformColObjs[preColIndex[i] + 1].addFirstVal(needLoadDifNode[i].yArray[1]);
                            nonUniformColObjs[preColIndex[i] + 1].forceMerge(needLoadDifNode[i].yArray[1]);
                        }
                    }

                }
                break;
            }
            if (needLoadDifNode.length === 0) {
                break;
            }
            let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
            if (losedDataInfo.length > 0) {
                await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, this);
            }

        }
        for (let i = 0; i < nonUniformColObjs.length; i++) {
            nonUniformColObjs[i].checkIsMis();
        }
        return nonUniformColObjs;
    }


    async viewChangeInteractionFinal1(currentLevel: number, width: number, timeRange: Array<number>, yScale: any, drawer: any) {
        
        const currentFlagInfo = getFlag(this.dataName);
        // const currentFlagInfo = getFlag("mock_guassian_sin_8m_om3_8m");
        if (currentFlagInfo === undefined) {
            throw new Error(this.dataName + " get flag faild")
        } else {
            console.log("flag length:", currentFlagInfo.length)
        }

        allTimes = []
        // console.time("v_c")
        const nonUniformColObjs = computeTimeSE(currentLevel, width, timeRange, this.realDataRowNum, this.maxLevel);
        let needLoadDifNode: Array<TrendTree> = [];
        let colIndex = 0;
        let startT = new Date().getTime();
        for (let i = 0; i < this.levelIndexObjs[currentLevel].firstNodes.length; i++) {
            const firtIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][0], this.maxLevel);
            const lastIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][1], this.maxLevel);
            let p = this.levelIndexObjs[currentLevel].firstNodes[i];

            if (firtIndexTimeRange.startT <= timeRange[0] && lastIndexTimeRange.endT >= timeRange[1]) {
                while (p != null) {
                    if (colIndex >= nonUniformColObjs.length) {
                        break;
                        //throw new Error("col index out range");
                    }
                    const type = nonUniformColObjs[colIndex].isMissContain(p);
                    nonUniformColObjs[colIndex].containColumnRange(p, type);
                    if (type === 1) {
                        p = p.nextSibling!;
                    } else if (type === 2 || type === 7 || type === 8 || type === 9 || type === 10) {
                        if (type === 2) {
                            needLoadDifNode.push(p);
                        }
                        if(type === 7 || type === 9){
                            colIndex++;
                        }
                        // if (type === 7) {
                        //     needLoadDifNode.push(p);
                        //     colIndex++;
                        // }
                        // if (type === 8) {
                        //     if (colIndex != 0) {
                        //         needLoadDifNode.push(p);
                        //     }
                        // }
                        // if (type === 9) {
                        //     colIndex++;
                        //     if (colIndex !== nonUniformColObjs.length - 1) {
                        //         needLoadDifNode.push(p);
                        //     }
                        // }
                        // if (type === 10) {
                        //     needLoadDifNode.push(p);
                        //     //preColIndex.push(colIndex);
                        // }
                        p = p.nextSibling!;
                    } else if (type === 3) {
                        colIndex++;
                    } else if (type === 5) {
                        p = p.nextSibling!
                    } else if (type === 6) {
                        break;
                    } else {
                        p = p.nextSibling!;
                        //throw new Error("node time is little than col");
                    }
                }
            }else{
                debugger
            }
        }
        // debugger
        if (needLoadDifNode.length === 0) {
            return nonUniformColObjs;
        }
        let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
        // debugger
        if (losedDataInfo.length > 0) {
            await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, this);
        }

        while (needLoadDifNode.length > 0) {
            colIndex = 0;
            const tempNeedLoadDifNodes = [];
            const tempQue: Array<TrendTree> = [];

            needLoadDifNode.forEach(v => {
                if ((v._leftChild === null || v._rightChild === null) && v.nodeType === 'O') {
                    debugger
                    throw new Error("cannot find next level node");
                }
                if (v.nodeType === 'NULL') {
                    //
                } else {
                    this.lruCache.has(v._leftChild!.level + "_" + v._leftChild!.index);
                    this.lruCache.has(v._rightChild!.level + "_" + v._rightChild!.index);
                    if (v._leftChild!.nodeType !== 'NULL') {
                        tempQue.push(v._leftChild!);
                    }
                    if (v._rightChild!.nodeType !== 'NULL') {
                        tempQue.push(v._rightChild!);
                    }
                }

            });

            const preColIndex = [];
            for (let i = 0; i < tempQue.length; i++) {
                if (colIndex >= nonUniformColObjs.length) {
                    break;
                    //throw new Error("col index out range");
                }
                const type = nonUniformColObjs[colIndex].isMissContain(tempQue[i]);
                nonUniformColObjs[colIndex].containColumnRange(tempQue[i], type);
                if (type === 1) {
                    continue;
                } else if (type === 2 || type === 7 || type === 8 || type === 9 || type === 10) {
                    if (type === 2) {
                        tempNeedLoadDifNodes.push(tempQue[i]);
                        preColIndex.push(colIndex);
                    }
                    // if (type === 7) {
                    //     tempNeedLoadDifNodes.push(tempQue[i]);
                    //     preColIndex.push(colIndex)
                    // }
                    // if (type === 8) {
                    //     if (colIndex != 0) {
                    //         tempNeedLoadDifNodes.push(tempQue[i]);
                    //         preColIndex.push(colIndex - 1)
                    //     }
                    // }
                    // if (type === 9) {
                    //     if (colIndex !== nonUniformColObjs.length - 1) {
                    //         tempNeedLoadDifNodes.push(tempQue[i]);
                    //         preColIndex.push(colIndex)
                    //     }
                    // }
                    // if (type === 10) {
                    //     tempNeedLoadDifNodes.push(tempQue[i]);
                    //     preColIndex.push(colIndex);
                    // }

                } else if (type === 3) {
                    colIndex++;
                    i--;
                } else if (type === 6) {
                    break;
                } else {
                    continue;
                    // throw new Error("node time is little than col");
                }
            }
            if (preColIndex.length != tempNeedLoadDifNodes.length) {
                throw new Error("cannot memory index");
            }
            // for (let i = 0; i < tempNeedLoadDifNodes.length; i++) {
            //     if (tempNeedLoadDifNodes[i].gapFlag !== 'NO') {
            //         continue;
            //     }
            //     if (preColIndex[i] + 1 < nonUniformColObjs.length) {
            //         const con1 = canCut(tempNeedLoadDifNodes[i], nonUniformColObjs[preColIndex[i]], nonUniformColObjs[preColIndex[i] + 1], yScale);
            //         if (con1) {
            //             tempNeedLoadDifNodes.splice(i, 1)
            //             preColIndex.splice(i, 1);
            //         }
            //     }
            // }
            needLoadDifNode = tempNeedLoadDifNodes;
            if (needLoadDifNode.length > 0 && needLoadDifNode[0].level === this.maxLevel - 1) {
                for (let i = 0; i < needLoadDifNode.length; i++) {
                    const nodeFlag2 = currentFlagInfo[2 * needLoadDifNode[i].index + 1]
                    if (needLoadDifNode[i].gapFlag === 'NO') {
                        if (nodeFlag2 === 0) {
                            nonUniformColObjs[preColIndex[i]].addLastVal(needLoadDifNode[i].yArray[1], needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[1]);
                            if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                                nonUniformColObjs[preColIndex[i] + 1].addFirstVal(needLoadDifNode[i].yArray[2], needLoadDifNode[i]);
                                nonUniformColObjs[preColIndex[i] + 1].forceMerge(needLoadDifNode[i].yArray[2]);
                            }
                        } else {
                            nonUniformColObjs[preColIndex[i]].addLastVal(needLoadDifNode[i].yArray[2], needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[2]);
                            if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                                nonUniformColObjs[preColIndex[i] + 1].addFirstVal(needLoadDifNode[i].yArray[1], needLoadDifNode[i]);
                                nonUniformColObjs[preColIndex[i] + 1].forceMerge(needLoadDifNode[i].yArray[1]);
                            }
                        }
                    } else {
                        if (nodeFlag2 === 0) {
                            nonUniformColObjs[preColIndex[i]].addLastVal(needLoadDifNode[i].yArray[1], needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[1]);

                            nonUniformColObjs[preColIndex[i]].addFirstVal(needLoadDifNode[i].yArray[2], needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[2]);

                        } else {
                            nonUniformColObjs[preColIndex[i]].addLastVal(needLoadDifNode[i].yArray[2], needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[2]);

                            nonUniformColObjs[preColIndex[i]].addFirstVal(needLoadDifNode[i].yArray[1], needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(needLoadDifNode[i].yArray[1]);
                        }
                    }

                }
                break;
            }
            if (store.state.controlParams.progressive && drawer) {
                drawer(nonUniformColObjs, "progressive")
            }
            if (needLoadDifNode.length === 0) {
                break;
            }
            let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
            if (losedDataInfo.length > 0) {
                await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, this);
            }
        }

        console.log("The time to get all coefficients:" + (new Date().getTime() - startT));
        for (let i = 0; i < nonUniformColObjs.length; i++) {
            nonUniformColObjs[i].checkIsMis();
        }

        return nonUniformColObjs;
    }

    async viewTransformFinal(otherDataManager: Array<LevelDataManager>, currentLevel: number, width: number, timeRange: Array<number>, yScale: any, drawer: any, transform_symbol:any){
        const currentFlagInfo = getFlag(this.dataName);
        // const currentFlagInfo = getFlag("custom_number8_test2_om3_test.flagz");
        if (currentFlagInfo === undefined) {
            throw new Error(this.dataName + " get flag faild")
        } else {
            // console.log("flag info:", currentFlagInfo);
            // console.log("flag length:", currentFlagInfo.length)
        }
        const currentFlagInfo2 = [];
        const dataNames = [];
        for(let i=0;i<otherDataManager.length;++i){
            currentFlagInfo2.push(getFlag(otherDataManager[i].dataName));
            dataNames.push(otherDataManager[i].dataName);
            // const currentFlagInfo2 = getFlag("custom_number8_test1_om3_test.flagz");
            if (currentFlagInfo2[i] === undefined) {
                throw new Error(otherDataManager[i].dataName + " get flag faild")
            } else {
                // console.log("flag2 info:", currentFlagInfo2[i]);
                // console.log("flag2 length:", currentFlagInfo2[i].length)
            }
        }
        const maxLevel = Math.ceil(Math.log2(timeRange[1]));
        // const currentFlagInfo = [0,1,1,0,1,0,0,1];
        // const currentFlagInfo2 = [0,1,0,1,0,1,0,1];

        allTimes = []
        const nonUniformColObjs = computeTimeSE(currentLevel, width, timeRange, this.realDataRowNum, this.maxLevel);
        let needLoadDifNode: Array<TrendTree> = [];
        let needLoadDifNode2: Array<Array<TrendTree>> = new Array(otherDataManager.length).fill([]).map(() => new Array<TrendTree>());
        let colIndex = 0;
        let count_obj = {count: 0};

        let sumOfNeedLoadDifNodes = 0;
        let total_time = 0;
        let databaseT = 0;
        let startT = new Date().getTime();
        //假设对于dataset1
        for(let i=0; i<this.levelIndexObjs[currentLevel].firstNodes.length; ++i){
            const firstIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][0], this.maxLevel);
            const lastIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][1], this.maxLevel);
            let p = this.levelIndexObjs[currentLevel].firstNodes[i];
            let p2 = [];
            for(let k=0;k<otherDataManager.length;++k){
                p2.push(otherDataManager[k].levelIndexObjs[currentLevel].firstNodes[i])
            }
            // let p2 = otherDataManager.levelIndexObjs[currentLevel].firstNodes[i];//测试
            let data;
            let resChild;
            if (firstIndexTimeRange.startT <= timeRange[0] && lastIndexTimeRange.endT >= timeRange[1]) {
                while(p != null){
                    if(colIndex >= nonUniformColObjs.length){
                        break;
                    } 
                    const type = nonUniformColObjs[colIndex].isMissContain(p);
                    let p2_temp = p2.slice();
                    nonUniformColObjs[colIndex].containColumnRange(p, type);
                    
                    let start_t = new Date().getTime();
                    nonUniformColObjs[colIndex].computeTransform2(p, p2_temp, type, currentFlagInfo, currentFlagInfo2, transform_symbol, count_obj, needLoadDifNode, needLoadDifNode2);
                    let end_t = new Date().getTime();
                    total_time += end_t - start_t;
                    // nonUniformColObjs[colIndex].computeTransform(p, p2_temp,this.dataName, dataNames, this, otherDataManager, type, currentFlagInfo, currentFlagInfo2, transform_symbol);
                    if(type === 1){
                        p = p.nextSibling!;
                        for(let k=0;k<otherDataManager.length;++k){
                            p2[k] = p2[k].nextSibling!;
                        }                        
                    }
                    else if(type === 2){
                        needLoadDifNode.push(p);
                        for(let k=0;k<otherDataManager.length;++k){
                            needLoadDifNode2[k].push(p2[k]);
                        } 
                        // needLoadDifNode2.push(p2);
                        p = p.nextSibling!;
                        for(let k=0;k<otherDataManager.length;++k){
                            p2[k] = p2[k].nextSibling!;
                        } 
                    }
                    else if (type === 3) {
                        colIndex++;
                    } else if (type === 5) {
                        p = p.nextSibling!;
                        for(let k=0;k<otherDataManager.length;++k){
                            p2[k] = p2[k].nextSibling!;
                        } 
                    } else if (type === 6) {
                        // throw new Error("error in viewchange")
                        break;
                    } else {
                        p = p.nextSibling!;
                        for(let k=0;k<otherDataManager.length;++k){
                            p2[k] = p2[k].nextSibling!;
                        } 
                        //throw new Error("node time is little than col");
                    }
                }
            }
            // console.log("count:", count_obj.count);
        }
        
        if(needLoadDifNode.length === 0){
             return nonUniformColObjs;
        }

        needLoadDifNode = [...new Set(needLoadDifNode)];
        for(let i=0;i<needLoadDifNode2.length;i++){
            needLoadDifNode2[i] = [...new Set(needLoadDifNode2[i])];
        }
        // let start_databaseT = new Date().getTime();
        // let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
        // if (losedDataInfo.length > 0) {
        //     await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, this);  //取得系数
        //     for(let i=0; i<otherDataManager.length; i++)
        //         await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, otherDataManager[i]);
        // }
        // databaseT += new Date().getTime() - start_databaseT;
        sumOfNeedLoadDifNodes += needLoadDifNode.length;

        let testT = 0;
        let alternativeNodes:TrendTree[][] = Array.from({ length: 11 }, () => []);
        let alternativeNodes2:TrendTree[][][] = Array.from({ length: 1 }, () => Array.from({ length: 11 }, () => []));

        while (needLoadDifNode.length > 0) { //如果需要继续向下获取系数，则一直向下查询，直到最后一层
            colIndex = 0;
            let tempNeedLoadDifNodes = [];
            let tempQue: Array<TrendTree> = [];
            let tempNeedLoadDifNodes2 : Array<Array<TrendTree>> = new Array(otherDataManager.length).fill([]).map(() => new Array<TrendTree>());
            let tempQue2: Array<Array<TrendTree>> = new Array(otherDataManager.length).fill([]).map(() => new Array<TrendTree>());

            needLoadDifNode.forEach(v => {
                if(v._leftChild != null && v._rightChild != null){
                    this.lruCache.has(v._leftChild.level + "_" + v._leftChild.index);
                    this.lruCache.has(v._rightChild.level + "_" + v._rightChild.index);
                    if (v._leftChild.nodeType !== 'NULL') {
                        tempQue.push(v._leftChild!);
                    }
                    if (v._rightChild.nodeType !== 'NULL') {
                        tempQue.push(v._rightChild!);
                    }
                }
            });
            for(let i=0;i<needLoadDifNode2.length;++i){
                needLoadDifNode2[i].forEach(v => {
                    if(v._leftChild != null && v._rightChild != null){
                        this.lruCache.has(v._leftChild.level + "_" + v._leftChild.index);
                        this.lruCache.has(v._rightChild.level + "_" + v._rightChild.index);
                        if (v._leftChild.nodeType !== 'NULL') {
                            tempQue2[i].push(v._leftChild!);
                        }
                        if (v._rightChild.nodeType !== 'NULL') {
                            tempQue2[i].push(v._rightChild!);
                        }
                    }
                });
            }
            
            const preColIndex = [];
            let alterNodes = {value: 0};
            // console.log("level:", tempQue[0].level);
            for (let i = 0; i < tempQue.length; i++) {
                if (colIndex >= nonUniformColObjs.length) {
                    break;
                    //throw new Error("col index out range");
                }
                const type = nonUniformColObjs[colIndex].isMissContain(tempQue[i]);
                
                let tempQue3 = [];
                for(let k=0;k<otherDataManager.length;++k){
                    tempQue3.push(tempQue2[k][i]);
                }
                let array = tempQue3.slice();
                nonUniformColObjs[colIndex].containColumnRange(tempQue[i], type);
                // nonUniformColObjs[colIndex].computeTransform(tempQue[i], array, this.dataName, dataNames, this, otherDataManager, type, currentFlagInfo, currentFlagInfo2, transform_symbol);
                let start_t = new Date().getTime(); 
                nonUniformColObjs[colIndex].computeTransform2(tempQue[i], array, type, currentFlagInfo, currentFlagInfo2, transform_symbol, count_obj, tempNeedLoadDifNodes, tempNeedLoadDifNodes2, alternativeNodes, alternativeNodes2, maxLevel, alterNodes);
                let end_t = new Date().getTime();
                total_time += end_t - start_t;
                if (type === 1) {
                    continue;
                } else if (type === 2) {
                    tempNeedLoadDifNodes.push(tempQue[i]);
                    for(let k=0;k<otherDataManager.length;++k){
                        tempNeedLoadDifNodes2[k].push(array[k]);
                    }
                    // tempNeedLoadDifNodes2.push(tempQue2[i]);
                    preColIndex.push(colIndex);
                } else if (type === 3) {
                    colIndex++;
                    i--;
                } else if (type === 6) {
                    break;
                } else {
                    continue;
                    // throw new Error("node time is little than col");
                }
            }
            // console.log("alterNodes:", alterNodes.value);
            tempNeedLoadDifNodes = [...new Set(tempNeedLoadDifNodes)];
            needLoadDifNode = tempNeedLoadDifNodes;
            for(let i=0;i<tempNeedLoadDifNodes2.length;i++){
                tempNeedLoadDifNodes2[i] = [...new Set(tempNeedLoadDifNodes2[i])];
            }
            needLoadDifNode2 = tempNeedLoadDifNodes2;
            // console.log("needLoadDifNode:", needLoadDifNode.length);

            if (needLoadDifNode.length > 0 && needLoadDifNode[0].level === maxLevel - 1) {
                if(transform_symbol === '+'){
                    for (let i = 0; i < needLoadDifNode.length; i++) {
                        let maxL = 0, maxR = 0;
                        const nodeFlag1 = currentFlagInfo[2 * needLoadDifNode[i].index + 1];
                        if(nodeFlag1 === 0){
                            maxL += needLoadDifNode[i].yArray[1];
                            maxR += needLoadDifNode[i].yArray[2];
                        } 
                        else{
                            maxL += needLoadDifNode[i].yArray[2];
                            maxR += needLoadDifNode[i].yArray[1];
                        }
                        //const nodeFlag2 = currentFlagInfo2[2 * needLoadDifNode[i].index + 1];
                        for(let k=0; k<currentFlagInfo2.length;++k){
                            if(currentFlagInfo2[k][needLoadDifNode[i].index * 2 + 1] === 0){
                                maxL += needLoadDifNode2[k][i].yArray[1];
                                maxR += needLoadDifNode2[k][i].yArray[2];
                            }
                            else{
                                maxL += needLoadDifNode2[k][i].yArray[2];
                                maxR += needLoadDifNode2[k][i].yArray[1];
                            }
                        }
                        // let sumOfOtherMin = 0, sumOfOtherMax = 0;
                        // for(let k=0;k<otherDataManager.length;++k){
                        //     sumOfOtherMin += needLoadDifNode2[k][i].yArray[1];
                        //     sumOfOtherMax += needLoadDifNode2[k][i].yArray[2];
                        // }
                        if (needLoadDifNode[i].gapFlag === 'NO') {
                            nonUniformColObjs[preColIndex[i]].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(maxL);
                            if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                                nonUniformColObjs[preColIndex[i] + 1].addFirstVal(maxR, needLoadDifNode[i]);
                                nonUniformColObjs[preColIndex[i] + 1].forceMerge(maxR);
                            }
                        } else {
                            nonUniformColObjs[preColIndex[i]].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(maxL);

                            nonUniformColObjs[preColIndex[i] + 1].addFirstVal(maxR, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i] + 1].forceMerge(maxR);
                        }
                        
                    }
                }
                else if(transform_symbol === '-'){
                    for (let i = 0; i < needLoadDifNode.length; i++) {
                        let maxL = 0, maxR = 0;
                        const nodeFlag1 = currentFlagInfo[2 * needLoadDifNode[i].index + 1];
                        if(nodeFlag1 === 0){
                            maxL += needLoadDifNode[i].yArray[1];
                            maxR += needLoadDifNode[i].yArray[2];
                        } 
                        else{
                            maxL += needLoadDifNode[i].yArray[2];
                            maxR += needLoadDifNode[i].yArray[1];
                        }
                        //const nodeFlag2 = currentFlagInfo2[2 * needLoadDifNode[i].index + 1];
                        for(let k=0; k<currentFlagInfo2.length;++k){
                            if(currentFlagInfo2[k][needLoadDifNode[i].index * 2 + 1] === 0){
                                maxL -= needLoadDifNode2[k][i].yArray[1];
                                maxR -= needLoadDifNode2[k][i].yArray[2];
                            }
                            else{
                                maxL -= needLoadDifNode2[k][i].yArray[2];
                                maxR -= needLoadDifNode2[k][i].yArray[1];
                            }
                        }
                        if (needLoadDifNode[i].gapFlag === 'NO') {
                            nonUniformColObjs[preColIndex[i]].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(maxL);
                            if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                                nonUniformColObjs[preColIndex[i] + 1].addFirstVal(maxR, needLoadDifNode[i]);
                                nonUniformColObjs[preColIndex[i] + 1].forceMerge(maxR);
                            }
                        } else {
                            nonUniformColObjs[preColIndex[i]].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(maxL);

                            nonUniformColObjs[preColIndex[i] + 1].addFirstVal(maxR, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i] + 1].forceMerge(maxR);
                        }
                        
                    }
                }
                else if(transform_symbol === '*'){
                    for (let i = 0; i < needLoadDifNode.length; i++) {
                        let maxL = 0, maxR = 0;
                        const nodeFlag1 = currentFlagInfo[2 * needLoadDifNode[i].index + 1];
                        if(nodeFlag1 === 0){
                            maxL += needLoadDifNode[i].yArray[1];
                            maxR += needLoadDifNode[i].yArray[2];
                        } 
                        else{
                            maxL += needLoadDifNode[i].yArray[2];
                            maxR += needLoadDifNode[i].yArray[1];
                        }
                        //const nodeFlag2 = currentFlagInfo2[2 * needLoadDifNode[i].index + 1];
                        for(let k=0; k<currentFlagInfo2.length;++k){
                            if(currentFlagInfo2[k][needLoadDifNode[i].index * 2 + 1] === 0){
                                maxL *= needLoadDifNode2[k][i].yArray[1];
                                maxR *= needLoadDifNode2[k][i].yArray[2];
                            }
                            else{
                                maxL *= needLoadDifNode2[k][i].yArray[2];
                                maxR *= needLoadDifNode2[k][i].yArray[1];
                            }
                        }
                        if (needLoadDifNode[i].gapFlag === 'NO') {
                            nonUniformColObjs[preColIndex[i]].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(maxL);
                            if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                                nonUniformColObjs[preColIndex[i] + 1].addFirstVal(maxR, needLoadDifNode[i]);
                                nonUniformColObjs[preColIndex[i] + 1].forceMerge(maxR);
                            }
                        } else {
                            nonUniformColObjs[preColIndex[i]].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(maxL);

                            nonUniformColObjs[preColIndex[i] + 1].addFirstVal(maxR, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i] + 1].forceMerge(maxR);
                        }
                        
                    }
                }
                else if(transform_symbol === '/'){
                    for (let i = 0; i < needLoadDifNode.length; i++) {
                        let maxL = 0, maxR = 0;
                        const nodeFlag1 = currentFlagInfo[2 * needLoadDifNode[i].index + 1];
                        if(nodeFlag1 === 0){
                            maxL += needLoadDifNode[i].yArray[1];
                            maxR += needLoadDifNode[i].yArray[2];
                        } 
                        else{
                            maxL += needLoadDifNode[i].yArray[2];
                            maxR += needLoadDifNode[i].yArray[1];
                        }
                        //const nodeFlag2 = currentFlagInfo2[2 * needLoadDifNode[i].index + 1];
                        for(let k=0; k<currentFlagInfo2.length;++k){
                            if(currentFlagInfo2[k][needLoadDifNode[i].index * 2 + 1] === 0){
                                maxL /= needLoadDifNode2[k][i].yArray[1];
                                maxR /= needLoadDifNode2[k][i].yArray[2];
                            }
                            else{
                                maxL /= needLoadDifNode2[k][i].yArray[2];
                                maxR /= needLoadDifNode2[k][i].yArray[1];
                            }
                        }
                        if (needLoadDifNode[i].gapFlag === 'NO') {
                            nonUniformColObjs[preColIndex[i]].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(maxL);
                            if (preColIndex[i] + 1 < nonUniformColObjs.length) {
                                nonUniformColObjs[preColIndex[i] + 1].addFirstVal(maxR, needLoadDifNode[i]);
                                nonUniformColObjs[preColIndex[i] + 1].forceMerge(maxR);
                            }
                        } else {
                            nonUniformColObjs[preColIndex[i]].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i]].forceMerge(maxL);

                            nonUniformColObjs[preColIndex[i] + 1].addFirstVal(maxR, needLoadDifNode[i]);
                            nonUniformColObjs[preColIndex[i] + 1].forceMerge(maxR);
                        }
                        
                    }
                }
                break;
            }
            if (needLoadDifNode.length === 0) {
                break;
            }
            sumOfNeedLoadDifNodes += needLoadDifNode.length;
            // let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
            // if (losedDataInfo.length > 0) {
            //     await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, this); //每一层都需要判断子节点是否需要获取，需要的话要从数据库获取系数
            //     for(let i=0; i<otherDataManager.length; i++)
            //         await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, otherDataManager[i]); 
            // }
            databaseT += new Date().getTime() - startT;
        }
       
        databaseT = new Date().getTime() - startT;
        console.log("The time to get all coefficients:" + databaseT);
        // console.log("The final count:", count_obj.count);
        // console.log("The stop time to get coefficients:", total_time);
        // databaseT = total_time;

        for(let i=0; i<alternativeNodes.length;i++){
            alternativeNodes[i] = [...new Set(alternativeNodes[i])];
        }
        for(let i=0; i<alternativeNodes2.length; i++){
            for(let j=0; j<alternativeNodes2[i].length; j++){
                alternativeNodes2[i][j] = [...new Set(alternativeNodes2[i][j])];
            }
        }
        // const itemsToRemove = 4;
        // if (this.levelIndexObjs.length >= itemsToRemove) {
        //     this.levelIndexObjs.splice(this.levelIndexObjs.length - itemsToRemove, itemsToRemove);
        // }

        //first prune
        for(let i=0; i<alternativeNodes.length;i++){
            for(let j=0; j<alternativeNodes[i].length; j++){
                if(transform_symbol === '+'){
                    let min=0, max=0;
                    for(let len=0; len<alternativeNodes2.length; len++){
                        min += alternativeNodes2[len][i][j].yArray[1];
                        max += alternativeNodes2[len][i][j].yArray[2];
                    }
                    if(alternativeNodes.length === 0) continue;
                    let level = alternativeNodes[i][j].level;
                    let col = Math.floor((timeRange[1] / 2**(level) * alternativeNodes[i][j].index)/(timeRange[1]/width));
                    if((alternativeNodes[i][j].yArray[1] + min > nonUniformColObjs[col].addMin[1]) && (alternativeNodes[i][j].yArray[2] + max < nonUniformColObjs[col].addMax[1])){
                        alternativeNodes[i].splice(j,1);
                        for(let len=0; len<alternativeNodes2.length; len++){
                            alternativeNodes2[len][i].splice(j,1);
                        }
                    }
                }
                else if(transform_symbol === '-'){
                    let min=0, max=0;
                    for(let len=0; len<alternativeNodes2.length; len++){
                        min += alternativeNodes2[len][i][j].yArray[1];
                        max += alternativeNodes2[len][i][j].yArray[2];
                    }
                    if(alternativeNodes.length === 0) continue;
                    let level = alternativeNodes[i][j].level;
                    let col = Math.floor((timeRange[1] / 2**(level) * alternativeNodes[i][j].index)/(timeRange[1]/width));
                    if((alternativeNodes[i][j].yArray[1] - max > nonUniformColObjs[col].subMin[1]) && (alternativeNodes[i][j].yArray[2] - min < nonUniformColObjs[col].subMax[1])){
                        alternativeNodes[i].splice(j,1);
                        for(let len=0; len<alternativeNodes2.length; len++){
                            alternativeNodes2[len][i].splice(j,1);
                        }
                    }
                }
                else if(transform_symbol === '*'){
                    let min, max;
                    let temp = [];
                    temp.push(alternativeNodes[i][j].yArray[1]);
                    temp.push(alternativeNodes[i][j].yArray[2]);
                    for(let k = 0; k<alternativeNodes2.length; ++k){
                        let len = temp.length;
                        for(let l = 0; l<len; ++l){
                            temp.push(temp[l] * alternativeNodes2[k][i][j].yArray[1]);
                            temp.push(temp[l] * alternativeNodes2[k][i][j].yArray[2]);
                        }   
                        for(let m = 0; m<len; ++m){
                            temp.shift();
                        }   
                    }
                    min = Math.min(...temp);
                    max = Math.max(...temp);
                    if(alternativeNodes.length === 0) continue;
                    let level = alternativeNodes[i][j].level;
                    let col = Math.floor((timeRange[1] / 2**(level) * alternativeNodes[i][j].index)/(timeRange[1]/width));
                    if((min > nonUniformColObjs[col].multiMin[1]) && (max < nonUniformColObjs[col].multiMax[1])){
                        alternativeNodes[i].splice(j,1);
                        for(let len=0; len<alternativeNodes2.length; len++){
                            alternativeNodes2[len][i].splice(j,1);
                        }
                    }
                }
            }
        }

        let start_noStopTime = new Date().getTime();
        let tempArray: Array<TrendTree> = [];
        let tempArray2: Array<Array<TrendTree>> = new Array(otherDataManager.length).fill([]).map(() => new Array<TrendTree>());
        if(store.state.controlParams.stopEarly === false){
            for(let i=0;i<alternativeNodes.length;i++){
                // let tempLosedDataInfo = computeLosedDataRangeV1(alternativeNodes[i]);
                // // console.log("tempLosedDataInfo's length:", tempLosedDataInfo.length);
                // if (tempLosedDataInfo.length > 0) {
                //     await batchLoadDataForRangeLevel1MinMaxMiss(tempLosedDataInfo, this, tempArray); 
                //     // console.log("tempArray's length", tempArray.length);
                //     for(let j=0; j<otherDataManager.length; j++)
                //         await batchLoadDataForRangeLevel1MinMaxMiss(tempLosedDataInfo, otherDataManager[j], tempArray2[j]); 
                // }
                for(let m=0; m<alternativeNodes[i].length; m++){
                    tempArray.push(alternativeNodes[i][m]._leftChild!);
                    tempArray.push(alternativeNodes[i][m]._rightChild!);
                }
                for(let j=0; j<otherDataManager.length; j++){
                    for(let n=0; n<alternativeNodes[i].length; n++){
                        tempArray2[j].push(alternativeNodes2[j][i][n]._leftChild!);
                        tempArray2[j].push(alternativeNodes2[j][i][n]._rightChild!);
                    }
                }

                // compare with current pixel column, prune
                for(let k=0; k<tempArray.length;k++){
                    if(transform_symbol === '+'){
                        let min = 0, max = 0;
                        for(let j=0; j<tempArray2.length; j++){
                            min += tempArray2[j][k].yArray[1];
                            max += tempArray2[j][k].yArray[2];
                        }
                        let level = tempArray[0].level;
                        let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                        if((tempArray[k].yArray[1] + min > nonUniformColObjs[col].addMin[1]) && (tempArray[k].yArray[2] + max < nonUniformColObjs[col].addMax[1])){
                            tempArray.splice(k,1);
                            for(let j=0; j<tempArray2.length; j++){
                                tempArray2[j].splice(k,1);
                            }
                        }
                    }
                    else if(transform_symbol === '-'){
                        let min = 0, max = 0;
                        for(let j=0; j<tempArray2.length; j++){
                            min += tempArray2[j][k].yArray[1];
                            max += tempArray2[j][k].yArray[2];
                        }
                        let level = tempArray[0].level;
                        let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                        if((tempArray[k].yArray[1] - max > nonUniformColObjs[col].subMin[1]) && (tempArray[k].yArray[2] - min < nonUniformColObjs[col].subMax[1])){
                            tempArray.splice(k,1);
                            for(let j=0; j<tempArray2.length; j++){
                                tempArray2[j].splice(k,1);
                            }
                        }
                    }
                    else if(transform_symbol === '*'){
                        let min, max;
                        let temp = [];
                        temp.push(tempArray[k].yArray[1]);
                        temp.push(tempArray[k].yArray[2]);
                        for(let i = 0; i<tempArray2.length; ++i){
                            let len = temp.length;
                            for(let j = 0; j<len; ++j){
                                temp.push(temp[j] * tempArray2[i][k].yArray[1]);
                                temp.push(temp[j] * tempArray2[i][k].yArray[2]);
                            }   
                            for(let j = 0; j<len; ++j){
                                temp.shift();
                            }   
                        }
                        min = Math.min(...temp);
                        max = Math.max(...temp);
                        let level = tempArray[0].level;
                        let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                        if((min > nonUniformColObjs[col].multiMin[1]) && (max < nonUniformColObjs[col].multiMax[1])){
                            tempArray.splice(k,1);
                            for(let j=0; j<tempArray2.length; j++){
                                tempArray2[j].splice(k,1);
                            }
                        }
                    }
                }
                
                if(tempArray.length === 0) continue;
                if(tempArray[0].level !== maxLevel - 1)
                    sumOfNeedLoadDifNodes += tempArray.length;
                //arrive the last layer, update
                if(alternativeNodes[i+1].length === 0){
                    // console.log("The last level:", tempArray[0].level);
                    for(let k=0; k<tempArray.length; k++){
                        if(transform_symbol === '+'){
                            let min = tempArray[k].yArray[1];
                            let max = tempArray[k].yArray[2];
                            for(let c=0; c<tempArray2.length; c++){
                                min += tempArray2[c][k].yArray[1];
                                max += tempArray2[c][k].yArray[2];
                            }
                            let level = tempArray[0].level;
                            // console.log("level:", level);
                            let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                            // console.log("col:", col);
                            if(min < nonUniformColObjs[col].addMin[1]){
                                nonUniformColObjs[col].addMin = [tempArray[k].index, min, level, [tempArray[k]]];
                            }
                            if(max > nonUniformColObjs[col].addMax[1]){
                                nonUniformColObjs[col].addMax = [tempArray[k].index, max, level, [tempArray[k]]];
                            }
                        }
                        else if(transform_symbol === '-'){
                            let min = tempArray[k].yArray[1];
                            let max = tempArray[k].yArray[2];
                            for(let c=0; c<tempArray2.length; c++){
                                min -= tempArray2[c][k].yArray[2];
                                max -= tempArray2[c][k].yArray[1];
                            }
                            let level = tempArray[0].level;
                            let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                            if(min < nonUniformColObjs[col].subMin[1]){
                                nonUniformColObjs[col].subMin = [tempArray[k].index, min, level, [tempArray[k]]];
                            }
                            if(max > nonUniformColObjs[col].subMax[1]){
                                nonUniformColObjs[col].subMax = [tempArray[k].index, max, level, [tempArray[k]]];
                            }
                        }
                        else if(transform_symbol === '*'){
                            let min, max;
                            let temp = [];
                            temp.push(tempArray[k].yArray[1]);
                            temp.push(tempArray[k].yArray[2]);
                            for(let i = 0; i<tempArray2.length; ++i){
                                let len = temp.length;
                                for(let j = 0; j<len; ++j){
                                    temp.push(temp[j] * tempArray2[i][k].yArray[1]);
                                    temp.push(temp[j] * tempArray2[i][k].yArray[2]);
                                }   
                                for(let j = 0; j<len; ++j){
                                    temp.shift();
                                }   
                            }
                            min = Math.min(...temp);
                            max = Math.max(...temp);
                            let level = tempArray[0].level;
                            let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                            if(min < nonUniformColObjs[col].multiMin[1]){
                                nonUniformColObjs[col].multiMin = [tempArray[k].index, min, level, [tempArray[k]]];
                            }
                            if(max > nonUniformColObjs[col].multiMax[1]){
                                nonUniformColObjs[col].multiMax = [tempArray[k].index, max, level, [tempArray[k]]];
                            }
                        }
                    }
                    break;
                }
                //update to next layer
                alternativeNodes[i+1] = [...alternativeNodes[i+1], ...tempArray];
                // alternativeNodes[i+1] = [...new Set(alternativeNodes[i+1])];
                for(let l=0; l<tempArray2.length; l++){
                    alternativeNodes2[l][i+1] = [...alternativeNodes2[l][i+1], ...tempArray2[l]];
                    // alternativeNodes2[l][i+1] = [...new Set(alternativeNodes2[l][i+1])];
                }
                tempArray= [];
                for(let l=0; l<tempArray2.length; l++)
                    tempArray2[l] = [];
            }
        }
        databaseT += new Date().getTime() - start_noStopTime;
        console.log("No Stop Time:", databaseT);
        console.log("The final load:", sumOfNeedLoadDifNodes);
        let maxValue = -Infinity, minValue = Infinity, finalValue = 0;
        for (let i = 0; i < nonUniformColObjs.length; i++) {
            nonUniformColObjs[i].checkIsMis();
            if(transform_symbol === '+'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].addMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].addMin[1]);
                // maxValue = 2000;
                // minValue = 2000;
            }
            else if(transform_symbol === '-'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].subMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].subMin[1]);
            }
            else if(transform_symbol === '*'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].multiMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].multiMin[1]);
            }
            else if(transform_symbol === '/'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].divMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].divMin[1]);
            }
            else if(transform_symbol === 'avg'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].addMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].addMin[1]);
            }
            finalValue = Math.max(Math.abs(maxValue), Math.abs(minValue));
        }
        const myDict: { a: NoUniformColObj[]; b: number; } = {
            a: nonUniformColObjs,
            b: finalValue
        }
        return myDict;
    }

    async viewTransformFinal_testNoPrune(otherDataManager: Array<LevelDataManager>, currentLevel: number, width: number, timeRange: Array<number>, yScale: any, drawer: any, transform_symbol:any){
        const currentFlagInfo = getFlag(this.dataName);
        // const currentFlagInfo = getFlag("custom_number8_test2_om3_test.flagz");
        if (currentFlagInfo === undefined) {
            throw new Error(this.dataName + " get flag faild")
        } else {
            console.log("flag info:", currentFlagInfo);
            console.log("flag length:", currentFlagInfo.length)
        }
        const currentFlagInfo2 = [];
        const dataNames = [];
        for(let i=0;i<otherDataManager.length;++i){
            currentFlagInfo2.push(getFlag(otherDataManager[i].dataName));
            dataNames.push(otherDataManager[i].dataName);
            // const currentFlagInfo2 = getFlag("custom_number8_test1_om3_test.flagz");
            if (currentFlagInfo2[i] === undefined) {
                throw new Error(otherDataManager[i].dataName + " get flag faild")
            } else {
                console.log("flag2 info:", currentFlagInfo2[i]);
                console.log("flag2 length:", currentFlagInfo2[i].length)
            }
        }
        const maxLevel = Math.ceil(Math.log2(timeRange[1]));

        let sumOfNeedLoadDifNodes = 0;
        allTimes = []
        const nonUniformColObjs = computeTimeSE(currentLevel, width, timeRange, this.realDataRowNum, this.maxLevel);
        let needLoadDifNode: Array<TrendTree> = [];
        let needLoadDifNode2: Array<Array<TrendTree>> = new Array(otherDataManager.length).fill([]).map(() => new Array<TrendTree>());
        let colIndex = 0;
        let count_obj = {count: 0};

        let total_time = 0;
        let databaseT = 0;
        let startT = new Date().getTime();
        //假设对于dataset1
        for(let i=0; i<this.levelIndexObjs[currentLevel].firstNodes.length; ++i){
            const firstIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][0], this.maxLevel);
            const lastIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][1], this.maxLevel);
            let p = this.levelIndexObjs[currentLevel].firstNodes[i];
            let p2 = [];
            for(let k=0;k<otherDataManager.length;++k){
                p2.push(otherDataManager[k].levelIndexObjs[currentLevel].firstNodes[i])
            }
            // let p2 = otherDataManager.levelIndexObjs[currentLevel].firstNodes[i];//测试
            let data;
            let resChild;
            if (firstIndexTimeRange.startT <= timeRange[0] && lastIndexTimeRange.endT >= timeRange[1]) {
                while(p != null){
                    needLoadDifNode.push(p);
                    for(let i=0; i<p2.length; i++){
                        needLoadDifNode2[i].push(p2[i]);
                    }
                    p = p.nextSibling!;
                    for(let i=0;i<p2.length;i++){
                        p2[i] = p2[i].nextSibling!
                    }
                }
            }
        }
        
        if(needLoadDifNode.length === 0){
             return nonUniformColObjs;
        }

        needLoadDifNode = [...new Set(needLoadDifNode)];
        for(let i=0;i<needLoadDifNode2.length;i++){
            needLoadDifNode2[i] = [...new Set(needLoadDifNode2[i])];
        }
        sumOfNeedLoadDifNodes += needLoadDifNode.length;

        console.log("get data");
        // let start_databaseT = new Date().getTime();
        // let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
        // if (losedDataInfo.length > 0) {
        //     await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, this);  //取得系数
        //     for(let i=0; i<otherDataManager.length; i++)
        //         await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, otherDataManager[i]);
        // }
        // databaseT += new Date().getTime() - start_databaseT;

        let testT = 0;
        let alternativeNodes:TrendTree[][] = Array.from({ length: 11 }, () => []);
        let alternativeNodes2:TrendTree[][][] = Array.from({ length: 2 }, () => Array.from({ length: 11 }, () => []));

        while (needLoadDifNode.length > 0) { //如果需要继续向下获取系数，则一直向下查询，直到最后一层
            colIndex = 0;
            let tempNeedLoadDifNodes = [];
            let tempQue: Array<TrendTree> = [];
            let tempNeedLoadDifNodes2 : Array<Array<TrendTree>> = new Array(otherDataManager.length).fill([]).map(() => new Array<TrendTree>());
            let tempQue2: Array<Array<TrendTree>> = new Array(otherDataManager.length).fill([]).map(() => new Array<TrendTree>());

            needLoadDifNode.forEach(v => {
                if(v._leftChild != null && v._rightChild != null){
                    this.lruCache.has(v._leftChild.level + "_" + v._leftChild.index);
                    this.lruCache.has(v._rightChild.level + "_" + v._rightChild.index);
                    if (v._leftChild.nodeType !== 'NULL') {
                        tempQue.push(v._leftChild!);
                    }
                    if (v._rightChild.nodeType !== 'NULL') {
                        tempQue.push(v._rightChild!);
                    }
                }
            });
            for(let i=0;i<needLoadDifNode2.length;++i){
                needLoadDifNode2[i].forEach(v => {
                    if(v._leftChild != null && v._rightChild != null){
                        this.lruCache.has(v._leftChild.level + "_" + v._leftChild.index);
                        this.lruCache.has(v._rightChild.level + "_" + v._rightChild.index);
                        if (v._leftChild.nodeType !== 'NULL') {
                            tempQue2[i].push(v._leftChild!);
                        }
                        if (v._rightChild.nodeType !== 'NULL') {
                            tempQue2[i].push(v._rightChild!);
                        }
                    }
                });
            }
            
            for (let i = 0; i < tempQue.length; i++) {
                if (colIndex >= nonUniformColObjs.length) {
                    break;
                    //throw new Error("col index out range");
                }
                tempNeedLoadDifNodes.push(tempQue[i]);
            }
            for(let i=0; i<tempQue2.length; i++){
                for(let j=0; j<tempQue2[i].length; j++){
                    tempNeedLoadDifNodes2[i].push(tempQue2[i][j]);
                }
            }
            let testTime = new Date().getTime();
            tempNeedLoadDifNodes = [...new Set(tempNeedLoadDifNodes)];
            needLoadDifNode = tempNeedLoadDifNodes;
            for(let i=0;i<tempNeedLoadDifNodes2.length;i++){
                tempNeedLoadDifNodes2[i] = [...new Set(tempNeedLoadDifNodes2[i])];
            }
            
            let testTime2 = new Date().getTime() - testTime;
            testT += testTime2;
            needLoadDifNode2 = tempNeedLoadDifNodes2;
            if (needLoadDifNode.length > 0 && needLoadDifNode[0].level === maxLevel - 1) {
                if(transform_symbol === '+'){
                    for (let i = 0; i < needLoadDifNode.length; i++) {
                        let maxL = 0, maxR = 0;
                        const nodeFlag1 = currentFlagInfo[2 * needLoadDifNode[i].index + 1];
                        if(nodeFlag1 === 0){
                            maxL += needLoadDifNode[i].yArray[1];
                            maxR += needLoadDifNode[i].yArray[2];
                        } 
                        else{
                            maxL += needLoadDifNode[i].yArray[2];
                            maxR += needLoadDifNode[i].yArray[1];
                        }
                        //const nodeFlag2 = currentFlagInfo2[2 * needLoadDifNode[i].index + 1];
                        for(let k=0; k<currentFlagInfo2.length;++k){
                            if(currentFlagInfo2[k][needLoadDifNode[i].index * 2 + 1] === 0){
                                maxL += needLoadDifNode2[k][i].yArray[1];
                                maxR += needLoadDifNode2[k][i].yArray[2];
                            }
                            else{
                                maxL += needLoadDifNode2[k][i].yArray[2];
                                maxR += needLoadDifNode2[k][i].yArray[1];
                            }
                        }
                        // if (needLoadDifNode[i].gapFlag === 'NO') {
                        //     // nonUniformColObjs[i].addLastVal(maxL, needLoadDifNode[i]);
                        //     nonUniformColObjs[i].forceMerge(maxL);
                        //     if (i + 1 < nonUniformColObjs.length) {
                        //         // nonUniformColObjs[i + 1].addFirstVal(maxR, needLoadDifNode[i]);
                        //         nonUniformColObjs[i + 1].forceMerge(maxR);
                        //     }
                        // } else {
                        //     // nonUniformColObjs[i].addLastVal(maxL, needLoadDifNode[i]);
                        //     nonUniformColObjs[i].forceMerge(maxL);

                        //     // nonUniformColObjs[i + 1].addFirstVal(maxR, needLoadDifNode[i]);
                        //     nonUniformColObjs[i + 1].forceMerge(maxR);
                        // }
                        
                    }
                }
                else if(transform_symbol === '-'){
                    for (let i = 0; i < needLoadDifNode.length; i++) {
                        let maxL = 0, maxR = 0;
                        const nodeFlag1 = currentFlagInfo[2 * needLoadDifNode[i].index + 1];
                        if(nodeFlag1 === 0){
                            maxL += needLoadDifNode[i].yArray[1];
                            maxR += needLoadDifNode[i].yArray[2];
                        } 
                        else{
                            maxL += needLoadDifNode[i].yArray[2];
                            maxR += needLoadDifNode[i].yArray[1];
                        }
                        //const nodeFlag2 = currentFlagInfo2[2 * needLoadDifNode[i].index + 1];
                        for(let k=0; k<currentFlagInfo2.length;++k){
                            if(currentFlagInfo2[k][needLoadDifNode[i].index * 2 + 1] === 0){
                                maxL -= needLoadDifNode2[k][i].yArray[1];
                                maxR -= needLoadDifNode2[k][i].yArray[2];
                            }
                            else{
                                maxL -= needLoadDifNode2[k][i].yArray[2];
                                maxR -= needLoadDifNode2[k][i].yArray[1];
                            }
                        }
                        if (needLoadDifNode[i].gapFlag === 'NO') {
                            nonUniformColObjs[i].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[i].forceMerge(maxL);
                            if (i + 1 < nonUniformColObjs.length) {
                                nonUniformColObjs[i + 1].addFirstVal(maxR, needLoadDifNode[i]);
                                nonUniformColObjs[i + 1].forceMerge(maxR);
                            }
                        } else {
                            nonUniformColObjs[i].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[i].forceMerge(maxL);

                            nonUniformColObjs[i + 1].addFirstVal(maxR, needLoadDifNode[i]);
                            nonUniformColObjs[i + 1].forceMerge(maxR);
                        }
                        
                    }
                }
                else if(transform_symbol === '*'){
                    for (let i = 0; i < needLoadDifNode.length; i++) {
                        let maxL = 0, maxR = 0;
                        const nodeFlag1 = currentFlagInfo[2 * needLoadDifNode[i].index + 1];
                        if(nodeFlag1 === 0){
                            maxL += needLoadDifNode[i].yArray[1];
                            maxR += needLoadDifNode[i].yArray[2];
                        } 
                        else{
                            maxL += needLoadDifNode[i].yArray[2];
                            maxR += needLoadDifNode[i].yArray[1];
                        }
                        //const nodeFlag2 = currentFlagInfo2[2 * needLoadDifNode[i].index + 1];
                        for(let k=0; k<currentFlagInfo2.length;++k){
                            if(currentFlagInfo2[k][needLoadDifNode[i].index * 2 + 1] === 0){
                                maxL *= needLoadDifNode2[k][i].yArray[1];
                                maxR *= needLoadDifNode2[k][i].yArray[2];
                            }
                            else{
                                maxL *= needLoadDifNode2[k][i].yArray[2];
                                maxR *= needLoadDifNode2[k][i].yArray[1];
                            }
                        }
                        if (needLoadDifNode[i].gapFlag === 'NO') {
                            nonUniformColObjs[i].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[i].forceMerge(maxL);
                            if (i + 1 < nonUniformColObjs.length) {
                                nonUniformColObjs[i + 1].addFirstVal(maxR, needLoadDifNode[i]);
                                nonUniformColObjs[i + 1].forceMerge(maxR);
                            }
                        } else {
                            nonUniformColObjs[i].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[i].forceMerge(maxL);

                            nonUniformColObjs[i + 1].addFirstVal(maxR, needLoadDifNode[i]);
                            nonUniformColObjs[i + 1].forceMerge(maxR);
                        }
                        
                    }
                }
                else if(transform_symbol === '/'){
                    for (let i = 0; i < needLoadDifNode.length; i++) {
                        let maxL = 0, maxR = 0;
                        const nodeFlag1 = currentFlagInfo[2 * needLoadDifNode[i].index + 1];
                        if(nodeFlag1 === 0){
                            maxL += needLoadDifNode[i].yArray[1];
                            maxR += needLoadDifNode[i].yArray[2];
                        } 
                        else{
                            maxL += needLoadDifNode[i].yArray[2];
                            maxR += needLoadDifNode[i].yArray[1];
                        }
                        //const nodeFlag2 = currentFlagInfo2[2 * needLoadDifNode[i].index + 1];
                        for(let k=0; k<currentFlagInfo2.length;++k){
                            if(currentFlagInfo2[k][needLoadDifNode[i].index * 2 + 1] === 0){
                                maxL /= needLoadDifNode2[k][i].yArray[1];
                                maxR /= needLoadDifNode2[k][i].yArray[2];
                            }
                            else{
                                maxL /= needLoadDifNode2[k][i].yArray[2];
                                maxR /= needLoadDifNode2[k][i].yArray[1];
                            }
                        }
                        if (needLoadDifNode[i].gapFlag === 'NO') {
                            // nonUniformColObjs[i].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[i].forceMerge(maxL);
                            if (i + 1 < nonUniformColObjs.length) {
                                // nonUniformColObjs[i + 1].addFirstVal(maxR, needLoadDifNode[i]);
                                nonUniformColObjs[i + 1].forceMerge(maxR);
                            }
                        } else {
                            // nonUniformColObjs[i].addLastVal(maxL, needLoadDifNode[i]);
                            nonUniformColObjs[i].forceMerge(maxL);

                            // nonUniformColObjs[i + 1].addFirstVal(maxR, needLoadDifNode[i]);
                            nonUniformColObjs[i + 1].forceMerge(maxR);
                        }
                        
                    }
                }
                break;
            }
            if (needLoadDifNode.length === 0) {
                break;
            }

            let start_databaseT2 = new Date().getTime();
            sumOfNeedLoadDifNodes += needLoadDifNode.length;
            // let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
            // if (losedDataInfo.length > 0) {
            //     await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, this); //每一层都需要判断子节点是否需要获取，需要的话要从数据库获取系数
            //     for(let i=0; i<otherDataManager.length; i++)
            //         await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, otherDataManager[i]); 
            // }
            // databaseT += new Date().getTime() - start_databaseT2;

        }
       
        // console.log("The time to get all coefficients:" + (new Date().getTime() - startT - testT));
        // console.log("The final count:", count_obj.count);
        console.log("The time to get total coefficients:", new Date().getTime() - startT);
        console.log("The final load:", sumOfNeedLoadDifNodes);

        let maxValue = -Infinity, minValue = Infinity, finalValue = 0;
        for (let i = 0; i < nonUniformColObjs.length; i++) {
            nonUniformColObjs[i].checkIsMis();
            if(transform_symbol === '+'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].addMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].addMin[1]);
                // maxValue = 2000;
                // minValue = 2000;
            }
            else if(transform_symbol === '-'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].subMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].subMin[1]);
                // maxValue = 1000;
                // minValue = -2000;
            }
            else if(transform_symbol === '*'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].multiMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].multiMin[1]);
            }
            else if(transform_symbol === '/'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].divMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].divMin[1]);
            }
            else if(transform_symbol === 'avg'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].addMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].addMin[1]);
            }
            finalValue = Math.max(Math.abs(maxValue), Math.abs(minValue));
        }
        const myDict: { a: NoUniformColObj[]; b: number; } = {
            a: nonUniformColObjs,
            b: finalValue
        }
        return myDict;
    }

    async viewTransformFinal_testNoPrune2(otherDataManager: Array<LevelDataManager>, currentLevel: number, width: number, timeRange: Array<number>, yScale: any, drawer: any, transform_symbol:any){
        const currentFlagInfo = getFlag(this.dataName);
        // const currentFlagInfo = getFlag("custom_number8_test2_om3_test.flagz");
        if (currentFlagInfo === undefined) {
            throw new Error(this.dataName + " get flag faild")
        } else {
            console.log("flag info:", currentFlagInfo);
            console.log("flag length:", currentFlagInfo.length)
        }
        const currentFlagInfo2 = [];
        const dataNames = [];
        for(let i=0;i<otherDataManager.length;++i){
            currentFlagInfo2.push(getFlag(otherDataManager[i].dataName));
            dataNames.push(otherDataManager[i].dataName);
            // const currentFlagInfo2 = getFlag("custom_number8_test1_om3_test.flagz");
            if (currentFlagInfo2[i] === undefined) {
                throw new Error(otherDataManager[i].dataName + " get flag faild")
            } else {
                console.log("flag2 info:", currentFlagInfo2[i]);
                console.log("flag2 length:", currentFlagInfo2[i].length)
            }
        }
        const maxLevel = Math.ceil(Math.log2(timeRange[1]));
        // const currentFlagInfo = [0,1,1,0,1,0,0,1];
        // const currentFlagInfo2 = [0,1,0,1,0,1,0,1];

        allTimes = []
        const nonUniformColObjs = computeTimeSE(currentLevel, width, timeRange, this.realDataRowNum, this.maxLevel);
        let needLoadDifNode: Array<TrendTree> = [];
        let needLoadDifNode2: Array<Array<TrendTree>> = new Array(otherDataManager.length).fill([]).map(() => new Array<TrendTree>());
        let colIndex = 0;
        let count_obj = {count: 0};

        let sumOfNeedLoadDifNodes = 0;
        let total_time = 0;
        let databaseT = 0;
        let startT = new Date().getTime();
        //假设对于dataset1
        for(let i=0; i<this.levelIndexObjs[currentLevel].firstNodes.length; ++i){
            const firstIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][0], this.maxLevel);
            const lastIndexTimeRange = this.getIndexTime(currentLevel, this.levelIndexObjs[currentLevel].loadedDataRange[i][1], this.maxLevel);
            let p = this.levelIndexObjs[currentLevel].firstNodes[i];
            let p2 = [];
            for(let k=0;k<otherDataManager.length;++k){
                p2.push(otherDataManager[k].levelIndexObjs[currentLevel].firstNodes[i])
            }
            // let p2 = otherDataManager.levelIndexObjs[currentLevel].firstNodes[i];//测试
            let data;
            let resChild;
            if (firstIndexTimeRange.startT <= timeRange[0] && lastIndexTimeRange.endT >= timeRange[1]) {
                while(p != null){
                    if(colIndex >= nonUniformColObjs.length){
                        break;
                    } 
                    const type = nonUniformColObjs[colIndex].isMissContain(p);
                    let p2_temp = p2.slice();
                    nonUniformColObjs[colIndex].containColumnRange(p, type);
                    
                    let start_t = new Date().getTime();
                    nonUniformColObjs[colIndex].computeTransform2(p, p2_temp, type, currentFlagInfo, currentFlagInfo2, transform_symbol, count_obj, needLoadDifNode, needLoadDifNode2);
                    let end_t = new Date().getTime();
                    total_time += end_t - start_t;
                    // nonUniformColObjs[colIndex].computeTransform(p, p2_temp,this.dataName, dataNames, this, otherDataManager, type, currentFlagInfo, currentFlagInfo2, transform_symbol);
                    needLoadDifNode.push(p);
                    for(let k=0;k<otherDataManager.length;++k){
                        needLoadDifNode2[k].push(p2[k]);
                    } 
                    if(type === 1){
                        p = p.nextSibling!;
                        for(let k=0;k<otherDataManager.length;++k){
                            p2[k] = p2[k].nextSibling!;
                        }                        
                    }
                    else if(type === 2){
                        
                        // needLoadDifNode2.push(p2);
                        p = p.nextSibling!;
                        for(let k=0;k<otherDataManager.length;++k){
                            p2[k] = p2[k].nextSibling!;
                        } 
                    }
                    else if (type === 3) {
                        colIndex++;
                    } else if (type === 5) {
                        p = p.nextSibling!;
                        for(let k=0;k<otherDataManager.length;++k){
                            p2[k] = p2[k].nextSibling!;
                        } 
                    } else if (type === 6) {
                        // throw new Error("error in viewchange")
                        break;
                    } else {
                        p = p.nextSibling!;
                        for(let k=0;k<otherDataManager.length;++k){
                            p2[k] = p2[k].nextSibling!;
                        } 
                        //throw new Error("node time is little than col");
                    }
                }
            }
            // console.log("count:", count_obj.count);
        }
        
        if(needLoadDifNode.length === 0){
             return nonUniformColObjs;
        }

        needLoadDifNode = [...new Set(needLoadDifNode)];
        for(let i=0;i<needLoadDifNode2.length;i++){
            needLoadDifNode2[i] = [...new Set(needLoadDifNode2[i])];
        }
        // let start_databaseT = new Date().getTime();
        // let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
        // if (losedDataInfo.length > 0) {
        //     await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, this);  //取得系数
        //     for(let i=0; i<otherDataManager.length; i++)
        //         await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, otherDataManager[i]);
        // }
        // databaseT += new Date().getTime() - start_databaseT;
        sumOfNeedLoadDifNodes += needLoadDifNode.length;

        let testT = 0;
        let alternativeNodes:TrendTree[][] = Array.from({ length: 11 }, () => []);
        let alternativeNodes2:TrendTree[][][] = Array.from({ length: 1 }, () => Array.from({ length: 11 }, () => []));

        while (needLoadDifNode.length > 0) { //如果需要继续向下获取系数，则一直向下查询，直到最后一层
            colIndex = 0;
            let tempNeedLoadDifNodes = [];
            let tempQue: Array<TrendTree> = [];
            let tempNeedLoadDifNodes2 : Array<Array<TrendTree>> = new Array(otherDataManager.length).fill([]).map(() => new Array<TrendTree>());
            let tempQue2: Array<Array<TrendTree>> = new Array(otherDataManager.length).fill([]).map(() => new Array<TrendTree>());

            needLoadDifNode.forEach(v => {
                if(v._leftChild != null && v._rightChild != null){
                    this.lruCache.has(v._leftChild.level + "_" + v._leftChild.index);
                    this.lruCache.has(v._rightChild.level + "_" + v._rightChild.index);
                    if (v._leftChild.nodeType !== 'NULL') {
                        tempQue.push(v._leftChild!);
                    }
                    if (v._rightChild.nodeType !== 'NULL') {
                        tempQue.push(v._rightChild!);
                    }
                }
            });
            for(let i=0;i<needLoadDifNode2.length;++i){
                needLoadDifNode2[i].forEach(v => {
                    if(v._leftChild != null && v._rightChild != null){
                        this.lruCache.has(v._leftChild.level + "_" + v._leftChild.index);
                        this.lruCache.has(v._rightChild.level + "_" + v._rightChild.index);
                        if (v._leftChild.nodeType !== 'NULL') {
                            tempQue2[i].push(v._leftChild!);
                        }
                        if (v._rightChild.nodeType !== 'NULL') {
                            tempQue2[i].push(v._rightChild!);
                        }
                    }
                });
            }
            
            const preColIndex = [];
            let alterNodes = {value: 0};
            // console.log("level:", tempQue[0].level);
            console.log("level:");
            for (let i = 0; i < tempQue.length; i++) {
                if (colIndex >= nonUniformColObjs.length) {
                    break;
                    //throw new Error("col index out range");
                }
                const type = nonUniformColObjs[colIndex].isMissContain(tempQue[i]);
                
                let tempQue3 = [];
                for(let k=0;k<otherDataManager.length;++k){
                    tempQue3.push(tempQue2[k][i]);
                }
                let array = tempQue3.slice();
                nonUniformColObjs[colIndex].containColumnRange(tempQue[i], type);
                // nonUniformColObjs[colIndex].computeTransform(tempQue[i], array, this.dataName, dataNames, this, otherDataManager, type, currentFlagInfo, currentFlagInfo2, transform_symbol);
                let start_t = new Date().getTime(); 
                nonUniformColObjs[colIndex].computeTransform2(tempQue[i], array, type, currentFlagInfo, currentFlagInfo2, transform_symbol, count_obj, tempNeedLoadDifNodes, tempNeedLoadDifNodes2, alternativeNodes, alternativeNodes2, maxLevel, alterNodes);
                let end_t = new Date().getTime();
                total_time += end_t - start_t;
                tempNeedLoadDifNodes.push(tempQue[i]);
                for(let k=0;k<otherDataManager.length;++k){
                    tempNeedLoadDifNodes2[k].push(array[k]);
                }
                if (type === 1) {
                    continue;
                } else if (type === 2) {
                    
                    // tempNeedLoadDifNodes2.push(tempQue2[i]);
                    preColIndex.push(colIndex);
                } else if (type === 3) {
                    colIndex++;
                    i--;
                } else if (type === 6) {
                    break;
                } else {
                    continue;
                    // throw new Error("node time is little than col");
                }
            }
            console.log("alterNodes:");
            tempNeedLoadDifNodes = [...new Set(tempNeedLoadDifNodes)];
            needLoadDifNode = tempNeedLoadDifNodes;
            for(let i=0;i<tempNeedLoadDifNodes2.length;i++){
                tempNeedLoadDifNodes2[i] = [...new Set(tempNeedLoadDifNodes2[i])];
            }
            needLoadDifNode2 = tempNeedLoadDifNodes2;
            console.log("needLoadDifNode:", needLoadDifNode.length);

            if (needLoadDifNode.length === 0) {
                break;
            }
            sumOfNeedLoadDifNodes += needLoadDifNode.length;
            // let losedDataInfo = computeLosedDataRangeV1(needLoadDifNode);
            // if (losedDataInfo.length > 0) {
            //     await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, this); //每一层都需要判断子节点是否需要获取，需要的话要从数据库获取系数
            //     for(let i=0; i<otherDataManager.length; i++)
            //         await batchLoadDataForRangeLevel1MinMaxMiss(losedDataInfo, otherDataManager[i]); 
            // }
            databaseT += new Date().getTime() - startT;

        }
       
        console.log("The time to get all coefficients:" + (new Date().getTime() - startT));
        // console.log("The final count:", count_obj.count);
        // console.log("The stop time to get coefficients:", databaseT);

        for(let i=0; i<alternativeNodes.length;i++){
            alternativeNodes[i] = [...new Set(alternativeNodes[i])];
        }
        for(let i=0; i<alternativeNodes2.length; i++){
            for(let j=0; j<alternativeNodes2[i].length; j++){
                alternativeNodes2[i][j] = [...new Set(alternativeNodes2[i][j])];
            }
        }
        // const itemsToRemove = 4;
        // if (this.levelIndexObjs.length >= itemsToRemove) {
        //     this.levelIndexObjs.splice(this.levelIndexObjs.length - itemsToRemove, itemsToRemove);
        // }

        //first prune
        for(let i=0; i<alternativeNodes.length;i++){
            for(let j=0; j<alternativeNodes[i].length; j++){
                if(transform_symbol === '+'){
                    let min=0, max=0;
                    for(let len=0; len<alternativeNodes2.length; len++){
                        min += alternativeNodes2[len][i][j].yArray[1];
                        max += alternativeNodes2[len][i][j].yArray[2];
                    }
                    if(alternativeNodes.length === 0) continue;
                    let level = alternativeNodes[i][j].level;
                    let col = Math.floor((timeRange[1] / 2**(level) * alternativeNodes[i][j].index)/(timeRange[1]/width));
                    if((alternativeNodes[i][j].yArray[1] + min > nonUniformColObjs[col].addMin[1]) && (alternativeNodes[i][j].yArray[2] + max < nonUniformColObjs[col].addMax[1])){
                        alternativeNodes[i].splice(j,1);
                        for(let len=0; len<alternativeNodes2.length; len++){
                            alternativeNodes2[len][i].splice(j,1);
                        }
                    }
                }
                else if(transform_symbol === '-'){
                    let min=0, max=0;
                    for(let len=0; len<alternativeNodes2.length; len++){
                        min += alternativeNodes2[len][i][j].yArray[1];
                        max += alternativeNodes2[len][i][j].yArray[2];
                    }
                    if(alternativeNodes.length === 0) continue;
                    let level = alternativeNodes[i][j].level;
                    let col = Math.floor((timeRange[1] / 2**(level) * alternativeNodes[i][j].index)/(timeRange[1]/width));
                    if((alternativeNodes[i][j].yArray[1] - max > nonUniformColObjs[col].subMin[1]) && (alternativeNodes[i][j].yArray[2] - min < nonUniformColObjs[col].subMax[1])){
                        alternativeNodes[i].splice(j,1);
                        for(let len=0; len<alternativeNodes2.length; len++){
                            alternativeNodes2[len][i].splice(j,1);
                        }
                    }
                }
                else if(transform_symbol === '*'){
                    let min, max;
                    let temp = [];
                    temp.push(alternativeNodes[i][j].yArray[1]);
                    temp.push(alternativeNodes[i][j].yArray[2]);
                    for(let k = 0; k<alternativeNodes2.length; ++k){
                        let len = temp.length;
                        for(let l = 0; l<len; ++l){
                            temp.push(temp[l] * alternativeNodes2[k][i][j].yArray[1]);
                            temp.push(temp[l] * alternativeNodes2[k][i][j].yArray[2]);
                        }   
                        for(let m = 0; m<len; ++m){
                            temp.shift();
                        }   
                    }
                    min = Math.min(...temp);
                    max = Math.max(...temp);
                    if(alternativeNodes.length === 0) continue;
                    let level = alternativeNodes[i][j].level;
                    let col = Math.floor((timeRange[1] / 2**(level) * alternativeNodes[i][j].index)/(timeRange[1]/width));
                    if((min > nonUniformColObjs[col].multiMin[1]) && (max < nonUniformColObjs[col].multiMax[1])){
                        alternativeNodes[i].splice(j,1);
                        for(let len=0; len<alternativeNodes2.length; len++){
                            alternativeNodes2[len][i].splice(j,1);
                        }
                    }
                }
            }
        }

        let start_noStopTime = new Date().getTime();
        let tempArray: Array<TrendTree> = [];
        let tempArray2: Array<Array<TrendTree>> = new Array(otherDataManager.length).fill([]).map(() => new Array<TrendTree>());
        if(store.state.controlParams.stopEarly === false){
            for(let i=0;i<alternativeNodes.length;i++){
                // let tempLosedDataInfo = computeLosedDataRangeV1(alternativeNodes[i]);
                // // console.log("tempLosedDataInfo's length:", tempLosedDataInfo.length);
                // if (tempLosedDataInfo.length > 0) {
                //     await batchLoadDataForRangeLevel1MinMaxMiss(tempLosedDataInfo, this, tempArray); 
                //     // console.log("tempArray's length", tempArray.length);
                //     for(let j=0; j<otherDataManager.length; j++)
                //         await batchLoadDataForRangeLevel1MinMaxMiss(tempLosedDataInfo, otherDataManager[j], tempArray2[j]); 
                // }
                for(let m=0; m<alternativeNodes[i].length; m++){
                    tempArray.push(alternativeNodes[i][m]._leftChild!);
                    tempArray.push(alternativeNodes[i][m]._rightChild!);
                }
                for(let j=0; j<otherDataManager.length; j++){
                    for(let n=0; n<alternativeNodes[i].length; n++){
                        tempArray2[j].push(alternativeNodes2[j][i][n]._leftChild!);
                        tempArray2[j].push(alternativeNodes2[j][i][n]._rightChild!);
                    }
                }

                // compare with current pixel column, prune
                for(let k=0; k<tempArray.length;k++){
                    if(transform_symbol === '+'){
                        let min = 0, max = 0;
                        for(let j=0; j<tempArray2.length; j++){
                            min += tempArray2[j][k].yArray[1];
                            max += tempArray2[j][k].yArray[2];
                        }
                        let level = tempArray[0].level;
                        let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                        if((tempArray[k].yArray[1] + min > nonUniformColObjs[col].addMin[1]) && (tempArray[k].yArray[2] + max < nonUniformColObjs[col].addMax[1])){
                            tempArray.splice(k,1);
                            for(let j=0; j<tempArray2.length; j++){
                                tempArray2[j].splice(k,1);
                            }
                        }
                    }
                    else if(transform_symbol === '-'){
                        let min = 0, max = 0;
                        for(let j=0; j<tempArray2.length; j++){
                            min += tempArray2[j][k].yArray[1];
                            max += tempArray2[j][k].yArray[2];
                        }
                        let level = tempArray[0].level;
                        let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                        if((tempArray[k].yArray[1] - max > nonUniformColObjs[col].subMin[1]) && (tempArray[k].yArray[2] - min < nonUniformColObjs[col].subMax[1])){
                            tempArray.splice(k,1);
                            for(let j=0; j<tempArray2.length; j++){
                                tempArray2[j].splice(k,1);
                            }
                        }
                    }
                    else if(transform_symbol === '*'){
                        let min, max;
                        let temp = [];
                        temp.push(tempArray[k].yArray[1]);
                        temp.push(tempArray[k].yArray[2]);
                        for(let i = 0; i<tempArray2.length; ++i){
                            let len = temp.length;
                            for(let j = 0; j<len; ++j){
                                temp.push(temp[j] * tempArray2[i][k].yArray[1]);
                                temp.push(temp[j] * tempArray2[i][k].yArray[2]);
                            }   
                            for(let j = 0; j<len; ++j){
                                temp.shift();
                            }   
                        }
                        min = Math.min(...temp);
                        max = Math.max(...temp);
                        let level = tempArray[0].level;
                        let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                        if((min > nonUniformColObjs[col].multiMin[1]) && (max < nonUniformColObjs[col].multiMax[1])){
                            tempArray.splice(k,1);
                            for(let j=0; j<tempArray2.length; j++){
                                tempArray2[j].splice(k,1);
                            }
                        }
                    }
                }
                
                if(tempArray.length === 0) continue;
                if(tempArray[0].level !== maxLevel - 1)
                    sumOfNeedLoadDifNodes += tempArray.length;
                //arrive the last layer, update
                if(alternativeNodes[i+1].length === 0){
                    // console.log("The last level:", tempArray[0].level);
                    for(let k=0; k<tempArray.length; k++){
                        if(transform_symbol === '+'){
                            let min = tempArray[k].yArray[1];
                            let max = tempArray[k].yArray[2];
                            for(let c=0; c<tempArray2.length; c++){
                                min += tempArray2[c][k].yArray[1];
                                max += tempArray2[c][k].yArray[2];
                            }
                            let level = tempArray[0].level;
                            // console.log("level:", level);
                            let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                            // console.log("col:", col);
                            if(min < nonUniformColObjs[col].addMin[1]){
                                nonUniformColObjs[col].addMin = [tempArray[k].index, min, level, [tempArray[k]]];
                            }
                            if(max > nonUniformColObjs[col].addMax[1]){
                                nonUniformColObjs[col].addMax = [tempArray[k].index, max, level, [tempArray[k]]];
                            }
                        }
                        else if(transform_symbol === '-'){
                            let min = tempArray[k].yArray[1];
                            let max = tempArray[k].yArray[2];
                            for(let c=0; c<tempArray2.length; c++){
                                min -= tempArray2[c][k].yArray[2];
                                max -= tempArray2[c][k].yArray[1];
                            }
                            let level = tempArray[0].level;
                            let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                            if(min < nonUniformColObjs[col].subMin[1]){
                                nonUniformColObjs[col].subMin = [tempArray[k].index, min, level, [tempArray[k]]];
                            }
                            if(max > nonUniformColObjs[col].subMax[1]){
                                nonUniformColObjs[col].subMax = [tempArray[k].index, max, level, [tempArray[k]]];
                            }
                        }
                        else if(transform_symbol === '*'){
                            let min, max;
                            let temp = [];
                            temp.push(tempArray[k].yArray[1]);
                            temp.push(tempArray[k].yArray[2]);
                            for(let i = 0; i<tempArray2.length; ++i){
                                let len = temp.length;
                                for(let j = 0; j<len; ++j){
                                    temp.push(temp[j] * tempArray2[i][k].yArray[1]);
                                    temp.push(temp[j] * tempArray2[i][k].yArray[2]);
                                }   
                                for(let j = 0; j<len; ++j){
                                    temp.shift();
                                }   
                            }
                            min = Math.min(...temp);
                            max = Math.max(...temp);
                            let level = tempArray[0].level;
                            let col = Math.floor((timeRange[1] / 2**(level) * tempArray[k].index)/(timeRange[1]/width));
                            if(min < nonUniformColObjs[col].multiMin[1]){
                                nonUniformColObjs[col].multiMin = [tempArray[k].index, min, level, [tempArray[k]]];
                            }
                            if(max > nonUniformColObjs[col].multiMax[1]){
                                nonUniformColObjs[col].multiMax = [tempArray[k].index, max, level, [tempArray[k]]];
                            }
                        }
                    }
                    break;
                }
                let copyT = new Date().getTime();
                //update to next layer
                console.log("copy time:")
                alternativeNodes[i+1] = [...alternativeNodes[i+1], ...tempArray];
                // alternativeNodes[i+1] = [...new Set(alternativeNodes[i+1])];
                for(let l=0; l<tempArray2.length; l++){
                    alternativeNodes2[l][i+1] = [...alternativeNodes2[l][i+1], ...tempArray2[l]];
                    // alternativeNodes2[l][i+1] = [...new Set(alternativeNodes2[l][i+1])];
                }
                console.log("copy time:", new Date().getTime() - copyT);
                tempArray= [];
                for(let l=0; l<tempArray2.length; l++)
                    tempArray2[l] = [];
            }
        }
        databaseT += new Date().getTime() - start_noStopTime;
        console.log("No Prune Time:", databaseT);
        console.log("The final load:", sumOfNeedLoadDifNodes);
        let maxValue = -Infinity, minValue = Infinity, finalValue = 0;
        for (let i = 0; i < nonUniformColObjs.length; i++) {
            nonUniformColObjs[i].checkIsMis();
            if(transform_symbol === '+'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].addMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].addMin[1]);
                // maxValue = 2000;
                // minValue = 2000;
            }
            else if(transform_symbol === '-'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].subMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].subMin[1]);
            }
            else if(transform_symbol === '*'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].multiMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].multiMin[1]);
            }
            else if(transform_symbol === '/'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].divMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].divMin[1]);
            }
            else if(transform_symbol === 'avg'){
                maxValue = Math.max(maxValue, nonUniformColObjs[i].addMax[1]);
                minValue = Math.min(minValue, nonUniformColObjs[i].addMin[1]);
            }
            finalValue = Math.max(Math.abs(maxValue), Math.abs(minValue));
        }
        const myDict: { a: NoUniformColObj[]; b: number; } = {
            a: nonUniformColObjs,
            b: finalValue
        }
        return myDict;
    }
}

