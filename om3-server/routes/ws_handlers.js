const {generateSingalLevelSQLMinMaxMissQuery} = require('../helper/generate_sql');
const {customDBPoolMap, getPool} = require('../helper/util');
const {dataManager} = require('./linechart_postgres');

const routerMap = new Map()
const levelMap = {
    "6ht": 16,
    "1m": 20,
    "2m": 21,
    "4m": 22,
    "8m": 23,
    "16m": 24,
    "32m": 25,
    "64m": 26,
    "1b": 27,
    "3b": 28,
    "10b": 30,
    "test":4,
}

function Init() {
    routerMap.set("level_load_data_min_max_miss",queryMinMaxMissData)
}

const pool =getPool()

function queryMinMaxMissData(req, ws){
    const query = { table_name: req.tn ,line_type:req.line_type,mode:req.mode,user_cookie:req.user_cookie};
    // console.log(dataManager);
    // console.log(query);
    let currentPool=pool
    const userCookie=req.user_cookie;
    if(query.mode==='Custom'){
        if (userCookie === '' || userCookie === null || userCookie === undefined) {
            ws.send(JSON.stringify({ code: 400, msg: "cookie not found", data: { result: "fail" } }))
            return
        }
        if (!customDBPoolMap().has(userCookie)) {
            ws.send(JSON.stringify({ code: 400, msg: "custom db not create connection", data: { result: "fail" } }))
            return
        }
        currentPool=customDBPoolMap().get(userCookie);
    }

    const splitArray = query.table_name.split("_");
    let maxLevel = levelMap[splitArray[splitArray.length - 1]];
    const strObj = req.data;
    // let manager = req.manager;

    const needRangeArray = JSON.parse(strObj)["data"];
    console.log(needRangeArray);
    console.log(manager);

    const curLevel=needRangeArray[0][0];
    if(curLevel===undefined){
        console.log(needRangeArray);
        ws.send({ code: 400, msg: "level error" })
        return
    }
    let schema="";
    if(query.line_type==='Single'){
        schema="om3";
    }else{
        schema="om3_multi";
    }
    const tName=`${schema}.${query.table_name}`;
    const condition = generateSingalLevelSQLMinMaxMissQuery(needRangeArray, maxLevel, tName);
    if (condition === null) {
        console.log(needRangeArray);
        ws.send({ code: 400, msg: "level error" })
        return
    }
    let sqlStr = condition + " order by i asc";
    const minV = [];
    const maxV = [];
    const aveV = [];
    const l = [];
    const idx = [];
    currentPool.query(sqlStr, function (err, result) {
        if (err) {
            console.log(sqlStr);
            currentPool.end();
            throw err;
        }
        
        result.rows.forEach((v) => {
            const curI=v['i'];
            l.push(curLevel);
            idx.push(curI-2**curLevel);
            minV.push(v['minvd']);
            maxV.push(v['maxvd']);
            aveV.push(v['avevd']);
        });
        const resultArray = [];
        if (result && result[0] && result[0].length > 0) {
            for (let i = 0; i < result[0].length; i++) {
                resultArray.push({ l: result[0][i], i: result[1][i], dif: [0, result[2][i], result[3][i], result[4][i], 0] });
            }
        }
        let count = 0;
        // for (let i = 0; i < losedRange.length; i++) {
        //     const levelRange = losedRange[i];
        //     const startNode = manager.levelIndexObjs[losedRange[i][0]].getTreeNodeStartIndex(losedRange[i][1]);
        //     let p: TrendTree = startNode;
        //     const newTreeNode = [];
        //     for (let j = losedRange[i][1]; j <= losedRange[i][2];j++) {
        //         // if (p?.index === j && j === difVals[count].i && p.level === difVals[count].l) {
        //         if (p?.index === j && p.level === difVals[count].l) {
        //             let dif = difVals[count].dif!;
        //             let curNodeType: "O" | "NULL" | "LEFTNULL" | "RIGHTNULL" = 'O';
        //             if (dif[1] === null && dif[2] === null) {
        //                 curNodeType = "NULL";
        //             } else if (dif[1] === null) {
        //                 curNodeType = "LEFTNULL"
        //                 p.gapFlag="L"
        //             } else if (dif[2] === null) {
        //                 curNodeType = "RIGHTNULL";
        //                 p.gapFlag="R"
        //             }
        //             if(curNodeType!=="O"){
        //                 p.nodeType = curNodeType
        //             }
        //             //@ts-ignore
        //             p.difference = difVals[count].dif;
        //             // const yArray1: [any, any, any, any] = [undefined, undefined, undefined, undefined]
        //             // const yArray2: [any, any, any, any] = [undefined, undefined, undefined, undefined]
        //             const yArray1: [any, any, any, any, any] = [undefined, undefined, undefined, undefined, undefined]
        //             const yArray2: [any, any, any, any, any] = [undefined, undefined, undefined, undefined, undefined]
        //             if (curNodeType === 'O') {
        //                 if (p.difference![1] < 0) {
        //                     yArray1[1] = p.yArray[1];
        //                     yArray2[1] = p.yArray[1] - p.difference![1];
        //                 } else {
        //                     yArray1[1] = p.yArray[1] + p.difference![1];
        //                     yArray2[1] = p.yArray[1]
        //                 }
        //                 if (p.difference![2] < 0) {
        //                     yArray1[2] = p.yArray[2] + p.difference![2];
        //                     yArray2[2] = p.yArray[2];
        //                 } else {
        //                     yArray1[2] = p.yArray[2];
        //                     yArray2[2] = p.yArray[2] - p.difference![2];
        //                 }
        //                 if(p.difference![3] <= 0 || p.difference![3] >= 0){
        //                     yArray1[3] = (p.yArray[3] * 2 + p.difference![3]) / 2; 
        //                     yArray2[3] = (p.yArray[3] * 2 - p.difference![3]) / 2; 
        //                 }
        //             } else if (curNodeType == "LEFTNULL") {
                    
        //                 yArray2[1] = p.yArray[1];
        //                 yArray2[2] = p.yArray[2];
        //                 yArray2[3] = p.yArray[3] / 2;
                    
        //             } else if (curNodeType == "RIGHTNULL") {
                    
        //                 yArray1[1] = p.yArray[1];
        //                 yArray1[2] = p.yArray[2];
        //                 yArray1[3] = p.yArray[3] / 2;
                    
        //             } 

        //             const firstNode = new TrendTree(p, true, p.index, yArray1, null);
        //             if (p.nodeType === 'LEFTNULL' || p.nodeType === 'NULL') {
        //                 firstNode.nodeType = 'NULL';
        //             }
        //             const secondNode = new TrendTree(p, false, p.index, yArray2, null);
        //             if (p.nodeType === 'RIGHTNULL' || p.nodeType == 'NULL') {
        //                 secondNode.nodeType = 'NULL';
        //             }
        //             // if(firstNode.nodeType==='NULL'){
        //             //     secondNode.gapFlag='L'
        //             // }
        //             // if(secondNode.nodeType==='NULL'){
        //             //     firstNode.gapFlag='R';
        //             // }
        //             newTreeNode.push(firstNode);
        //             newTreeNode.push(secondNode);
        //             manager.lruCache.set(firstNode.level+"_"+firstNode.index,firstNode);
        //             manager.lruCache.set(secondNode.level+"_"+secondNode.index,secondNode);
        //             p = p.nextSibling!;
        //             count++;
        //             if (p === null || count >= difVals.length) {
        //                 break;
        //             }

        //         } else {
        //             console.log(losedRange[i][0] - 1, Math.floor(losedRange[i][1] / 2))
        //             console.log("lose range:", losedRange, p, p?.index, j);
        //             console.log(manager.levelIndexObjs);
        //             debugger
        //             throw new Error("dif not match node");
        //         }
        //     }
        //     for (let j = 0; j < newTreeNode.length - 1; j++) {
        //         newTreeNode[j].nextSibling = newTreeNode[j + 1];
        //         newTreeNode[j + 1].previousSibling = newTreeNode[j];
        //         if (newTreeNode[j].index != newTreeNode[j + 1].index - 1) {
        //             throw new Error("sibling index error");
        //         }

        //     }
        //     if (manager.levelIndexObjs[losedRange[i][0] + 1]) {
        //         manager.levelIndexObjs[losedRange[i][0] + 1].addLoadedDataRange(newTreeNode[0], [newTreeNode[0].index, newTreeNode[newTreeNode.length - 1].index]);
        //     } else {
        //         manager.levelIndexObjs[losedRange[i][0] + 1] = new LevelIndexObj(losedRange[i][0] + 1, false);
        //         manager.levelIndexObjs[losedRange[i][0] + 1].addLoadedDataRange(newTreeNode[0], [newTreeNode[0].index, newTreeNode[newTreeNode.length - 1].index]);
        //     }
        // }
        ws.send(JSON.stringify({ code: 200, msg: "success", data: [l, idx, minV, maxV, aveV] }));
    });

}

module.exports = { Init, routerMap }