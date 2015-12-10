/* 
 * OPENRADIATION API
 */

 //1. generic
var pg = require('pg');
var express = require('express');
var bodyParser = require('body-parser');
var multer = require('multer');  
var properties = require('./properties.js');
var async = require('async');
var fs = require('fs');
var PNG = require('node-png/lib/png').PNG;
var https = require('https');
var http = require('http');
var SHA256 = require("crypto-js/sha256");

var conStr = "postgres://" + properties.login + ":" + properties.password + "@" + properties.host + "/openradiation";
var app = express();
app.use(bodyParser.json({strict: true, limit: '2mb'})); // enclosedObject shouldn't exceeded 1mb, but total space is higher with the base64 encoding
app.use(bodyParser.urlencoded({ extended: true })); 
//app.use(multer({ dest: __dirname + '/uploads/'})); //multipart/form-data

var upload = multer({ dest: __dirname + '/uploads/', storage: multer.memoryStorage(), limits: { files: 1, fileSize: 10 * 1000000 }}); // security : limit file is 10 MB

app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');

app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
 
    next();
});

//2. load apiKeys every ten minutes
var apiKeys = [];
var openradiationApiKey = ""; //the mutable apikey

var apiKeyTestCounter = 0;
var apiKeyTestDate;

getAPI = function() {
    pg.connect(conStr, function(err, client, done) {
        if (err) {
            done();
            console.error("Could not connect to PostgreSQL", err);
        } else {
            var sql = 'SELECT "apiKey","role" from APIKEYS';
            client.query(sql, [], function(err, result) {
                done();
                if (err)
                    console.error("Error while running query " + sql, err);
                else {
                    apiKeys = result.rows;
                    for (i = 0; i < apiKeys.length; i++)
                    {
                        if (apiKeys[i].role == "mutable")
                            openradiationApiKey = apiKeys[i].apiKey;
                    }
                }
            });
        }
    });
};

getAPI();
setInterval(getAPI, properties.getAPIInterval); //every ten minutes

//3. load userId, userPwd every ten minutes
var users = [];

getUsers = function() {
    pg.connect(conStr, function(err, client, done) {
        if (err) {
            done();
            console.error("Could not connect to PostgreSQL", err);
        } else {
            var sql = 'SELECT "userId","userPwd" from APIUSERS';
            client.query(sql, [], function(err, result) {
                done();
                if (err)
                    console.error("Error while running query " + sql, err);
                else {
                    users = result.rows;
                }
            });
        }
    });
};

getUsers();
setInterval(getUsers, properties.getUsersInterval); //every ten minutes

//4. common functions
verifyApiKey = function(res, apiKey, adminOnly, apiKey_, isSubmitAPI) {
    
    for (i = 0; i < apiKeys.length; i++)
    {
        if (apiKeys[i].apiKey == apiKey.toLowerCase()) //apiKey should be in lowercase in the database
        {
            if (adminOnly && apiKeys[i].role != "admin")
            {
                res.status(401).json({ error: {code:"103", message:"apiKey is not valid for this restricted access"}});
                return false;
            }
            
            apiKey_.role = apiKeys[i].role;
            
            //test if apiKey = test is called more often
            if (apiKeys[i].role == "test") {
                var maintenant = new Date();
                if (apiKeyTestDate == null || (apiKeyTestDate.getTime() + properties.APIKeyTestInterval) < maintenant.getTime())
                {
                    apiKeyTestCounter = 1;
                    apiKeyTestDate = maintenant;
                }
                else
                {
                    apiKeyTestCounter+= 1;
                    if (apiKeyTestCounter > properties.APIKeyTestMaxCounter)
                    {
                        res.status(401).json({ error: {code:"103", message:"Too much calls for the test apiKey ... Retry later"}});
                        return false;
                    }
                }
            }
            
            pg.connect(conStr, function(err, client, done) {
                if (err)
                {
                    console.error("Could not connect to PostgreSQL", err);
                    return false;
                } else {
                    var sql;
                    if (isSubmitAPI)
                        sql = 'UPDATE APIKEYS SET "submitAccessCount" = "submitAccessCount" + 1 WHERE "apiKey"=$1';
                    else
                        sql = 'UPDATE APIKEYS SET "requestAccessCount" = "requestAccessCount" + 1 WHERE "apiKey"=$1';
                    client.query(sql, [apiKey.toLowerCase()], function(err, result) {
                        done();
                        if (err)
                        {
                            console.error("Error while running query " + sql, err);
                            return false;
                        }
                    });
                }
            });
            return true;
        }
    }
    res.status(401).json({ error: {code:"103", message:"apiKey is not a valid key"}});           
    return false;
};


//to decrease computation time password are stored 10 to 12 minutes
var passwords = {};
deletePasswords = function() {
    
    for (var i in passwords)
    {
        var now = new Date();
        if (passwords[i].getTime() + 600000 < now.getTime())
            delete passwords[i];
    }
};
setInterval(deletePasswords, 120000); //every 2 minutes

//password_crypt impementation of the php drupal algorithm
//see https://api.drupal.org/api/drupal/includes!password.inc/function/_password_crypt/7
var isPasswordValid = function(password, userPwd) {

    var passwordKey = password + userPwd;
    if (passwordKey in passwords)
    {
        passwords[passwordKey] = new Date();
        return true;
    }
    var CryptoJS = require("crypto-js");
    var SHA512 = require("crypto-js/sha512");
        
    var itoa64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    
    function convertWordArrayToUint8Array(wordArray) {
        var len = wordArray.words.length,
        u8_array = new Uint8Array(len << 2),
        offset = 0, word, i;
        for (i=0; i<len; i++) {
            word = wordArray.words[i];
            u8_array[offset++] = word >> 24;
            u8_array[offset++] = (word >> 16) & 0xff;
            u8_array[offset++] = (word >> 8) & 0xff;
            u8_array[offset++] = word & 0xff;
        }
        return u8_array;
    }

    //base 64 encoding with drupal's method : this function is strictly the same than https://api.drupal.org/api/drupal/includes!password.inc/function/_password_base64_encode/7
    function _password_base64_encode(input) {

        var count = input.length;
        var output = '';
        var i = 0;
        
        do {
            var value = input[i++];
            output += itoa64[value & 0x3f];
            if (i < count) {
              value |= input[i] << 8;
            }
            output += itoa64[(value >> 6) & 0x3f];
            if (i++ >= count) {
              break;
            }
            if (i < count) {
              value |= input[i] << 16;
            }
            output += itoa64[(value >> 12) & 0x3f];
            if (i++ >= count) {
              break;
            }
            output += itoa64[(value >> 18) & 0x3f];
        }
        while (i < count);
    
        return output;
    }

    if (userPwd.length != 55 || userPwd.substring(0,3) != "$S$")
    {
        console.error("isPasswordValid detect an invalid userPwd format");
        return false;
    }   
    
    var count_log2 = itoa64.indexOf(userPwd.substring(3,4));
    if (count_log2 < 0)
    {
        console.error("isPasswordValid detect an invalid userPwd");
        return false;
    }    
    
    var salt = userPwd.substring(4,12);
    var hash = SHA512(salt + password);
    for (var i = 0; i < Math.pow(2,count_log2); i++)
    {
        hash = SHA512(hash.concat(CryptoJS.enc.Utf8.parse(password)));
    } 
    var base64 = _password_base64_encode(convertWordArrayToUint8Array(hash)); 
    if (userPwd == userPwd.substring(0,12) + base64.substr(0,43))
    {
        passwords[password + userPwd] = new Date();
        return true;
    }
    else
        return false;
}

