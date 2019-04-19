const listContains = (lst, e) => lst.indexOf(e) >= 0;
const listify = str => !str ? [] : str.split(',').map(x => x.trim());

const invokeUrl = '<your aws api gateway invoke url here>'; // TODO
const ATTRBS = ['Bottle UUID', 'Name', 'Price', 'Varietal', 'Vineyard', 'Vintage', 'Location', 'Lower', 'Upper'];
const NUM_ATTRBS = ['Lower', 'Upper', 'Price'];

// Modal stuff (we use modals instead of popups b/c some people disable them)
const modal = document.getElementById('my_modal');
const modalText = document.getElementById('modal_text');
const modalConfirmButtons = document.getElementById('modal_confirm_buttons');
const modalCloseButton = document.getElementById('modal_close_button');
var cancelModal;  // func
var okModal;  // func

// Various HMTL elements that we reuse
const addFormBlock = document.getElementById('add_form_block');
const queryFormBlock = document.getElementById('query_form_block');

// Misc. globals
var authToken = null;
var tableColNames;
var tableRows;
var inFocusRow;
var hasQueriedAlready = false;
var addFormOpen = true;
var queryFormOpen = true;
var loggedIn = false;

function showModal(show) {
    modal.style = `display:${show ? 'block' : 'none'}`;
}

function showConfirmButtons(show) {
    modalConfirmButtons.style = `display:${show ? 'block' : 'none'}`;
}

function showCloseButton(show) {
    modalCloseButton.style = `display:${show ? 'block' : 'none'}`;
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
    if (event.target == modal) {
        showModal(false);
    }
}

// Shows a modal that's very similar to an iOS Safari style js alert() popup
function alertModal(msg) {
    msg = msg.replace(/\n/g, '<br>');
    modalText.innerHTML = msg;
    showConfirmButtons(false);
    showCloseButton(true);
    showModal(true);
    cancelModal = () => {
        showModal(false);
    };
}

// Shows a modal that's very similar to an iOS Safari style js confirm() popup
function confirmModal(msg, confirmCb) {
    modalText.innerHTML = msg;
    showConfirmButtons(true);
    showCloseButton(false);
    showModal(true);
    cancelModal = () => {
        showModal(false);
    };
    okModal = () => {
        confirmCb();
        showModal(false);
    };
}

// Get URL params out of hash
function getUrlVars() {
    var vars = {};
    var parts = window.location.hash.replace(/[#&]+([^=&]+)=([^&]*)/gi, function (m, key, value) {
        vars[key] = decodeURIComponent(value);
    });
    return vars;
}

// If username and password were given in URL params (e.g., if user scans QR
// code in my wine cellar) then log in immediately
function logInWithUrlParams(cb) {
    const username = getUrlVars()['u'];
    const pw = getUrlVars()['p'];
    authenticate(username, pw, cb);
}

// If bottle num is given in URL params, search for it, show search results,
// and programmatically press edit (which copies bottle's vals into add/edit
// form)
function refreshBottleNum() {
    const bottleNum = getUrlVars()['b'];
    if (bottleNum !== null && bottleNum !== undefined) {
        // Query for bottle with given bottleNum then press its edit
        // button
        document.getElementById('search_bottle_num').value = bottleNum;
        query(true);
    }
}


// If username and password are given in URL hash, log in then check if bottle
// num is given. If it is, show search results for that bottle
function logInWithHash() {
    if (getUrlVars()['u'] && getUrlVars()['p']) {
        logInWithUrlParams((err, res) => {
            if (!err) {
                refreshBottleNum();
            } else {
                console.log('--> login failed, so could not do bottle num tasks');
            }
        });
    }
}
logInWithHash();

// When user scans QR code again, monitor hash change so can refresh search
function hashChangeFunc() {
    if (loggedIn) {
        refreshBottleNum();
    } else {
        logInWithHash();
    }
}
window.onhashchange = hashChangeFunc;

// Shows modal containing comment for given row in current search results table
function showComments(i) {
    const name = tableRows[i].name;
    const vineyard = tableRows[i].vineyard;
    var location = tableRows[i].location;
    location = listify(location).join(', ');
    const vintage = parseInt(tableRows[i].vintage || '0');
    alertModal(`Comments for ${vintage > 0 ? vintage + ' ' : ''}${name} from ${vineyard} at ${location}:\n\n${tableRows[i]['comments']}`);
}

