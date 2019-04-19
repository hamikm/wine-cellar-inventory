const AWS = require('aws-sdk');
AWS.config.update({
  region: 'us-east-1',
  endpoint: 'https://dynamodb.us-east-1.amazonaws.com',
});

const docClient = new AWS.DynamoDB.DocumentClient();
const table = '<your table Name>';  // TODO
const bottleNumIdx = '<your bottle number index name>';  // TODO

const ALLOWED_ATTRBS = [
    'bottleUUID', 'location', 'name', 'price', 'rackTimeEpoc', 'status',
    'varietal', 'vintage', 'vineyard', 'lower', 'upper', 'consumeTimeEpoc',
    'bottleNum', 'comments',
];

const STRING_ATTRBS = [
    'bottleUUID', 'location', 'name', 'status', 'varietal', 'vineyard',
    'vintage', 'bottleNum', 'comments',
];

const NUMBER_ATTRBS = [
    'price', 'rackTimeEpoc', 'lower', 'upper', 'consumeTimeEpoc',
];

const isInSet = (s) => (e => s.has(e));

const setContains = (a, b) => {
    return [...a].every(isInSet(b));
}

const shallowSetEq = (a, b) => {
    return a.size === b.size && setContains(a, b);
}

const listContains = (lst, e) => lst.indexOf(e) >= 0;

const listify = str => !str ? [] : str.split(',').map(x => x.trim());

// Make sure that ATTRB definitions make sense
const attrbConstsCorrect = () => {
    const combinedAttrbSet = new Set([...STRING_ATTRBS, ...NUMBER_ATTRBS]);
    return shallowSetEq(new Set(ALLOWED_ATTRBS), combinedAttrbSet);
};

const matchesOrAttrbs = (orableQueryAttrbs, orableAttrbs) => {
    const keys = Object.keys(orableQueryAttrbs);

    for (var i = 0; i < keys.length; i++) {
        const key = keys[i];
        const queryValList = orableQueryAttrbs[key];
        const val = orableAttrbs[key];

        if (queryValList.length === 0) {
            continue;
        }

        var matchedOne = false;
        for (var j = 0; j < queryValList.length; j++) {
            const queryVal = queryValList[j];
            if (queryVal.toLowerCase() === val.toLowerCase()) {
                matchedOne = true;
                break;
            }
        }

        if (!matchedOne) {
            return false;
        }
    }
    return true;
};

const matchesRangeAttrbs = (rangeableQueryAttrbs, rangeableAttrbs) => {
    const keys = Object.keys(rangeableQueryAttrbs);

    for (var i = 0; i < keys.length; i++) {
        const key = keys[i];
        const val = Number(rangeableAttrbs[key]);

        var lower = rangeableQueryAttrbs[key]['lower'];
        lower = !lower ? 0 : Number(lower);
        var upper = rangeableQueryAttrbs[key]['upper'];
        upper = !upper ? 999999 : Number(upper);

        if (val < lower || val > upper) {
            return false;
        }
    }
    return true;
};

const matchesDrinkability = (lower, upper, vintage, drinkability) => {

    // If don't need to match on drinkability
    if (!drinkability) {
        return true;
    }

    const currYear = (new Date()).getFullYear();

    // If lower and upper aren't given, use 0, 3, 5 year rule
    if (!lower || !upper) {

        // Can't apply 0, 3, 5 year rule without vintage
        if (!vintage) {
            return false;
        }

        vintage = Number(vintage);
        if (currYear - vintage <= 3) {
            return drinkability === 'mature' ? true : false;
        } else if (currYear - vintage <= 5) {
            return drinkability === 'drink_soon' ? true : false;
        } else {
            return drinkability === 'past_prime' ? true : false;
        }
    } else {  // Otherwise use 0, 25, 75, 100% of range rul
        lower = Number(lower);
        upper = Number(upper);
        const delta = upper - lower;

        if (currYear - lower < 0) {  // undrinkable
            return drinkability === 'undrinkable' ? true : false;
        } else if (currYear - upper < 0) {
            const fromLower = currYear - lower;
            if (fromLower <= 0.25 * delta) {
                return drinkability === 'young' ? true : false;
            } else if (fromLower <= 0.75 * delta) {  // mature
                return drinkability === 'mature' ? true : false;
            } else {  // drink soon
                return drinkability === 'drink_soon' ? true : false;
            }
        } else {  // past prime
            return drinkability === 'past_prime' ? true : false;
        }
    }
};