verifyData = function(res, json, isMandatory, dataName) {
       
    if (json[dataName] != null && typeof(json[dataName]) == "string" && json[dataName] == "")
        json[dataName] = null;
    
    if (isMandatory && json[dataName] == null)
    {
        res.status(400).json({ error: {code:"101", message:dataName + " is mandatory but undefined"}});
        return false;
    }

    if (json[dataName] != null)
    {
        switch (dataName) {
            case "apparatusId":
                if (typeof(json[dataName]) != "string" || json[dataName].length > 100)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                break;
            case "apparatusVersion":
                if (typeof(json[dataName]) != "string" || json[dataName].length > 100)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                break;
            case "apparatusSensorType":
                var apparatusSensorTypeValues = ["geiger","photodiode"]; 
                if (typeof(json[dataName]) != "string" || apparatusSensorTypeValues.indexOf(json[dataName]) == -1)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " should be in [geiger | photodiode]"}});
                    return false;
                }
                break;
            case "apparatusTubeType":
                if (typeof(json["apparatusSensorType"]) != "string" || json["apparatusSensorType"] != "geiger")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " can be defined only if apparatusSensorType is geiger"}});
                    return false;
                }
                if (typeof(json[dataName]) != "string" || json[dataName].length > 100)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                break;
            case "temperature":
                if (typeof(json[dataName]) != "number" || parseFloat(json[dataName]) != parseInt(json[dataName]))
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not an integer"}});
                    return false;
                }
                break;
            case "minValue":
            case "maxValue":
            case "minLatitude":
            case "maxLatitude":
            case "minLongitude":
            case "maxLongitude":
                if (typeof(json[dataName]) != "string" || isNaN(json[dataName]) )
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a number " + json[dataName]}});
                    return false;                 
                }
                break;
            case "value":
                if (typeof(json[dataName]) != "number")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a number (" + typeof(json[dataName]) + ")"}});
                    return false;
                }
                break;
            case "hitsNumber":
                if (typeof(json[dataName]) != "number" || parseFloat(json[dataName]) != parseInt(json[dataName]))
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not an integer"}});
                    return false;
                }
                break;
            case "dateOfCreation":
            case "minStartTime":
            case "maxStartTime":
            case "startTime":
                if (typeof(json[dataName]) != "string" || new Date(json[dataName]) == "Invalid Date")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a date"}});
                    return false;
                }
                break;
            case "endTime":
                if (typeof(json[dataName]) != "string" || new Date(json[dataName]) == "Invalid Date")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a date"}});
                    return false;
                }
                break;
            case "latitude":
                if (typeof(json[dataName]) != "number")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a number"}});
                    return false;
                }
                break;
            case "longitude":
                if (typeof(json[dataName]) != "number")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a number"}});
                    return false;
                }
                break;
            case "accuracy":
                if (typeof(json[dataName]) != "number")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a number"}});
                    return false;
                }
                break;   
            case "altitude":
                if (typeof(json[dataName]) != "number" || parseFloat(json[dataName]) != parseInt(json[dataName]))
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not an integer"}});
                    return false;
                }
                break; 
            case "altitudeAccuracy":
                if (typeof(json[dataName]) != "number")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a number"}});
                    return false;
                }
                break; 
            case "deviceUuid":
                if (typeof(json[dataName]) != "string" || json[dataName].length > 100)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                break;
            case "devicePlatform":
                if (typeof(json[dataName]) != "string" || json[dataName].length > 100)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                break; 
            case "deviceVersion":
                if (typeof(json[dataName]) != "string" || json[dataName].length > 100)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                break; 
            case "deviceModel":
                if (typeof(json[dataName]) != "string" || json[dataName].length > 100)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                break;                 
            case "reportUuid": //sample 110e8400-e29b-11d4-a716-446655440000
                if (typeof(json[dataName]) != "string" || json[dataName].length != 36 || /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test( json[dataName]) == false) 
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a UUID format" }});
                    return false;
                }                
                break;
            case "manualReporting":
                if (typeof(json[dataName]) != "boolean")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a boolean"}});
                    return false;
                }
                break; 
            case "organisationReporting":
                if (typeof(json[dataName]) != "string" || json[dataName].length > 100)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                break;
            case "reportContext":
                var reportContextValues = ["emergency","routine","exercise","test"];
                if (typeof(json[dataName]) != "string" || reportContextValues.indexOf(json[dataName]) == -1)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " should be in [emergency | routine | exercise | test]"}});
                    return false;
                }
                break;
            case "description":
                if (typeof(json[dataName]) != "string" || json[dataName].length > 1000)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                if (json["userId"] == null)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " can be defined only if userId is defined"}});
                    return false;
                }
                break;
            case "measurementHeight":
                if (typeof(json[dataName]) != "number" || parseFloat(json[dataName]) != parseInt(json[dataName]))
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not an integer"}});
                    return false;
                }
                break;
            case "tag":
                if (typeof(json[dataName]) != "string" || json[dataName].length > 100)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                break;       
            case "tags":
                if (! (json[dataName] instanceof Array) || json[dataName].length > 10)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " should be an array from ten elements max"}}); 
                    return false;
                }
                for (i = 0; i < json[dataName].length; i++) 
                {
                    if (typeof(json[dataName][i]) != "string" || json[dataName][i].length > 100 || json[dataName][i] == "") 
                    {
                        res.status(400).json({ error: {code:"102", message:dataName + " contains an element which is too long or is not a filled string"}}); 
                        return false;
                    }
                    for (j = 0; j < json[dataName].length; j++) 
                    {
                        if (j<i && json[dataName][i].toLowerCase() == json[dataName][j].toLowerCase())
                        {
                            res.status(400).json({ error: {code:"102", message:dataName + " contains several elements with the same value"}}); 
                            return false;
                        }
                    }
                }
                if (json["userId"] == null)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " can be defined only if userId is defined"}});
                    return false;
                }
                break;
            case "enclosedObject":
                if (typeof(json[dataName]) != "string" || /data:image\/.*;base64,.*/.test( json[dataName].substr(0,50)) == false) //data:image/<subtype>;base64,
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a data URI scheme with base64 encoded image"}});  
                    return false;
                }
                if (json["userId"] == null)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " can be defined only if userId is defined"}});
                    return false;
                }
                break;
            case "userId_request": 
                if (typeof(json["userId"]) != "string" || json["userId"].length > 100)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                break;
            case "userId":
                if (typeof(json[dataName]) != "string" || json[dataName].length > 100)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                if (json["userPwd"] == null)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " can be defined only if userPwd is defined"}});
                    return false;
                }
                break;
            case "userPwd":
                if (typeof(json[dataName]) != "string" || json[dataName].length > 100) 
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                if (json["userId"] == null)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " can be defined only if userId is defined"}});
                    return false;
                }
                for (var i = 0; i < users.length; i++) {
                    if (users[i].userId == json["userId"]) {
                        if (isPasswordValid(json["userPwd"],users[i].userPwd)) //userPwd is encrypted with openradiation.org method and compared to stored encrypted password
                            return true;
                        else
                            break;
                    }
                }
                res.status(400).json({ error: { code:"102", message:"credentials userId / userPwd are not valid"}});
                return false;    
                break;    
            case "measurementEnvironment":
                var measurementEnvironmentValues = ["countryside","city","ontheroad","inside","plane"];
                if (typeof(json[dataName]) != "string" || measurementEnvironmentValues.indexOf(json[dataName]) == -1)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " should be in [countryside | city | ontheroad | inside | plane]"}});
                    return false;
                }
                break;
            case "qualification":
                var qualificationValues = ["seemscorrect", "mustbeverified", "noenvironmentalcontext", "badsensor", "badprotocole", "baddatatransmission"];
                if (typeof(json[dataName]) != "string" || qualificationValues.indexOf(json[dataName]) == -1)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " should be in [seemscorrect | mustbeverified | noenvironmentalcontext | badsensor | badprotocole | baddatatransmission]"}});
                    return false;
                }
                break;
            case "qualificationVotesNumber":
                if (typeof(json[dataName]) != "number" || parseFloat(json[dataName]) != parseInt(json[dataName]) || parseInt(json[dataName]) < 1)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a positive integer"}});
                    return false;
                }
                break;
            case "response":
                if (typeof(json[dataName]) != "string" || json[dataName] != "complete")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " should be in [complete]"}});
                    return false;
                }
                break;
            case "withEnclosedObject":
                if (typeof(json[dataName]) != "string" || json[dataName] != "no")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " should be in [no]"}});
                    return false;
                }
                break;
            case "maxNumber":
                if (typeof(json[dataName]) != "string" || isNaN(json[dataName]) || parseFloat(json[dataName]) != parseInt(json[dataName]) || parseInt(json[dataName]) < 1)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a positive integer"}});
                    return false;                
                }
                break;
            case "atypical":
                if (typeof(json[dataName]) != "string" || (json[dataName] != "true" && json[dataName] != "false"))
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a boolean"}});
                    return false;
                }
                break; 
            default:
            {
                console.error("Internal error in verifyValue");
                res.status(500).end();
                return false;
            }
        }
    }
    return true;
}; 

