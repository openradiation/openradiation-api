/* 
 * OPENRADIATION API
 */

//1. generic
var cluster = require('cluster');
const { MD5 } = require('crypto-js');
var request = require('request');
var properties = require('./properties.js');


// from measurementEnvironment, deviceUuid, flightNumber, startTime 
// return flight_id, alternate_latitude, alternate_longitude, alternate_altitude
// update tables : flights, flightstrack
updateFlightInfos = function(client, measurementEnvironment, flightNumber_, startTime, endTime, latitude, longitude, updateMeasurementFunc) {

    // variables to be returned
    var flightId = null;
    var refinedLatitude = null;
    var refinedLongitude = null;
    var refinedAltitude = null;
    var refinedEndLatitude = null;
    var refinedEndLongitude = null;
    var refinedEndAltitude = null;
    var flightSearch = null;
    var flightNumber = null;
 
    var hours = 3600*1000; // 1 hour in milliseconds
    
    if ((measurementEnvironment != null) && (measurementEnvironment == "plane") && flightNumber_ != null) {
        
        //0. if flight number is 'Af 038' we store 'AF38'
        flightNumber = flightNumber_.replace(/ /g,"");
        if (flightNumber.length > 2 && (!isNaN(flightNumber.substr(2))))
            flightNumber = flightNumber.substr(0,2).toUpperCase() + parseFloat(flightNumber.substr(2));
    
        async.waterfall(
          [
            function(callback) { 
                //1. is there any similar measurements, i.e. same flightNumber and less 2 hours apart
                var sql = 'select count(*) as count FROM MEASUREMENTS WHERE "flightNumber"=$1 and "flightSearch"=true and "startTime">$2 and "startTime"<$3';
                var values = [ flightNumber, new Date(new Date(startTime).getTime() - 2* hours), new Date(new Date(startTime).getTime() + 2* hours)];
                client.query(sql, values, function(err, result) {
                    if (err)
                    {
                        console.log("Error while running query " + sql, err);
                        callback();
                    } else {
                        if (result.rows[0].count == 0) {
                            //no similar result, so we try to connect flightradar
                            flightSearch = true;
                            
                            var requestParams = {};
                            requestParams.qs = {};
                            requestParams.url = properties.flightURL + 'FlightInfoStatus';
                            if (properties.flightProxy != null)
                                requestParams.proxy = properties.flightProxy; 
                            requestParams.qs.ident = flightNumber;
                            
                            request.get(requestParams, function (err, resp, body) {
                                if (err) {
                                    console.log("ERROR request FlightInfoStatus : " + err); 
                                    callback();   
                                }
                                else if (resp.statusCode >= 400) {
                                    console.log("ERROR status code FlightInfoStatus : " + resp.statusCode);
                                    callback();
                                }
                                else {
                                    body_json = JSON.parse(body);
                                    if ((body_json.FlightInfoStatusResult != null) && (body_json.FlightInfoStatusResult.flights.length > 0))
                                    {
                                        async.forEach(body_json.FlightInfoStatusResult.flights, function(flight, callback_flights) { 
                                            if ((new Date(flight.actual_departure_time.epoch * 1000) < new Date(new Date(startTime).getTime() + 4* hours)) 
                                            && (new Date(flight.actual_arrival_time.epoch * 1000) > new Date(new Date(startTime).getTime() - 4* hours))) 
                                            {
                                                var departureTime = new Date(flight.actual_departure_time.epoch * 1000);
                                                var arrivalTime = new Date(flight.actual_arrival_time.epoch * 1000);
                                                
                                                sql = 'select count(*) as count from FLIGHTS WHERE "flightNumber"=$1 and "departureTime"=$2 and "arrivalTime"=$3';
                                                values = [ flightNumber, departureTime, arrivalTime];
                                                client.query(sql, values, function(err, result) {
                                                    if (err) {
                                                        console.log("Error while running query " + sql, err);
                                                        callback_flights();
                                                    } else {
                                                        if (result.rows[0].count == 0)
                                                        {
                                                            sql = 'insert into FLIGHTS("flightNumber", "departureTime", "arrivalTime", "airportOrigin", "airportDestination", "aircraftType") VALUES ($1, $2, $3, $4, $5, $6) RETURNING "flightId"';
                                                            values = [ flightNumber, departureTime, arrivalTime, flight.origin.alternate_ident, flight.destination.alternate_ident, flight.aircrafttype ];
                                                            client.query(sql, values, function(err, result) {
                                                                if (err)
                                                                    console.log("Error while running query " + sql, err);
                                                                var flightIdInserted = result.rows[0].flightId;
                                                                requestParams.qs.ident = flight.faFlightID;
                                                                requestParams.url = properties.flightURL + 'GetFlightTrack';
                                                                request.get(requestParams, function (err, resp, body) {
                                                                    if (err) {
                                                                        console.log("ERROR request FlightInfoStatus : " + err); 
                                                                        callback_flights();
                                                                    } else if (resp.statusCode >= 400) {
                                                                        console.log("ERROR status code FlightInfoStatus : " + resp.statusCode);
                                                                        callback_flights();
                                                                    }
                                                                    else {
                                                                        body_json = JSON.parse(body);
                                                                        if ((body_json.GetFlightTrackResult != null) && (body_json.GetFlightTrackResult.tracks.length > 0))
                                                                        {
                                                                            async.forEach(body_json.GetFlightTrackResult.tracks, function(track, callback_tracks) { //The second argument (callback) is the "task callback" for a specific task
                                                                                if (track.timestamp != null && track.timestamp > 0 && track.latitude != null && track.longitude != null && track.altitude != null) {
                                                                                    var altitude_in_meter;
                                                                                    if (track.altitude_feet != null)
                                                                                        altitude_in_meter = Math.round(track.altitude_feet * 0.3048);
                                                                                    else
                                                                                        altitude_in_meter = Math.round(track.altitude * 100 * 0.3048);
                                                                                    
                                                                                    sql = 'insert into FLIGHTSTRACK("flightId", "timestamp", "latitude", "longitude", "altitude") VALUES ($1, $2, $3, $4, $5)';
                                                                                    values = [ flightIdInserted, new Date(track.timestamp * 1000), track.latitude, track.longitude, altitude_in_meter ];
                                                                                    client.query(sql, values, function(err, result) {
                                                                                        if (err)
                                                                                            console.log("Error while running query insert flightstrack " + sql, err);
                                                                                        callback_tracks();
                                                                                    });
                                                                                } else {
                                                                                    callback_tracks();
                                                                                }
                                                                            }, function(err) {
                                                                                if (err) {
                                                                                    console.log("Error tracks " + err);
                                                                                    callback_flights();
                                                                                } else {
                                                                                    sql = 'update FLIGHTS set "firstLatitude"=$1, "firstLongitude"=$2, "midLatitude"=$3, "midLongitude"=$4, "lastLatitude"=$5, "lastLongitude"=$6 where "flightId"=$7';
                                                                                    values = [ body_json.GetFlightTrackResult.tracks[0].latitude, 
                                                                                               body_json.GetFlightTrackResult.tracks[0].longitude,
                                                                                               body_json.GetFlightTrackResult.tracks[Math.round(body_json.GetFlightTrackResult.tracks.length/2)].latitude,
                                                                                               body_json.GetFlightTrackResult.tracks[Math.round(body_json.GetFlightTrackResult.tracks.length/2)].longitude,                                                                                               
                                                                                               body_json.GetFlightTrackResult.tracks[body_json.GetFlightTrackResult.tracks.length-1].latitude,
                                                                                               body_json.GetFlightTrackResult.tracks[body_json.GetFlightTrackResult.tracks.length-1].longitude,
                                                                                               flightIdInserted ];
                                                                                    client.query(sql, values, function(err, result) {
                                                                                        if (err)
                                                                                            console.log("Error while running query " + sql, err);
                                                                                        
                                                                                        callback_flights();
                                                                                    });
                                                                                    
                                                                                }
                                                                            });
                                                                        } else
                                                                            callback_flights();
                                                                    }
                                                                });
                                                            });             
                                                        } else {
                                                            callback_flights();
                                                        }
                                                    }
                                                });
                                            } else {
                                                callback_flights();
                                            }
                                        }, function(err) {
                                            if (err) 
                                                console.log("Error " + err);
                                            callback();
                                        });  
                                    } else {
                                        //console.log("No flight found in flightradar");
                                        callback();
                                    }
                                }
                            });
                        } else {   
                            callback();
                        }
                    }   
                });                        
             },
            
            function(callback) {
                //2. is there any registred flightradar flight, with same flightNumber and less 2 hours apart
                sql = 'select "flightId", "departureTime", "arrivalTime" FROM FLIGHTS WHERE "flightNumber"=$1 and "departureTime"<=$2 and "arrivalTime">=$3';
                values = [ flightNumber, new Date(new Date(startTime).getTime() + 2* hours), new Date(new Date(startTime).getTime() - 2* hours)];
                client.query(sql, values, function(err, result) {
                    if (err)
                    {
                        console.log("Error while running query " + sql, err);
                        callback(null, false);
                    } else {
                        if (result.rows.length == 0)
                        {
                            callback(null, false);           
                        } else {
                            var diff;  
                            for (var i = 0; i < result.rows.length; i++)
                            {
                                var midTime = new Date(result.rows[i].departureTime.getTime() + ((result.rows[i].arrivalTime.getTime() - result.rows[i].departureTime.getTime()) / 2));                                         
                                if ((i ==0) || Math.abs(midTime - new Date(startTime).getTime()) < diff) {
                                    diff = Math.abs(midTime - new Date(startTime).getTime());
                                    flightId = result.rows[i].flightId;
                                }
                            }
                            sql = 'SELECT timestamp, latitude, longitude, altitude from FLIGHTSTRACK where "flightId"=$1 order by timestamp';
                            values = [ flightId ];
                            client.query(sql, values, function(err, result) {
                                if (err) {
                                    console.log("Error while running query " + sql, err);
                                    callback(null, true); 
                                } else {
                                    var startTimeIndice = null;
                                    var endTimeIndice = null;
                                    for (var i = 0; i < result.rows.length; i++)
                                    {    
                                        if (startTimeIndice == null && (new Date(startTime) <= result.rows[i].timestamp))
                                            startTimeIndice = i;
                                        
                                        if (endTimeIndice == null && (new Date(endTime) < result.rows[i].timestamp)) {
                                            endTimeIndice = i;
                                            break;
                                        }
                                    }
                                    
                                    if (startTimeIndice == 0)
                                    {
                                        refinedLatitude = result.rows[0].latitude;
                                        refinedLongitude = result.rows[0].longitude;
                                        if (result.rows[0].altitude != 0)
                                            refinedAltitude = result.rows[0].altitude;   
                                    } else if (startTimeIndice == null) {
                                        if (result.rows.length > 0) {
                                            refinedLatitude = result.rows[result.rows.length - 1].latitude;
                                            refinedLongitude = result.rows[result.rows.length - 1].longitude;
                                            if (result.rows[result.rows.length - 1].altitude != 0)
                                                refinedAltitude = result.rows[result.rows.length - 1].altitude;
                                        }
                                    } else {
                                        refinedLatitude = result.rows[startTimeIndice - 1].latitude + (result.rows[startTimeIndice].latitude - result.rows[startTimeIndice - 1].latitude) * (new Date(startTime) - result.rows[startTimeIndice - 1].timestamp) / (result.rows[startTimeIndice].timestamp - result.rows[startTimeIndice - 1].timestamp);
                                        refinedLongitude = result.rows[startTimeIndice - 1].longitude + (result.rows[startTimeIndice].longitude - result.rows[startTimeIndice - 1].longitude) * (new Date(startTime) - result.rows[startTimeIndice - 1].timestamp) / (result.rows[startTimeIndice].timestamp - result.rows[startTimeIndice - 1].timestamp); 
                                        if (result.rows[startTimeIndice - 1].altitude != 0 && result.rows[startTimeIndice].altitude != 0)
                                            refinedAltitude = Math.round(result.rows[startTimeIndice - 1].altitude + (result.rows[startTimeIndice].altitude - result.rows[startTimeIndice - 1].altitude) * (new Date(startTime) - result.rows[startTimeIndice - 1].timestamp) / (result.rows[startTimeIndice].timestamp - result.rows[startTimeIndice - 1].timestamp)); 
                                    } 

                                    if (endTimeIndice == 0)
                                    {
                                        refinedEndLatitude = result.rows[0].latitude;
                                        refinedEndLongitude = result.rows[0].longitude;
                                        if (result.rows[0].altitude != 0)
                                            refinedEndAltitude = result.rows[0].altitude;   
                                    } else if (endTimeIndice == null) {
                                        if (result.rows.length > 0) {
                                            refinedEndLatitude = result.rows[result.rows.length - 1].latitude;
                                            refinedEndLongitude = result.rows[result.rows.length - 1].longitude;
                                            if (result.rows[result.rows.length - 1].altitude != 0)
                                                refinedEndAltitude = result.rows[result.rows.length - 1].altitude;
                                        }
                                    } else {
                                        refinedEndLatitude = result.rows[endTimeIndice - 1].latitude + (result.rows[endTimeIndice].latitude - result.rows[endTimeIndice - 1].latitude) * (new Date(endTime) - result.rows[endTimeIndice - 1].timestamp) / (result.rows[endTimeIndice].timestamp - result.rows[endTimeIndice - 1].timestamp);
                                        refinedEndLongitude = result.rows[endTimeIndice - 1].longitude + (result.rows[endTimeIndice].longitude - result.rows[endTimeIndice - 1].longitude) * (new Date(endTime) - result.rows[endTimeIndice - 1].timestamp) / (result.rows[endTimeIndice].timestamp - result.rows[endTimeIndice - 1].timestamp); 
                                        if (result.rows[endTimeIndice - 1].altitude != 0 && result.rows[endTimeIndice].altitude != 0)
                                            refinedEndAltitude = Math.round(result.rows[endTimeIndice - 1].altitude + (result.rows[endTimeIndice].altitude - result.rows[endTimeIndice - 1].altitude) * (new Date(endTime) - result.rows[endTimeIndice - 1].timestamp) / (result.rows[endTimeIndice].timestamp - result.rows[endTimeIndice - 1].timestamp)); 
                                    } 
                                    callback(null, true);
                                }
                            });       
                        }
                    }   
                });                     
                
            },
            
            function(flightFound, callback) {
                
                if (flightFound == false) {
                    //2. if not found, is there any flights, with same flightNumber and less 20 hours total duration and less 12 hours apart
                    sql = 'select "flightId", "startTimeMin", "startTimeMax", "firstLatitude", "firstLongitude", "midLatitude", "midLongitude", "lastLatitude", "lastLongitude" FROM FLIGHTS WHERE "flightNumber"=$1 and (    ("startTimeMin"<=$2 and "startTimeMax">=$2) or ("startTimeMin">$2  and "startTimeMin"<=$3 and "startTimeMax"<=$4) or ("startTimeMax"<$2  and "startTimeMax">=$5 and "startTimeMin">=$6))';
                    values = [ flightNumber, startTime, new Date(new Date(startTime).getTime() + 12* hours), new Date(new Date(startTime).getTime() + 20 * hours), new Date(new Date(startTime).getTime() - 12* hours), new Date(new Date(startTime).getTime() - 20* hours)];
                    
                    client.query(sql, values, function(err, result) {
                        if (err)
                        {
                            console.log("Error while running query " + sql, err);
                            callback();
                        } else {
                            if (result.rows.length == 0)
                            {
                                sql = 'insert into FLIGHTS("flightNumber", "startTimeMin", "startTimeMax", "firstLatitude", "firstLongitude", "midLatitude", "midLongitude", "lastLatitude", "lastLongitude") VALUES ($1, $2, $2, $3, $4, $3, $4, $3, $4) RETURNING "flightId"';
                                values = [ flightNumber, startTime, latitude, longitude ];
                                client.query(sql, values, function(err, result) {
                                    if (err)
                                        console.log("Error while running query " + sql, err);
                                    //console.log("FLIGHT NO MATCH - inserting new flight with id = " + result.rows[0].flightId);
                                    flightId = result.rows[0].flightId;
                                    callback();    
                                });             
                            } else {
                                var diff;
                                var startTimeMin;
                                var startTimeMax;
                                var firstLatitude;
                                var firstLongitude;
                                var midLatitude;
                                var midLongitude;
                                var lastLatitude;
                                var lastLongitude;
                                        
                                for (var i = 0; i < result.rows.length; i++)
                                {
                                    var startTimeMid = new Date(result.rows[i].startTimeMin.getTime() + ((result.rows[i].startTimeMax.getTime() - result.rows[i].startTimeMin.getTime()) / 2));                                      
                                    if ((i ==0) || Math.abs(startTimeMid - new Date(startTime).getTime()) < diff) {
                                        diff = Math.abs(startTimeMid - new Date(startTime).getTime());
                                        flightId = result.rows[i].flightId;
                                        startTimeMin = result.rows[i].startTimeMin;
                                        startTimeMax = result.rows[i].startTimeMax;
                                        firstLatitude = result.rows[i].firstLatitude;
                                        firstLongitude = result.rows[i].firstLongitude;
                                        midLatitude = result.rows[i].midLatitude;
                                        midLongitude = result.rows[i].midLongitude;
                                        lastLatitude = result.rows[i].lastLatitude;
                                        lastLongitude = result.rows[i].lastLongitude;
                                        
                                        if (new Date(startTime) < result.rows[i].startTimeMin) {
                                            startTimeMin = new Date(startTime);
                                            firstLatitude = latitude;
                                            firstLongitude = longitude;
                                        }
                                        
                                        if (new Date(startTime) > result.rows[i].startTimeMax) {
                                            startTimeMax = new Date(startTime);
                                            lastLatitude = latitude;
                                            lastLongitude = longitude; 
                                        }
                                    }
                                }
                                
                                //todo : we should update midLatitude/midLongitude maybe when a user retrieve measurements from a flights
                                sql = 'update FLIGHTS set "startTimeMin"=$1, "startTimeMax"=$2, "firstLatitude"=$3, "firstLongitude"=$4, "midLatitude"=$5, "midLongitude"=$6, "lastLatitude"=$7, "lastLongitude"=$8 where "flightId"=$9';
                                values = [ startTimeMin, startTimeMax, firstLatitude, firstLongitude, midLatitude, midLongitude, lastLatitude, lastLongitude, flightId ];
                                client.query(sql, values, function(err, result) {
                                    if (err)
                                        console.log("Error while running query " + sql, err);
                                    callback();    
                                });       
                            }
                        }   
                    });
                } else {
                    callback();   
                }
             }, 
             
             function() { //success
                updateMeasurementFunc({flightId, refinedLatitude, refinedLongitude, refinedAltitude, refinedEndLatitude, refinedEndLongitude, refinedEndAltitude, flightSearch, flightNumber});     
             }
          ],
          // Erreur
          function(err) { 
            console.log('FAIL: ' + err.message); 
            updateMeasurementFunc({flightId, refinedLatitude, refinedLongitude, refinedAltitude, refinedEndLatitude, refinedEndLongitude, refinedEndAltitude, flightSearch, flightNumber}); 
           }
        );
    } else {
        updateMeasurementFunc({flightId, refinedLatitude, refinedLongitude, refinedAltitude, refinedEndLatitude, refinedEndLongitude, refinedEndAltitude, flightSearch, flightNumber});  
    }
}