// Toggles visibility of add form and toggles chevron in section header
function toggleAddForm() {
    const afid = 'add_form_chevron';
    const fid = 'add_form';
    if (addFormOpen) {  // if open, close it
        document.getElementById(afid).classList.remove('icon-chevron-up');
        document.getElementById(afid).classList.add('icon-chevron-down');
        document.getElementById(fid).style = 'display:none';
        addFormOpen = false;
    } else {  // open it
        document.getElementById(afid).classList.remove('icon-chevron-down');
        document.getElementById(afid).classList.add('icon-chevron-up');
        document.getElementById(fid).style = 'display:block';
        addFormOpen = true;
    }
}

// Toggles visibility of query form and toggles chevron in section header
function toggleQueryForm() {
    const afid = 'query_form_chevron';
    const fid = 'form';
    if (queryFormOpen) {  // if open, close it
        document.getElementById(afid).classList.remove('icon-chevron-up');
        document.getElementById(afid).classList.add('icon-chevron-down');
        document.getElementById(fid).style = 'display:none';
        queryFormOpen = false;
    } else {  // close it
        document.getElementById(afid).classList.remove('icon-chevron-down');
        document.getElementById(afid).classList.add('icon-chevron-up');
        document.getElementById(fid).style = 'display:block';
        queryFormOpen = true;
    }
}

// Copies values from row in which edit was pressed to add/edit form
function editRow(i, scrollAddFormIntoView = true) {
    inFocusRow = tableRows[i];
    document.getElementById('add_header').innerHTML = '&nbsp;Edit&nbsp;';
    document.getElementById('add_button').value = 'Edit';
    document.getElementById('edit_cancel_button').style = 'display:block';
    document.getElementById('add_clear_button').style = 'display:none';

    document.getElementById('Vineyard').value = inFocusRow.vineyard;
    document.getElementById('Varietal').value = inFocusRow.varietal;
    document.getElementById('Vintage').value = inFocusRow.vintage;
    document.getElementById('Name').value = inFocusRow.name;
    document.getElementById('Price').value = inFocusRow.price;
    document.getElementById('Lower').value =
        inFocusRow.lower ? inFocusRow.lower : '';
    document.getElementById('Upper').value =
        inFocusRow.upper ? inFocusRow.upper : '';
    document.getElementById('add_bottle_num').value =
        inFocusRow.bottleNum || '';
    document.getElementById('add_comments').value = inFocusRow.comments || '';

    // Split location into area, row, col
    const locationCoords = listify(inFocusRow.location);
    if (locationCoords.length === 3) {
        document.getElementById('add_area').value = locationCoords[0];
        document.getElementById('add_row').value = locationCoords[1];
        document.getElementById('add_col').value = locationCoords[2];
    } else {
        document.getElementById('add_area').value = '💩';
        document.getElementById('add_row').value = '';
        document.getElementById('add_col').value = '';
    }

    if (scrollAddFormIntoView) {
        addFormBlock.scrollIntoView();
    }
}

// Switched the edit version of the add form back to the add version
function exitEditMode() {
    document.getElementById('add_header').innerHTML = '&nbsp;Add&nbsp;';
    document.getElementById('add_button').value = 'Add';
    document.getElementById('edit_cancel_button').style = 'display:none';
    document.getElementById('add_clear_button').style = 'display:block';
    clearAddForm();
}

// Clears all the fields in the add form
function clearAddForm() {
    ids = [
        'Vineyard', 'Varietal', 'Vintage', 'Name', 'Price', 'Lower',
        'Upper', 'add_area', 'add_row', 'add_col', 'add_bottle_num', 'add_comments',
    ];
    ids.forEach(attrbName => document.getElementById(attrbName).value = '');
}

// Clears all the fields in the add form
function clearQueryForm() {
    document.getElementById('unopened_checkbox').checked = true;
    document.getElementById('drinkability_attribute').value = 'INVALID';
    ids = [
        'name_value', 'varietal_value', 'vineyard_value', 'vintage_value',
        'search_bottle_num', 'price_lower_value', 'price_upper_value',
        'area_value', 'row_value', 'column_value',
    ];
    ids.forEach(attrbName => document.getElementById(attrbName).value = '');
}