//5. request API
if (properties.requestApiFeature) {
    app.get('/measurements/:reportUuid', function (req, res, next) {
       
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            var apiKey = { "role":""};
            if (verifyApiKey(res, req.query.apiKey, false, apiKey, false)
             && verifyData(res, req.query, false, "response")
             && verifyData(res, req.query, false, "withEnclosedObject"))
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {
                        var sql;
                        if (req.query.response == null)
                            sql = 'SELECT "value", "startTime", "latitude", "longitude", "reportUuid", "qualification", "atypical" FROM MEASUREMENTS WHERE "reportUuid"=$1';
                        else if (req.query.withEnclosedObject == null)
                            sql = 'SELECT "apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","startTime", \
                                  "endTime","latitude","longitude","accuracy","altitude","altitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel", \
                                  MEASUREMENTS."reportUuid","manualReporting","organisationReporting","description","measurementHeight","tag","enclosedObject", "userId", \
                                  "measurementEnvironment","dateAndTimeOfCreation","qualification","qualificationVotesNumber","reliability","atypical" \
                                  FROM MEASUREMENTS LEFT JOIN TAGS on MEASUREMENTS."reportUuid" = TAGS."reportUuid" WHERE MEASUREMENTS."reportUuid" = $1';
                        else
                            sql = 'SELECT "apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","startTime", \
                                  "endTime","latitude","longitude","accuracy","altitude","altitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel", \
                                  MEASUREMENTS."reportUuid","manualReporting","organisationReporting","description","measurementHeight","tag", "userId", \
                                  "measurementEnvironment","dateAndTimeOfCreation","qualification","qualificationVotesNumber","reliability","atypical" \
                                  FROM MEASUREMENTS LEFT JOIN TAGS on MEASUREMENTS."reportUuid" = TAGS."reportUuid" WHERE MEASUREMENTS."reportUuid" = $1';
                       
                        var values = [ req.params.reportUuid];
                        client.query(sql, values, function(err, result) {
                            done();
                            if (err)
                            {
                                console.console.error("Error while running query " + sql + values, err);
                                res.status(500).end();
                            }
                            else
                            {
                                if (result.rowCount == 0)
                                    res.status(400).json({ error: {code:"104", message:"reportUuid does not exists"}});
                                else
                                {
                                    var data = result.rows[0];

                                    if (req.query.response != null)
                                    {
                                        data.tags = [];
                                        for (i = 0; i < result.rows.length; i++)
                                        {
                                            if (result.rows[i].tag != null)
                                                data.tags.push(result.rows[i].tag)
                                        }
                                        if (data.tags.length == 0)
                                            delete data.tags;
                                    }
                                    
                                    delete data.tag;
                                    for (i in data)
                                    {
                                        if (data[i] == null)
                                            delete data[i];
                                    }
                                    
                                    res.json( { data:data} );
                                }
                            }
                        });
                    }
                });
            }
        }
    });

    //http://localhost:8080/measurements?apiKey=bde8ebc61cb089b8cc997dd7a0d0a434&minLatitude=3.4&maxStartTime=2015-04-19T11:49:59Z&minStartTime=2015-04-19T11:49:59.005Z&response=complete
    app.get('/measurements', function (req, res, next) {
       
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            var apiKey = { "role":""};
            if ( (req.query.dateOfCreation == null
             && verifyApiKey(res, req.query.apiKey, false, apiKey, false)
             && verifyData(res, req.query, false, "minValue")
             && verifyData(res, req.query, false, "maxValue")
             && verifyData(res, req.query, false, "minStartTime")
             && verifyData(res, req.query, false, "maxStartTime")
             && verifyData(res, req.query, false, "minLatitude")
             && verifyData(res, req.query, false, "maxLatitude")
             && verifyData(res, req.query, false, "minLongitude")
             && verifyData(res, req.query, false, "maxLongitude")
             && verifyData(res, req.query, false, "userId_request")
             && verifyData(res, req.query, false, "qualification")
             && verifyData(res, req.query, false, "tag")
             && verifyData(res, req.query, false, "atypical")    
             && verifyData(res, req.query, false, "response")
             && verifyData(res, req.query, false, "withEnclosedObject")
             && verifyData(res, req.query, false, "maxNumber")) 
           ||   (req.query.dateOfCreation != null
             && verifyApiKey(res, req.query.apiKey, true, apiKey, false)
             && verifyData(res, req.query, false, "dateOfCreation") 
             && verifyData(res, req.query, false, "minValue")
             && verifyData(res, req.query, false, "maxValue")
             && verifyData(res, req.query, false, "minStartTime")
             && verifyData(res, req.query, false, "maxStartTime")
             && verifyData(res, req.query, false, "minLatitude")
             && verifyData(res, req.query, false, "maxLatitude")
             && verifyData(res, req.query, false, "minLongitude")
             && verifyData(res, req.query, false, "maxLongitude")
             && verifyData(res, req.query, false, "userId_request")
             && verifyData(res, req.query, false, "qualification")
             && verifyData(res, req.query, false, "tag")
             && verifyData(res, req.query, false, "atypical")
             && verifyData(res, req.query, false, "response")
             && verifyData(res, req.query, false, "withEnclosedObject")
             && verifyData(res, req.query, false, "maxNumber") ) )
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {
                        var sql;
                        var limit = properties.maxNumber;
                        if (req.query.maxNumber != null && parseInt(req.query.maxNumber) < properties.maxNumber)
                            limit = parseInt(req.query.maxNumber);
                        
                        if (req.query.response == null)
                            sql = 'SELECT "value", "startTime", "latitude", "longitude", MEASUREMENTS."reportUuid", "qualification", "atypical"';
                        else if (req.query.withEnclosedObject == null)
                            sql = 'SELECT "apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","startTime", \
                                  "endTime","latitude","longitude","accuracy","altitude","altitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel", \
                                  MEASUREMENTS."reportUuid","manualReporting","organisationReporting","description","measurementHeight", "enclosedObject", "userId", \
                                  "measurementEnvironment","dateAndTimeOfCreation","qualification","qualificationVotesNumber","reliability","atypical"';
                        else
                            sql = 'SELECT "apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","startTime", \
                                  "endTime","latitude","longitude","accuracy","altitude","altitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel", \
                                  MEASUREMENTS."reportUuid","manualReporting","organisationReporting","description","measurementHeight","userId", \
                                  "measurementEnvironment","dateAndTimeOfCreation","qualification","qualificationVotesNumber","reliability","atypical"';
                                  
                        if (req.query.tag == null)
                            sql += ' FROM MEASUREMENTS';
                        else
                            sql += ' FROM MEASUREMENTS,TAGS WHERE MEASUREMENTS."reportUuid" = TAGS."reportUuid"'; //FROM MEASUREMENTS LEFT JOIN TAGS on MEASUREMENTS."reportUuid" = TAGS."reportUuid"';
                            
                        var where = '';
                        var values = [ ]; 
                        if (req.query.minLatitude != null)
                        {
                            values.push(req.query.minLatitude);
                            where += ' AND MEASUREMENTS."latitude" >= $' + values.length;
                        }
                        if (req.query.maxLatitude != null)
                        {
                            values.push(req.query.maxLatitude);
                            where += ' AND MEASUREMENTS."latitude" <= $' + values.length;
                        }
                        if (req.query.minLongitude != null)
                        {
                            values.push(req.query.minLongitude);
                            where += ' AND MEASUREMENTS."longitude" >= $' + values.length;
                        }
                        if (req.query.maxLongitude != null)
                        {
                            values.push(req.query.maxLongitude);
                            where += ' AND MEASUREMENTS."longitude" <= $' + values.length;
                        }
                        if (req.query.minStartTime != null)
                        {
                            values.push(req.query.minStartTime);
                            where += ' AND MEASUREMENTS."startTime" >= $' + values.length;
                        }
                        if (req.query.maxStartTime != null)
                        {
                            values.push(req.query.maxStartTime);
                            where += ' AND MEASUREMENTS."startTime" <= $' + values.length;
                        }
                        if (req.query.minValue != null)
                        {
                            values.push(req.query.minValue);
                            where += ' AND MEASUREMENTS."value" >= $' + values.length;
                        }
                        if (req.query.maxValue != null)
                        {
                            values.push(req.query.maxValue);
                            where += ' AND MEASUREMENTS."value" <= $' + values.length;
                        }
                        if (req.query.userId != null)
                        {
                            values.push(req.query.userId);
                            where += ' AND MEASUREMENTS."userId" = $' + values.length;
                        }
                        if (req.query.qualification != null)
                        {
                            values.push(req.query.qualification);
                            where += ' AND MEASUREMENTS."qualification" = $' + values.length;
                        }
                        if (req.query.tag != null)
                        {
                            values.push(req.query.tag.toLowerCase());
                            where += ' AND TAGS."tag" = $' + values.length;
                        }
                        if (req.query.atypical != null)
                        {
                            values.push(req.query.atypical);
                            where += ' AND MEASUREMENTS."atypical" = $' + values.length;
                        }
                        if (req.query.dateOfCreation != null)
                        {
                            var date = new Date(req.query.dateOfCreation);
                            var date1 = new Date(date.toDateString());
                            var date2 = new Date(date1);
                            date2.setDate(date1.getDate() + 1);
                            values.push(date1);
                            where += ' AND MEASUREMENTS."dateAndTimeOfCreation" >= $' + values.length;
                            values.push(date2);
                            where += ' AND MEASUREMENTS."dateAndTimeOfCreation" < $' + values.length;
                        }
                        
                        if (req.query.tag == null)
                            where = where.replace('AND', 'WHERE');
                        
                        sql += where;
                        sql += ' ORDER BY "startTime" desc, MEASUREMENTS."reportUuid"';
                        
                        if (req.query.dateOfCreation == null)
                            sql += ' LIMIT ' + limit;
                        else
                            limit = -1;
                            
                        client.query(sql, values, function(err, result) {
                            if (err)
                            {
                                done();
                                console.error("Error while running query " + sql + values, err);
                                res.status(500).end();
                            }
                            else
                            {
                                var data = [];
                                
                                //methode 1 : with where
                                if (req.query.response == null || result.rows.length == 0) // no need to retrieve tags
                                {
                                    done();
                                    for (r = 0; r < result.rows.length; r++)
                                    {
                                        data.push(result.rows[r]);
                                        
                                        for (i in data[data.length - 1])
                                        {
                                            if (data[data.length - 1][i] == null)
                                                delete data[data.length - 1][i];
                                        }
                                    }
                                    res.json( { maxNumber:limit, data:data} );
                                } else { // here we do an other request to retrieve tags
                                    var sql = 'select "reportUuid", "tag" FROM TAGS WHERE "reportUuid" IN (';
                                    for (r = 0; r < result.rows.length; r++)
                                    {
                                        if (r == 0)
                                            sql += "'" + result.rows[r].reportUuid + "'";
                                        else
                                            sql += ",'" + result.rows[r].reportUuid + "'";
                                    }
                                    sql += ') ORDER BY "reportUuid"';
                                    client.query(sql, [], function(err, result2) {
                                        done();
                                        if (err)
                                        {
                                            console.error("Error while running query " + sql, err);
                                            res.status(500).end();
                                        } else {
                                            //var t = 0;
                                            var tmp_tags = {};
                                            for (t = 0; t < result2.rows.length; t++)
                                            {
                                                if (tmp_tags[result2.rows[t].reportUuid] == null)
                                                    tmp_tags[result2.rows[t].reportUuid] = [];
                                                tmp_tags[result2.rows[t].reportUuid].push(result2.rows[t].tag);
                                            }
                                            
                                            for (r = 0; r < result.rows.length; r++)
                                            {
                                                data.push(result.rows[r]);
                                                if (tmp_tags[result.rows[r].reportUuid] != null)
                                                   data[data.length - 1].tags = tmp_tags[result.rows[r].reportUuid];
                                                    
                                                for (i in data[data.length - 1])
                                                {
                                                    if (data[data.length - 1][i] == null)
                                                        delete data[data.length - 1][i];
                                                }
                                            }
                                            res.json( { maxNumber:limit, data:data} );
                                        }
                                    });
                                }
                                /*
                                // method 2 : with left join
                                var lastReportUuid = "";
                                for (r = 0; r < result.rows.length; r++)
                                {
                                    if (result.rows[r].reportUuid != lastReportUuid)
                                    {
                                        data.push(result.rows[r]);
                                        if (result.rows[r].tag != null)
                                            data[data.length - 1].tags = [ result.rows[r].tag ];
                                        delete data[data.length - 1].tag;
                                        for (i in data[data.length - 1])
                                        {
                                            if (data[data.length - 1][i] == null)
                                                delete data[data.length - 1][i];
                                        }
                                    } else {
                                        data[data.length - 1].tags.push(result.rows[r].tag);
                                    }
                                    lastReportUuid = result.rows[r].reportUuid;
                                }
                                res.json( { maxNumber:limit, data:data} );*/
                                
                                
                                
                            }
                        });
                    }
                });
            }
        }
    });
}