const queryAction = (attrbs, context, callback) => {

    const orableQueryAttrbs = {
        name: listify(attrbs['name']),
        varietal: listify(attrbs['varietal']),
        vineyard: listify(attrbs['vineyard']),
        vintage: listify(attrbs['vintage']),
        area: listify(attrbs['area']),
        row: listify(attrbs['row']),
        column: listify(attrbs['column']),
        bottleNum: listify(attrbs['bottleNum']),
    };

    const rangeableQueryAttrbs = {
        price: {
            lower: attrbs['priceLower'],
            upper: attrbs['priceUpper'],
        },
    };

    const drinkabilityQuery = attrbs['drinkability'];
    const unopenedQuery = attrbs['unopened'];

    docClient.scan(scanParams, (err, scanResult) => {
        if (err) {
            return printAndReturnErr(JSON.stringify(err), context, callback);
        } else {
            var newItems = scanResult.Items.filter(item => {

                // If item undefined or already consumed, skip
                if (!item) {
                    return false;
                }

                const bottleUUID = item['bottleUUID'];
                const nameItem = item['name'];
                const priceItem = item['price'];
                const varietalItem = item['varietal'];
                const vintageItem = item['vintage'];
                const vineyardItem = item['vineyard'];
                const lowerItem = item['lower'];
                const upperItem = item['upper'];
                const bottleNumItem = item['bottleNum'] || '';

                // Don't include bottles without proper locations
                var locationItem = item['location'].trim();
                const locationItemLst = listify(locationItem);
                var unopened = true;
                var areaItem = '';
                var rowItem = '';
                var columnItem = '';
                if (locationItem === 'TUMMY') {
                    unopened = false;
                } else {
                    if (!locationItem) {
                        console.log(`skipping ${bottleUUID} b/c no location`);
                        return false;
                    }
                    if (locationItemLst.length !== 3) {
                        console.log(
                            `skipping ${bottleUUID} b/c loc ${locationItem}`);
                        return false;
                    }
                    areaItem = locationItemLst[0];
                    rowItem = locationItemLst[1];
                    columnItem = locationItemLst[2];
                }

                // See if this item matches or-able attributes. Must match
                // at least one thing for each of the following attributes
                const orableAttrbs = {
                    name: nameItem,
                    varietal: varietalItem,
                    vineyard: vineyardItem,
                    vintage: vintageItem,
                    area: areaItem,
                    row: rowItem,
                    column: columnItem,
                    bottleNum: bottleNumItem,
                };
                const matchesOrs = matchesOrAttrbs(
                    orableQueryAttrbs, orableAttrbs);

                // See if item's range attributes fall within these ranges
                const rangeableAttrbs = { price: priceItem };
                const matchesRanges = matchesRangeAttrbs(
                    rangeableQueryAttrbs, rangeableAttrbs);

                // See if item's drinkability matches
                const matchesAge = matchesDrinkability(
                    lowerItem, upperItem, vintageItem, drinkabilityQuery);

                const matchesUnopened = unopenedQuery === unopened;

                return (matchesOrs && matchesRanges && matchesAge
                    && matchesUnopened);
            });

            return callback(null, goodRespParams({ Items: newItems }));
        }
    });
};

const doesBottleUUIDExist = (bottleUUID, cb) => {
    docClient.query(queryUUIDParams(bottleUUID), function(err, data) {
        if (err) {
            console.error(
                '--> unable to query for uuid. Error:', JSON.stringify(err, null, 2));
            cb(false);
        } else {
            if (data.Items.length === 1) {
                const status = data.Items[0].status;
                const location = data.Items[0].location;
                if (status === 'CONSUMED' && location === 'TUMMY') {
                    cb(true, false);  // false second arg means consumed already
                } else {
                    cb(true, true);  // true second arg means not consumed yet
                }
                
            } else {
                cb(false);
            }
        }
    });
};