// Returns HTML for first row (column headers) of search results table
function getTableStart() {
    tableColNames = [];
    rtn = '<table id="querytable" class="searchtable">';
    rtn += '<thead id="querytablehead" class="searchthead">';
    rtn += '<tr>';
    rtn += `<th class="searchth">${'Actions'}</th>`;
    tableColNames.push('Actions');
    for (var j = 0; j < ATTRBS.length; j++) {
        skipTheseAttrbs = ['Bottle UUID', 'Lower', 'Upper'];
        if (listContains(skipTheseAttrbs, ATTRBS[j])) {
            continue;
        }
        rtn += `<th class="searchth">${ATTRBS[j]}</th>`;
        tableColNames.push(ATTRBS[j]);
    }
    rtn += '<th class="searchth">Range</th>';
    tableColNames.push('Range');
    rtn += '</tr>';
    rtn += '</thead>';

    return rtn;
}

// Performs a search for bottles with the current values in search form
function query(autoPressEdit = false) {

    // Prepare payload for query rpc
    const nameVal = document.getElementById('name_value').value;
    const varietalVal = document.getElementById('varietal_value').value;
    const vineyardVal = document.getElementById('vineyard_value').value;
    const vintageVal = document.getElementById('vintage_value').value;
    const bottleNumVal = document.getElementById('search_bottle_num').value;
    const areaVal = document.getElementById('area_value').value;
    const rowVal = document.getElementById('row_value').value;
    const columnVal = document.getElementById('column_value').value;
    const priceLowerVal = document.getElementById('price_lower_value').value;
    const priceUpperVal = document.getElementById('price_upper_value').value;
    const drinkabilityVal = document.getElementById('drinkability_attribute').value;
    const unopenedVal = document.getElementById('unopened_checkbox').checked;

    const payload = {
        action: 'query',
        name: !nameVal ? null : nameVal.toLowerCase(),
        varietal: !varietalVal ? null : varietalVal.toLowerCase(),
        vineyard: !vineyardVal ? null : vineyardVal.toLowerCase(),
        vintage: !vintageVal ? null : vintageVal,
        bottleNum: (bottleNumVal === null || bottleNumVal === undefined ?
            null : bottleNumVal),
        area: !areaVal ? null : areaVal.toLowerCase(),
        row: !rowVal ? null : rowVal,
        column: !columnVal ? null : columnVal.toLowerCase(),
        priceLower: !priceLowerVal ? null : priceLowerVal,
        priceUpper: !priceUpperVal ? null : priceUpperVal,
        drinkability: drinkabilityVal === 'INVALID' ? null : drinkabilityVal,
        unopened: (unopenedVal === undefined || unopenedVal === null ?
            null : unopenedVal),
    };

    return $.ajax({
        method: 'POST',
        url: invokeUrl + '/crud',
        headers: {
            Authorization: authToken
        },
        data: JSON.stringify(payload),
        contentType: 'application/json',
        success: function getJsonTable(result) {
            tableRows = result.Items;

            var moreRows = getTableStart();
            moreRows += '<tbody>';
            for (var i = 0; i < tableRows.length; i++) {
                moreRows += '<tr>';
                for (var j = 0; j < tableColNames.length; j++) {
                    const attrbName = tableColNames[j].toLowerCase();
                    const attrbVal = tableRows[i][attrbName] || '';

                    if (attrbName === 'actions') {  // needs special style td
                        moreRows += '<td class="searchtdactions">';
                        moreRows += `<button class="iosstylebutton actionbutton" onclick="remove(${i})"><span class="icon-trash-alt actionicon"></span></button>`;
                        moreRows += `<button class="iosstylebutton actionbutton" onclick="consume(${i})"><span class="icon-glass-cheers actionicon"></span></button>`;
                        moreRows += `<button class="iosstylebutton actionbutton" onclick="editRow(${i})"><span class="icon-edit actionicon"></span></button>`;
                        if (tableRows[i].comments) {
                            moreRows += `<button class="iosstylebutton actionbutton" onclick="showComments(${i})"><span class="icon-comment actionicon"></span></button>`;
                        }
                        moreRows += '</td>';
                    } else {  // generic style td is OK
                        moreRows += '<td class="searchtd">';
                        if (attrbName === 'range') {
                            var lower = tableRows[i].lower;
                            var upper = tableRows[i].upper;
                            var cellContent = '';
                            if (lower && upper) {
                                cellContent = `${lower} to ${upper}`;
                            } else if (lower) {
                                cellContent = `from ${lower} on`;
                            } else if (upper) {
                                cellContent = `until ${upper}`;
                            }
                            moreRows += cellContent;
                        } else if (attrbName === 'location') {
                            if (tableRows[i].location === 'TUMMY') {
                                moreRows += '&#x1f4a9;';  // poop emoji
                            } else {
                                moreRows += attrbVal.replace(/,/gi, ' ');
                            }
                        } else {
                            moreRows += attrbVal;
                        }
                        moreRows += '</td>';
                    }
                }
                moreRows += '</tr>';
            }
            moreRows += '</tbody>';
            moreRows += '</table>';

            const bottles = tableRows.length;
            document.getElementById('count_div').innerHTML =
                `<i>${bottles} bottle${bottles === 1 ? '' : 's'}</i>`;
            document.getElementById('table_div').innerHTML = moreRows;
            hasQueriedAlready = true;

            // Makes the newly created table's header stick to top of screen
            // when user scrolls down
            const $table = $('#querytable');
            const $tableContainer = $('#table_div');
            $table.stickyTableHeaders();

            // When the table is scrolled horizontally, floated table header
            // doesn't scroll with it. This re-floats the header when table
            // is scrolled horizontally
            $tableContainer.scroll(function () {
                $table.stickyTableHeaders();
            });

            // If we did a bottleNum-in-URL-param search, press edit button
            // programmatically
            if (autoPressEdit) {
                if (tableRows.length === 0) {
                    console.log('--> did not find bottle, so just copying num');
                    if (isInEditMode()) {
                        exitEditMode();
                    } else {
                        clearAddForm();
                    }
                    const bottleNum = getUrlVars()['b'];
                    document.getElementById('add_bottle_num').value = bottleNum;
                } else if (tableRows.length === 1) {
                    editRow(0, false);  // only 1 row, so will be vis. at bottom
                    if (queryFormOpen) {
                        toggleQueryForm();
                    }
                } else {
                    console.log('--> ERROR: too many bottles with same num');
                }
            }
        },
        error: function ajaxError(jqXHR, textStatus, errorThrown) {
            console.error('--> error: ', textStatus, ', Details: ', errorThrown);
            console.error('--> response: ', jqXHR.responseText);
            alertModal('An error occured:\n' + jqXHR.responseText);
        }
    });
}

