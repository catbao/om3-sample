const fs = require("fs");
const { Pool } = require('pg');

const dbConfig = JSON.parse(fs.readFileSync("/Users/bao/Downloads/om3-sample/om3-server/initdb/dbconfig.json").toString());
console.log(dbConfig)
if (!dbConfig['username'] || !dbConfig['hostname'] || !dbConfig['password'] || !dbConfig['db']) {
    throw new Error("db config error");
}
const pool = new Pool({
    user: dbConfig['username'],
    host: dbConfig["hostname"],
    database: dbConfig['db'],
    password: dbConfig['password'],
});

async function computeTableFlag(data) {
    const maxT = data.rows[data.rows.length - 1]['t'];

    const bufLen = 2 ** Math.ceil(Math.log2(maxT));
    const tempArray = new Array(bufLen);
    data.rows.forEach(item => {
        tempArray[item['t']] = item['v'];
    });
    const arrayBuffer = new Buffer.alloc(bufLen);

    for (let j = 0; j < tempArray.length; j += 2) {
        if (tempArray[j] === undefined && tempArray[j + 1] === undefined) {
            continue;
        } else if (tempArray[j] === undefined) {
            arrayBuffer[j] = 1;
            arrayBuffer[j + 1] = 0;
            continue;
        } else if (tempArray[j + 1] === undefined) {
            arrayBuffer[j] = 1;
            arrayBuffer[j + 1] = 1;
            continue
        }
        if (tempArray[j] < tempArray[j + 1]) {
            arrayBuffer[j] = 0;
            arrayBuffer[j + 1] = 0;
        } else {
            arrayBuffer[j] = 0;
            arrayBuffer[j + 1] = 1;
        }
    }
    fs.writeFileSync(`/Users/bao/Downloads/om3-sample/om3-server/flags/${"custom_mock25ht_mock_guassian_sin2_25ht_om3_25ht"}.flagz`, arrayBuffer);
    console.log("compute ordering flag finished")
    //pool.end()
}