const doesBottleNumExist = (bottleNum, cb) => {
    docClient.query(queryBottleNumParams(bottleNum), function(err, data) {
        if (err) {
            console.error(
                '--> unable to query for bottle num. Error:', JSON.stringify(err, null, 2));
            cb(true, null);
        } else {
            console.log('--> # bottles', data.Items.length === 0, 'for', bottleNum);
            if (data.Items.length === 0) {
                cb(false, null);
            } else {
                cb(true, data.Items[0].bottleUUID);
            }
        }
    });
};

const putAttrbsInRow = (attrbs, context, callback) => {
    docClient.put(putParams(attrbs), (err, _) => {
        if (err) {
            return printAndReturnErr(
                JSON.stringify(err), context, callback);
        } else {
            callback(null, goodRespParams({}));
        }
    });
};

const addAction = (attrbs, context, callback, editing=false) => {

    // Check that there are no unexpected attribute names and that they have
    // the expected types
    const keys = Object.keys(attrbs);
    for (var i = 0; i < keys.length; i++) {
        const key = keys[i];
        const val = attrbs[key];
        if (!listContains(ALLOWED_ATTRBS, key)) {
            return printAndReturnErr(
                `--> key ${key} not allowed`, context, callback);
        }

        if (listContains(STRING_ATTRBS, key)) {
            if (typeof val !== 'string') {
                const msg = `--> value ${val} for key ${key} needs type string`;
                return printAndReturnErr(msg, context, callback);
            }
        } else if (listContains(NUMBER_ATTRBS, key)) {
            if (typeof val !== 'number') {
                const msg = `--> value ${val} for key ${key} needs type number`;
                return printAndReturnErr(msg, context, callback);
            }
        }
    }

    // If this is a bottle addition, assume the frontend generated a new uuid.
    // Just need to make sure the bottle num isn't already in the database
    if (!editing) {
        doesBottleNumExist(attrbs.bottleNum, (exists, _) => {
            if (!exists) {
                putAttrbsInRow(attrbs, context, callback);
            } else {
                return printAndReturnErr(
                    `Bottle num ${attrbs.bottleNum} already exists. Can't add`,
                    context,
                    callback);
            }
        });
    } else {  // Otherwise check that the bottleUUID exists before updating row
        const bottleUUID = attrbs.bottleUUID;
        doesBottleUUIDExist(bottleUUID, exists => {
            if (exists) {

                // If the new bottle num we just got is already associated with
                // another bottle with a different uuid, we're about to have
                // two bottles with the same bottle num.
                doesBottleNumExist(attrbs.bottleNum, (exists, othersUUID) => {
                    if (!exists) {
                        putAttrbsInRow(attrbs, context, callback);
                    } else {
                        if (bottleUUID === othersUUID) {
                            putAttrbsInRow(attrbs, context, callback);
                        } else {
                            const m = `Bottle num ${attrbs.bottleNum} already exists for ${othersUUID}`
                            return printAndReturnErr(m, context, callback);
                        }
                    }
                });
            } else {
                return printAndReturnErr(
                    `Can't edit nonexistent bottle ${bottleUUID}`,
                    context,
                    callback);
            }
        });
    }
};

const editAction = (attrbs, context, callback) => {
    addAction(attrbs, context, callback, true);
};

const removeAction = (bottleUUID, context, callback) => {
    doesBottleUUIDExist(bottleUUID, exists => {
        if (exists) {
            docClient.delete(deleteParams(bottleUUID), (err, result) => {
                if (err) {
                    return printAndReturnErr(JSON.stringify(err), context, callback);
                } else {
                    callback(null, goodRespParams({}));
                }
            });
        } else {
            return printAndReturnErr(
                `Bottle ${bottleUUID} doesn't exist`, context, callback);
        }
    });
};