// Generate simple uuid v4
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function isInEditMode() {
    return document.getElementById('add_button').value === 'Edit';
}

// Returns true if given string represents an integer
function strIsPositiveInt(val) {
    if (!val) {
        return false;
    }
    const valAsNum = Number(val);
    if (isNaN(val) || !Number.isInteger(valAsNum)) {
        return false;
    }
    return true;
}

// Handles bottle addition as well as bottle editing
function add() {

    // Prepare the payload of attributes for add rpc
    attrbs = {};
    for (var i = 0; i < ATTRBS.length; i++) {

        const currAttrb = ATTRBS[i];
        var valElem = document.getElementById(currAttrb);
        if (listContains(['Bottle UUID', 'Location'], currAttrb) || !!!valElem || !!!(valElem.value)) {
            continue;
        }

        var attrb = currAttrb.toLowerCase();
        var val = valElem.value;

        if (attrb === 'location') {
            var locElems = val.split(',');
            if (locElems.length !== 3) {
                alertModal('Try again. Location format is: area,row,column');
                return;
            }
            locElems = locElems.map(str => str.trim().toLowerCase());
            val = locElems.join();
        }

        if (listContains(NUM_ATTRBS, currAttrb)) {
            attrbs[attrb] = parseInt(val);
        } else {
            attrbs[attrb] = val ? val.toLowerCase().trim() : val;
        }
    }
    attrbs['bottleNum'] =
        document.getElementById('add_bottle_num').value.trim();
    const comments =
        document.getElementById('add_comments').value.trim();
    if (comments) {
        attrbs['comments'] = comments;
    }

    // The payload depends a little on whether add or edit rpc
    const editing = isInEditMode();
    const area =
        (document.getElementById('add_area').value || '').trim().toLowerCase();
    const row =
        (document.getElementById('add_row').value || '').trim().toLowerCase();
    const col =
        (document.getElementById('add_col').value || '').trim().toLowerCase();
    if (!editing) {  // if adding a new bottle, new UUID & rack date
        attrbs['bottleUUID'] = uuidv4();
        attrbs['rackTimeEpoc'] = Math.floor(new Date() / 1000);
        attrbs['status'] = 'RACKED';
        attrbs['location'] = `${area},${row},${col}`;
    } else {  // if editing an old bottle, keep UUID and some other fields same
        attrbs['bottleUUID'] = inFocusRow.bottleUUID;
        attrbs['rackTimeEpoc'] = inFocusRow.rackTimeEpoc;
        attrbs['status'] = inFocusRow.status;

        // If the bottle hasn't already been consumed, let user edit location
        attrbs['location'] = (inFocusRow.location !== 'TUMMY' ?
            `${area},${row},${col}` : inFocusRow.location);
    }

    // Validate the add form contents. If invalid, show a modal explaining
    // problem. Otherwise call add RPC
    const lowerVal = document.getElementById('Lower').value;
    const upperVal = document.getElementById('Upper').value;
    const cannotBeNull = [
        'Vineyard', 'Varietal', 'Vintage', 'Name', 'Price',
        'add_area', 'add_row', 'add_col', 'add_bottle_num',
    ];
    const mustBeNumbers = ['Vintage', 'Price', 'add_row', 'add_bottle_num'];
    const ifNotNullMustBeNumbers = ['Lower', 'Upper'];
    var valid = true;
    valid = valid && cannotBeNull.every(
        eid => !!document.getElementById(eid).value);
    valid = valid && mustBeNumbers.every(
        eid => strIsPositiveInt(document.getElementById(eid).value));
    valid = valid && ifNotNullMustBeNumbers.filter(
        eid => !!document.getElementById(eid).value).every(
            eid => strIsPositiveInt(document.getElementById(eid).value));
    if (valid && lowerVal && upperVal) {  // skip if invalid already
        if (Number(lowerVal) > Number(upperVal)) {
            valid = false;
        }
    }
    if (!valid) {
        alertModal('Bailey says you messed up your form. Everything is required except comments and drink dates. Vintages, prices, years, rows, and bottle numbers must be integers.');
        return;
    }

    return $.ajax({
        method: 'POST',
        url: invokeUrl + '/crud',
        headers: {
            Authorization: authToken
        },
        data: JSON.stringify({
            action: editing ? 'edit' : 'add',
            attrbs: attrbs,
        }),
        contentType: 'application/json',
        success: function getJsonTable(result) {
            alertModal(`Bailey ${editing ? 'edited' : 'added'} your bottle!`);
            // Don't display the entire cellar after adding a bottle right
            // after loading the page
            if (hasQueriedAlready) {
                query();
            }
            if (editing) {
                exitEditMode();
            }
        },
        error: function ajaxError(jqXHR, textStatus, errorThrown) {
            console.error('--> error: ', textStatus, ', Details: ', errorThrown);
            console.error('--> response: ', jqXHR.responseText);
            alertModal('An error occured:\n' + jqXHR.responseText);
        }
    });
}