//6. submit API
if (properties.submitApiFeature) {
    app.post('/measurements', function (req, res, next) {
        //console.log(new Date().toISOString() + " - POST /measurements : ");
        if (typeof(req.body.apiKey) != "string" || typeof(req.body.data) != "object")
        {
            res.status(400).json({ error: {code:"100", message:"You must send a JSON with a string apiKey and an object data"}});
        }
        else {
            var apiKey = { "role":""};

            if (verifyApiKey(res, req.body.apiKey, false, apiKey, true)
             && verifyData(res, req.body.data, false, "apparatusId")
             && verifyData(res, req.body.data, false, "apparatusVersion")
             && verifyData(res, req.body.data, false, "apparatusSensorType")
             && verifyData(res, req.body.data, false, "apparatusTubeType")
             && verifyData(res, req.body.data, false, "temperature")
             && verifyData(res, req.body.data, true, "value")
             && verifyData(res, req.body.data, false, "hitsNumber") 
             && verifyData(res, req.body.data, true, "startTime")
             && verifyData(res, req.body.data, false, "endTime")     
             && verifyData(res, req.body.data, true, "latitude") 
             && verifyData(res, req.body.data, true, "longitude")
             && verifyData(res, req.body.data, false, "accuracy")
             && verifyData(res, req.body.data, false, "altitude")
             && verifyData(res, req.body.data, false, "altitudeAccuracy")
             && verifyData(res, req.body.data, false, "deviceUuid")
             && verifyData(res, req.body.data, false, "devicePlatform")
             && verifyData(res, req.body.data, false, "deviceVersion")
             && verifyData(res, req.body.data, false, "deviceModel")
             && verifyData(res, req.body.data, true, "reportUuid")
             && verifyData(res, req.body.data, false, "manualReporting")
             && verifyData(res, req.body.data, false, "organisationReporting")
             && verifyData(res, req.body.data, false, "reportContext")
             && verifyData(res, req.body.data, false, "description")
             && verifyData(res, req.body.data, false, "measurementHeight")
             && verifyData(res, req.body.data, false, "tags")  
             && verifyData(res, req.body.data, false, "enclosedObject")
             && verifyData(res, req.body.data, false, "userId")
             && verifyData(res, req.body.data, false, "userPwd")
             && verifyData(res, req.body.data, false, "measurementEnvironment"))
            {
                if (apiKey.role != "test" && req.body.data.reportContext != null && req.body.data.reportContext == "routine")
                {
                    pg.connect(conStr, function(err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            var sql = 'INSERT INTO MEASUREMENTS ("apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","startTime","endTime", \
                                       "latitude","longitude","accuracy","altitude","altitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel","reportUuid","manualReporting", \
                                       "organisationReporting","reportContext","description","measurementHeight","enclosedObject","userId","measurementEnvironment","dateAndTimeOfCreation", \
                                       "qualification","qualificationVotesNumber","reliability","atypical") VALUES \
                                       ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)';
                            
                            var manualReporting = req.body.data.manualReporting == null ? true : req.body.data.manualReporting;
                            var reliability = 0;
                            //+1 for each filled field
                            if (req.body.data.apparatusId != null) 
                                reliability += 1;
                            if (req.body.data.apparatusVersion != null)
                                reliability +=1;
                            if (req.body.data.apparatusSensorType != null)
                                reliability +=1;
                            if (req.body.data.apparatusTubeType != null)
                                reliability +=1;
                            if (req.body.data.temperature != null)
                                reliability +=1;
                            if (req.body.data.value != null)
                                reliability +=1;
                            if (req.body.data.hitsNumber != null)
                                reliability +=1; 
                            if (req.body.data.startTime != null)
                                reliability +=1;
                            if (req.body.data.endTime != null)
                                reliability +=1;     
                            if (req.body.data.latitude != null)
                                reliability +=1; 
                            if (req.body.data.longitude != null)
                                reliability +=1;
                            if (req.body.data.accuracy != null)
                                reliability +=1;
                            if (req.body.data.altitude != null)
                                reliability +=1;
                            if (req.body.data.altitudeAccuracy != null)
                                reliability +=1;
                            if (req.body.data.deviceUuid != null)
                                reliability +=1;
                            if (req.body.data.devicePlatform != null)
                                reliability +=1;
                            if (req.body.data.deviceVersion != null)
                                reliability +=1;
                            if (req.body.data.deviceModel != null)
                                reliability +=1;
                            if (req.body.data.reportUuid != null)
                                reliability +=1;
                            if (req.body.data.manualReporting != null)
                                reliability +=1;
                            if (req.body.data.organisationReporting != null)
                                reliability +=1;
                            if (req.body.data.reportContext != null)
                                reliability +=1;
                            if (req.body.data.description != null)
                                reliability +=1;
                            if (req.body.data.measurementHeight != null)
                                reliability +=1;
                            if (req.body.data.tags != null)
                                reliability +=1;  
                            if (req.body.data.enclosedObject != null)
                                reliability +=1;
                            if (req.body.data.userId != null)
                                reliability +=1;
                            if (req.body.data.userPwd != null)
                                reliability +=1;
                            if (req.body.data.measurementEnvironment != null)
                                reliability +=1;
                            // + min(30,hitsNumber) if hitsNumber not null, 
                            if (req.body.data.hitsNumber != null)
                            {
                                if (req.body.data.hitsNumber > 30)
                                    reliability += 30;
                                else
                                    reliability += req.body.data.hitsNumber;
                            }
                            //+10 if userId not null
                            if (req.body.data.userId != null)
                                reliability += 10;
                            //+20 if manualReporting=false
                            if (manualReporting == false)
                                reliability += 20;
                            //+20 if measurementEnvironment=countryside / +10 if measurementEnvironment=city 
                            if (req.body.data.measurementEnvironment != null)
                            {
                                if (req.body.data.measurementEnvironment == "countryside")
                                    reliability += 20;
                                else if (req.body.data.measurementEnvironment == "city")
                                    reliability += 10;
                            }
                            //+20 if measurementHeight=1 
                            if (req.body.data.measurementHeight != null && req.body.data.measurementHeight == 1)
                                reliability += 20;

                            // Expecting > 100 (if not qualification is set to mustbeverified and qualificationVotesNumber is set to 0)
                            var qualification;
                            var qualificationVotesNumber;
                            if (req.body.data.measurementEnvironment != null && req.body.data.measurementEnvironment == "plane") {
                                qualification = "noenvironmentalcontext";
                                qualificationVotesNumber = 0;
                            } else if (reliability <= 100) {
                                qualification = "mustbeverified";
                                qualificationVotesNumber = 0;
                            } else {
                                delete qualification;
                                delete qualificationVotesNumber;
                            }
                                
                            var atypical = req.body.data.value < 0.2 ? false : true;
                            var dateAndTimeOfCreation = new Date();
                            var values = [ req.body.data.apparatusId, req.body.data.apparatusVersion, req.body.data.apparatusSensorType, req.body.data.apparatusTubeType, 
                                           req.body.data.temperature, req.body.data.value, req.body.data.hitsNumber, req.body.data.startTime, 
                                           req.body.data.endTime, req.body.data.latitude, req.body.data.longitude, req.body.data.accuracy,
                                           req.body.data.altitude, req.body.data.altitudeAccuracy, req.body.data.deviceUuid, req.body.data.devicePlatform,
                                           req.body.data.deviceVersion, req.body.data.deviceModel, req.body.data.reportUuid, manualReporting,
                                           req.body.data.organisationReporting, req.body.data.reportContext, req.body.data.description, req.body.data.measurementHeight,
                                           req.body.data.enclosedObject, req.body.data.userId, req.body.data.measurementEnvironment, dateAndTimeOfCreation,
                                           qualification, qualificationVotesNumber, reliability, atypical                                 
                                          ];
                                           
                            client.query(sql, values, function(err, result) {
                                if (err)
                                {
                                    done();
                                    if (err.code == "23505")
                                        res.status(400).json({ error: {code:"104", message:"duplicate key : reportUuid already exists"}});  
                                    else {
                                        console.error("Error while running query " + sql + values, err);
                                        res.status(500).end();
                                    }
                                }
                                else
                                {
                                    if (req.body.data.tags != null)
                                    {
                                        async.forEach(req.body.data.tags, function(tag, callback) { //The second argument (callback) is the "task callback" for a specific task
                                                var sql = 'INSERT INTO TAGS ("reportUuid", "tag") VALUES ($1, $2)';
                                                var values = [ req.body.data.reportUuid, tag.toLowerCase() ];
                                                client.query(sql, values, function(err, result) {
                                                    if (err) {
                                                        console.error("Error while running query " + sql + values, err);
                                                        callback(err);
                                                    } else
                                                        callback();
                                                });
                                        }, function(err) {
                                            done();
                                            if (err) 
                                                res.status(500).end();
                                            else
                                                res.status(201).end();
                                        });
                                    }
                                    else {
                                       done(); 
                                       res.status(201).end();
                                    }
                                }
                            });
                        }
                    });
                }
                else
                {
                    res.json({ "test":true});
                }
            }
        }
    });

    app.put('/users', function (req, res, next) {
      
        console.log(new Date().toISOString() + "PUT /users");
       
        if (typeof(req.body.apiKey) != "string" || typeof(req.body.data) != "object")
        {
            res.status(400).json({ error: {code:"100", message:"You must send a JSON with a string apiKey and an object data"}});
            console.log("1");
        }
        else {
            var apiKey = { "role":""};

            if (verifyApiKey(res, req.body.apiKey, true, apiKey, true))
            {
                if (! (req.body.data instanceof Array) || req.body.data.length > 1000000)
                {
                    console.log("2");
                    res.status(400).json({ error: {code:"101", message:"data should be an array"}}); 
                } else {
                    console.log("3");
                    //1. check validity
                    var isValid = true;
                    for (i = 0; i < req.body.data.length; i++) 
                    {
                        if (typeof(req.body.data[i].userId) != "string" || typeof(req.body.data[i].userPwd) != "string" 
                         || req.body.data[i].userId.length > 100 || req.body.data[i].userPwd.length > 100 || req.body.data[i].userId == "" || req.body.data[i].userPwd == "") 
                        {
                            res.status(400).json({ error: {code:"102", message:"Element " + i + " in data does not contains valid userId and valid userPwd"}}); 
                            isValid = false;
                            break;
                        }
                        for (j = 0; j < req.body.data.length; j++)
                        {
                            if (j<i && req.body.data[i].userId == req.body.data[j].userId)
                            {
                                res.status(400).json({ error: {code:"104", message:req.body.data[i].userId + " is present twice or more"}}); 
                                isValid = false;
                            }
                        }
                        if (isValid == false)
                            break;
                    }
                    
                    //2. insert users in APIUSERS table
                    if (isValid)
                    {
                        console.log("4");
                        pg.connect(conStr, function(err, client, done) {
                            if (err) {
                                done();
                                console.error("Could not connect to PostgreSQL", err);
                                res.status(500).end();
                            } else {
                                var sql = 'DELETE FROM APIUSERS';
                                client.query(sql, [], function(err, result) {
                                    if (err)
                                    {
                                        done();
                                        console.error("Error while running query " + sql, err);
                                        res.status(500).end();
                                    }
                                    else
                                    {
                                        async.forEach(req.body.data, function(user, callback) { //The second argument (callback) is the "task callback" for a specific task
                                                var sql = 'INSERT INTO APIUSERS ("userId", "userPwd") VALUES ($1, $2)';
                                                var values = [ user.userId, user.userPwd ];
                                                client.query(sql, values, function(err, result) {
                                                    if (err) {
                                                        console.error("Error while running query " + sql + values, err);
                                                        callback(err);
                                                    } else
                                                        callback();
                                                });
                                        }, function(err) {
                                            done();
                                            if (err) 
                                                res.status(500).end();
                                            else
                                                res.status(201).end();
                                        });
                                    }
                                });
                            }
                        });
                    }
                }
            }
        }
    });

    app.post('/measurements/:reportUuid', function (req, res, next) {
       
        if (typeof(req.body.apiKey) != "string" || typeof(req.body.data) != "object")
        {
            res.status(400).json({ error: {code:"100", message:"You must send a JSON with a string apiKey and an object data"}});
        }
        else {
            var apiKey = { "role":""};

            if (verifyApiKey(res, req.body.apiKey, true, apiKey, true)
             && verifyData(res, req.body.data, true, "qualification")
             && verifyData(res, req.body.data, true, "qualificationVotesNumber"))
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {
                        var sql = 'UPDATE MEASUREMENTS SET "qualification"=$1,"qualificationVotesNumber"=$2 WHERE "reportUuid"=$3';
                        var values = [ req.body.data.qualification, req.body.data.qualificationVotesNumber, req.params.reportUuid];
                        client.query(sql, values, function(err, result) {
                            done();
                            if (err)
                            {
                                console.error("Error while running query " + sql, err);
                                res.status(500).end();
                            }
                            else
                            {
                                if (result.rowCount == 0)
                                    res.status(400).json({ error: {code:"104", message:"reportUuid does not exists"}});
                                else
                                    res.status(201).end();
                            }
                        });
                    }
                });
            }
        }
    });
}