const consumeAction = (bottleUUID, context, callback) => {
    doesBottleUUIDExist(bottleUUID, (exists, notConsumed) => {
        if (exists) {
            if (notConsumed) {
                docClient.update(updateParams(bottleUUID), (err, result) => {
                    if (err) {
                        return printAndReturnErr(
                            JSON.stringify(err), context, callback);
                    } else {
                        callback(null, goodRespParams({}));
                    }
                });
            } else {
                return printAndReturnErr(
                    `Bottle was already marked consumed: ${bottleUUID}`,
                    context,
                    callback);
            }
        } else {
            return printAndReturnErr(
                `Bottle does not exist: ${bottleUUID}`, context, callback);
        }
    });
};

const scanParams = {
    TableName: table,
};

const queryUUIDParams = bottleUUID => {
    return {
        TableName: table,
        KeyConditionExpression: '#buuidAttrb = :buuidVal',
        ExpressionAttributeNames: {
            '#buuidAttrb': 'bottleUUID',
        },
        ExpressionAttributeValues: {
            ':buuidVal': bottleUUID,
        },
    };
};

const queryBottleNumParams = bottleNum => {
    return {
        TableName: table,
        IndexName: bottleNumIdx,
        KeyConditionExpression: '#numAttrb = :numVal',
        ExpressionAttributeNames: {
            '#numAttrb': 'bottleNum',
        },
        ExpressionAttributeValues: {
            ':numVal': bottleNum,
        },
    };
};

const putParams = attrbs => {
    return {
        TableName: table,
        Item: attrbs,
    };
};

const deleteParams = bottleUUID => {
    return {
        TableName: table,
        Key: {
            bottleUUID: bottleUUID,
        },
    };
};

const updateParams = bottleUUID => {
    return {
        TableName: table,
        Key: {
            bottleUUID: bottleUUID,
        },
        UpdateExpression: 'set #sname = :sval, #lname = :lval, #cname = :cval',
        ExpressionAttributeNames: {
            '#sname': 'status',
            '#lname': 'location',
            '#cname': 'consumeTimeEpoc',
        },
        ExpressionAttributeValues: {
            ':sval': 'CONSUMED',
            ':lval': 'TUMMY',
            ':cval': Math.floor(new Date() / 1000),
        },
        ReturnValues: 'UPDATED_NEW',
    };
};

const goodRespParams = bodyBlob => {
    return {
        statusCode: 201,
        body: JSON.stringify(bodyBlob),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    };
};

const errRespParams = (errorMessage, awsRequestId) => {
    return {
        statusCode: 500,
        body: JSON.stringify({
            Error: errorMessage,
            Reference: awsRequestId,
        }),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    };
};

const printAndReturnErr = (errMsg, context, callback) => {
    console.error(errMsg);
    return callback(null, errRespParams(errMsg, context.awsRequestId));
};

exports.handler = (event, context, callback) => {
    console.log('--> event', event);

    if (!event.requestContext.authorizer) {
        return printAndReturnErr('--> authorization not configured', context, callback);
    }

    if (!attrbConstsCorrect()) {
        return printAndReturnErr('--> attribute arrays are messed up', context, callback);
    }

    const claims = event.requestContext.authorizer.claims;
    if (!claims || !claims['cognito:username']) {
        return printAndReturnErr('--> no cognito user given', context, callback);
    }
    const requestBody = JSON.parse(event.body);

    if (requestBody.action == 'query') {
        queryAction(requestBody, context, callback);
    } else if (requestBody.action == 'add') {
        addAction(requestBody.attrbs, context, callback);
    } else if (requestBody.action == 'remove') {
        removeAction(requestBody.bottleUUID, context, callback);
    } else if (requestBody.action == 'consume') {
        consumeAction(requestBody.bottleUUID, context, callback);
    } else if (requestBody.action == 'edit') {
        editAction(requestBody.attrbs, context, callback);
    } else {
        return printAndReturnErr(
            `--> unsupported action ${requestBody.action}`, context, callback);
    }
};