// Code to run if we're in the master process
if (cluster.isMaster) {

    var cpuCount = require('os').cpus().length;
    console.log(new Date().toISOString() + " - ****** OpenRadiation : cpuCount = " + cpuCount);
    // Create a worker for each CPU
    for (var i = 0; i < cpuCount; i += 1) {
        cluster.fork();
    }
    
    cluster.on('exit', function() {
        console.log('A worker process died, restarting...');
        cluster.fork();
    });
    
    var pg = require('pg');
    var async = require('async');
    
    var conStr = "postgres://" + properties.login + ":" + properties.password + "@" + properties.host + "/openradiation";
    
    majFlights = function() {
        pg.connect(conStr, function(err, client, done) {
            if (err) {
                done();
                console.log("Could not connect to PostgreSQL", err);
            } else {
                var sql = 'SELECT "reportUuid","measurementEnvironment","flightNumber","startTime","endTime","latitude","longitude" from MEASUREMENTS WHERE "measurementEnvironment"=\'plane\' AND "flightNumber" is not null AND "flightId" is null';
                client.query(sql, [], function(err, result) {
                    if (err) {
                        console.log("Error while running query " + sql, err);
                        done();
                    }
                    else {
                        async.forEachSeries(result.rows, function(measure, callbackLoop) {
                            
                            updateFlightInfos(client, measure.measurementEnvironment, measure.flightNumber, measure.startTime, measure.endTime, measure.latitude, measure.longitude, function(flightInfos) {   
                                //console.log(flightInfos);
                                var sql = 'update MEASUREMENTS set "flightNumber"=$1, "flightId"=$2, "refinedLatitude"=$3, "refinedLongitude"=$4,"refinedAltitude"=$5,"refinedEndLatitude"=$6,"refinedEndLongitude"=$7, "refinedEndAltitude"=$8,"flightSearch"=$9 WHERE "reportUuid"=$10';
                                var values = [ flightInfos.flightNumber, flightInfos.flightId, flightInfos.refinedLatitude, flightInfos.refinedLongitude,flightInfos.refinedAltitude,flightInfos.refinedEndLatitude,flightInfos.refinedEndLongitude, flightInfos.refinedEndAltitude,flightInfos.flightSearch, measure.reportUuid];
                                client.query(sql, values, function(err, result) {
                                    if (err)
                                        console.log("Error while running query " + sql, err);
                                    callbackLoop();
                                });
                            });
                        }, function(err) {
                            if (err) 
                                console.log("Error " + err);
                            done();
                        });
                    }
                });
            }
        }); 
    }
    if (properties.submitApiFeature)
        setInterval(majFlights, properties.flightSearchInterval);       
} else { // Code to run if we're in a worker process

var pg = require('pg');
var express = require('express');
var bodyParser = require('body-parser');
var multer = require('multer');  
var async = require('async');
var fs = require('fs');
var PNG = require('node-png/lib/png').PNG;
var https = require('https');
var http = require('http');
var CryptoJS = require("crypto-js");
var SHA256 = require("crypto-js/sha256");
var SHA512 = require("crypto-js/sha512");
var itoa64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    
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
var mutableOpenRadiationMapApiKey = ""; //the mutable apikey for openradiation map : it is mutable while it is visible in map

var apiKeyTestCounter = 0;
var apiKeyTestDate;

getAPI = function() {
    //console.log(new Date().toISOString() + " - getAPI() : begin"); 
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
                            mutableOpenRadiationMapApiKey = apiKeys[i].apiKey;
                    }
                }
            });
        }
    });
    //console.log(new Date().toISOString() + " - getAPI() : end");
};