//7. submit Form
if (properties.submitFormFeature) {
    app.get('/test', function (req, res, next) {
        res.render('test.ejs');
    });
    
    //sample : https://localhost:8080/test/6/46.6094640/2.4718880/0.45/2015-10-05T13:49:59Z
    //sample : https://localhost:8080/testme?zoom=6&latitude=46.6094640&longitude=2.3718880&value=0.45&startTime=2015-10-05T13:49:59Z
    //app.get('/test/:zoom/:latitude/:longitude/:value/:startTime', function (req, res, next) { 
    app.get('/testme', function (req, res, next) { 
        if ((req.query.zoom != null && isNaN(req.query.zoom) == false && parseFloat(req.query.zoom) == parseInt(req.query.zoom) && parseInt(req.query.zoom) >=0 && parseInt(req.query.zoom) <= 18)
         && (req.query.latitude != null && isNaN(req.query.latitude) == false)
         && (req.query.longitude != null && isNaN(req.query.longitude) == false)
         && (req.query.value != null && isNaN(req.query.value) == false)
         && (req.query.startTime != null && new Date(req.query.startTime) != "Invalid Date"))
        {  
            var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
                return v.toString(16);
            });
            
            var json = {
                "apiKey": openradiationApiKey,
                "data": {
                    "reportUuid": uuid,
                    "latitude": parseFloat(req.query.latitude),
                    "longitude": parseFloat(req.query.longitude),
                    "value": parseFloat(req.query.value),
                    "startTime": req.query.startTime,
                    "organisationReporting" : "openradiation.net v1",	
                    "reportContext" : "routine"
                }
            }
            
            var options = {
                host: properties.submitAPIHost,
                port: properties.submitAPIPort,
                path: '/measurements',
                method: 'POST',
                rejectUnauthorized: false, //accept autosigned certificate
                headers: {
                  'Content-Type': 'application/json',
                  'Content-Length': JSON.stringify(json).length
                }
            };
            
            var post_req = https.request(options, function(post_res) {
                var result = '';
                post_res.setEncoding('utf8');
                post_res.on('data', function (chunk) {
                    result += chunk;                
                });
                post_res.on('end', function () {
                    if (post_res.statusCode == 201)
                    {
                        res.render('openradiation.ejs', { apiKey: openradiationApiKey, measurementURL: properties.measurementURL, withLocate:false, fitBounds:false, zoom: req.query.zoom, latitude: req.query.latitude, longitude: req.query.longitude, 
                                 tag:"", userId: "", qualification: "all", atypical: "all",
                                 rangeValueMin:0, rangeValueMax:100, rangeDateMin:0, rangeDateMax:100 } );                    
                        
                    } else {
                        console.error("Error after posting measurement : (" + post_res.statusCode  + ") " + result);
                        res.status(500).end();
                    }    
                });
            }).on('error', function(e) {
                console.error("Error while trying to post measurement : " + e.message);
                res.status(500).end();
            });
             
            // post the data
            post_req.write(JSON.stringify(json),encoding='utf8');
            post_req.end();       
        } else {
            res.status(404).end();
        }
    });

    app.get('/upload', function (req, res, next) {
        res.render('uploadfile.ejs', { userId:"", userPwd:"", measurementHeight:"", measurementEnvironment:"", description:"", tags: JSON.stringify([]), result: "" });
    });
    
    app.post('/upload', upload.single('file'), function(req, res, next) {
        console.log(new Date().toISOString() + "POST /upload");
        
        var message = "";
        var tags = [];      
        var submittedTags = true;
        var nbTags = 0;
        while (submittedTags)
        {
            nbTags +=1;
            if (nbTags > 9 || req.body["tag" + nbTags] == null || typeof(req.body["tag" + nbTags]) != "string")
                submittedTags = false;    
            else if (req.body["tag" + nbTags] != "")
                tags.push(req.body["tag" + nbTags]);
        }
      
        if (req.body.userId == null || typeof(req.body.userId) != "string" || req.body.userId == "" || req.body.userId.length > 100)
            res.render('uploadfile.ejs', { userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, description:req.body.description, tags: JSON.stringify(tags), result: "Username is mandatory" }); 
        else if (req.body.userPwd == null || typeof(req.body.userPwd) != "string" || req.body.userPwd == "" || req.body.userPwd.length > 100)
            res.render('uploadfile.ejs', { userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, description:req.body.description, tags: JSON.stringify(tags), result: "Password is mandatory" }); 
        else {
            var measurementEnvironmentValues = ["countryside","city","ontheroad","inside","plane"];
            if (req.body.measurementHeight == null || typeof(req.body.measurementHeight) != "string" || req.body.measurementHeight == "" || parseFloat(req.body.measurementHeight) != parseInt(req.body.measurementHeight))
                res.render('uploadfile.ejs', { userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, description:req.body.description, tags: JSON.stringify(tags), result: "Measurement height should be an integer" }); 
            else if (req.body.measurementEnvironment == null || typeof(req.body.measurementEnvironment) != "string" || measurementEnvironmentValues.indexOf(req.body.measurementEnvironment) == -1)
                res.render('uploadfile.ejs', { userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, description:req.body.description, tags: JSON.stringify(tags), result: "Measurement environment should be in [countryside | city | ontheroad | inside | plane]" }); 
            else if (req.body.description == null || typeof(req.body.description) != "string" || req.body.description.length > 1000)
                res.render('uploadfile.ejs', { userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, description:req.body.description, tags: JSON.stringify(tags), result: "Description is not valid" }); 
            else if (req.file == null)
                res.render('uploadfile.ejs', { userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, description:req.body.description, tags: JSON.stringify(tags), result: "You have to choose a file" }); 
            else {
                file = req.file.buffer.toString("utf-8");
                var sha256 = SHA256(file).toString();
                console.log(req.file);
                lines = file.split(new RegExp('\r\n|\r|\n'));
                
                if (lines.length > 20000)
                    res.render('uploadfile.ejs', { userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, description:req.body.description, tags: JSON.stringify(tags), result: "Your file contains too many lines (more than 20000 lines)" }); 
                else {
                    var measurementsLinesValid = 0;
                    var measurementsLinesOk = 0;
                    
                    var errorMessage = "";
                    var stopIt = false;

                    //to avoid a maximum call stack size exceeded we cut the file in 1000 lines chunks
                    var loops = [];
                    for (var i = 0; i <= Math.floor(lines.length / 1000); i++)
                    {
                        loops.push(i);
                    }
                    
                    async.forEachSeries(loops, function(index, callbackLoop) {
                        var sublines = [];
                        if ( (index*1000+1000) > lines.length)
                            subLines = lines.slice(index * 1000, lines.length);
                        else
                            subLines = lines.slice(index * 1000, index*1000 + 1000);
                        
                        // treatment of the chunk
                        if (stopIt == false) {
                            async.forEachSeries(subLines, function(line, callback) { //see https://github.com/Safecast/bGeigieMini for the format of the file
                                
                                if (line.match(/^#/) || stopIt) {
                                    callback(); //log line are not treated
                                } else {
                                    var values = line.split(",");
                                    
                                    if ( values.length == 15 && values[6] == "A" && values[12] == "A" && isNaN(values[3]) == false && (parseFloat(values[3]) == parseInt(values[3]))
                                     && (new Date(values[2]) != "Invalid Date") && isNaN(values[7]) == false && isNaN(values[9]) == false
                                     && (values[8] == "N" || values[8] == "S") && (values[10] == "E" || values[10] == "W") 
                                     && isNaN(values[11]) == false && isNaN(values[13]) == false) {  // if line is valid i.e. well formatted, Radiation count validity flag = A and GPS validity = A
                                        measurementsLinesValid += 1;
                                        
                                        var data = {};
                                        data.apparatusId = "safecast_id " + values[1];
                                        data.apparatusVersion = values[0];
                                        data.apparatusSensorType = "geiger";
                                        data.value = Math.round(parseFloat(values[3]) / 330 * 100) / 100;
                                        data.hitsNumber = parseInt(values[3]);
                                        data.endTime = new Date(values[2]);
                                        data.startTime = new Date(data.endTime.getTime() - 60000);
                                        var mm = values[7].match(/\d\d\.\d*/);
                                        var hh = /(\d*)\d\d\./.exec(values[7]);
                                        if (hh != null && hh.length > 1 && mm != null)
                                        {
                                            data.latitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                            if (values[8] == "S")
                                                data.latitude = data.latitude * -1;
                                        }
                                        mm = values[9].match(/\d\d\.\d*/);
                                        hh = /(\d*)\d\d\./.exec(values[9]);
                                        if (hh != null && hh.length > 1 && mm != null)
                                        {
                                            data.longitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                            if (values[10] == "W")
                                                data.longitude = data.longitude * -1;
                                        } 
                                        data.accuracy = parseFloat(values[13]);
                                        data.altitude = parseInt(values[11]);
                                        var epoch = data.startTime.getTime() / 1000;
                                        if (epoch.toString().length > 10)
                                            epoch = epoch.toString().substr(0,10);
                                        else if (epoch.toString().length < 10)
                                            epoch = "0000000000".substring(0,10-epoch.toString().length) + epoch.toString();
                                        data.reportUuid = "ff" + sha256.substr(0,6) + "-" + sha256.substr(6,4) + "-4" + sha256.substr(10,3) + "-a" + sha256.substr(13,3) + "-" + sha256.substr(16,2) + epoch.toString(); // Uuid is ffxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx with 18 characters from sha-256 file and epoch startTime
                                        data.manualReporting = false;
                                        data.organisationReporting = "openradiation.net/upload " + properties.version;
                                        data.reportContext = "routine";
                                        data.description = req.body.description;
                                        data.measurementHeight = parseInt(req.body.measurementHeight);
                                        data.tags = tags.slice();
                                        data.tags.push("file_" + sha256.substr(0,18));
                                        data.userId = req.body.userId;
                                        data.userPwd = req.body.userPwd;
                                        data.measurementEnvironment = req.body.measurementEnvironment;
                                        
                                        var json = {
                                            "apiKey": openradiationApiKey,
                                            "data": data
                                        }
                                            
                                        var options = {
                                            host: properties.submitAPIHost,
                                            port: properties.submitAPIPort,
                                            path: '/measurements',
                                            method: 'POST',
                                            rejectUnauthorized: false, //accept autosigned certificate
                                            headers: {
                                              'Content-Type': 'application/json',
                                              'Content-Length': JSON.stringify(json).length
                                            }
                                        };
                                            
                                        var post_req = https.request(options, function(post_res) {
                                            var result = '';
                                            post_res.setEncoding('utf8');
                                            post_res.on('data', function (chunk) {
                                                result += chunk;                                         
                                            });
                                            post_res.on('end', function () { 
                                                if (post_res.statusCode == 201)
                                                {
                                                    measurementsLinesOk += 1;
                                                    callback();
                                                } else {
                                                    if (measurementsLinesValid == 1) {
                                                        stopIt = true;
                                                        errorMessage = JSON.parse(result).error.message;
                                                    } else {  
                                                        errorMessage = line + "<br>" + JSON.parse(result).error.message;
                                                    }
                                                    callback();
                                                }    
                                            });
                                        }).on('error', function(e) {
                                            console.error("Error while trying to post measurement : " + e.message);
                                            res.status(500).end();
                                        });
                                             
                                        // post the data
                                        post_req.write(JSON.stringify(json),encoding='utf8');
                                        post_req.end(); 

                                    } else {
                                        callback(); //invalid lines are not treated
                                    }
                                }
                            }, function(err) {

                                console.log(req.file.originalname + " processed at " + index * 1000);  //everything is done now 
                                if (err) {
                                    console.log("error : " + err);
                                    stopIt = true;
                                    res.render('uploadfile.ejs', { userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, description:req.body.description, tags: JSON.stringify(tags), result: err });
                                    
                                } else {
                                    if (measurementsLinesOk == 0) {
                                        stopIt = true;
                                        res.render('uploadfile.ejs', { userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, description:req.body.description, tags: JSON.stringify(tags), result: errorMessage });
                                    } 
                                }
                                callbackLoop();
                            });
                        } else {
                            callbackLoop();
                        }
                    }, function(err) {
                        console.log(req.file.originalname + " processed");  //everything is done now 
                        if (stopIt == false) {
                            if (measurementsLinesValid != measurementsLinesOk) {
                                message = "The file " + req.file.originalname + " has been processed : " + measurementsLinesOk + " measurement(s) are stored in the openradiation database.<br>";
                                message += "<br>" + (measurementsLinesValid - measurementsLinesOk) + " line(s) of the file have been refused, like this one : <br><i>" + errorMessage + "</i><br><br>";
                                message += "The measurements have been tagged <i>#file_" + sha256.substr(0,18) + "</i><br><br><br>";             
                                message += "<iframe frameborder=\"0\" style=\"height:90%;width:90%;left:auto;right:auto;min-height:400px;\" height=\"90%\" width=\"90%\" src=\"" + properties.mappingURL + "/openradiation/file_" + sha256.substr(0,18) + "/all/all/all/0/100/0/100\"></iframe>";
                                res.render('uploadfile.ejs', { userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, description:req.body.description, tags: JSON.stringify(tags), result: message });
                            } else {
                                message = "Your file " + req.file.originalname + " has been processed : " + measurementsLinesOk + " measurements are stored in the openradiation database.<br>";
                                message += "All the measurements have been tagged <i>#file_" + sha256.substr(0,18) + "</i><br><br><br>";
                                message += "<iframe frameborder=\"0\" style=\"height:90%;width:90%;left:auto;right:auto;min-height:400px;\" height=\"90%\" width=\"90%\" src=\"" + properties.mappingURL + "/openradiation/file_" + sha256.substr(0,18) + "/all/all/all/0/100/0/100\"></iframe>";
                                res.render('uploadfile.ejs', { userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, description:req.body.description, tags: JSON.stringify(tags), result: message });
                            }
                        }
                    });   
                }
            }
        }
    });
}