async function nonuniformMinMaxEncode() {
    const querySQL = `SELECT t,v FROM "om3_raw_data"."mock_guassian_sin3_1m_copy1" ORDER by t ASC`
    const queryData = await pool.query(querySQL);
    // computeTableFlag(queryData);
    // return
    let data = queryData.rows;

    let min = data[0]['v'];
    let max = data[0]['v'];
    let maxTime = 1048576;
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        if (data[i]['v'] < min) {
            min = data[i]['v'];
        }
        if (data[i]['v'] > max) {
            max = data[i]['v'];
        }
        if (data[i]['t'] > maxTime) {
            maxTime = data[i]['t'];
        }
        sum += data[i]['v'];
    }
    let ave = sum / maxTime;
    const realLen = 2 ** Math.ceil(Math.log2(maxTime));
    const maxL = Math.ceil(Math.log2(maxTime));
    const dataArray = new Array(realLen)
    data.forEach((v, i) => {
        dataArray[v['t']] = v['v'];
    });
    let curL = 1;
    let minV = dataArray
    let maxV = dataArray
    let aveV = dataArray
    for (let l = curL; l <= maxL; l++) {

        console.log("compute level:", l)

        let curMinVDiff = new Array(2 ** (maxL - l));
        let curMaxVDiff = new Array(2 ** (maxL - l));
        let curAveVDiff = new Array(2 ** (maxL - l))

        let curMinV = new Array(2 ** (maxL - l));
        let curMaxV = new Array(2 ** (maxL - l));
        let curAveV = new Array(2 ** (maxL - l))

        for (let i = 0; i < 2 ** (maxL - l + 1); i += 2) {

            //Min
            if (minV[i] === undefined && minV[i + 1] !== undefined) {
                curV = minV[i + 1]
                curDif = undefined;
            } else if (minV[i] !== undefined && minV[i + 1] === undefined) {
                curV = minV[i];
                curDif = 0;
            } else if (minV[i] === undefined && minV[i + 1] === undefined) {
                curV = undefined;
                curDif = undefined;
            } else {
                curV = Math.min(minV[i], minV[i + 1]);
                curDif = minV[i] - minV[i + 1];
            }
            curMinV[i / 2] = curV;
            curMinVDiff[i / 2] = curDif;

            //Max
            if (maxV[i] === undefined && maxV[i + 1] !== undefined) {
                curV = maxV[i + 1];
                curDif = 0;
            } else if (maxV[i] !== undefined && maxV[i + 1] === undefined) {
                curV = maxV[i];
                curDif = undefined;
            } else if (maxV[i] === undefined && maxV[i + 1] === undefined) {
                curV = undefined;
                curDif = undefined;
            } else {
                curV = Math.max(maxV[i], maxV[i + 1]);
                curDif = maxV[i] - maxV[i + 1];
            }
            curMaxV[i / 2] = curV;
            curMaxVDiff[i / 2] = curDif;

            //Ave
            if (aveV[i] === undefined && aveV[i + 1] !== undefined) {
                curV = aveV[i + 1];
                curDif = 0;
            } else if (aveV[i] !== undefined && aveV[i + 1] === undefined) {
                curV = aveV[i];
                curDif = undefined;
            } else if (aveV[i] === undefined && aveV[i + 1] === undefined) {
                curV = undefined;
                curDif = undefined;
            } else {
                curV = (aveV[i] + aveV[i + 1]) / 2;
                curDif = aveV[i] - aveV[i + 1];
            }
            curAveV[i / 2] = curV;
            curAveVDiff[i / 2] = curDif;
        }
        minV = curMinV;
        maxV = curMaxV;
        aveV = curAveV;

        if (l === 1) {
            continue
            // console.log(curMinT, curMinV, curMaxV, curMaxT);
        }

        let sqlStr = "insert into om3.mock1m_mock_guassian_sin3test_1m_om3_1m(i,minvd,maxvd,avevd) values "
        let i = 0;
        while (i < curMaxVDiff.length) {
            const usedL = maxL - l
            let tempStr = ''
            if (i + 10000 < curMaxVDiff.length) {
                for (let j = i; j < i + 10000; j++) {
                    if (curMinVDiff[j] === undefined && curMaxVDiff[j] === undefined) {
                        continue;
                    }

                    if (tempStr === '') {
                        tempStr += ` (${(2 ** usedL) + j},${curMinVDiff[j] === undefined ? "NULL" : curMinVDiff[j]},${curMaxVDiff[j] === undefined ? "NULL" : curMaxVDiff[j]},${curAveVDiff[j] === undefined ? "NULL" : curAveVDiff[j]})`;
                    } else {
                        tempStr += `,(${(2 ** usedL) + j},${curMinVDiff[j] === undefined ? "NULL" : curMinVDiff[j]},${curMaxVDiff[j] === undefined ? "NULL" : curMaxVDiff[j]},${curAveVDiff[j] === undefined ? "NULL" : curAveVDiff[j]})`;
                    }
                }

            } else {
                for (let j = i; j < curMaxVDiff.length; j++) {
                    if (curMinVDiff[j] === undefined && curMaxVDiff[j] === undefined) {
                        continue;
                    }

                    if (tempStr === '') {
                        tempStr += ` (${(2 ** usedL) + j},${curMinVDiff[j] === undefined ? "NULL" : curMinVDiff[j]},${curMaxVDiff[j] === undefined ? "NULL" : curMaxVDiff[j]},${curAveVDiff[j] === undefined ? "NULL" : curAveVDiff[j]})`;
                    } else {
                        tempStr += `,(${(2 ** usedL) + j},${curMinVDiff[j] === undefined ? "NULL" : curMinVDiff[j]},${curMaxVDiff[j] === undefined ? "NULL" : curMaxVDiff[j]},${curAveVDiff[j] === undefined ? "NULL" : curAveVDiff[j]})`;
                    }
                }
            }
            i += 10000
            if (tempStr === '') {
                continue
            }
            let sql = sqlStr + tempStr;
            try {
                await pool.query(sql)
            } catch (err) {
                console.log(sql)
                pool.end();
                throw err
            }
        }
    }
    if (min !== undefined && max !== undefined) {
        const l0Sql = `insert into om3.mock1m_mock_guassian_sin3test_1m_om3_1m(i,minvd,maxvd,avevd) values(${-1},${min},${max},${ave})`
        await pool.query(l0Sql);
        pool.end()
    }

}
nonuniformMinMaxEncode()