getAPI();
setInterval(getAPI, properties.getAPIInterval); //every ten minutes

//3. load userId, userPwd every ten minutes
var users = [];

getUsers = function() {
    //console.log(new Date().toISOString() + " - getUsers() : begin");
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
    //console.log(new Date().toISOString() + " - getUsers() : end");
};

getUsers();
setInterval(getUsers, properties.getUsersInterval); //every ten minutes

//4. common functions
verifyApiKey = function(res, apiKey, adminOnly, isSubmitAPI) {
    // roles are the following : 
    //      test    : only a few GET requests
    //      get     : only GET requests
    //      mutable : only GET request, may change in database
    //      put     : GET or PUT/POST request
    //      admin   : GET or PUT/POST request + admin role requests are admit
    for (i = 0; i < apiKeys.length; i++)
    {
        if (apiKeys[i].apiKey == apiKey.toLowerCase()) //apiKey should be in lowercase in the database
        {
            if (adminOnly && apiKeys[i].role != "admin")
            {
                res.status(401).json({ error: {code:"103", message:"apiKey is not valid for this restricted access"}});
                return false;
            }

            if (isSubmitAPI && (apiKeys[i].role != "put" && apiKeys[i].role != "admin"))  
            {
                res.status(401).json({ error: {code:"103", message:"apiKey is not valid for submitting data"}});
                return false;
            }            
            
            //test : if apiKey = test is called more often
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
                    done();
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


//password_crypt impementation of the php drupal algorithm
//see https://api.drupal.org/api/drupal/includes!password.inc/function/_password_crypt/7
//to decrease computation time password are stored 10 to 12 minutes
var passwords = {};
deletePasswords = function() {
    //console.log(new Date().toISOString() + " - deletePasswords() : begin");
    for (var i in passwords)
    {
        var now = new Date();
        if (passwords[i].getTime() + 600000 < now.getTime())
            delete passwords[i];
    }
    //console.log(new Date().toISOString() + " - deletePasswords() : end");
};
setInterval(deletePasswords, 120000); //every 2 minutes

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
    
isPasswordValid = function(password, userPwd) {
    
    var passwordKey = password + userPwd;
    if (passwordKey in passwords)
    {
        passwords[passwordKey] = new Date();
        return true;
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
    
    var password_wordArray = CryptoJS.enc.Utf8.parse(password);
    var salt = userPwd.substring(4,12);
    var hash = SHA512(salt + password);
    var iterations = Math.pow(2,count_log2);
    
    for (var i = 0; i < iterations; i++)
    {
        hash = SHA512(hash.concat(password_wordArray));
    } 
    var base64 = _password_base64_encode(convertWordArrayToUint8Array(hash)); 
    if (userPwd == userPwd.substring(0,12) + base64.substr(0,43))
    {
        passwords[password + userPwd] = new Date();
        return true;
    }
    else
    {
        return false;
    }   
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
            case "MonthOfCreation":
            case "minStartTime":
            case "maxStartTime":
            case "endTime":
                if (typeof(json[dataName]) != "string" || new Date(json[dataName]) == "Invalid Date")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a date"}});
                    return false;
                }
                break;
            case "startTime":
                if (typeof(json[dataName]) != "string" || new Date(json[dataName]) == "Invalid Date")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a reliable date"}});
                    return false;
                }
                var now = new Date();
                if ( (new Date(json[dataName])).getTime() > (now.getTime() + 86400000)) 
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a real date"}});
                    return false;
                }
                break;
            case "latitude":
            case "endLatitude":
                if (typeof(json[dataName]) != "number")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a number"}});
                    return false;
                }
                break;
            case "longitude":
            case "endLongitude":
                if (typeof(json[dataName]) != "number")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a number"}});
                    return false;
                }
                break;
            case "accuracy":
            case "endAccuracy":
                if (typeof(json[dataName]) != "number")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a number"}});
                    return false;
                }
                break;   
            case "altitude":
            case "endAltitude":
                if (typeof(json[dataName]) != "number" || parseFloat(json[dataName]) != parseInt(json[dataName]))
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not an integer"}});
                    return false;
                }
                break; 
            case "altitudeAccuracy":
            case "endAltitudeAccuracy":
                if (typeof(json[dataName]) != "number")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a number"}});
                    return false;
                }
                break; 
            case "deviceUuid":
			case "devicePlatform":
			case "deviceVersion":
			case "deviceModel":
			case "calibrationFunction":
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
            case "rain":
			case "storm":
                if (typeof(json[dataName]) != "boolean")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a boolean"}});
                    return false;
                }
                break;
			case "flightNumber":
			case "seatNumber":
			    if (typeof(json["measurementEnvironment"]) != "string" || json["measurementEnvironment"] != "plane")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " can be defined only if measurementEnvironment is plane"}});
                    return false;
                }
				if (typeof(json[dataName]) != "string" || json[dataName].length > 25)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not a string"}});
                    return false;
                }
                break;
			case "windowSeat":
			    if (typeof(json["measurementEnvironment"]) != "string" || json["measurementEnvironment"] != "plane")
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " can be defined only if measurementEnvironment is plane"}});
                    return false;
                }
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
                    if (typeof(json[dataName][i]) != "string" || json[dataName][i].length > 100 || json[dataName][i].replace(/#/g, "")  == "")
                    {
                        res.status(400).json({ error: {code:"102", message:dataName + " contains an element which is too long or is not a filled string"}}); 
                        return false;
                    }
                    for (j = 0; j < json[dataName].length; j++) 
                    {
                        if (j<i && json[dataName][i].toLowerCase().replace(/#/g, "") == json[dataName][j].toLowerCase().replace(/#/g, ""))
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
                var qualificationValues = ["groundlevel", "plane", "wrongmeasurement", "temporarysource"];
                if (typeof(json[dataName]) != "string" || qualificationValues.indexOf(json[dataName]) == -1)
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " should be in [groundlevel | plane | wrongmeasurement | temporarysource]"}});
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
            case "flightId":
                if (typeof(json[dataName]) != "string" || isNaN(json[dataName]) || parseFloat(json[dataName]) != parseInt(json[dataName]))
                {
                    res.status(400).json({ error: {code:"102", message:dataName + " is not an integer"}});
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

// return preferred language in req request
getLanguage = function(req) {
    if (req.acceptsLanguages('fr', 'en') == "fr")
        return "fr";
    else
        return "en";
}

//5. request API
if (properties.requestApiFeature) {
    app.get('/measurements/:reportUuid', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /measurements/:reportUuid : begin");
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            if (verifyApiKey(res, req.query.apiKey, false, false)
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
                            sql = 'SELECT "apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","calibrationFunction","startTime", \
                                  "endTime","latitude","longitude","accuracy","altitude","altitudeAccuracy","endLatitude","endLongitude","endAccuracy","endAltitude","endAltitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel", \
                                  MEASUREMENTS."reportUuid","manualReporting","organisationReporting","description","measurementHeight","tag","enclosedObject", "userId", \
                                  "measurementEnvironment","rain",MEASUREMENTS."flightNumber","seatNumber","windowSeat","storm",MEASUREMENTS."flightId","refinedLatitude","refinedLongitude","refinedAltitude","refinedEndLatitude","refinedEndLongitude","refinedEndAltitude", \
                                  "departureTime","arrivalTime","airportOrigin","airportDestination","aircraftType","firstLatitude","firstLongitude","midLatitude","midLongitude","lastLatitude","lastLongitude","dateAndTimeOfCreation","qualification","qualificationVotesNumber","reliability","atypical" \
                                  FROM MEASUREMENTS LEFT JOIN TAGS on MEASUREMENTS."reportUuid" = TAGS."reportUuid" LEFT JOIN FLIGHTS on MEASUREMENTS."flightId"=FLIGHTS."flightId" WHERE MEASUREMENTS."reportUuid" = $1';
                        else
                            sql = 'SELECT "apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","calibrationFunction","startTime", \
                                  "endTime","latitude","longitude","accuracy","altitude","altitudeAccuracy","endLatitude","endLongitude","endAccuracy","endAltitude","endAltitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel", \
                                  MEASUREMENTS."reportUuid","manualReporting","organisationReporting","description","measurementHeight","tag", "userId", \
                                  "measurementEnvironment","rain",MEASUREMENTS."flightNumber","seatNumber","windowSeat","storm",MEASUREMENTS."flightId","refinedLatitude","refinedLongitude","refinedAltitude","refinedEndLatitude","refinedEndLongitude","refinedEndAltitude", \
                                  "departureTime","arrivalTime","airportOrigin","airportDestination","aircraftType","firstLatitude","firstLongitude","midLatitude","midLongitude","lastLatitude","lastLongitude","dateAndTimeOfCreation","qualification","qualificationVotesNumber","reliability","atypical" \
                                  FROM MEASUREMENTS LEFT JOIN TAGS on MEASUREMENTS."reportUuid" = TAGS."reportUuid" LEFT JOIN FLIGHTS on MEASUREMENTS."flightId"=FLIGHTS."flightId" WHERE MEASUREMENTS."reportUuid" = $1';
                       
                        var values = [ req.params.reportUuid];
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
        console.log(new Date().toISOString() + " - GET /measurements/:reportUuid : end");
    });

    //http://localhost:8080/measurements?apiKey=bde8ebc61cb089b8cc997dd7a0d0a434&minLatitude=3.4&maxStartTime=2015-04-19T11:49:59Z&minStartTime=2015-04-19T11:49:59.005Z&response=complete
    app.get('/measurements', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /measurements : begin");
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            if ( verifyApiKey(res, req.query.apiKey, false, false)
             && verifyData(res, req.query, false, "dateOfCreation")
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
             && verifyData(res, req.query, false, "flightId")              
             && verifyData(res, req.query, false, "response")
             && verifyData(res, req.query, false, "withEnclosedObject")
             && verifyData(res, req.query, false, "maxNumber")) 
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
                            sql = 'SELECT "apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","calibrationFunction","startTime", \
                                  "endTime","latitude","longitude","accuracy","altitude","altitudeAccuracy","endLatitude","endLongitude","endAccuracy","endAltitude","endAltitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel", \
                                  MEASUREMENTS."reportUuid","manualReporting","organisationReporting","description","measurementHeight", "enclosedObject", "userId", \
                                  "measurementEnvironment","rain",MEASUREMENTS."flightNumber","seatNumber","windowSeat","storm",MEASUREMENTS."flightId","refinedLatitude","refinedLongitude","refinedAltitude","refinedEndLatitude","refinedEndLongitude","refinedEndAltitude", \
                                  "departureTime","arrivalTime","airportOrigin","airportDestination","aircraftType","firstLatitude","firstLongitude","midLatitude","midLongitude","lastLatitude","lastLongitude","dateAndTimeOfCreation","qualification","qualificationVotesNumber","reliability","atypical"';
                        else
                            sql = 'SELECT "apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","calibrationFunction","startTime", \
                                  "endTime","latitude","longitude","accuracy","altitude","altitudeAccuracy","endLatitude","endLongitude","endAccuracy","endAltitude","endAltitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel", \
                                  MEASUREMENTS."reportUuid","manualReporting","organisationReporting","description","measurementHeight","userId", \
                                  "measurementEnvironment","rain",MEASUREMENTS."flightNumber","seatNumber","windowSeat","storm",MEASUREMENTS."flightId","refinedLatitude","refinedLongitude","refinedAltitude","refinedEndLatitude","refinedEndLongitude","refinedEndAltitude", \
                                  "departureTime","arrivalTime","airportOrigin","airportDestination","aircraftType","firstLatitude","firstLongitude","midLatitude","midLongitude","lastLatitude","lastLongitude","dateAndTimeOfCreation","qualification","qualificationVotesNumber","reliability","atypical"';
                                  
                        if (req.query.tag == null)
                            sql += ' FROM MEASUREMENTS LEFT JOIN FLIGHTS on MEASUREMENTS."flightId"=FLIGHTS."flightId"';
                        else
                            sql += ' FROM MEASUREMENTS LEFT JOIN FLIGHTS on MEASUREMENTS."flightId"=FLIGHTS."flightId",TAGS WHERE MEASUREMENTS."reportUuid" = TAGS."reportUuid"'; //FROM MEASUREMENTS LEFT JOIN TAGS on MEASUREMENTS."reportUuid" = TAGS."reportUuid"';
                            
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
                            values.push(new Date(req.query.minStartTime));
                            where += ' AND MEASUREMENTS."startTime" >= $' + values.length;
                        }
                        if (req.query.maxStartTime != null)
                        {
                            values.push(new Date(req.query.maxStartTime));
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
                            values.push(req.query.tag.toLowerCase().replace(/#/g, ""));
                            where += ' AND TAGS."tag" = $' + values.length;
                        }
                        if (req.query.atypical != null)
                        {
                            values.push(req.query.atypical);
                            where += ' AND MEASUREMENTS."atypical" = $' + values.length;
                        }
                        if (req.query.flightId != null)
                        {
                            values.push(req.query.flightId);
                            where += ' AND MEASUREMENTS."flightId" = $' + values.length;
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
                        
                        if (req.query.dateOfCreation == null && req.query.flightId == null)
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
        console.log(new Date().toISOString() + " - GET /measurements : end");
    });
    
    app.get('/flights', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /flights : begin");
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            if ( verifyApiKey(res, req.query.apiKey, false, false))
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {
                        var sql = 'SELECT "flightId", "flightNumber", "departureTime", "arrivalTime", "airportOrigin", "airportDestination", "aircraftType", "firstLatitude", "firstLongitude", "midLatitude", "midLongitude", "lastLatitude", "lastLongitude" FROM FLIGHTS ORDER BY "flightId"';
                        var values = [ ]; 
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
                                res.json( { data:data} );
                            }
                        });
                    }
                });
            }
        }
        console.log(new Date().toISOString() + " - GET /flights : end");
    });
    app.get('/users', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /users : begin");
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            if ( verifyApiKey(res, req.query.apiKey, false, false))
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {
                        var sql = 'SELECT DISTINCT ON (MEASUREMENTS."userId") MEASUREMENTS."userId", MEASUREMENTS."latitude", MEASUREMENTS."longitude", "endTime", APIUSERS."userPwd" FROM MEASUREMENTS  LEFT JOIN APIUSERS ON APIUSERS."userId" = MEASUREMENTS."userId" WHERE "endTime" IS NOT NULL ORDER BY MEASUREMENTS."userId" ASC, "endTime" DESC';
                        
                        var values = [ ];
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
                                res.json( { data:data} );
                            }
                        });
                    }
                });
            }
        }
        console.log(new Date().toISOString() + " - GET /users : end")
    });
    app.get('/totalContributors', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /totalContributors : begin");
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            if ( verifyApiKey(res, req.query.apiKey, false, false))
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {

                        var sql = `select count(distinct"userId")  from measurements`;

                        var values = [ ];
                        client.query(sql, values, function(err, result) {
                            if (err)
                            {
                                done();
                                console.error("Error while running query " + sql + values, err);
                                res.status(500).end();
                            }
                            else
                            {
                                done();
                                if(result.rows.length === 1) {
                                    res.json( result.rows[0].count );
                                }
                                else
                                {
                                    res.json( 0 );
                                }
                            }
                        });
                    }
                });
            }
        }
        console.log(new Date().toISOString() + " - GET /totalContributors : end")
    });
    app.get('/totalMeasurements', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /totalMeasurements : begin");
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            if ( verifyApiKey(res, req.query.apiKey, false, false))
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {
                        var sql = `select count("value")  from measurements`;

                        var where = '';
                        var values = [ ];

                        if (req.query.userId != null)
                        {
                            values.push(req.query.userId);
                            where += ' WHERE MEASUREMENTS."userId" = $' + values.length;
                        }

                        sql += where;

                        client.query(sql, values, function(err, result) {
                            if (err)
                            {
                                done();
                                console.error("Error while running query " + sql + values, err);
                                res.status(500).end();
                            }
                            else
                            {
                                done();
                                if(result.rows.length === 1) {
                                    res.json( result.rows[0].count );
                                }
                                else
                                {
                                    res.json( 0 );
                                }
                            }
                        });
                    }
                });
            }
        }
        console.log(new Date().toISOString() + " - GET /totalMeasurements : end")
    });
    app.get('/qualificationMeasurements', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /qualificationMeasurements : begin");
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            if ( verifyApiKey(res, req.query.apiKey, false, false))
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {
                        var sql = `SELECT "measurementEnvironment",  count("value")  FROM MEASUREMENTS  GROUP BY "measurementEnvironment"`;
                        
                        var values = [ ]; 
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
                                res.json( { data:data} );
                            }
                        });
                    }
                });
            }
        }
        console.log(new Date().toISOString() + " - GET /qualificationMeasurements : end")
    });
    app.get('/measurementsHistoryValue', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /measurementsHistoryValue : begin");
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            if ( verifyApiKey(res, req.query.apiKey, false, false))
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {
                        var sql = "";
                        var bornes = ['0.025', '0.050', '0.075', '0.100'];
                        var qualification = 'groundlevel';
                        var labels = {};

                        if (req.body.bornes != null)
                        {
                            bornes = req.body.bornes;
                        }

                        if (req.body.qualification != null)
                        {
                            qualification = req.body.qualification;
                        }

                        var key = 'val_0';
                        labels[key] = "0-"+bornes[0];
                        sql = 'select count(value) filter (where "value" <= ' +bornes[0]+ ' and qualification=\''+qualification+'\') as '+key;
                        for (let i = 0; i < bornes.length - 1; i++) {
                            key = 'val_'+(i+1);
                            sql=sql+', '+'count(value) filter (where "value" between ' +bornes[i]+ ' and ' +bornes[i+1]+ ' and qualification=\''+qualification+'\') as '+key;
                            labels[key] = bornes[i]+"-"+bornes[i+1];
                        }
                        key = 'val_'+bornes.length;
                        sql=sql+', '+'count(value) filter (where "value" >  ' +bornes[bornes.length - 1]+ ' and qualification=\''+qualification+'\') as '+key;
                        sql=sql+' from measurements;';
                        labels[key] = bornes[bornes.length-1]+" et +";

                        var values = [ ]; 
                        client.query(sql, values, function(err, result) {
                            if (err)
                            {
                                done();
                                console.error("Error while running query " + sql + values, err);
                                res.status(500).end();
                            }
                            else
                            {
                                done();
                                if(result.rows.length === 1) {
                                    res.json( {elements: result.rows[0], labels: labels} );
                                }
                                else
                                {
                                    res.json( 0 );
                                }
                            }
                        });
                    }
                });
            }
        }
        console.log(new Date().toISOString() + " - GET /measurementsHistoryValue : end")
    });
    app.get('/lastMeasureOfAllUsers', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /lastMeasureOfAllUsers : begin");
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            if ( verifyApiKey(res, req.query.apiKey, false, false))
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {
                        var sql = `SELECT DISTINCT ON (MEASUREMENTS."userId") MEASUREMENTS."userId",  "value", "longitude", "latitude" FROM MEASUREMENTS  LEFT JOIN APIUSERS ON APIUSERS."userId" = MEASUREMENTS."userId" WHERE "endTime" IS NOT NULL ORDER BY MEASUREMENTS."userId" ASC, "startTime" DESC`;
                        
                        var values = [ ]; 
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
                                res.json( { data:data} );
                            }
                        });
                    }
                });
            }
        }
        console.log(new Date().toISOString() + " - GET /lastMeasureOfAllUsers : end")
    });
   
    app.get('/lastMeasurementOfUser', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /lastMeasurementOfUser : begin");
        if (typeof(req.query.apiKey) != "string")
        {
            res.status(400).json({ error: {code:"100", message:"You must send the apiKey parameter"}});
        }
        else {
            if ( verifyApiKey(res, req.query.apiKey, false, false)
             && verifyData(res, req.query, false, "dateOfMeasurement")
             && verifyData(res, req.query, false, "MonthOfCreation")
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
             && verifyData(res, req.query, false, "flightId")              
             && verifyData(res, req.query, false, "response")
             && verifyData(res, req.query, false, "withEnclosedObject")
             && verifyData(res, req.query, false, "maxNumber")) 
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {
                        var sql;
                        var limit = 100;
                        if (req.query.maxNumber != null && parseInt(req.query.maxNumber) < properties.maxNumber)
                            limit = parseInt(req.query.maxNumber);
                        
                        if (req.query.response == null)
                            sql = `SELECT "userId","measurementEnvironment", TO_CHAR("startTime", 'DD Month YYYY') AS "date", "value"`;
                        else if (req.query.withEnclosedObject == null)
                            sql = 'SELECT "apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","calibrationFunction","startTime", \
                                  "endTime","latitude","longitude","accuracy","altitude","altitudeAccuracy","endLatitude","endLongitude","endAccuracy","endAltitude","endAltitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel", \
                                  MEASUREMENTS."reportUuid","manualReporting","organisationReporting","description","measurementHeight", "enclosedObject", "userId", \
                                  "measurementEnvironment","rain",MEASUREMENTS."flightNumber","seatNumber","windowSeat","storm",MEASUREMENTS."flightId","refinedLatitude","refinedLongitude","refinedAltitude","refinedEndLatitude","refinedEndLongitude","refinedEndAltitude", \
                                  "departureTime","arrivalTime","airportOrigin","airportDestination","aircraftType","firstLatitude","firstLongitude","midLatitude","midLongitude","lastLatitude","lastLongitude","dateAndTimeOfCreation","qualification","qualificationVotesNumber","reliability","atypical"';
                        else
                            sql = 'SELECT "apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","calibrationFunction","startTime", \
                                  "endTime","latitude","longitude","accuracy","altitude","altitudeAccuracy","endLatitude","endLongitude","endAccuracy","endAltitude","endAltitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel", \
                                  MEASUREMENTS."reportUuid","manualReporting","organisationReporting","description","measurementHeight","userId", \
                                  "measurementEnvironment","rain",MEASUREMENTS."flightNumber","seatNumber","windowSeat","storm",MEASUREMENTS."flightId","refinedLatitude","refinedLongitude","refinedAltitude","refinedEndLatitude","refinedEndLongitude","refinedEndAltitude", \
                                  "departureTime","arrivalTime","airportOrigin","airportDestination","aircraftType","firstLatitude","firstLongitude","midLatitude","midLongitude","lastLatitude","lastLongitude","dateAndTimeOfCreation","qualification","qualificationVotesNumber","reliability","atypical"';
                                  
                        if (req.query.tag == null)
                            sql += ' FROM MEASUREMENTS LEFT JOIN FLIGHTS on MEASUREMENTS."flightId"=FLIGHTS."flightId"';
                        else
                            sql += ' FROM MEASUREMENTS LEFT JOIN FLIGHTS on MEASUREMENTS."flightId"=FLIGHTS."flightId",TAGS WHERE MEASUREMENTS."reportUuid" = TAGS."reportUuid"'; //FROM MEASUREMENTS LEFT JOIN TAGS on MEASUREMENTS."reportUuid" = TAGS."reportUuid"';
                            
                        var where = '';
                        var values = [ ]; 
                        

                        if (req.query.maxStartTime != null)
                        {
                            values.push(new Date(req.query.maxStartTime));
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

                        if (req.query.dateOfMeasurement != null)
                        {
                            var date = new Date(req.query.dateOfMeasurement);
                            var date1 = new Date(date.toDateString());
                            var date2 = new Date(date1);
                            date2.setDate(date1.getDate() + 1);
                            values.push(date1);
                            where += ' AND MEASUREMENTS."startTime" >= $' + values.length;
                            values.push(date2);
                            where += ' AND MEASUREMENTS."startTime" < $' + values.length;
                        }
                        
                        if (req.query.tag == null)
                            where = where.replace('AND', 'WHERE');
                        
                        sql += where;
                        sql += ' ORDER BY "startTime" desc, MEASUREMENTS."reportUuid"';
                        
                        if (req.query.dateOfCreation == null && req.query.flightId == null)
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
                            }
                        });
                    }
                });
            }
        }
        console.log(new Date().toISOString() + " - GET /lastMeasurementOfUser : end");
    });
}