//8. mapping
if (properties.mappingFeature) {
    var asinh = function(x) {
        return Math.log(x + Math.sqrt(1 + x*x));
    }
            
    app.get('/i/:z/:x/:y.png', function (req, res, next) { 

        if (isNaN(req.params.z) || isNaN(req.params.x) || isNaN(req.params.y) 
            || parseInt(req.params.z) < 0 || parseInt(req.params.z) > 16
            || parseInt(req.params.x) < 0 || parseInt(req.params.x) >= Math.pow(2, 2 * parseInt(req.params.z))
            || parseInt(req.params.y) < 0 || parseInt(req.params.y) >= Math.pow(2, 2 * parseInt(req.params.z)))
        {
            res.status(500).end();
        }
        else 
        {   
            var x = parseInt(req.params.x);
            var y = parseInt(req.params.y);
            var z = parseInt(req.params.z);
        
            var btilex = x.toString(2);
            var btiley = y.toString(2);
            var quadkey = "";
            var cx, cy; 
            
            for (q = 0; q < z; q++) //from right to left
            {
                if (btilex.length > q)
                    cx = parseInt( btilex.substr(btilex.length-q-1,1) );
                else
                    cx = 0;
                    
                if (btiley.length > q)
                    cy = parseInt( btiley.substr(btiley.length-q-1,1) );
                else
                    cy = 0;
                quadkey = (cx + 2 * cy) + quadkey;
            }
        
            //console.log("x, y, z, quadkey = " + x + ";" + y + ";" + z + ";" + quadkey);
            
            var sql = 'SELECT "tile", "opacity" FROM TILES WHERE "quadKey"=$1';
            var values = [ quadkey ];
            
            pg.connect(conStr, function(err, client, done) {
                if (err) {
                    done();
                    console.error("Could not connect to PostgreSQL", err);
                    res.status(500).end();
                } else {
                    client.query(sql, values, function(err, result) {
                        done();
                        if (err)
                        {
                            console.error("Error while running query " + sql + values, err);
                            res.status(500).end();
                        }
                        else
                        {
                            if (result.rowCount == 0)
                                res.status(200).end();
                            else
                            {
                                var png = new PNG({
                                    width: 256,
                                    height: 256,
                                    filterType: -1
                                });
                                 
                                var tile = result.rows[0].tile;
                                var opacity = result.rows[0].opacity;

                                var value;
                                var opac;

                                idx_value = 0;
                                idx_opacity = 0;                          
                                // for each value stored from left to right, then top to bottom
                                for (var pix_x = 0; pix_x < 256; pix_x++) {
                                    for (var pix_y = 0; pix_y < 256; pix_y++) { 
                                        value = parseInt(tile.substr(idx_value,16), 2);
                                        opac = parseInt(opacity.substr(idx_opacity,7),2);
                                        
                                        if (opac > 100)
                                            opac=100;
                                        //idx in png is stored from top to bottom, then left to right
                                        var idx = (pix_x + pix_y * 256) << 2;
          
                                        png.data[idx+3] = Math.floor(255 * (opac / 100.0));
                                
                                        if (value == 65535) { //in fact it is a null value
                                            png.data[idx] = 255;    //R
                                            png.data[idx+1] = 255; //G
                                            png.data[idx+2] = 255; //B
                                            png.data[idx+3] = 0; //opacity
                                        } else if (value < 0.395612425) {
                                            png.data[idx] = 39; //R
                                            png.data[idx+1] = 190; //G
                                            png.data[idx+2] = 240; //B
                                        } else if (value < 1.718281828) {
                                            png.data[idx] = 36; //R
                                            png.data[idx+1] = 180; //G
                                            png.data[idx+2] = 241; //B
                                        } else if (value < 4.29449005) {
                                            png.data[idx] = 29; //R
                                            png.data[idx+1] = 148; //G
                                            png.data[idx+2] = 244; //B
                                        } else if (value < 9.312258501) {
                                            png.data[idx] = 21; //R
                                            png.data[idx+1] = 113; //G
                                            png.data[idx+2] = 246; //B
                                        } else if (value < 19.08553692) {
                                            png.data[idx] = 15; //R
                                            png.data[idx+1] = 80; //G
                                            png.data[idx+2] = 251; //B
                                        } else if (value < 38.121284) {
                                            png.data[idx] = 12; //R
                                            png.data[idx+1] = 51; //G
                                            png.data[idx+2] = 251; //B
                                        } else if (value < 75.19785657) {
                                            png.data[idx] = 13; //R
                                            png.data[idx+1] = 42; //G
                                            png.data[idx+2] = 250; //B
                                        } else if (value < 147.4131591) {
                                            png.data[idx] = 40; //R
                                            png.data[idx+1] = 41; //G
                                            png.data[idx+2] = 242; //B
                                        } else if (value < 288.0693621) {
                                            png.data[idx] = 88; //R
                                            png.data[idx+1] = 44; //G
                                            png.data[idx+2] = 229; //B
                                        } else if (value < 562.0302368) {
                                            png.data[idx] = 128; //R
                                            png.data[idx+1] = 48; //G
                                            png.data[idx+2] = 201; //B
                                        } else if (value < 1095.633158) {
                                            png.data[idx] = 143; //R
                                            png.data[idx+1] = 46; //G
                                            png.data[idx+2] = 175; //B
                                        } else if (value < 2134.949733) {
                                            png.data[idx] = 159; //R
                                            png.data[idx+1] = 43; //G
                                            png.data[idx+2] = 135; //B
                                        } else if (value < 4159.262005) {
                                            png.data[idx] = 172; //R
                                            png.data[idx+1] = 41; //G
                                            png.data[idx+2] = 99; //B
                                        } else if (value < 8102.083928) {
                                            png.data[idx] = 183; //R
                                            png.data[idx+1] = 37; //G
                                            png.data[idx+2] = 66; //B
                                        } else if (value < 15781.6524) {
                                            png.data[idx] = 193; //R
                                            png.data[idx+1] = 36; //G
                                            png.data[idx+2] = 35; //B
                                        } else {
                                            png.data[idx] = 189; //R
                                            png.data[idx+1] = 46; //G
                                            png.data[idx+2] = 38; //B
                                        }
                                        
                                        idx_value = idx_value + 16;
                                        idx_opacity = idx_opacity + 7;
                                    }                           
                                }
                            
                                var pngFileName = __dirname + '/public/png/{z}_{x}_{y}.png'.replace('{z}_{x}_{y}',z + "_" + x + "_" + y);
                                png.pack().pipe(fs.createWriteStream(pngFileName)).on('finish', function() {
                                    var img = fs.readFileSync(pngFileName);
                                    res.writeHead(200, {'Content-Type': 'image/png' });
                                    res.end(img, 'binary');
                                    if (z > 6)
                                        fs.unlinkSync(pngFileName);
                                });
                            }   
                        }
                    });
                }   
            });
        }        
                
        /*fs.createReadStream('in.png')
            .pipe(new PNG({
                filterType: 4
            }))
            .on('parsed', function() {*/
    });


    app.get('/openradiation', function (req, res, next) {
        res.render('openradiation.ejs', { apiKey: openradiationApiKey, measurementURL: properties.measurementURL, withLocate:true, fitBounds:false, zoom: 6, latitude:46.609464, longitude:2.471888, tag:"", userId:"",  qualification:"all",  atypical:"all", rangeValueMin:0, rangeValueMax:100, rangeDateMin:0, rangeDateMax:100});
    });
    
    app.get('/openradiation/:zoom/:latitude/:longitude', function (req, res, next) { 

        if ((isNaN(req.params.zoom) == false && parseFloat(req.params.zoom) == parseInt(req.params.zoom) && parseInt(req.params.zoom) >=0 && parseInt(req.params.zoom) <= 18)
         && (isNaN(req.params.latitude) == false)
         && (isNaN(req.params.longitude) == false))
        {  
            res.render('openradiation.ejs', { apiKey: openradiationApiKey, measurementURL: properties.measurementURL, withLocate:false, fitBounds:false, zoom: req.params.zoom, latitude: req.params.latitude, longitude: req.params.longitude, 
                                          tag:"", userId: "", qualification: "all", atypical: "all",
                                          rangeValueMin:0, rangeValueMax:100, rangeDateMin:0, rangeDateMax:100 } );
        } else {
            res.status(404).end();
        }
    });   
       
    app.get('/openradiation/:tag/:userId/:qualification/:atypical/:rangeValueMin/:rangeValueMax/:rangeDateMin/:rangeDateMax', function (req, res, next) { 

        if ( (req.params.qualification == "all" || req.params.qualification == "seemscorrect" || req.params.qualification == "mustbeverified" || req.params.qualification == "noenvironmentalcontext" || req.params.qualification == "badsensor" || req.params.qualification == "badprotocole" || req.params.qualification == "baddatatransmission")
          && (req.params.atypical == "all" || req.params.atypical == "true" || req.params.atypical == "false")
          && (isNaN(req.params.rangeValueMin) == false && parseFloat(req.params.rangeValueMin) == parseInt(req.params.rangeValueMin) && parseInt(req.params.rangeValueMin) >=0 && parseInt(req.params.rangeValueMin) <= 100)
          && (isNaN(req.params.rangeValueMax) == false && parseFloat(req.params.rangeValueMax) == parseInt(req.params.rangeValueMax) && parseInt(req.params.rangeValueMax) >=0 && parseInt(req.params.rangeValueMax) <= 100 && parseInt(req.params.rangeValueMin) <= parseInt(req.params.rangeValueMax))
          && (isNaN(req.params.rangeDateMin) == false && parseFloat(req.params.rangeDateMin) == parseInt(req.params.rangeDateMin) && parseInt(req.params.rangeDateMin) >=0 && parseInt(req.params.rangeDateMin) <= 100)
          && (isNaN(req.params.rangeDateMax) == false && parseFloat(req.params.rangeDateMax) == parseInt(req.params.rangeDateMax) && parseInt(req.params.rangeDateMax) >=0 && parseInt(req.params.rangeDateMax) <= 100 && parseInt(req.params.rangeDateMin) <= parseInt(req.params.rangeDateMax)))
        {  
            var tag;
            if (req.params.tag == "all")
                tag = "";
            else
                tag = req.params.tag;
            var userId;
            if (req.params.userId == "all")
                userId = "";
            else
                userId = req.params.userId;
            
            res.render('openradiation.ejs', { apiKey: openradiationApiKey, measurementURL: properties.measurementURL, withLocate:false, fitBounds:true, zoom: 1, latitude:46.609464, longitude:2.471888, 
                                          tag:tag, userId: userId, qualification: req.params.qualification, atypical: req.params.atypical,
                                          rangeValueMin:req.params.rangeValueMin, rangeValueMax:req.params.rangeValueMax, rangeDateMin:req.params.rangeDateMin, rangeDateMax:req.params.rangeDateMax } );
        } else
            res.status(404).end();
    });
    
    app.get('/openradiation/:zoom/:latitude/:longitude/:tag/:userId/:qualification/:atypical/:rangeValueMin/:rangeValueMax/:rangeDateMin/:rangeDateMax', function (req, res, next) { 

        if ((isNaN(req.params.zoom) == false && parseFloat(req.params.zoom) == parseInt(req.params.zoom) && parseInt(req.params.zoom) >=0 && parseInt(req.params.zoom) <= 18)
          && (isNaN(req.params.latitude) == false)
          && (isNaN(req.params.longitude) == false)
          && (req.params.qualification == "all" || req.params.qualification == "seemscorrect" || req.params.qualification == "mustbeverified" || req.params.qualification == "noenvironmentalcontext" || req.params.qualification == "badsensor" || req.params.qualification == "badprotocole" || req.params.qualification == "baddatatransmission")
          && (req.params.atypical == "all" || req.params.atypical == "true" || req.params.atypical == "false")
          && (isNaN(req.params.rangeValueMin) == false && parseFloat(req.params.rangeValueMin) == parseInt(req.params.rangeValueMin) && parseInt(req.params.rangeValueMin) >=0 && parseInt(req.params.rangeValueMin) <= 100)
          && (isNaN(req.params.rangeValueMax) == false && parseFloat(req.params.rangeValueMax) == parseInt(req.params.rangeValueMax) && parseInt(req.params.rangeValueMax) >=0 && parseInt(req.params.rangeValueMax) <= 100 && parseInt(req.params.rangeValueMin) <= parseInt(req.params.rangeValueMax))
          && (isNaN(req.params.rangeDateMin) == false && parseFloat(req.params.rangeDateMin) == parseInt(req.params.rangeDateMin) && parseInt(req.params.rangeDateMin) >=0 && parseInt(req.params.rangeDateMin) <= 100)
          && (isNaN(req.params.rangeDateMax) == false && parseFloat(req.params.rangeDateMax) == parseInt(req.params.rangeDateMax) && parseInt(req.params.rangeDateMax) >=0 && parseInt(req.params.rangeDateMax) <= 100 && parseInt(req.params.rangeDateMin) <= parseInt(req.params.rangeDateMax)))
        {  
            var tag;
            if (req.params.tag == "all")
                tag = "";
            else
                tag = req.params.tag;
            var userId;
            if (req.params.userId == "all")
                userId = "";
            else
                userId = req.params.userId;
            
            res.render('openradiation.ejs', { apiKey: openradiationApiKey, measurementURL: properties.measurementURL, withLocate:false, fitBounds:false, zoom: req.params.zoom, latitude: req.params.latitude, longitude: req.params.longitude, 
                                          tag:tag, userId: userId, qualification: req.params.qualification, atypical: req.params.atypical,
                                          rangeValueMin:req.params.rangeValueMin, rangeValueMax:req.params.rangeValueMax, rangeDateMin:req.params.rangeDateMin, rangeDateMax:req.params.rangeDateMax } );
        } else
            res.status(404).end();
    });     
}