// Remove given bottle, clear the add form (so no outdated info), refresh query
function confirmRemove(i) {
    var bottleUUID = tableRows[i].bottleUUID;
    return $.ajax({
        method: 'POST',
        url: invokeUrl + '/crud',
        headers: {
            Authorization: authToken
        },
        data: JSON.stringify({
            action: 'remove',
            bottleUUID: bottleUUID,
        }),
        contentType: 'application/json',
        success: function getJsonTable(result) {
            clearAddForm();  // clear so outdated attrb vals won't be used
            query();  // refresh search results after removal
        },
        error: function ajaxError(jqXHR, textStatus, errorThrown) {
            console.error(
                '--> error: ', textStatus, ', Details: ', errorThrown);
            console.error('--> response: ', jqXHR.responseText);
            try {
                const msg = JSON.parse(jqXHR.responseText).Error;
                alertModal('Bailey could not remove your bottle.\n' + msg);
            } catch (e) {
                alertModal('Bailey could not remove ' + bottleUUID);
            }
        }
    });
}

// Ask if user really wants to remove given bottle. If so, remove it
function remove(i) {
    const name = tableRows[i].name;
    const vineyard = tableRows[i].vineyard;
    var location = tableRows[i].location;
    location = listify(location).join(', ');
    const vintage = parseInt(tableRows[i].vintage || '0');
    confirmModal(
        `Permanently delete entry for ${vintage > 0 ? vintage + ' ' : ''}${name} from ${vineyard}? It's at ${location}.`,
        () => confirmRemove(i));
}