//6. submit API
if (properties.submitApiFeature) {
    app.post('/measurements', function (req, res, next) {
        console.log(new Date().toISOString() + " - POST /measurements : begin");
        if (typeof(req.body.apiKey) != "string" || typeof(req.body.data) != "object")
        {
            console.dir(req.body);
            console.log("You must send a JSON with a string apiKey and an object data");
            res.status(400).json({ error: {code:"100", message:"You must send a JSON with a string apiKey and an object data"}});
        }
        else {
            console.log(req.body.apiKey);
            //console.log(req.body.data);
            if (verifyApiKey(res, req.body.apiKey, false, true)
             && verifyData(res, req.body.data, false, "apparatusId")
             && verifyData(res, req.body.data, false, "apparatusVersion")
             && verifyData(res, req.body.data, false, "apparatusSensorType")
             && verifyData(res, req.body.data, false, "apparatusTubeType")
             && verifyData(res, req.body.data, false, "temperature")
             && verifyData(res, req.body.data, true, "value")
             && verifyData(res, req.body.data, false, "hitsNumber") 
			 && verifyData(res, req.body.data, false, "calibrationFunction") 
             && verifyData(res, req.body.data, true, "startTime")
             && verifyData(res, req.body.data, false, "endTime")     
             && verifyData(res, req.body.data, true, "latitude") 
             && verifyData(res, req.body.data, true, "longitude")
             && verifyData(res, req.body.data, false, "accuracy")
             && verifyData(res, req.body.data, false, "altitude")
             && verifyData(res, req.body.data, false, "altitudeAccuracy")
             && verifyData(res, req.body.data, false, "endLatitude") 
             && verifyData(res, req.body.data, false, "endLongitude")
             && verifyData(res, req.body.data, false, "endAccuracy")
             && verifyData(res, req.body.data, false, "endAltitude")
             && verifyData(res, req.body.data, false, "endAltitudeAccuracy")
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
             && verifyData(res, req.body.data, false, "measurementEnvironment")
             && verifyData(res, req.body.data, false, "rain")
			 && verifyData(res, req.body.data, false, "flightNumber") 
			 && verifyData(res, req.body.data, false, "seatNumber") 
			 && verifyData(res, req.body.data, false, "windowSeat") 
			 && verifyData(res, req.body.data, false, "storm") )
            {
                if (req.body.data.reportContext != null && req.body.data.reportContext == "routine")
                {
                    pg.connect(conStr, function(err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            
                            //updateFlightInfos(client, req.body.data.measurementEnvironment, req.body.data.flightNumber, req.body.data.startTime, req.body.data.endTime, req.body.data.latitude, req.body.data.longitude, function(flightInfos) {
                               
                                var sql = 'INSERT INTO MEASUREMENTS ("apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","calibrationFunction","startTime","endTime", \
                                           "latitude","longitude","accuracy","altitude","altitudeAccuracy","endLatitude","endLongitude","endAccuracy","endAltitude","endAltitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel","reportUuid","manualReporting", \
                                           "organisationReporting","reportContext","description","measurementHeight","enclosedObject","userId","measurementEnvironment","rain","flightNumber","seatNumber","windowSeat","storm", \
                                           "flightId","refinedLatitude","refinedLongitude","refinedAltitude","refinedEndLatitude","refinedEndLongitude","refinedEndAltitude","flightSearch", "dateAndTimeOfCreation", \
                                           "qualification","qualificationVotesNumber","reliability","atypical") VALUES \
                                           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51)';
                                
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
                                //+20 if measurementEnvironment=countryside / +10 if measurementEnvironment=city or ontheroad 
                                if (req.body.data.measurementEnvironment != null)
                                {
                                    if (req.body.data.measurementEnvironment == "countryside")
                                        reliability += 20;
                                    else if (req.body.data.measurementEnvironment == "city" || req.body.data.measurementEnvironment == "ontheroad")
                                        reliability += 10;
                                }
                                //+20 if measurementHeight=1 
                                if (req.body.data.measurementHeight != null && req.body.data.measurementHeight == 1)
                                    reliability += 10;

                                // qualification is set to groundlevel by default and qualificationVotesNumber is set to 0
                                // if measurementEnvironment is plane, qualification is set to plane
                                var qualification = "groundlevel";
                                var qualificationVotesNumber = 0;
                                if(req.body.data.measurementEnvironment != null && req.body.data.measurementEnvironment == "plane")
                                    qualification = "plane";
                                    
                                var atypical = req.body.data.value < 0.2 ? false : true;
                                var dateAndTimeOfCreation = new Date();
                                var values = [ req.body.data.apparatusId, req.body.data.apparatusVersion, req.body.data.apparatusSensorType, req.body.data.apparatusTubeType, 
                                               req.body.data.temperature, req.body.data.value, req.body.data.hitsNumber, req.body.data.calibrationFunction, new Date(req.body.data.startTime), 
                                               req.body.data.endTime != null ? new Date(req.body.data.endTime) : req.body.data.endTime, req.body.data.latitude, req.body.data.longitude, req.body.data.accuracy,
                                               req.body.data.altitude, req.body.data.altitudeAccuracy, req.body.data.endLatitude, req.body.data.endLongitude, req.body.data.endAccuracy,
                                               req.body.data.endAltitude, req.body.data.endAltitudeAccuracy, req.body.data.deviceUuid, req.body.data.devicePlatform,
                                               req.body.data.deviceVersion, req.body.data.deviceModel, req.body.data.reportUuid, manualReporting,
                                               req.body.data.organisationReporting, req.body.data.reportContext, req.body.data.description, req.body.data.measurementHeight,
                                               req.body.data.enclosedObject, req.body.data.userId, req.body.data.measurementEnvironment, req.body.data.rain, req.body.data.flightNumber, req.body.data.seatNumber, req.body.data.windowSeat, req.body.data.storm, 
                                               //flightInfos.flightId, flightInfos.refinedLatitude, flightInfos.refinedLongitude,flightInfos.refinedAltitude,flightInfos.refinedEndLatitude,flightInfos.refinedEndLongitude, flightInfos.refinedEndAltitude,flightInfos.flightSearch,
                                               null, null, null, null, null, null, null, null,
                                               dateAndTimeOfCreation, qualification, qualificationVotesNumber, reliability, atypical                                 
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
                                                    var values = [ req.body.data.reportUuid, tag.toLowerCase().replace(/#/g, "") ];
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
                            //});//end updateFlightInfos  
                        }//end else
                    });
                }
                else
                {
                    res.json({ "test":true});
                }
            }
        }
        console.log(new Date().toISOString() + " - POST /measurements : end");
    });

    app.put('/users', function (req, res, next) {
      
        console.log(new Date().toISOString() + " - PUT /users : begin");
        if (typeof(req.body.apiKey) != "string" || typeof(req.body.data) != "object")
        {
            res.status(400).json({ error: {code:"100", message:"You must send a JSON with a string apiKey and an object data"}});
            console.log("1");
        }
        else {
            if (verifyApiKey(res, req.body.apiKey, true, true))
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
        console.log(new Date().toISOString() + " - PUT /users : end");
    });

    app.post('/measurements/:reportUuid', function (req, res, next) {
        console.log(new Date().toISOString() + " - POST /measurements/:reportUuid : begin");
        if (typeof(req.body.apiKey) != "string" || typeof(req.body.data) != "object")
        {
            res.status(400).json({ error: {code:"100", message:"You must send a JSON with a string apiKey and an object data"}});
        }
        else {
            if (verifyApiKey(res, req.body.apiKey, true, true)
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
        console.log(new Date().toISOString() + " - POST /tags/:reportUuid : end");
    });
    app.post('/tags/:reportUuid', function (req, res, next) {
        console.log(new Date().toISOString() + " - POST /tags/:reportUuid : begin");
        if (typeof(req.body.apiKey) != "string" || typeof(req.body.data) != "object")
        {
            res.status(400).json({ error: {code:"100", message:"You must send a JSON with a string apiKey and an object data"}});
        }
        else {
            if (verifyApiKey(res, req.body.apiKey, true, true)
            && verifyData(res, req.body.data, true, "reportUuid")
            && verifyData(res, req.body.data, true, "tag"))
             
            {
                pg.connect(conStr, function(err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        res.status(500).end();
                    } else {
                        var sql = 'UPDATE TAGS SET "qualification"=$1,"qualificationVotesNumber"=$2 WHERE "reportUuid"=$3';
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
        console.log(new Date().toISOString() + " - POST /tags/:reportUuid : end");
    });
}

//7. submit Form
if (properties.submitFormFeature) {
    
	
    app.get('/test', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /test : begin");
        res.render('test.ejs');
        console.log(new Date().toISOString() + " - GET /test : end");
    });
    /*
    //sample : https://localhost:8080/test/6/46.6094640/2.4718880/0.45/2015-10-05T13:49:59Z
    //sample : https://localhost:8080/testme?zoom=6&latitude=46.6094640&longitude=2.3718880&value=0.45&startTime=2015-10-05T13:49:59Z
    //app.get('/test/:zoom/:latitude/:longitude/:value/:startTime', function (req, res, next) { 
    app.get('/testme', function (req, res, next) { 
        console.log(new Date().toISOString() + " - GET /testme : begin");
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
                "apiKey": properties.submitFormAPIKey,
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
                        res.render('openradiation.ejs', { lang:getLanguage(req), apiKey: properties.submitFormAPIKey, measurementURL: properties.measurementURL, withLocate:false, fitBounds:false, zoom: req.query.zoom, latitude: req.query.latitude, longitude: req.query.longitude, 
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
        console.log(new Date().toISOString() + " - GET /testme : end");
    });
*/

    app.get('/:lang/upload', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET :lang/upload : begin");
        if (req.params.lang == "fr" || req.params.lang == "en") {           
            res.render('uploadfile.ejs', { lang:req.params.lang , userId:"", userPwd:"", measurementEnvironment:"", measurementHeight:"", rain:"", flightNumber:"", description:"", tags: JSON.stringify([]), result: "" });
        } else
            res.status(404).end();
        console.log(new Date().toISOString() + " - GET :lang/upload : end");
    });
    
    app.get('/upload', function (req, res, next) {
        console.log(new Date().toISOString() + " - GET /upload : begin");
        res.render('uploadfile.ejs', { lang:getLanguage(req), userId:"", userPwd:"", measurementEnvironment:"", measurementHeight:"", rain:"", flightNumber:"", description:"", tags: JSON.stringify([]), result: "" });
        console.log(new Date().toISOString() + " - GET /upload : end");
    });
  
    app.post('/upload', upload.single('file'), function(req, res, next) {
        console.log(new Date().toISOString() + " - POST /upload : begin");
        
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
      
        if (req.body.lang == null || typeof(req.body.lang) != "string" || (req.body.lang !="fr" && req.body.lang !="en"))
            res.status(404).end();
        else if (req.body.userId == null || typeof(req.body.userId) != "string" || req.body.userId == "" || req.body.userId.length > 100)
            res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: "Username is mandatory" }); 
        else if (req.body.userPwd == null || typeof(req.body.userPwd) != "string" || req.body.userPwd == "" || req.body.userPwd.length > 100)
            res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: "Password is mandatory" }); 
        else {
            var measurementEnvironmentValues = ["countryside","city","ontheroad","inside","plane"];
            if (req.body.measurementEnvironment == null || typeof(req.body.measurementEnvironment) != "string" || measurementEnvironmentValues.indexOf(req.body.measurementEnvironment) == -1)
                res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: "Measurement environment should be in [countryside | city | ontheroad | inside | plane]" }); 
            else if (req.body.measurementEnvironment != "plane" && (req.body.measurementHeight == null || typeof(req.body.measurementHeight) != "string" || req.body.measurementHeight == "" || parseFloat(req.body.measurementHeight) != parseInt(req.body.measurementHeight)))
                res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: "Measurement height should be an integer" }); 
            else if (req.body.measurementEnvironment != "plane" && (req.body.rain == null || typeof(req.body.rain) != "string" || req.body.rain == "" || (req.body.rain != "true" &&  req.body.rain != "false")))
                res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: "Rain should be a boolean (true or false)" }); 
            else if (req.body.measurementEnvironment == "plane" && (req.body.flightNumber == null || typeof(req.body.flightNumber) != "string" || req.body.flightNumber == "" || (req.body.flightNumber.length > 25)))
                res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: "Flight Number is not valid" }); 
            else if (req.body.description == null || typeof(req.body.description) != "string" || req.body.description.length > 1000)
                res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: "Description is not valid" }); 
            else if (req.file == null)
                res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: "You have to choose a file" }); 
            else {
                file = req.file.buffer.toString("utf-8");
                var sha256 = SHA256(file).toString();
                console.log(req.file);
                lines = file.split(new RegExp('\r\n|\r|\n'));
                
                if (lines.length > 100000)
                    res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: "Your file contains too many lines (more than 100000 lines)" }); 
                else {
                    var measurementsLinesValid = 0;
                    var measurementsTakenInAccount = 0;
                    var measurementsOk = 0;
                    
                    var errorMessage = "";
                    var stopIt = false;
                    var lastEndTimeSubmitted;
                    
                    var firstMeasurement = true;
                    var totalHitsNumber;
                    var linesCount;
                    var startTime;
                    var latitude;
                    var longitude;
                    var accuracy;
                    var altitude;
                    var mm;
                    var hh;

                    //to avoid a maximum call stack size exceeded we cut the file in 1000 lines chunks
                    var loops = []; // loops will contain the chunks number
                    for (var i = 0; i <= Math.floor(lines.length / 1000); i++)
                    {
                        loops.push(i);
                    }
                    
                    // for each chunk
                    async.forEachSeries(loops, function(index, callbackLoop) {
                        var sublines = [];
                        if ( (index*1000+1000) > lines.length)
                            subLines = lines.slice(index * 1000, lines.length);
                        else
                            subLines = lines.slice(index * 1000, index*1000 + 1000);
                        
                        // treatment of the chunk
                        if (stopIt == false) {
                            // for each line of the chunk
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
                                        
                                        if (firstMeasurement) {
                                            totalHitsNumber = 0;
                                            linesCount = 1;
                                            startTime = new Date(values[2]);
                                            mm = values[7].match(/\d\d\.\d*/);
                                            hh = /(\d*)\d\d\./.exec(values[7]);
                                            if (hh != null && hh.length > 1 && mm != null)
                                            {
                                                latitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                                if (values[8] == "S")
                                                   latitude = latitude * -1;
                                            }
                                            mm = values[9].match(/\d\d\.\d*/);
                                            hh = /(\d*)\d\d\./.exec(values[9]);
                                            if (hh != null && hh.length > 1 && mm != null)
                                            {
                                                longitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                                if (values[10] == "W")
                                                    longitude = longitude * -1;
                                            } 
                                            accuracy = parseFloat(values[13]);
                                            altitude = parseInt(values[11]);

                                            firstMeasurement = false;
                                            callback();
                                        } else if (linesCount < 12) {
                                            linesCount += 1;
                                            totalHitsNumber += parseInt(values[4]); // number of pulses given by the Geiger tube in the last 5 seconds
                                            callback();
                                        } else if (linesCount == 12) {
                                            measurementsTakenInAccount += 1;
                                            
                                            var data = {};
                                            data.apparatusId = "safecast_id " + values[1];
                                            data.apparatusVersion = values[0];
                                            data.apparatusSensorType = "geiger";
                                            data.hitsNumber = totalHitsNumber + parseInt(values[4]); // hits number during one minute
                                            if (req.body.measurementEnvironment == "plane")
                                                if (Math.round(parseFloat(data.hitsNumber) / 60) >= 4.33)
                                                    data.value = Math.round(parseFloat(data.hitsNumber) / 60 * 0.42 * 1000) / 1000;
                                                else
                                                    data.value = Math.round(parseFloat(data.hitsNumber) / 60 / 5.56667 * 1000) / 1000;
                                            else
                                                data.value = Math.round(parseFloat(data.hitsNumber) / 60 / 5.56667 * 1000) / 1000;
                                            data.startTime = startTime;
                                            data.endTime = new Date(values[2]);
                                            data.latitude = latitude;
                                            data.longitude = longitude;
                                            data.accuracy = accuracy;
                                            data.altitude = altitude;    
                                            mm = values[7].match(/\d\d\.\d*/);
                                            hh = /(\d*)\d\d\./.exec(values[7]);
                                            if (hh != null && hh.length > 1 && mm != null)
                                            {
                                                data.endLatitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                                if (values[8] == "S")
                                                    data.endLatitude = data.endLatitude * -1;
                                            }
                                            mm = values[9].match(/\d\d\.\d*/);
                                            hh = /(\d*)\d\d\./.exec(values[9]);
                                            if (hh != null && hh.length > 1 && mm != null)
                                            {
                                                data.endLongitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                                if (values[10] == "W")
                                                    data.endLongitude = data.endLongitude * -1;
                                            } 
                                            data.endAccuracy = parseFloat(values[13]);
                                            data.endAltitude = parseInt(values[11]);
                                            var epoch = data.startTime.getTime() / 1000;
                                            if (epoch.toString().length > 10)
                                                epoch = epoch.toString().substr(0,10);
                                            else if (epoch.toString().length < 10)
                                                epoch = "0000000000".substring(0,10-epoch.toString().length) + epoch.toString();
                                            data.reportUuid = "ff" + MD5.substr(0,6) + "-" + MD5.substr(6,4) + "-4" + MD5.substr(10,3) + "-a" + MD5.substr(13,3) + "-" + MD5.substr(16,2) + epoch.toString(); // Uuid is ffxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx with 18 characters from sha-256 file and epoch startTime
                                            data.manualReporting = false;
                                            data.organisationReporting = "openradiation.net/upload " + properties.version;
                                            data.reportContext = "routine";
                                            data.description = req.body.description;
											data.measurementEnvironment = req.body.measurementEnvironment;
											if (req.body.measurementEnvironment == "plane")
												data.flightNumber = req.body.flightNumber; 
											else {
												data.measurementHeight = parseInt(req.body.measurementHeight);
												if (req.body.rain == "true")
													data.rain = true;
												else
													data.rain = false;
											}
                                            data.tags = tags.slice();
                                            data.tags.push("safecast");
                                            data.tags.push("file_" + sha256.substr(0,18));
                                            data.userId = req.body.userId;
                                            data.userPwd = req.body.userPwd;

                                            // here we retrieve data for the next measurement
                                            totalHitsNumber = 0;
                                            linesCount = 1;
                                            startTime = new Date(values[2]);
                                            mm = values[7].match(/\d\d\.\d*/);
                                            hh = /(\d*)\d\d\./.exec(values[7]);
                                            if (hh != null && hh.length > 1 && mm != null)
                                            {
                                                latitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                                if (values[8] == "S")
                                                   latitude = latitude * -1;
                                            }
                                            mm = values[9].match(/\d\d\.\d*/);
                                            hh = /(\d*)\d\d\./.exec(values[9]);
                                            if (hh != null && hh.length > 1 && mm != null)
                                            {
                                                longitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                                if (values[10] == "W")
                                                    longitude = longitude * -1;
                                            } 
                                            accuracy = parseFloat(values[13]);
                                            altitude = parseInt(values[11]);
                                            
                                            var json = {
                                                "apiKey": properties.submitFormAPIKey,
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
                                                        measurementsOk += 1;
                                                        callback();
                                                    } else {
                                                        if (measurementsTakenInAccount == 1) { // if there is an error we stop at the first one
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
                                                stopIt = true;
                                                res.status(500).end(); 
                                                callback();
                                            });
                                                 
                                            // post the data
                                            post_req.write(JSON.stringify(json),encoding='utf8');
                                            post_req.end(); 
                                        }
                                        //else
                                        //    callback(); //only one line all minute is treated
                                    } else {
                                        callback(); //invalid lines are not treated
                                    }
                                }
                            }, function(err) {

                                console.log(req.file.originalname + " processed at " + index * 1000);  //chunk is done now 
                                if (err) {
                                    console.log("error : " + err);
                                    stopIt = true;
                                    res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: "<strong>Error during the processing</strong> : " + err });
                                    
                                } else {
                                    if (measurementsOk == 0) { //we prefer to stop the treatment
                                        stopIt = true;
                                        res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: "<strong>Error during the processing</strong> : " + errorMessage });
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
                            message = "The file " + req.file.originalname + " has been processed : " + measurementsOk + " measurement(s) are stored in the OpenRadiation database.<br>";
                            message += "The file contained " + measurementsLinesValid + " valid lines, and " + measurementsTakenInAccount + " measurements have been extracted (one per minute).<br>";      
                            if (measurementsTakenInAccount != measurementsOk) {
                                message += "Amongst them, " + (measurementsTakenInAccount - measurementsOk) + " have been refused, like this one : <br><i>" + errorMessage + "</i><br><br>";
                            }
                            message += "Measurements have been tagged <i>#safecast</i> <i>#file_" + sha256.substr(0,18) + "</i>. You can now close this page.<br><br><br>";             
                            message += "<iframe frameborder=\"0\" style=\"height:90%;width:90%;left:auto;right:auto;min-height:400px;\" height=\"90%\" width=\"90%\" src=\"" + properties.mappingURL + "/openradiation/file_" + sha256.substr(0,18) + "/all/all/all/0/100/0/100\"></iframe>";
                            res.render('uploadfile.ejs', { lang:req.body.lang, userId:req.body.userId, userPwd:req.body.userPwd, measurementHeight:req.body.measurementHeight, measurementEnvironment:req.body.measurementEnvironment, rain:req.body.rain, flightNumber:req.body.flightNumber, description:req.body.description, tags: JSON.stringify(tags), result: message }); 
                        }
                    });   
                }
            }
        }
        console.log(new Date().toISOString() + " - POST /upload : end");
    });
}