//9. launch server
app.use(function(err, req, res, next){
    if (err)
    {
        console.log(err);
        if (err.status == null)
            res.status(500).end();
        else
            res.status(err.status).end();
    }
    else
        res.status(404).end();
});

var privateKey  = fs.readFileSync(__dirname + '/' + properties.certKeyFile, 'utf8');
var certificate = fs.readFileSync(__dirname + '/' + properties.certCrtFile, 'utf8');
var credentials = {key: privateKey, cert: certificate};
var httpsServer = https.createServer(credentials, app);

httpsServer.timeout = 600000; // ten minutes before timeout (used when we post files, default is 120000)

httpsServer.listen(properties.port, function() {
    
    console.log(new Date().toISOString() + " - *** OpenRadiation API started with parameters : ");
    console.log(new Date().toISOString() + " -    port                 : [" + properties.port + "]");
    console.log(new Date().toISOString() + " -    login                : [" + properties.login + "]");
    console.log(new Date().toISOString() + " -    password             : [************]");
    console.log(new Date().toISOString() + " -    host                 : [" + properties.host + "]");
    console.log(new Date().toISOString() + " -    maxNumber            : [" + properties.maxNumber + "]");
    console.log(new Date().toISOString() + " -    getAPIInterval       : [" + properties.getAPIInterval + "]");
    console.log(new Date().toISOString() + " -    getUsersInterval     : [" + properties.getUsersInterval + "]");
    console.log(new Date().toISOString() + " -    APIKeyTestInterval   : [" + properties.APIKeyTestInterval + "]");
    console.log(new Date().toISOString() + " -    APIKeyTestMaxCounter : [" + properties.APIKeyTestMaxCounter + "]"); 
    console.log(new Date().toISOString() + " -    measurementURL       : [" + properties.measurementURL + "]"); 
    if (properties.nodeUserUid != null && properties.nodeUserGid != null && process.getuid && process.setuid && process.getgid && process.setgid) {
        process.setgid(properties.nodeUserGid);
        process.setuid(properties.nodeUserUid);
        console.log(new Date().toISOString() + " -    nodeUserUid          : [" + properties.nodeUserUid + "]");
        console.log(new Date().toISOString() + " -    nodeUserGid          : [" + properties.nodeUserGid + "]"); 
    }
    console.log(new Date().toISOString() + " -    certKeyFile          : [" + properties.certKeyFile + "]"); 
    console.log(new Date().toISOString() + " -    certCrtFile          : [" + properties.certCrtFile + "]");
    console.log(new Date().toISOString() + " -    submitApiFeature     : [" + properties.submitApiFeature + "]"); 
    console.log(new Date().toISOString() + " -    requestApiFeature    : [" + properties.requestApiFeature + "]"); 
    console.log(new Date().toISOString() + " -    mappingFeature       : [" + properties.mappingFeature + "]"); 
    console.log(new Date().toISOString() + " -    submitFormFeature    : [" + properties.submitFormFeature + "]");
    console.log(new Date().toISOString() + " -    mappingURL           : [" + properties.mappingURL + "]");
    console.log(new Date().toISOString() + " -    submitAPIHost        : [" + properties.submitAPIHost + "]");
    console.log(new Date().toISOString() + " -    submitAPIPort        : [" + properties.submitAPIPort + "]");
    console.log(new Date().toISOString() + " -    version              : [" + properties.version + "]");
    console.log(new Date().toISOString() + " - ****** ");
});


