/* 
 * OPENRADIATION submit API
 */

 //1. generic
var pg = require('pg');
var express = require('express');
var bodyParser = require('body-parser');
var multer = require('multer');  
var properties = require('./properties.js');
var async = require('async');

var conStr = "postgres://" + properties.login + ":" + properties.password + "@" + properties.host + "/openradiation";
var app = express();
app.use(bodyParser.json({strict: true, limit: '2mb'})); // enclosedObject shouldn't exceeded 1mb, but total space is higher with the base64 encoding
app.use(bodyParser.urlencoded({ extended: true })); 
app.use(multer({ dest: __dirname + '/uploads/'})); //multipart/form-data

app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');

app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
 
    next();
});

//2. render test page
app.get('/test', function (req, res, next) {
    res.render('test.ejs');
});

app.get('/openradiation', function (req, res, next) {
    res.render('openradiation.ejs', { measurementURL: properties.measurementURL });
});

//3. load apiKeys every ten minutes
var apiKeys = [];

var apiKeyTestCounter = 0;
var apiKeyTestDate;

getAPI = function() {
    pg.connect(conStr, function(err, client, done) {
        if (err) {
            done();
            console.error("Could not connect to PostgreSQL", err);
        } else {
            var sql = 'SELECT "apiKey","role" from apiKeyS';
            client.query(sql, [], function(err, result) {
                done();
                if (err)
                    console.error("Error while running query " + sql, err);
                else {
                    apiKeys = result.rows;
                }
            });
        }
    });
};

getAPI();
setInterval(getAPI, properties.getAPIInterval); //every ten minutes

//4. load userId, userPwd every ten minutes
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
    
//5. common functions
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

verifyData = function(res, json, isMandatory, dataName) {
       
    if (json[dataName] != null && json[dataName] == "")
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
                break;
            case "enclosedObject":
                if (typeof(json[dataName]) != "string" || /data:image\/.*;base64,.*/.test( json[dataName].substr(0,50)) == false) //data:image/<subtype>;base64,
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a data URI scheme with base64 encoded image"}});  
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
                        if (users[i].userPwd.toLowerCase() == json["userPwd"].toLowerCase())
                            return true;
                        else
                            break;
                    }
                }
                res.status(400).json({ error: { code:"102", message:"credentials userId / userPwd are not valid"}});
                return false;    
                break;    
            case "measurementEnvironment":
                var measurementEnvironmentValues = ["countryside","city","ontheroad","inside"];
                if (typeof(json[dataName]) != "string" || measurementEnvironmentValues.indexOf(json[dataName]) == -1)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " should be in [countryside | city | ontheroad | inside]"}});
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

//6. Post measurements
app.post('/measurements', function (req, res, next) {
   
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
                        if (reliability <= 100) {
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

//7. PUT users
app.put('/users', function (req, res, next) {
   
    if (typeof(req.body.apiKey) != "string" || typeof(req.body.data) != "object")
    {
        res.status(400).json({ error: {code:"100", message:"You must send a JSON with a string apiKey and an object data"}});
    }
    else {
        var apiKey = { "role":""};

        if (verifyApiKey(res, req.body.apiKey, true, apiKey, true))
        {
            if (! (req.body.data instanceof Array) || req.body.data.length > 1000000)
            {
                res.status(400).json({ error: {code:"101", message:"data should be an array"}}); 
            } else {
            
                //first check validity
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
                
                //second insert users in APIUSERS table
                if (isValid)
                {
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

//8. POST /measurements/:reportUuid
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

//9. GET /measurements/:reportUuid
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

//10. GET /measurements
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
                        values.push(req.query.tag);
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
                            // methode 2 : with left join
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

app.use(function(err, req, res, next){
    if (err)
        res.status(err.status).end();
    else
        res.status(404).end();
});

app.listen(properties.port, function() {
  if (properties.nodeUserUid != null && properties.nodeUserGid != null && process.getuid && process.setuid && process.getgid && process.setgid) {
    process.setgid(properties.nodeUserGid);
    process.setuid(properties.nodeUserUid);
    console.log(new Date().toISOString() + " -    nodeUserUid          : [" + properties.nodeUserUid + "]");
    console.log(new Date().toISOString() + " -    nodeUserGid          : [" + properties.nodeUserGid + "]"); 
  }
});

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
