class LevelDataManager {
    levelIndexObjs
    maxLevel
    realDataRowNum
    dataName
    md5Num
    isShow
    columnInfos
    curNodeNum
    maxCacheNodeNum
    isIntering
    constructor(levelIndexObjs, dataName, maxLevel) {
        this.levelIndexObjs = levelIndexObjs;
        this.maxLevel = maxLevel ? maxLevel : store.state.controlParams.tableMaxLevel;
        this.realDataRowNum = 2 ** (maxLevel ? maxLevel : store.state.controlParams.tableMaxLevel);
        this.dataName = dataName;
        this.isShow = true;
        this.columnInfos = null;
        this.curNodeNum = 0;
        this.maxCacheNodeNum = 100000
        this.isIntering = false;
    }

}

module.exports = {LevelDataManager}