//8. mapping
if (properties.mappingFeature) {
    var asinh = function(x) {
        return Math.log(x + Math.sqrt(1 + x*x));
    }
            
    app.get('/i/:z/:x/:y.png', function (req, res, next) { 
        console.log(new Date().toISOString() + " - GET /i/" + req.params.z + "/" + req.params.x + "/" + req.params.y + ".png : begin");

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
        
            var pngFileName = __dirname + '/public/png/{z}_{x}_{y}.png'.replace('{z}_{x}_{y}',z + "_" + x + "_" + y);
                                
            fs.access(pngFileName, (err) => {
                if (err) {
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
                                    {   
                                        var transparentTileFileName = __dirname + '/public/transparent_tile.png';
                                        if (z > 7)
                                            res.status(200).end();
                                            //res.writeHead(200, {'Content-Type': 'image/png' });
                                            //var fileStream = fs.createReadStream(transparentTileFileName);
                                            //fileStream.pipe(res);
                                        else {
                                            res.status(200).end();
                                            //res.writeHead(200, {'Content-Type': 'image/png' });
                                            //var fileStream = fs.createReadStream(transparentTileFileName);
                                            //fileStream.pipe(res);
                                            
                                            fs.createReadStream(transparentTileFileName).pipe(fs.createWriteStream(pngFileName));
                                            
                                            //fs.copyFile(transparentTileFileName, pngFileName, (err) => { });
                                        }
                                    }
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
                                                value = parseInt(tile.substr(idx_value,16), 2); // value is stored in nSv/h
                                                opac = parseInt(opacity.substr(idx_opacity,7),2);
                                                
                                                if (opac > 100)
                                                    opac=100;
                                                //idx in png is stored from top to bottom, then left to right
                                                var idx = (pix_x + pix_y * 256) << 2;
                  
                                                png.data[idx+3] = Math.floor(255 * (opac / 100.0));
                                        
                                                if (value == 65535) { // it is a null value
                                                    png.data[idx] = 255;    //R
                                                    png.data[idx+1] = 255; //G
                                                    png.data[idx+2] = 255; //B
                                                    png.data[idx+3] = 0; //opacity
                                                } else if (value < 45) {
                                                    png.data[idx] = 3; //R
                                                    png.data[idx+1] = 3; //G
                                                    png.data[idx+2] = 230; //B
                                                } else if (value < 72) {
                                                    png.data[idx] = 17; //R
                                                    png.data[idx+1] = 84; //G
                                                    png.data[idx+2] = 238; //B
                                                } else if (value < 114) {72
                                                    png.data[idx] = 35; //R
                                                    png.data[idx+1] = 172; //G
                                                    png.data[idx+2] = 246; //B
                                                } else if (value < 181) {
                                                    png.data[idx] = 51; //R
                                                    png.data[idx+1] = 250; //G
                                                    png.data[idx+2] = 254; //B
                                                } else if (value < 287) {
                                                    png.data[idx] = 34; //R
                                                    png.data[idx+1] = 248; //G
                                                    png.data[idx+2] = 175; //B
                                                } else if (value < 454) {
                                                    png.data[idx] = 16; //R
                                                    png.data[idx+1] = 247; //G
                                                    png.data[idx+2] = 89; //B
                                                } else if (value < 720) {
                                                    png.data[idx] = 0; //R
                                                    png.data[idx+1] = 245; //G
                                                    png.data[idx+2] = 15; //B
                                                } else if (value < 1142) {
                                                    png.data[idx] = 59; //R
                                                    png.data[idx+1] = 247; //G
                                                    png.data[idx+2] = 13; //B
                                                } else if (value < 1809) {
                                                    png.data[idx] = 129; //R
                                                    png.data[idx+1] = 249; //G
                                                    png.data[idx+2] = 10; //B
                                                } else if (value < 2867) {
                                                    png.data[idx] = 195; //R
                                                    png.data[idx+1] = 251; //G
                                                    png.data[idx+2] = 8; //B
                                                } else if (value < 4545) {
                                                    png.data[idx] = 255; //R
                                                    png.data[idx+1] = 253; //G
                                                    png.data[idx+2] = 6; //B
                                                } else if (value < 7203) {
                                                    png.data[idx] = 255; //R
                                                    png.data[idx+1] = 222; //G
                                                    png.data[idx+2] = 6; //B
                                                } else if (value < 11416) {
                                                    png.data[idx] = 254; //R
                                                    png.data[idx+1] = 192; //G
                                                    png.data[idx+2] = 7; //B
                                                } else if (value < 18092) {
                                                    png.data[idx] = 254; //R
                                                    png.data[idx+1] = 161; //G
                                                    png.data[idx+2] = 7; //B
                                                } else if (value < 28675) {
                                                    png.data[idx] = 253; //R
                                                    png.data[idx+1] = 131; //G
                                                    png.data[idx+2] = 7; //B
                                                } else if (value < 45446) {
                                                    png.data[idx] = 253; //R
                                                    png.data[idx+1] = 100; //G
                                                    png.data[idx+2] = 7; //B
                                                } else if (value < 72027) { //todo : value format is limited to 65535 
                                                    png.data[idx] = 252; //R
                                                    png.data[idx+1] = 69; //G
                                                    png.data[idx+2] = 8; //B
                                                } else if (value < 114115) {
                                                    png.data[idx] = 252; //R
                                                    png.data[idx+1] = 39; //G
                                                    png.data[idx+2] = 8; //B
                                                } else {
                                                    png.data[idx] = 251; //R
                                                    png.data[idx+1] = 8; //G
                                                    png.data[idx+2] = 8; //B
                                                }
                                                
                                                idx_value = idx_value + 16;
                                                idx_opacity = idx_opacity + 7;
                                            }                           
                                        }
                                    
                                        if (z > 7)
                                        {
                                            res.writeHead(200, {'Content-Type': 'image/png' });
                                            png.pack().pipe(res);
                                        } else {  // 7 to limit the number of files, while at this zoom level, we have 4^7 image files
                                            png.pack().pipe(fs.createWriteStream(pngFileName)).on('finish', function() {
                                                //var img = fs.readFileSync(pngFileName);
                                                //res.writeHead(200, {'Content-Type': 'image/png' });
                                                //res.end(img, 'binary');
                                                //if (z > 7) // 7 to limit the number of files, because at this zoom level, we have 4^7 image files
                                                  //  fs.unlinkSync(pngFileName);
                                                res.writeHead(200, {'Content-Type': 'image/png' });
                                                var fileStream = fs.createReadStream(pngFileName);
                                                fileStream.pipe(res);            
                                            });
                                        }
                                            
                                    }   
                                }
                            });
                        }   
                    });
                } else {
                    
                    //var img = fs.readFileSync(pngFileName);
                    res.writeHead(200, {'Content-Type': 'image/png' });
                    var fileStream = fs.createReadStream(pngFileName);
                    fileStream.pipe(res);
                    //res.end(img, 'binary');
                }
            });
        }        
        //console.log(new Date().toISOString() + " - GET /i/:z/:x/:y.png : end");
    });
           
    app.get('/:lang?/openradiation', function (req, res, next) {
        if (req.params.lang == undefined || req.params.lang == "fr" || req.params.lang == "en") 
        {   
            var lang;
            if (req.params.lang == undefined)
                lang = getLanguage(req);
            else
                lang = req.params.lang;
            res.render('openradiation.ejs', { lang:lang, apiKey: mutableOpenRadiationMapApiKey, measurementURL: properties.measurementURL, withLocate:true, fitBounds:false, zoom: 5, latitude:46, longitude:7, tag:"", userId:"",  qualification:"groundlevel",  atypical:"all", rangeValueMin:0, rangeValueMax:100, rangeDateMin:0, rangeDateMax:100});
        } else
            res.status(404).end();
    });
    
    app.get('/:lang?/openradiation/:zoom/:latitude/:longitude', function (req, res, next) { 
        if ((isNaN(req.params.zoom) == false && parseFloat(req.params.zoom) == parseInt(req.params.zoom) && parseInt(req.params.zoom) >=0 && parseInt(req.params.zoom) <= 18)
         && (isNaN(req.params.latitude) == false)
         && (isNaN(req.params.longitude) == false)
         && (req.params.lang == undefined || req.params.lang == "fr" || req.params.lang == "en"))
        {       
            var lang;
            if (req.params.lang == undefined)
                lang = getLanguage(req);
            else
                lang = req.params.lang;
            res.render('openradiation.ejs', { lang:lang, apiKey: mutableOpenRadiationMapApiKey, measurementURL: properties.measurementURL, withLocate:false, fitBounds:false, zoom: req.params.zoom, latitude: req.params.latitude, longitude: req.params.longitude, 
                                          tag:"", userId: "", qualification: "groundlevel", atypical: "all",
                                          rangeValueMin:0, rangeValueMax:100, rangeDateMin:0, rangeDateMax:100 } );
        } else {
            res.status(404).end();
        }
    });
       
    app.get('/:lang?/openradiation/:tag/:userId/:qualification/:atypical/:rangeValueMin/:rangeValueMax/:rangeDateMin/:rangeDateMax', function (req, res, next) {
        if ( (req.params.qualification == "all" || req.params.qualification == "plane" || req.params.qualification == "wrongmeasurement" || req.params.qualification == "groundlevel" || req.params.qualification == "temporarysource")
          && (req.params.atypical == "all" || req.params.atypical == "true" || req.params.atypical == "false")
          && (isNaN(req.params.rangeValueMin) == false && parseFloat(req.params.rangeValueMin) == parseInt(req.params.rangeValueMin) && parseInt(req.params.rangeValueMin) >=0 && parseInt(req.params.rangeValueMin) <= 100)
          && (isNaN(req.params.rangeValueMax) == false && parseFloat(req.params.rangeValueMax) == parseInt(req.params.rangeValueMax) && parseInt(req.params.rangeValueMax) >=0 && parseInt(req.params.rangeValueMax) <= 100 && parseInt(req.params.rangeValueMin) <= parseInt(req.params.rangeValueMax))
          && (isNaN(req.params.rangeDateMin) == false && parseFloat(req.params.rangeDateMin) == parseInt(req.params.rangeDateMin) && parseInt(req.params.rangeDateMin) >=0 && parseInt(req.params.rangeDateMin) <= 100)
          && (isNaN(req.params.rangeDateMax) == false && parseFloat(req.params.rangeDateMax) == parseInt(req.params.rangeDateMax) && parseInt(req.params.rangeDateMax) >=0 && parseInt(req.params.rangeDateMax) <= 100 && parseInt(req.params.rangeDateMin) <= parseInt(req.params.rangeDateMax))
          && (req.params.lang == undefined || req.params.lang == "fr" || req.params.lang == "en"))
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
            var lang;
            if (req.params.lang == undefined)
                lang = getLanguage(req);
            else
                lang = req.params.lang;
			var qualification;
			qualification = req.params.qualification;
			
            res.render('openradiation.ejs', { lang:lang, apiKey: mutableOpenRadiationMapApiKey, measurementURL: properties.measurementURL, withLocate:false, fitBounds:true, zoom: 1, latitude:46, longitude:7, 
                                          tag:tag, userId: userId, qualification:qualification, atypical: req.params.atypical,
                                          rangeValueMin:req.params.rangeValueMin, rangeValueMax:req.params.rangeValueMax, rangeDateMin:req.params.rangeDateMin, rangeDateMax:req.params.rangeDateMax } );
        } else
            res.status(404).end();
    });
    
    app.get('/:lang?/openradiation/:zoom/:latitude/:longitude/:tag/:userId/:qualification/:atypical/:rangeValueMin/:rangeValueMax/:rangeDateMin/:rangeDateMax', function (req, res, next) { 
        if ((isNaN(req.params.zoom) == false && parseFloat(req.params.zoom) == parseInt(req.params.zoom) && parseInt(req.params.zoom) >=0 && parseInt(req.params.zoom) <= 18)
          && (isNaN(req.params.latitude) == false)
          && (isNaN(req.params.longitude) == false)
          && (req.params.qualification == "all" || req.params.qualification == "plane" || req.params.qualification == "wrongmeasurement" || req.params.qualification == "groundlevel" || req.params.qualification == "temporarysource")
          && (req.params.atypical == "all" || req.params.atypical == "true" || req.params.atypical == "false")
          && (isNaN(req.params.rangeValueMin) == false && parseFloat(req.params.rangeValueMin) == parseInt(req.params.rangeValueMin) && parseInt(req.params.rangeValueMin) >=0 && parseInt(req.params.rangeValueMin) <= 100)
          && (isNaN(req.params.rangeValueMax) == false && parseFloat(req.params.rangeValueMax) == parseInt(req.params.rangeValueMax) && parseInt(req.params.rangeValueMax) >=0 && parseInt(req.params.rangeValueMax) <= 100 && parseInt(req.params.rangeValueMin) <= parseInt(req.params.rangeValueMax))
          && (isNaN(req.params.rangeDateMin) == false && parseFloat(req.params.rangeDateMin) == parseInt(req.params.rangeDateMin) && parseInt(req.params.rangeDateMin) >=0 && parseInt(req.params.rangeDateMin) <= 100)
          && (isNaN(req.params.rangeDateMax) == false && parseFloat(req.params.rangeDateMax) == parseInt(req.params.rangeDateMax) && parseInt(req.params.rangeDateMax) >=0 && parseInt(req.params.rangeDateMax) <= 100 && parseInt(req.params.rangeDateMin) <= parseInt(req.params.rangeDateMax))
          && (req.params.lang == undefined || req.params.lang == "fr" || req.params.lang == "en"))
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
            var lang;
            if (req.params.lang == undefined)
                lang = getLanguage(req);
            else
                lang = req.params.lang;
			var qualification;
			qualification = req.params.qualification;
			
            res.render('openradiation.ejs', { lang:lang, apiKey: mutableOpenRadiationMapApiKey, measurementURL: properties.measurementURL, withLocate:false, fitBounds:false, zoom: req.params.zoom, latitude: req.params.latitude, longitude: req.params.longitude, 
                                          tag:tag, userId: userId, qualification:qualification, atypical: req.params.atypical,
                                          rangeValueMin:req.params.rangeValueMin, rangeValueMax:req.params.rangeValueMax, rangeDateMin:req.params.rangeDateMin, rangeDateMax:req.params.rangeDateMax } );
        } else
            res.status(404).end();
    });
}