// Consume given bottle, clear the add form (so no outdated info), refresh query
function confirmConsume(i) {
    var bottleUUID = tableRows[i].bottleUUID;
    return $.ajax({
        method: 'POST',
        url: invokeUrl + '/crud',
        headers: {
            Authorization: authToken
        },
        data: JSON.stringify({
            action: 'consume',
            bottleUUID: bottleUUID,
        }),
        contentType: 'application/json',
        success: function getJsonTable(result) {
            clearAddForm();  // clear so outdated attrb vals won't be used
            query();  // refresh search results b/c they probably changed
        },
        error: function ajaxError(jqXHR, textStatus, errorThrown) {
            console.error(
                '--> error: ', textStatus, ', Details: ', errorThrown);
            console.error('--> response: ', jqXHR.responseText);
            try {
                const msg = JSON.parse(jqXHR.responseText).Error;
                alertModal('Bailey could not mark your bottle as consumed.\n' + msg);
            } catch (e) {
                alertModal('Bailey could not mark ' + bottleUUID + ' as consumed');
            }
        }
    });
}

// Ask if user really wants to mark given bottle as consumed. If so, consume it
function consume(i) {
    const name = tableRows[i].name;
    const vineyard = tableRows[i].vineyard;
    var location = tableRows[i].location;
    location = listify(location).join(', ');
    const vintage = parseInt(tableRows[i].vintage || '0');
    confirmModal(
        `Consume the ${vintage > 0 ? vintage + ' ' : ''}${name} from ${vineyard} from ${location}?`,
        () => confirmConsume(i));
}

// Log in
function authenticate(username, pw, cb) {

    var CognitoUserPool = AmazonCognitoIdentity.CognitoUserPool;
    username = username ? username : document.getElementById('username').value;
    pw = pw ? pw : document.getElementById('pw').value;

    var authenticationData = {
        Username: username,
        Password: pw,
    };
    var authenticationDetails = new AWSCognito.CognitoIdentityServiceProvider.AuthenticationDetails(authenticationData);
    var poolData = {
        UserPoolId: '<user pool id goes here>',  // TODO
        ClientId: '<client id goes here>'  // TODO
    };
    var userPool = new AWSCognito.CognitoIdentityServiceProvider.CognitoUserPool(poolData);
    var userData = {
        Username: username,
        Pool: userPool
    };
    var cognitoUser = new AWSCognito.CognitoIdentityServiceProvider.CognitoUser(userData);

    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: function (result) {
            console.log('--> woooo authenticated!!');
            authToken = result.getIdToken().getJwtToken();
            document.getElementById('login_block').style = 'display:none';
            document.getElementById('content_block').style = 'display:block';
            clearRedLoginColor();
            loggedIn = true;
            if (cb) {
                cb(null);
            }
        },
        onFailure: function (err) {
            console.log('--> could not authenticate =(');
            document.getElementById('username').style = 'background-color:#ffcccc';
            document.getElementById('pw').style = 'background-color:#ffcccc';
            if (cb) {
                cb(err);
            }
        },
        // TODO
        // newPasswordRequired: function(userAttributes, requiredAttributes) {
        //     cognitoUser.completeNewPasswordChallenge('<new pass here>', {}, this)
        // }
    });
}

// Makes username and password fields a less threatening color
function clearRedLoginColor() {
    document.getElementById('username').style = 'background-color:#ffffff';
    document.getElementById('pw').style = 'background-color:#ffffff';
}