// Apps server (http + https or http only)
if (properties.httpsEnabled) {
    //9a. https server
    app.use(function (err, req, res, next) {
        if (err) {
            console.log(err);
            if (err.status == null)
                res.status(500).end();
            else
                res.status(err.status).end();
        } else
            res.status(404).end();
    });

    var privateKey = fs.readFileSync(__dirname + '/' + properties.certKeyFile, 'utf8');
    var certificate = fs.readFileSync(__dirname + '/' + properties.certCrtFile, 'utf8');
    var credentials = {key: privateKey, cert: certificate};
    var httpsServer = https.createServer(credentials, app);

    httpsServer.timeout = 600000; // ten minutes before timeout (used when we post files, default is 120000)

    httpsServer.listen(properties.httpsPort, function () {
        console.log(new Date().toISOString() + " - *** OpenRadiation API (worker " + cluster.worker.id + ") started with parameters : ");
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
        if (properties.submitFormFeature)
            console.log(new Date().toISOString() + " -    submitFormAPIKey     : [" + properties.submitFormAPIKey + "]");
        console.log(new Date().toISOString() + " -    mappingURL           : [" + properties.mappingURL + "]");
        console.log(new Date().toISOString() + " -    submitAPIHost        : [" + properties.submitAPIHost + "]");
        console.log(new Date().toISOString() + " -    submitAPIPort        : [" + properties.submitAPIPort + "]");
        console.log(new Date().toISOString() + " -    httpsPort            : [" + properties.httpsPort + "]");
        console.log(new Date().toISOString() + " -    httpPort             : [" + properties.httpPort + "]");
        console.log(new Date().toISOString() + " -    flightURL            : [" + properties.flightURL + "]");
        console.log(new Date().toISOString() + " -    flightProxy          : [" + properties.flightProxy + "]");
        console.log(new Date().toISOString() + " -    flightSearchInterval : [" + properties.flightSearchInterval + "]");
        console.log(new Date().toISOString() + " -    version              : [" + properties.version + "]");
        console.log(new Date().toISOString() + " - ****** ");
    });

    //10a. http server
    http.createServer(http_req).listen(properties.httpPort); // replace http_req by app to listen on http port
    function http_req(req, res) {
        console.log(new Date().toISOString() + " - http_req(req, res) : HTTP /" + req.method + " called");
        req.on('error', function (err) {
            console.error(new Date().toISOString() + " - Error in request " + err.stack);
        });

        if ((req.method == "GET" || req.method == "HEAD") && (typeof req.headers.host != "undefined")) { // bug : Cannot read property 'indexOf' of undefined
            if (req.headers.host.indexOf(":") > -1)
                res.writeHead(301, {Location: "https://" + req.headers.host.slice(0, req.headers.host.indexOf(":")) + ":" + properties.httpsPort + req.url});
            else
                res.writeHead(301, {Location: "https://" + req.headers.host + req.url});
            res.end();
        } else {
            console.log(new Date().toISOString() + " - before res");
            res.writeHead(400, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({error: {code: "100", message: "Please use https instead of http"}}));
            console.log(new Date().toISOString() + " - after res");
        }
    }
} else {
    //9b. http server
    app.use(function (err, req, res, next) {
        if (err) {
            console.log(err);
            if (err.status == null) {
                res.status(500).end();
            } else {
                res.status(err.status).end();
            }
        } else {
            res.status(404).end();
        }
    });

    var httpServer = http.createServer(app);

    httpServer.timeout = 600000; // ten minutes before timeout (used when we post files, default is 120000)

    httpServer.listen(properties.httpPort, function () {
        console.log(new Date().toISOString() + " - *** OpenRadiation API (worker " + cluster.worker.id + ") started with parameters : ");
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
        console.log(new Date().toISOString() + " -    submitApiFeature     : [" + properties.submitApiFeature + "]");
        console.log(new Date().toISOString() + " -    requestApiFeature    : [" + properties.requestApiFeature + "]");
        console.log(new Date().toISOString() + " -    mappingFeature       : [" + properties.mappingFeature + "]");
        console.log(new Date().toISOString() + " -    submitFormFeature    : [" + properties.submitFormFeature + "]");
        if (properties.submitFormFeature)
            console.log(new Date().toISOString() + " -    submitFormAPIKey     : [" + properties.submitFormAPIKey + "]");
        console.log(new Date().toISOString() + " -    mappingURL           : [" + properties.mappingURL + "]");
        console.log(new Date().toISOString() + " -    submitAPIHost        : [" + properties.submitAPIHost + "]");
        console.log(new Date().toISOString() + " -    submitAPIPort        : [" + properties.submitAPIPort + "]");
        console.log(new Date().toISOString() + " -    httpPort             : [" + properties.httpPort + "]");
        console.log(new Date().toISOString() + " -    flightURL            : [" + properties.flightURL + "]");
        console.log(new Date().toISOString() + " -    flightProxy          : [" + properties.flightProxy + "]");
        console.log(new Date().toISOString() + " -    flightSearchInterval : [" + properties.flightSearchInterval + "]");
        console.log(new Date().toISOString() + " -    version              : [" + properties.version + "]");
        console.log(new Date().toISOString() + " - ****** ");
    });
}

} // worker



