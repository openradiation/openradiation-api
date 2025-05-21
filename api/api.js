/* 
 * OPENRADIATION API
 */

//1. generic
const cluster = require('cluster');
const {MD5} = require('crypto-js');
const properties = require('./properties.js');
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const async = require('async');
const fs = require('fs');
const PNG = require('pngjs').PNG;
const https = require('https');
const http = require('http');
const CryptoJS = require("crypto-js");
const SHA256 = require("crypto-js/sha256");
const SHA512 = require("crypto-js/sha512");
const pg = require('pg');
const axios = require('axios');
const {HttpsProxyAgent} = require('https-proxy-agent');


// from measurementEnvironment, deviceUuid, flightNumber, startTime
// return flight_id, alternate_latitude, alternate_longitude, alternate_altitude
// update tables : flights, flightstrack
updateFlightInfos = function (client, measurementEnvironment, flightNumber_, startTime, endTime, latitude, longitude, updateMeasurementFunc) {
    // variables to be returned
    let flightId = null;
    let refinedLatitude = null;
    let refinedLongitude = null;
    let refinedAltitude = null;
    let refinedEndLatitude = null;
    let refinedEndLongitude = null;
    let refinedEndAltitude = null;
    let flightSearch = null;
    let flightNumber = null;

    const hours = 3600 * 1000; // 1 hour in milliseconds

    if ((measurementEnvironment != null) && (measurementEnvironment === "plane") && flightNumber_ != null) {

        console.log("Valeur initiale de flightNumber_ :", flightNumber_);
        //0. if flight number is 'Af 038' we store 'AF38'
        flightNumber = flightNumber_.replace(/ /g, "");

        let match = flightNumber.match(/^([A-Za-z]{2,3})(\d{1,4})$/);
        if (match) {
            let airlineCode = match[1].toUpperCase();
            let flightDigits = parseInt(match[2], 10);
            flightNumber = airlineCode + flightDigits;
        } else {
            console.error("Numéro de vol invalide :", flightNumber);
        }

        async.waterfall(
            [
                function (callback) {
                    //1. is there any similar measurements, i.e. same flightNumber and less 2 hours apart
                    let sql = 'select count(*) as count FROM MEASUREMENTS WHERE "flightNumber"=$1 and "flightSearch"=true and "startTime">$2 and "startTime"<$3';
                    let values = [
                        flightNumber,
                        new Date(new Date(startTime).getTime() - 2 * hours),
                        new Date(new Date(startTime).getTime() + 2 * hours)
                    ];
                    client.query(sql, values, function (err, result) {
                        if (err) {
                            console.log("Error while running query " + sql, err);
                            callback();
                        } else {
                            if (Number(result.rows[0].count) === 0) {
                                //no similar result, so we try to connect flightradar
                                flightSearch = true;

                                const proxyUrl = properties.flightProxy || null;
                                const axiosCfg = {
                                    baseURL: properties.flightURL,
                                    headers: {'x-apikey': properties.flightApiKey}
                                };
                                if (proxyUrl) {
                                    axiosCfg.httpsAgent = new HttpsProxyAgent(proxyUrl);
                                    axiosCfg.proxy = false;
                                }
                                const aeroapi = axios.create(axiosCfg);
                                const requestParams = {};
                                requestParams.qs = {
                                    start: new Date(startTime.getTime() - 4 * hours).toISOString().split('.')[0] + 'Z',
                                    end: new Date(startTime.getTime() + 4 * hours).toISOString().split('.')[0] + 'Z',
                                };

                                console.log("Appel de l'API : /flights/" + flightNumber);

                                aeroapi.get(`/flights/${flightNumber}`, {params: requestParams.qs})
                                    .then(resp => {
                                        if (resp.status >= 400) {
                                            console.log("ERROR status code FlightInfoStatus : " + resp);
                                            return callback();
                                        }

                                        const flights = resp.data.flights || [];
                                        async.forEach(flights, function (flight, callback_flights) {
                                            const departureTime = new Date(flight.actual_off || flight.scheduled_off);
                                            const arrivalTime = new Date(flight.actual_on || flight.scheduled_on);

                                            sql = 'select count(*) as count from FLIGHTS WHERE "flightNumber"=$1 and "departureTime"=$2 and "arrivalTime"=$3';
                                            values = [flightNumber, departureTime, arrivalTime];
                                            client.query(sql, values, function (err, result) {
                                                if (err) {
                                                    console.log("Error while running query " + sql, err);
                                                    return callback_flights();
                                                }
                                                if (Number(result.rows[0].count)) return callback_flights();

                                                sql = 'insert into FLIGHTS("flightNumber", "departureTime", "arrivalTime", "airportOrigin", "airportDestination", "aircraftType") VALUES ($1, $2, $3, $4, $5, $6) RETURNING "flightId"';
                                                values = [
                                                    flightNumber,
                                                    departureTime,
                                                    arrivalTime,
                                                    flight.origin?.code,
                                                    flight.destination?.code,
                                                    flight.aircrafttype
                                                ];
                                                client.query(sql, values, function (err, result) {
                                                    if (err) {
                                                        console.log("Error while running query " + sql, err);
                                                    }
                                                    const flightIdInserted = result.rows[0].flightId;

                                                    console.log("de l'API /flights/" + flight.fa_flight_id + "/track");

                                                    aeroapi.get(`/flights/${flight.fa_flight_id}/track`)
                                                        .then(respTrack => {
                                                            const tracks = respTrack.data.positions || [];
                                                            async.forEach(tracks, function (track, callback_tracks) { //The second argument (callback) is the "task callback" for a specific task
                                                                if (!track.timestamp || !track.latitude || !track.longitude) {
                                                                    return callback_tracks();
                                                                }
                                                                const altitude_in_meter = Math.round(track.altitude * 100 * 0.3048); //  hundred ft -> m

                                                                sql = 'insert into FLIGHTSTRACK("flightId", "timestamp", "latitude", "longitude", "altitude") VALUES ($1, $2, $3, $4, $5)';
                                                                values = [flightIdInserted, new Date(track.timestamp), track.latitude, track.longitude, altitude_in_meter];
                                                                client.query(sql, values, function (err, result) {
                                                                    if (err)
                                                                        console.log("Error while running query insert flightstrack " + sql, err);
                                                                    callback_tracks();
                                                                });

                                                            }, function (err) {
                                                                if (err) {
                                                                    console.log("Error tracks " + err);
                                                                    callback_flights();
                                                                } else {
                                                                    sql = 'update FLIGHTS set "firstLatitude"=$1, "firstLongitude"=$2, "midLatitude"=$3, "midLongitude"=$4, "lastLatitude"=$5, "lastLongitude"=$6 where "flightId"=$7';
                                                                    middle = Math.floor(tracks.length / 2);
                                                                    values = [tracks[0].latitude,
                                                                        tracks[0].longitude,
                                                                        tracks[middle].latitude,
                                                                        tracks[middle].longitude,
                                                                        tracks[tracks.length - 1].latitude,
                                                                        tracks[tracks.length - 1].longitude,
                                                                        flightIdInserted];
                                                                    client.query(sql, values, function (err, result) {
                                                                        if (err)
                                                                            console.log("Error while running query " + sql, err);

                                                                        callback_flights();
                                                                    });
                                                                }
                                                            });
                                                        }).catch(err => {
                                                        console.error("ERROR request FlightInfoStatus : " + err);
                                                        callback_flights();
                                                    });
                                                });
                                            });
                                        }, function (err) {
                                            if (err)
                                                console.log("Error " + err);
                                            console.error(err);
                                            callback();
                                        });
                                    }).catch(err => {
                                    console.error("ERROR request FlightInfoStatus : " + err);
                                    callback();
                                });
                            } else {
                                callback();
                            }
                        }
                    });
                },

                function (callback) {
                    //2. is there any registred flightradar flight, with same flightNumber and less 2 hours apart
                    let sql = 'select "flightId", "departureTime", "arrivalTime" FROM FLIGHTS WHERE "flightNumber"=$1 and "departureTime"<=$2 and "arrivalTime">=$3';
                    let values = [flightNumber, new Date(new Date(startTime).getTime() + 2 * hours), new Date(new Date(startTime).getTime() - 2 * hours)];
                    client.query(sql, values, function (err, result) {
                        if (err) {
                            console.log("Error while running query " + sql, err);
                            callback(null, false);
                        } else {
                            if (result.rows.length == 0) {
                                callback(null, false);
                            } else {
                                let diff;
                                for (let i = 0; i < result.rows.length; i++) {
                                    const midTime = new Date(result.rows[i].departureTime.getTime() + ((result.rows[i].arrivalTime.getTime() - result.rows[i].departureTime.getTime()) / 2));
                                    if ((i === 0) || Math.abs(midTime - new Date(startTime).getTime()) < diff) {
                                        diff = Math.abs(midTime - new Date(startTime).getTime());
                                        flightId = result.rows[i].flightId;
                                    }
                                }
                                let sql = 'SELECT timestamp, latitude, longitude, altitude from FLIGHTSTRACK where "flightId"=$1 order by timestamp';
                                let values = [flightId];
                                client.query(sql, values, function (err, result) {
                                    if (err) {
                                        console.log("Error while running query " + sql, err);
                                        callback(null, true);
                                    } else {
                                        let startTimeIndice = null;
                                        let endTimeIndice = null;
                                        for (let i = 0; i < result.rows.length; i++) {
                                            if (startTimeIndice == null && (new Date(startTime) <= result.rows[i].timestamp))
                                                startTimeIndice = i;

                                            if ((new Date(endTime) < result.rows[i].timestamp)) {
                                                endTimeIndice = i;
                                                break;
                                            }
                                        }

                                        if (startTimeIndice == 0) {
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

                                        if (endTimeIndice == 0) {
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

                function (flightFound, callback) {

                    if (flightFound == false) {
                        //2. if not found, is there any flights, with same flightNumber and less 20 hours total duration and less 12 hours apart
                        let sql = 'select "flightId", "startTimeMin", "startTimeMax", "firstLatitude", "firstLongitude", "midLatitude", "midLongitude", "lastLatitude", "lastLongitude" FROM FLIGHTS WHERE "flightNumber"=$1 and (    ("startTimeMin"<=$2 and "startTimeMax">=$2) or ("startTimeMin">$2  and "startTimeMin"<=$3 and "startTimeMax"<=$4) or ("startTimeMax"<$2  and "startTimeMax">=$5 and "startTimeMin">=$6))';
                        let values = [flightNumber, startTime, new Date(new Date(startTime).getTime() + 12 * hours), new Date(new Date(startTime).getTime() + 20 * hours), new Date(new Date(startTime).getTime() - 12 * hours), new Date(new Date(startTime).getTime() - 20 * hours)];

                        client.query(sql, values, function (err, result) {
                            if (err) {
                                console.log("Error while running query " + sql, err);
                                callback();
                            } else {
                                if (result.rows.length == 0) {
                                    let sql = 'insert into FLIGHTS("flightNumber", "startTimeMin", "startTimeMax", "firstLatitude", "firstLongitude", "midLatitude", "midLongitude", "lastLatitude", "lastLongitude") VALUES ($1, $2, $2, $3, $4, $3, $4, $3, $4) RETURNING "flightId"';
                                    let values = [flightNumber, startTime, latitude, longitude];
                                    client.query(sql, values, function (err, result) {
                                        if (err)
                                            console.log("Error while running query " + sql, err);
                                        //console.log("FLIGHT NO MATCH - inserting new flight with id = " + result.rows[0].flightId);
                                        callback();
                                    });
                                } else {
                                    let diff;
                                    let startTimeMin;
                                    let startTimeMax;
                                    let firstLatitude;
                                    let firstLongitude;
                                    let midLatitude;
                                    let midLongitude;
                                    let lastLatitude;
                                    let lastLongitude;

                                    for (let i = 0; i < result.rows.length; i++) {
                                        const startTimeMid = new Date(result.rows[i].startTimeMin.getTime() + ((result.rows[i].startTimeMax.getTime() - result.rows[i].startTimeMin.getTime()) / 2));
                                        if ((i === 0) || Math.abs(startTimeMid - new Date(startTime).getTime()) < diff) {
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
                                    let sql = 'update FLIGHTS set "startTimeMin"=$1, "startTimeMax"=$2, "firstLatitude"=$3, "firstLongitude"=$4, "midLatitude"=$5, "midLongitude"=$6, "lastLatitude"=$7, "lastLongitude"=$8 where "flightId"=$9';
                                    let values = [startTimeMin, startTimeMax, firstLatitude, firstLongitude, midLatitude, midLongitude, lastLatitude, lastLongitude, flightId];
                                    client.query(sql, values, function (err, result) {
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

                function () { //success
                    updateMeasurementFunc({
                        flightId,
                        refinedLatitude,
                        refinedLongitude,
                        refinedAltitude,
                        refinedEndLatitude,
                        refinedEndLongitude,
                        refinedEndAltitude,
                        flightSearch,
                        flightNumber
                    });
                }
            ],
            // Erreur
            function (err) {
                console.log('FAIL: ' + err.message);
                updateMeasurementFunc({
                    flightId,
                    refinedLatitude,
                    refinedLongitude,
                    refinedAltitude,
                    refinedEndLatitude,
                    refinedEndLongitude,
                    refinedEndAltitude,
                    flightSearch,
                    flightNumber
                });
            }
        );
    } else {
        updateMeasurementFunc({
            flightId,
            refinedLatitude,
            refinedLongitude,
            refinedAltitude,
            refinedEndLatitude,
            refinedEndLongitude,
            refinedEndAltitude,
            flightSearch,
            flightNumber
        });
    }
}

// Code to run if we're in the master process
if (cluster.isMaster) {

    const cpuCount = require('os').cpus().length;
    console.log(new Date().toISOString() + " - ****** OpenRadiation : cpuCount = " + cpuCount);
    // Create a worker for each CPU
    for (let i = 0; i < cpuCount; i += 1) {
        cluster.fork();
    }

    cluster.on('exit', function () {
        console.log('A worker process died, restarting...');
        cluster.fork();
    });

    let conStr = "postgres://" + properties.login + ":" + properties.password + "@" + properties.host + "/openradiation";
    let pool = new pg.Pool({
        connectionString: conStr,
    })

    majFlights = function () {
        pool.connect(function (err, client, done) {
            if (err) {
                console.log("Could not connect to PostgreSQL", err);
            } else {
                const sql = `
                    SELECT "reportUuid",
                           "measurementEnvironment",
                           "flightNumber",
                           "startTime",
                           "endTime",
                           "latitude",
                           "longitude"
                    FROM MEASUREMENTS
                    WHERE "measurementEnvironment" = 'plane'
                      AND "flightNumber" IS NOT NULL
                      AND "flightId" IS NULL
                      AND "startTime" >= NOW() - INTERVAL '10 days'
                `;
                client.query(sql, [], function (err, result) {
                    if (err) {
                        console.log("Error while running query " + sql, err);
                        done();
                    } else {
                        async.forEachSeries(result.rows, function (measure, callbackLoop) {
                            updateFlightInfos(client, measure.measurementEnvironment, measure.flightNumber, measure.startTime, measure.endTime, measure.latitude, measure.longitude, function (flightInfos) {
                                const sql = 'update MEASUREMENTS set "flightNumber"=$1, "flightId"=$2, "refinedLatitude"=$3, "refinedLongitude"=$4,"refinedAltitude"=$5,"refinedEndLatitude"=$6,"refinedEndLongitude"=$7, "refinedEndAltitude"=$8,"flightSearch"=$9 WHERE "reportUuid"=$10';
                                const values = [flightInfos.flightNumber, flightInfos.flightId, flightInfos.refinedLatitude, flightInfos.refinedLongitude, flightInfos.refinedAltitude, flightInfos.refinedEndLatitude, flightInfos.refinedEndLongitude, flightInfos.refinedEndAltitude, flightInfos.flightSearch, measure.reportUuid];
                                client.query(sql, values, function (err, result) {
                                    if (err)
                                        console.log("Error while running query " + sql, err);
                                    callbackLoop();
                                });
                            });
                        }, function (err) {
                            if (err)
                                console.log("Error " + err);
                            done();
                        });
                    }
                });
            }
        });
    }
    if (properties.submitApiFeature) {
        setInterval(majFlights, properties.flightSearchInterval);
    }

} else { // Code to run if we're in a worker process

    let conStr = "postgres://" + properties.login + ":" + properties.password + "@" + properties.host + "/openradiation";
    let pool = new pg.Pool({
        connectionString: conStr,
    })

    const itoa64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

    const app = express();
    app.use(bodyParser.json({strict: true, limit: '2mb'})); // enclosedObject shouldn't exceeded 1mb, but total space is higher with the base64 encoding
    app.use(bodyParser.urlencoded({extended: true}));

    const upload = multer({
        dest: __dirname + '/uploads/',
        storage: multer.memoryStorage(),
        limits: {files: 1, fileSize: 10 * 1000000}
    }); // security : limit file is 10 MB

    app.use(express.static(__dirname + '/public'));
    app.set('views', __dirname + '/views');

    app.all('*', function (req, res, next) {
        res.header("Access-Control-Allow-Origin", "*");
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
        next();
    });

//2. load apiKeys every ten minutes
    let apiKeys = [];
    let mutableOpenRadiationMapApiKey = ""; //the mutable apikey for openradiation map : it is mutable while it is visible in map

    let apiKeyTestCounter = 0;
    let apiKeyTestDate;

    getAPI = function () {
        //console.log(new Date().toISOString() + " - getAPI() : begin");
        pool.connect(function (err, client, done) {
            if (err) {
                done();
                console.error("Could not connect to PostgreSQL", err);
            } else {
                const sql = 'SELECT "apiKey","role" from APIKEYS';
                client.query(sql, [], function (err, result) {
                    done();
                    if (err)
                        console.error("Error while running query " + sql, err);
                    else {
                        apiKeys = result.rows;
                        for (let i = 0; i < apiKeys.length; i++) {
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
    let users = [];

    getUsers = function () {
        //console.log(new Date().toISOString() + " - getUsers() : begin");
        pool.connect(function (err, client, done) {
            if (err) {
                done();
                console.error("Could not connect to PostgreSQL", err);
            } else {
                const sql = 'SELECT "userId","userPwd" from APIUSERS';
                client.query(sql, [], function (err, result) {
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
    verifyApiKey = function (res, apiKey, adminOnly, isSubmitAPI) {
        // roles are the following :
        //      test    : only a few GET requests
        //      get     : only GET requests
        //      mutable : only GET request, may change in database
        //      put     : GET or PUT/POST request
        //      admin   : GET or PUT/POST request + admin role requests are admit
        for (let i = 0; i < apiKeys.length; i++) {
            if (apiKeys[i].apiKey == apiKey.toLowerCase()) //apiKey should be in lowercase in the database
            {
                if (adminOnly && apiKeys[i].role != "admin") {
                    res.status(401).json({
                        error: {
                            code: "103",
                            message: "apiKey is not valid for this restricted access"
                        }
                    });
                    return false;
                }

                if (isSubmitAPI && (apiKeys[i].role != "put" && apiKeys[i].role != "admin")) {
                    res.status(401).json({error: {code: "103", message: "apiKey is not valid for submitting data"}});
                    return false;
                }

                //test : if apiKey = test is called more often
                if (apiKeys[i].role == "test") {
                    const maintenant = new Date();
                    if (apiKeyTestDate == null || (apiKeyTestDate.getTime() + properties.APIKeyTestInterval) < maintenant.getTime()) {
                        apiKeyTestCounter = 1;
                        apiKeyTestDate = maintenant;
                    } else {
                        apiKeyTestCounter += 1;
                        if (apiKeyTestCounter > properties.APIKeyTestMaxCounter) {
                            res.status(401).json({
                                error: {
                                    code: "103",
                                    message: "Too much calls for the test apiKey ... Retry later"
                                }
                            });
                            return false;
                        }
                    }
                }

                pool.connect(function (err, client, done) {
                    if (err) {
                        done();
                        console.error("Could not connect to PostgreSQL", err);
                        return false;
                    } else {
                        let sql;
                        if (isSubmitAPI)
                            sql = 'UPDATE APIKEYS SET "submitAccessCount" = "submitAccessCount" + 1 WHERE "apiKey"=$1';
                        else
                            sql = 'UPDATE APIKEYS SET "requestAccessCount" = "requestAccessCount" + 1 WHERE "apiKey"=$1';
                        client.query(sql, [apiKey.toLowerCase()], function (err, result) {
                            done();
                            if (err) {
                                console.error("Error while running query " + sql, err);
                                return false;
                            }
                        });
                    }
                });
                return true;
            }
        }
        res.status(401).json({error: {code: "103", message: "apiKey is not a valid key"}});
        return false;
    };


//password_crypt impementation of the php drupal algorithm
//see https://api.drupal.org/api/drupal/includes!password.inc/function/_password_crypt/7
//to decrease computation time password are stored 10 to 12 minutes
    const passwords = {};
    deletePasswords = function () {
        //console.log(new Date().toISOString() + " - deletePasswords() : begin");
        for (let i in passwords) {
            const now = new Date();
            if (passwords[i].getTime() + 600000 < now.getTime())
                delete passwords[i];
        }
        //console.log(new Date().toISOString() + " - deletePasswords() : end");
    };
    setInterval(deletePasswords, 120000); //every 2 minutes

    function convertWordArrayToUint8Array(wordArray) {
        const len = wordArray.words.length,
            u8_array = new Uint8Array(len << 2);
        let offset = 0, word, i;
        for (i = 0; i < len; i++) {
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

        const count = input.length;
        let output = '';
        let i = 0;

        do {
            let value = input[i++];
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

    isPasswordValid = function (password, userPwd) {

        const passwordKey = password + userPwd;
        if (passwordKey in passwords) {
            passwords[passwordKey] = new Date();
            return true;
        }

        if (userPwd.length != 55 || userPwd.substring(0, 3) != "$S$") {
            console.error("isPasswordValid detect an invalid userPwd format");
            return false;
        }

        const count_log2 = itoa64.indexOf(userPwd.substring(3, 4));
        if (count_log2 < 0) {
            console.error("isPasswordValid detect an invalid userPwd");
            return false;
        }

        const password_wordArray = CryptoJS.enc.Utf8.parse(password);
        const salt = userPwd.substring(4, 12);
        let hash = SHA512(salt + password);
        const iterations = Math.pow(2, count_log2);

        for (let i = 0; i < iterations; i++) {
            hash = SHA512(hash.concat(password_wordArray));
        }
        const base64 = _password_base64_encode(convertWordArrayToUint8Array(hash));

        if (userPwd == userPwd.substring(0, 12) + base64.substr(0, 43)) {
            passwords[password + userPwd] = new Date();
            return true;
        } else {
            return false;
        }
    }

    logAndSendError = function (res, code, message) {
        console.log(`Error ${code}: ${message}`);
        res.status(400).json({error: {code: code, message: message}});
    }


    verifyData = function (res, json, isMandatory, dataName) {

        if (json[dataName] != null && typeof (json[dataName]) == "string" && json[dataName] == "")
            json[dataName] = null;

        if (isMandatory && json[dataName] == null) {
            logAndSendError(res, "101", `${dataName} is mandatory but undefined`);
            return false;
        }

        if (json[dataName] != null) {
            switch (dataName) {
                case "apparatusId":
                    if (typeof (json[dataName]) != "string" || json[dataName].length > 100) {
                        logAndSendError(res, "102", `${dataName} is not a string`);
                        return false;
                    }
                    break;
                case "apparatusVersion":
                    if (typeof (json[dataName]) != "string" || json[dataName].length > 100) {
                        logAndSendError(res, "102", `${dataName} is not a string`);
                        return false;
                    }
                    break;
                case "apparatusSensorType":
                    const apparatusSensorTypeValues = ["geiger", "photodiode"];
                    if (typeof (json[dataName]) != "string" || apparatusSensorTypeValues.indexOf(json[dataName]) == -1) {
                        logAndSendError(res, "102", `${dataName} should be in [geiger | photodiode]`);
                        return false;
                    }
                    break;
                case "apparatusTubeType":
                    if (typeof (json["apparatusSensorType"]) != "string" || json["apparatusSensorType"] != "geiger") {
                        logAndSendError(res, "102", `${dataName} can be defined only if apparatusSensorType is geiger`);
                        return false;
                    }
                    if (typeof (json[dataName]) != "string" || json[dataName].length > 100) {
                        logAndSendError(res, "102", `${dataName} is not a string`);
                        return false;
                    }
                    break;
                case "temperature":
                    if (typeof (json[dataName]) != "number" || parseFloat(json[dataName]) != parseInt(json[dataName])) {
                        logAndSendError(res, "102", `${dataName} is not an integer`);
                        return false;
                    }
                    break;
                case "minValue":
                case "maxValue":
                case "minLatitude":
                case "maxLatitude":
                case "minLongitude":
                case "maxLongitude":
                    if (typeof (json[dataName]) != "string" || isNaN(json[dataName])) {
                        logAndSendError(res, "102", `${dataName} is not a number ${json[dataName]}`);
                        return false;
                    }
                    break;
                case "value":
                    if (typeof (json[dataName]) != "number") {
                        logAndSendError(res, "102", `${dataName} is not a number ${typeof (json[dataName])}`);
                        return false;
                    }
                    break;
                case "hitsNumber":
                    if (typeof (json[dataName]) != "number" || parseFloat(json[dataName]) != parseInt(json[dataName])) {
                        logAndSendError(res, "102", `${dataName} is not an integer`);
                        return false;
                    }
                    break;
                case "dateOfCreation":
                case "MonthOfCreation":
                case "minStartTime":
                case "maxStartTime":
                case "endTime":
                    if (typeof (json[dataName]) != "string" || new Date(json[dataName]) == "Invalid Date") {
                        logAndSendError(res, "102", `${dataName} is not a date`);
                        return false;
                    }
                    break;
                case "startTime":
                    if (typeof (json[dataName]) != "string" || new Date(json[dataName]) == "Invalid Date") {
                        logAndSendError(res, "102", `${dataName} is not a reliable date`);
                        return false;
                    }
                    const now = new Date();
                    if ((new Date(json[dataName])).getTime() > (now.getTime() + 86400000)) {
                        logAndSendError(res, "102", `${dataName} is not a real date`);
                        return false;
                    }
                    break;
                case "latitude":
                case "endLatitude":
                case "longitude":
                case "endLongitude":
                case "accuracy":
                case "endAccuracy":
                case "altitudeAccuracy":
                case "endAltitudeAccuracy":
                    if (typeof (json[dataName]) != "number") {
                        logAndSendError(res, "102", `${dataName} is not a number`);
                        return false;
                    }
                    break;
                case "altitude":
                case "endAltitude":
                    if (typeof (json[dataName]) != "number" || parseFloat(json[dataName]) != parseInt(json[dataName])) {
                        logAndSendError(res, "102", `${dataName} is not an integer`);
                        return false;
                    }
                    break;
                case "deviceUuid":
                case "devicePlatform":
                case "deviceVersion":
                case "deviceModel":
                case "calibrationFunction":
                    if (typeof (json[dataName]) != "string" || json[dataName].length > 100) {
                        logAndSendError(res, "102", `${dataName} is not a string`);
                        return false;
                    }
                    break;
                case "reportUuid": //sample 110e8400-e29b-11d4-a716-446655440000
                    if (typeof (json[dataName]) != "string" || json[dataName].length != 36 || /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(json[dataName]) == false) {
                        logAndSendError(res, "102", `${dataName} is not a UUID format`);
                        return false;
                    }
                    break;
                case "manualReporting":
                case "rain":
                case "storm":
                    if (typeof (json[dataName]) != "boolean") {
                        logAndSendError(res, "102", `${dataName} is not a boolean`);
                        return false;
                    }
                    break;
                case "flightNumber":
                case "seatNumber":
                    if (typeof (json["measurementEnvironment"]) != "string" || json["measurementEnvironment"] != "plane") {
                        logAndSendError(res, "102", `${dataName} can be defined only if measurementEnvironment is plane`);
                        return false;
                    }
                    if (typeof (json[dataName]) != "string" || json[dataName].length > 25) {
                        logAndSendError(res, "102", `${dataName} is not a string`);
                        return false;
                    }
                    break;
                case "windowSeat":
                    if (typeof (json["measurementEnvironment"]) != "string" || json["measurementEnvironment"] != "plane") {
                        logAndSendError(res, "102", `${dataName} can be defined only if measurementEnvironment is plane`);
                        return false;
                    }
                    if (typeof (json[dataName]) != "boolean") {
                        logAndSendError(res, "102", `${dataName} is not a boolean`);
                        return false;
                    }
                    break;
                case "organisationReporting":
                    if (typeof (json[dataName]) != "string" || json[dataName].length > 100) {
                        logAndSendError(res, "102", `${dataName} is not a string`);
                        return false;
                    }
                    break;
                case "reportContext":
                    const reportContextValues = ["emergency", "routine", "exercise", "test"];
                    if (typeof (json[dataName]) != "string" || reportContextValues.indexOf(json[dataName]) == -1) {
                        logAndSendError(res, "102", `${dataName} should be in [emergency | routine | exercise | test]`);
                        return false;
                    }
                    break;
                case "description":
                    if (typeof (json[dataName]) != "string" || json[dataName].length > 1000) {
                        logAndSendError(res, "102", `${dataName} is not a string`);
                        return false;
                    }
                    if (json["userId"] == null) {
                        logAndSendError(res, "102", `${dataName} can be defined only if userId is defined`);
                        return false;
                    }
                    break;
                case "measurementHeight":
                    if (typeof (json[dataName]) != "number" || parseFloat(json[dataName]) != parseInt(json[dataName])) {
                        logAndSendError(res, "102", `${dataName} is not an integer`);
                        return false;
                    }
                    break;
                case "tag":
                    if (typeof (json[dataName]) != "string" || json[dataName].length > 100) {
                        logAndSendError(res, "102", `${dataName} is not a string`);
                        return false;
                    }
                    break;
                case "tags":
                    if (!(json[dataName] instanceof Array) || json[dataName].length > 10) {
                        logAndSendError(res, "102", `${dataName} should be an array from ten elements max`);
                        return false;
                    }
                    for (let i = 0; i < json[dataName].length; i++) {
                        if (typeof (json[dataName][i]) != "string" || json[dataName][i].length > 100 || json[dataName][i].replace(/#/g, "") == "") {
                            logAndSendError(res, "102", `${dataName} contains an element which is too long or is not a filled string`);
                            return false;
                        }
                        for (let j = 0; j < json[dataName].length; j++) {
                            if (j < i && json[dataName][i].toLowerCase().replace(/#/g, "") == json[dataName][j].toLowerCase().replace(/#/g, "")) {
                                logAndSendError(res, "102", `${dataName} contains several elements with the same value`);
                                return false;
                            }
                        }
                    }
                    if (json["userId"] == null) {
                        logAndSendError(res, "102", `${dataName} can be defined only if userId is defined`);
                        return false;
                    }
                    break;
                case "enclosedObject":
                    if (typeof (json[dataName]) != "string" || /data:image\/.*;base64,.*/.test(json[dataName].substr(0, 50)) == false) //data:image/<subtype>;base64,
                    {
                        logAndSendError(res, "102", `${dataName} is not a data URI scheme with base64 encoded image`);
                        return false;
                    }
                    if (json["userId"] == null) {
                        logAndSendError(res, "102", `${dataName} can be defined only if userId is defined`);
                        return false;
                    }
                    break;
                case "userId_request":
                    if (typeof (json["userId"]) != "string" || json["userId"].length > 100) {
                        logAndSendError(res, "102", `${dataName} is not a string`);
                        return false;
                    }
                    break;
                case "userId":
                    if (typeof (json[dataName]) != "string" || json[dataName].length > 100) {
                        logAndSendError(res, "102", `${dataName} is not a string`);
                        return false;
                    }
                    if (json["userPwd"] == null) {
                        logAndSendError(res, "102", `${dataName} can be defined only if userPwd is defined`);
                        return false;
                    }
                    break;
                case "userPwd":
                    if (typeof (json[dataName]) != "string" || json[dataName].length > 100) {
                        logAndSendError(res, "102", `${dataName} is not a string`);
                        return false;
                    }
                    if (json["userId"] == null) {
                        logAndSendError(res, "102", `${dataName} can be defined only if userId is defined`);
                        return false;
                    }
                    for (let i = 0; i < users.length; i++) {
                        if (users[i].userId == json["userId"]) {
                            if (isPasswordValid(json["userPwd"], users[i].userPwd)) //userPwd is encrypted with openradiation.org method and compared to stored encrypted password
                                return true;
                            else
                                break;
                        }
                    }
                    logAndSendError(res, "102", "credentials userId / userPwd are not valid");
                    return false;
                case "measurementEnvironment":
                    const measurementEnvironmentValues = ["countryside", "city", "ontheroad", "inside", "plane"];
                    if (typeof (json[dataName]) != "string" || measurementEnvironmentValues.indexOf(json[dataName]) == -1) {
                        logAndSendError(res, "102", `${dataName} should be in [countryside | city | ontheroad | inside | plane]`);
                        return false;
                    }
                    break;
                case "qualification":
                    const qualificationValues = ["groundlevel", "plane", "wrongmeasurement", "temporarysource"];
                    if (typeof (json[dataName]) != "string" || qualificationValues.indexOf(json[dataName]) == -1) {
                        logAndSendError(res, "102", `${dataName} should be in [groundlevel | plane | wrongmeasurement | temporarysource]`);
                        return false;
                    }
                    break;
                case "qualificationVotesNumber":
                    if (typeof (json[dataName]) != "number" || parseFloat(json[dataName]) != parseInt(json[dataName]) || parseInt(json[dataName]) < 1) {
                        logAndSendError(res, "102", `${dataName} is not a positive integer`);
                        return false;
                    }
                    break;
                case "response":
                    if (typeof (json[dataName]) != "string" || json[dataName] != "complete") {
                        logAndSendError(res, "102", `${dataName} should be in [complete]`);
                        return false;
                    }
                    break;
                case "withEnclosedObject":
                    if (typeof (json[dataName]) != "string" || json[dataName] != "no") {
                        logAndSendError(res, "102", `${dataName} should be in [no]`);
                        return false;
                    }
                    break;
                case "flightId":
                    if (typeof (json[dataName]) != "string" || isNaN(json[dataName]) || parseFloat(json[dataName]) != parseInt(json[dataName])) {
                        logAndSendError(res, "102", `${dataName} is not an integer`);
                        return false;
                    }
                    break;
                case "maxNumber":
                    if (typeof (json[dataName]) != "string" || isNaN(json[dataName]) || parseFloat(json[dataName]) != parseInt(json[dataName]) || parseInt(json[dataName]) < 1) {
                        logAndSendError(res, "102", `${dataName} is not a positive integer`);
                        return false;
                    }
                    break;
                case "atypical":
                    if (typeof (json[dataName]) != "string" || (json[dataName] != "true" && json[dataName] != "false")) {
                        logAndSendError(res, "102", `${dataName} is not a boolean`);
                        return false;
                    }
                    break;
                case "feedback" :
                    let isValidMessage = true;
                    let messages = req.body.data.Messages;
                    isValidMessage &= (messages instanceof Array && messages.length != 1);
                    let message = messages[0];
                    isValidMessage &= message.From && message.From.Email;
                    isValidMessage &= message.To && message.To.length >= 1 && message.To.lenght < 3;
                    isValidMessage &= message.Subject;
                    isValidMessage &= message.TextPart;
                    if (!isValidMessage) {
                        res.status(400).json({error: {code: "102", message: "Invalid feedback message"}});
                        return false;
                    }
                    break;
                default: {
                    console.error("Internal error in verifyValue");
                    res.status(500).end();
                    return false;
                }
            }
        }
        return true;
    };

// return preferred language in req request
    getLanguage = function (req) {
        if (req.acceptsLanguages('fr', 'en') == "fr")
            return "fr";
        else
            return "en";
    }

//5. request API
    if (properties.requestApiFeature) {
        app.get('/measurements/:reportUuid', function (req, res, next) {
            console.log(new Date().toISOString() + " - GET /measurements/:reportUuid : begin");
            if (typeof (req.query.apiKey) != "string") {
                res.status(400).json({error: {code: "100", message: "You must send the apiKey parameter"}});
            } else {
                if (verifyApiKey(res, req.query.apiKey, false, false)
                    && verifyData(res, req.query, false, "response")
                    && verifyData(res, req.query, false, "withEnclosedObject")) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            let sql;
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

                            const values = [req.params.reportUuid];
                            client.query(sql, values, function (err, result) {
                                done();
                                if (err) {
                                    console.error("Error while running query " + sql + values, err);
                                    res.status(500).end();
                                } else {
                                    if (result.rowCount == 0)
                                        res.status(400).json({
                                            error: {
                                                code: "104",
                                                message: "reportUuid does not exists"
                                            }
                                        });
                                    else {
                                        const data = result.rows[0];

                                        if (req.query.response != null) {
                                            data.tags = [];
                                            for (let i = 0; i < result.rows.length; i++) {
                                                if (result.rows[i].tag != null)
                                                    data.tags.push(result.rows[i].tag)
                                            }
                                            if (data.tags.length == 0)
                                                delete data.tags;
                                        }

                                        delete data.tag;
                                        for (let i in data) {
                                            if (data[i] == null)
                                                delete data[i];
                                        }

                                        res.json({data: data});
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
            if (typeof (req.query.apiKey) != "string") {
                res.status(400).json({error: {code: "100", message: "You must send the apiKey parameter"}});
            } else {
                if (verifyApiKey(res, req.query.apiKey, false, false)
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
                    && verifyData(res, req.query, false, "maxNumber")) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            let sql;
                            let limit = properties.maxNumber;
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

                            let where = '';
                            const values = [];
                            if (req.query.minLatitude != null) {
                                values.push(req.query.minLatitude);
                                where += ' AND MEASUREMENTS."latitude" >= $' + values.length;
                            }
                            if (req.query.maxLatitude != null) {
                                values.push(req.query.maxLatitude);
                                where += ' AND MEASUREMENTS."latitude" <= $' + values.length;
                            }
                            if (req.query.minLongitude != null) {
                                values.push(req.query.minLongitude);
                                where += ' AND MEASUREMENTS."longitude" >= $' + values.length;
                            }
                            if (req.query.maxLongitude != null) {
                                values.push(req.query.maxLongitude);
                                where += ' AND MEASUREMENTS."longitude" <= $' + values.length;
                            }
                            if (req.query.minStartTime != null) {
                                values.push(new Date(req.query.minStartTime));
                                where += ' AND MEASUREMENTS."startTime" >= $' + values.length;
                            }
                            if (req.query.maxStartTime != null) {
                                values.push(new Date(req.query.maxStartTime));
                                where += ' AND MEASUREMENTS."startTime" <= $' + values.length;
                            }
                            if (req.query.minValue != null) {
                                values.push(req.query.minValue);
                                where += ' AND MEASUREMENTS."value" >= $' + values.length;
                            }
                            if (req.query.maxValue != null) {
                                values.push(req.query.maxValue);
                                where += ' AND MEASUREMENTS."value" <= $' + values.length;
                            }
                            if (req.query.userId != null) {
                                values.push(req.query.userId);
                                where += ' AND MEASUREMENTS."userId" = $' + values.length;
                            }
                            if (req.query.qualification != null) {
                                values.push(req.query.qualification);
                                where += ' AND MEASUREMENTS."qualification" = $' + values.length;
                            }
                            if (req.query.tag != null) {
                                values.push(req.query.tag.toLowerCase().replace(/#/g, ""));
                                where += ' AND TAGS."tag" = $' + values.length;
                            }
                            if (req.query.atypical != null) {
                                values.push(req.query.atypical);
                                where += ' AND MEASUREMENTS."atypical" = $' + values.length;
                            }
                            if (req.query.flightId != null) {
                                values.push(req.query.flightId);
                                where += ' AND MEASUREMENTS."flightId" = $' + values.length;
                            }
                            if (req.query.dateOfCreation != null) {
                                const date = new Date(req.query.dateOfCreation);
                                const date1 = new Date(date.toDateString());
                                const date2 = new Date(date1);
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

                            client.query(sql, values, function (err, result) {
                                if (err) {
                                    done();
                                    console.error("Error while running query " + sql + values, err);
                                    res.status(500).end();
                                } else {
                                    const data = [];

                                    //methode 1 : with where
                                    if (req.query.response == null || result.rows.length == 0) // no need to retrieve tags
                                    {
                                        done();
                                        for (let r = 0; r < result.rows.length; r++) {
                                            data.push(result.rows[r]);

                                            for (let i in data[data.length - 1]) {
                                                if (data[data.length - 1][i] == null)
                                                    delete data[data.length - 1][i];
                                            }
                                        }
                                        res.json({maxNumber: limit, data: data});
                                    } else { // here we do an other request to retrieve tags
                                        let sql = 'select "reportUuid", "tag" FROM TAGS WHERE "reportUuid" IN (';
                                        for (let r = 0; r < result.rows.length; r++) {
                                            if (r == 0)
                                                sql += "'" + result.rows[r].reportUuid + "'";
                                            else
                                                sql += ",'" + result.rows[r].reportUuid + "'";
                                        }
                                        sql += ') ORDER BY "reportUuid"';
                                        client.query(sql, [], function (err, result2) {
                                            done();
                                            if (err) {
                                                console.error("Error while running query " + sql, err);
                                                res.status(500).end();
                                            } else {
                                                const tmp_tags = {};
                                                for (let t = 0; t < result2.rows.length; t++) {
                                                    if (tmp_tags[result2.rows[t].reportUuid] == null)
                                                        tmp_tags[result2.rows[t].reportUuid] = [];
                                                    tmp_tags[result2.rows[t].reportUuid].push(result2.rows[t].tag);
                                                }

                                                for (let r = 0; r < result.rows.length; r++) {
                                                    data.push(result.rows[r]);
                                                    if (tmp_tags[result.rows[r].reportUuid] != null)
                                                        data[data.length - 1].tags = tmp_tags[result.rows[r].reportUuid];

                                                    for (let i in data[data.length - 1]) {
                                                        if (data[data.length - 1][i] == null)
                                                            delete data[data.length - 1][i];
                                                    }
                                                }
                                                res.json({maxNumber: limit, data: data});
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    });
                }
            }
            console.log(new Date().toISOString() + " - GET /measurements : end");
        });
        app.get('/measurmentsStatisticsTotal', function (req, res, next) {
            console.log(new Date().toISOString() + " - GET /measurmentsStatisticsTotal : begin");
            if (typeof (req.query.apiKey) != "string") {
                res.status(400).json({error: {code: "100", message: "You must send the apiKey parameter"}});
            } else {
                if (verifyApiKey(res, req.query.apiKey, false, false)) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            let sql = `select count("value")
                                       from measurements`;

                            let where = '';
                            const values = [];

                            if (req.query.userId != null) {
                                values.push(req.query.userId);
                                where += ' WHERE MEASUREMENTS."userId" = $' + values.length;
                            }

                            sql += where;

                            client.query(sql, values, function (err, result) {
                                if (err) {
                                    done();
                                    console.error("Error while running query " + sql + values, err);
                                    res.status(500).end();
                                } else {
                                    done();
                                    if (result.rows.length === 1) {
                                        res.json(result.rows[0].count);
                                    } else {
                                        res.json(0);
                                    }
                                }
                            });
                        }
                    });
                }
            }
            console.log(new Date().toISOString() + " - GET /measurmentsStatisticsTotal : end")
        });
        app.get('/measurmentsStatisticsByInterval', function (req, res, next) {
            console.log(new Date().toISOString() + " - GET /measurmentsStatisticsByInterval : begin");
            if (typeof (req.query.apiKey) != "string") {
                res.status(400).json({error: {code: "100", message: "You must send the apiKey parameter"}});
            } else {
                if (verifyApiKey(res, req.query.apiKey, false, false)) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            let sql = "";
                            let intervals = ['0.025', '0.050', '0.075', '0.100'];
                            let qualification = ['\'groundlevel\'', '\'plane\''];
                            const labels = {};

                            if (req.body.intervals != null) {
                                intervals = req.body.intervals;
                            }

                            if (req.body.qualification != null) {
                                qualification = req.body.qualification;
                            }

                            const qualificationWhere = qualification.map(function (val, i) {
                                return "\'" + val + "\'";
                            });

                            let key = 'val_0';
                            labels[key] = "0-" + intervals[0];
                            sql = 'select count(value) filter (where "value" <= ' + intervals[0] + ' and qualification IN (' + qualificationWhere + ')) as ' + key;
                            for (let i = 0; i < intervals.length - 1; i++) {
                                key = 'val_' + (i + 1);
                                sql = sql + ', ' + 'count(value) filter (where "value" between ' + intervals[i] + ' and ' + intervals[i + 1] + ' and qualification IN (' + qualificationWhere + ')) as ' + key;
                                labels[key] = intervals[i] + "-" + intervals[i + 1];
                            }
                            key = 'val_' + intervals.length;
                            sql = sql + ', ' + 'count(value) filter (where "value" >  ' + intervals[intervals.length - 1] + ' and qualification IN (' + qualificationWhere + ')) as ' + key;
                            sql = sql + ' from measurements;';
                            labels[key] = intervals[intervals.length - 1] + " et +";

                            const values = [];
                            client.query(sql, values, function (err, result) {
                                if (err) {
                                    done();
                                    console.error("Error while running query " + sql + values, err);
                                    res.status(500).end();
                                } else {
                                    done();
                                    if (result.rows.length === 1) {
                                        res.json({
                                            elements: result.rows[0],
                                            labels: labels,
                                            qualification: qualification
                                        });
                                    } else {
                                        res.json(0);
                                    }
                                }
                            });
                        }
                    });
                }
            }
            console.log(new Date().toISOString() + " - GET /measurmentsStatisticsByInterval : end")
        });
        app.get('/flights', function (req, res, next) {
            console.log(new Date().toISOString() + " - GET /flights : begin");
            if (typeof (req.query.apiKey) != "string") {
                res.status(400).json({error: {code: "100", message: "You must send the apiKey parameter"}});
            } else {
                if (verifyApiKey(res, req.query.apiKey, false, false)) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            const sql = 'SELECT "flightId", "flightNumber", "departureTime", "arrivalTime", "airportOrigin", "airportDestination", "aircraftType", "firstLatitude", "firstLongitude", "midLatitude", "midLongitude", "lastLatitude", "lastLongitude" FROM FLIGHTS ORDER BY "flightId"';
                            const values = [];
                            client.query(sql, values, function (err, result) {
                                if (err) {
                                    done();
                                    console.error("Error while running query " + sql + values, err);
                                    res.status(500).end();
                                } else {
                                    const data = [];
                                    done();
                                    for (let r = 0; r < result.rows.length; r++) {
                                        data.push(result.rows[r]);

                                        for (let i in data[data.length - 1]) {
                                            if (data[data.length - 1][i] == null)
                                                delete data[data.length - 1][i];
                                        }
                                    }
                                    res.json({data: data});
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
            if (typeof (req.query.apiKey) != "string") {
                res.status(400).json({error: {code: "100", message: "You must send the apiKey parameter"}});
            } else {
                if (verifyApiKey(res, req.query.apiKey, false, false)) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            const sql = 'SELECT DISTINCT ON (MEASUREMENTS."userId") MEASUREMENTS."userId", MEASUREMENTS."latitude", MEASUREMENTS."longitude", "endTime" FROM MEASUREMENTS WHERE "endTime" IS NOT NULL ORDER BY MEASUREMENTS."userId" ASC, "endTime" DESC';
                            const values = [];
                            client.query(sql, values, function (err, result) {
                                if (err) {
                                    done();
                                    console.error("Error while running query " + sql + values, err);
                                    res.status(500).end();
                                } else {
                                    const data = [];
                                    done();
                                    for (let r = 0; r < result.rows.length; r++) {
                                        data.push(result.rows[r]);
                                        for (let i in data[data.length - 1]) {
                                            if (data[data.length - 1][i] == null)
                                                delete data[data.length - 1][i];
                                        }
                                    }
                                    res.json({data: data});
                                }
                            });
                        }
                    });
                }
            }
            console.log(new Date().toISOString() + " - GET /users : end")
        });
        app.get('/usersStatisticsTotal', function (req, res, next) {
            console.log(new Date().toISOString() + " - GET /usersStatisticsTotal : begin");
            if (typeof (req.query.apiKey) != "string") {
                res.status(400).json({error: {code: "100", message: "You must send the apiKey parameter"}});
            } else {
                if (verifyApiKey(res, req.query.apiKey, false, false)) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            const sql = `select count(distinct "userId")
                                         from measurements`;
                            const values = [];
                            client.query(sql, values, function (err, result) {
                                if (err) {
                                    done();
                                    console.error("Error while running query " + sql + values, err);
                                    res.status(500).end();
                                } else {
                                    done();
                                    if (result.rows.length === 1) {
                                        res.json(result.rows[0].count);
                                    } else {
                                        res.json(0);
                                    }
                                }
                            });
                        }
                    });
                }
            }
            console.log(new Date().toISOString() + " - GET /usersStatisticsTotal : end")
        });
        app.get('/qualificationMeasurements', function (req, res, next) {
            console.log(new Date().toISOString() + " - GET /qualificationMeasurements : begin");
            if (typeof (req.query.apiKey) != "string") {
                res.status(400).json({error: {code: "100", message: "You must send the apiKey parameter"}});
            } else {
                if (verifyApiKey(res, req.query.apiKey, false, false)) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            const sql = `SELECT "measurementEnvironment", count("value")
                                         FROM MEASUREMENTS
                                         GROUP BY "measurementEnvironment"`;

                            const values = [];
                            client.query(sql, values, function (err, result) {
                                if (err) {
                                    done();
                                    console.error("Error while running query " + sql + values, err);
                                    res.status(500).end();
                                } else {
                                    const data = [];
                                    done();
                                    for (let r = 0; r < result.rows.length; r++) {
                                        data.push(result.rows[r]);

                                        for (let i in data[data.length - 1]) {
                                            if (data[data.length - 1][i] == null)
                                                delete data[data.length - 1][i];
                                        }
                                    }
                                    res.json({data: data});
                                }
                            });
                        }
                    });
                }
            }
            console.log(new Date().toISOString() + " - GET /qualificationMeasurements : end")
        });
        app.get('/lastMeasureOfAllUsers', function (req, res, next) {
            console.log(new Date().toISOString() + " - GET /lastMeasureOfAllUsers : begin");
            if (typeof (req.query.apiKey) != "string") {
                res.status(400).json({error: {code: "100", message: "You must send the apiKey parameter"}});
            } else {
                if (verifyApiKey(res, req.query.apiKey, false, false)) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            const sql = `SELECT DISTINCT
                                         ON (MEASUREMENTS."userId") MEASUREMENTS."userId", "value", "longitude", "latitude"
                                         FROM MEASUREMENTS LEFT JOIN APIUSERS
                                         ON APIUSERS."userId" = MEASUREMENTS."userId"
                                         WHERE "endTime" IS NOT NULL
                                         ORDER BY MEASUREMENTS."userId" ASC, "startTime" DESC`;

                            const values = [];
                            client.query(sql, values, function (err, result) {
                                if (err) {
                                    done();
                                    console.error("Error while running query " + sql + values, err);
                                    res.status(500).end();
                                } else {
                                    const data = [];
                                    done();
                                    for (let r = 0; r < result.rows.length; r++) {
                                        data.push(result.rows[r]);

                                        for (let i in data[data.length - 1]) {
                                            if (data[data.length - 1][i] == null)
                                                delete data[data.length - 1][i];
                                        }
                                    }
                                    res.json({data: data});
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
            if (typeof (req.query.apiKey) != "string") {
                res.status(400).json({error: {code: "100", message: "You must send the apiKey parameter"}});
            } else {
                if (verifyApiKey(res, req.query.apiKey, false, false)
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
                    && verifyData(res, req.query, false, "maxNumber")) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            let sql;
                            let limit = 100;
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

                            let where = '';
                            const values = [];


                            if (req.query.maxStartTime != null) {
                                values.push(new Date(req.query.maxStartTime));
                                where += ' AND MEASUREMENTS."startTime" <= $' + values.length;
                            }
                            if (req.query.minValue != null) {
                                values.push(req.query.minValue);
                                where += ' AND MEASUREMENTS."value" >= $' + values.length;
                            }
                            if (req.query.maxValue != null) {
                                values.push(req.query.maxValue);
                                where += ' AND MEASUREMENTS."value" <= $' + values.length;
                            }
                            if (req.query.userId != null) {
                                values.push(req.query.userId);
                                where += ' AND MEASUREMENTS."userId" = $' + values.length;
                            }

                            if (req.query.dateOfMeasurement != null) {
                                const date = new Date(req.query.dateOfMeasurement);
                                const date1 = new Date(date.toDateString());
                                const date2 = new Date(date1);
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

                            client.query(sql, values, function (err, result) {
                                if (err) {
                                    done();
                                    console.error("Error while running query " + sql + values, err);
                                    res.status(500).end();
                                } else {
                                    const data = [];

                                    //methode 1 : with where
                                    if (req.query.response == null || result.rows.length == 0) // no need to retrieve tags
                                    {
                                        done();
                                        for (let r = 0; r < result.rows.length; r++) {
                                            data.push(result.rows[r]);

                                            for (let i in data[data.length - 1]) {
                                                if (data[data.length - 1][i] == null)
                                                    delete data[data.length - 1][i];
                                            }
                                        }
                                        res.json({maxNumber: limit, data: data});
                                    } else { // here we do an other request to retrieve tags
                                        let sql = 'select "reportUuid", "tag" FROM TAGS WHERE "reportUuid" IN (';
                                        for (let r = 0; r < result.rows.length; r++) {
                                            if (r == 0)
                                                sql += "'" + result.rows[r].reportUuid + "'";
                                            else
                                                sql += ",'" + result.rows[r].reportUuid + "'";
                                        }
                                        sql += ') ORDER BY "reportUuid"';
                                        client.query(sql, [], function (err, result2) {
                                            done();
                                            if (err) {
                                                console.error("Error while running query " + sql, err);
                                                res.status(500).end();
                                            } else {
                                                const tmp_tags = {};
                                                for (let t = 0; t < result2.rows.length; t++) {
                                                    if (tmp_tags[result2.rows[t].reportUuid] == null)
                                                        tmp_tags[result2.rows[t].reportUuid] = [];
                                                    tmp_tags[result2.rows[t].reportUuid].push(result2.rows[t].tag);
                                                }

                                                for (let r = 0; r < result.rows.length; r++) {
                                                    data.push(result.rows[r]);
                                                    if (tmp_tags[result.rows[r].reportUuid] != null)
                                                        data[data.length - 1].tags = tmp_tags[result.rows[r].reportUuid];

                                                    for (let i in data[data.length - 1]) {
                                                        if (data[data.length - 1][i] == null)
                                                            delete data[data.length - 1][i];
                                                    }
                                                }
                                                res.json({maxNumber: limit, data: data});
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
            if (typeof (req.body.apiKey) != "string" || typeof (req.body.data) != "object") {
                console.dir(req.body);
                console.log("You must send a JSON with a string apiKey and an object data");
                res.status(400).json({
                    error: {
                        code: "100",
                        message: "You must send a JSON with a string apiKey and an object data"
                    }
                });
            } else {
                console.log(req.body.apiKey);
                var userPwd = req.body.data.userPwd;
                if (req.body.data && req.body.data.userPwd) {
                    var userPwd = req.body.data.userPwd;
                    req.body.data.userPwd = '********';
                    console.log(req.body.data);
                    req.body.data.userPwd = userPwd;
                } else {
                    console.log(req.body.data);
                }
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
                    && verifyData(res, req.body.data, false, "storm")) {
                    if (req.body.data.reportContext != null && req.body.data.reportContext == "routine") {
                        pool.connect(function (err, client, done) {
                            if (err) {
                                done();
                                console.error("Could not connect to PostgreSQL", err);
                                res.status(500).end();
                            } else {

                                //updateFlightInfos(client, req.body.data.measurementEnvironment, req.body.data.flightNumber, req.body.data.startTime, req.body.data.endTime, req.body.data.latitude, req.body.data.longitude, function(flightInfos) {

                                const sql = 'INSERT INTO MEASUREMENTS ("apparatusId","apparatusVersion","apparatusSensorType","apparatusTubeType","temperature","value","hitsNumber","calibrationFunction","startTime","endTime", \
                                           "latitude","longitude","accuracy","altitude","altitudeAccuracy","endLatitude","endLongitude","endAccuracy","endAltitude","endAltitudeAccuracy","deviceUuid","devicePlatform","deviceVersion","deviceModel","reportUuid","manualReporting", \
                                           "organisationReporting","reportContext","description","measurementHeight","enclosedObject","userId","measurementEnvironment","rain","flightNumber","seatNumber","windowSeat","storm", \
                                           "flightId","refinedLatitude","refinedLongitude","refinedAltitude","refinedEndLatitude","refinedEndLongitude","refinedEndAltitude","flightSearch", "dateAndTimeOfCreation", \
                                           "qualification","qualificationVotesNumber","reliability","atypical") VALUES \
                                           ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49, $50, $51)';

                                const manualReporting = req.body.data.manualReporting == null ? true : req.body.data.manualReporting;
                                let reliability = 0;
                                //+1 for each filled field
                                if (req.body.data.apparatusId != null)
                                    reliability += 1;
                                if (req.body.data.apparatusVersion != null)
                                    reliability += 1;
                                if (req.body.data.apparatusSensorType != null)
                                    reliability += 1;
                                if (req.body.data.apparatusTubeType != null)
                                    reliability += 1;
                                if (req.body.data.temperature != null)
                                    reliability += 1;
                                if (req.body.data.value != null)
                                    reliability += 1;
                                if (req.body.data.hitsNumber != null)
                                    reliability += 1;
                                if (req.body.data.startTime != null)
                                    reliability += 1;
                                if (req.body.data.endTime != null)
                                    reliability += 1;
                                if (req.body.data.latitude != null)
                                    reliability += 1;
                                if (req.body.data.longitude != null)
                                    reliability += 1;
                                if (req.body.data.accuracy != null)
                                    reliability += 1;
                                if (req.body.data.altitude != null)
                                    reliability += 1;
                                if (req.body.data.altitudeAccuracy != null)
                                    reliability += 1;
                                if (req.body.data.deviceUuid != null)
                                    reliability += 1;
                                if (req.body.data.devicePlatform != null)
                                    reliability += 1;
                                if (req.body.data.deviceVersion != null)
                                    reliability += 1;
                                if (req.body.data.deviceModel != null)
                                    reliability += 1;
                                if (req.body.data.reportUuid != null)
                                    reliability += 1;
                                if (req.body.data.manualReporting != null)
                                    reliability += 1;
                                if (req.body.data.organisationReporting != null)
                                    reliability += 1;
                                if (req.body.data.reportContext != null)
                                    reliability += 1;
                                if (req.body.data.description != null)
                                    reliability += 1;
                                if (req.body.data.measurementHeight != null)
                                    reliability += 1;
                                if (req.body.data.tags != null)
                                    reliability += 1;
                                if (req.body.data.enclosedObject != null)
                                    reliability += 1;
                                if (req.body.data.userId != null)
                                    reliability += 1;
                                if (req.body.data.userPwd != null)
                                    reliability += 1;
                                if (req.body.data.measurementEnvironment != null)
                                    reliability += 1;
                                // + min(30,hitsNumber) if hitsNumber not null,
                                if (req.body.data.hitsNumber != null) {
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
                                if (req.body.data.measurementEnvironment != null) {
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
                                let qualification = "groundlevel";
                                const qualificationVotesNumber = 0;
                                if (req.body.data.measurementEnvironment != null && req.body.data.measurementEnvironment == "plane")
                                    qualification = "plane";

                                const atypical = req.body.data.value >= 0.2;
                                const dateAndTimeOfCreation = new Date();
                                const values = [req.body.data.apparatusId, req.body.data.apparatusVersion, req.body.data.apparatusSensorType, req.body.data.apparatusTubeType,
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

                                client.query(sql, values, function (err, result) {
                                    if (err) {
                                        done();
                                        if (err.code == "23505")
                                            res.status(400).json({
                                                error: {
                                                    code: "104",
                                                    message: "duplicate key : reportUuid already exists"
                                                }
                                            });
                                        else {
                                            console.error("Error while running query " + sql + values, err);
                                            res.status(500).end();
                                        }
                                    } else {
                                        if (req.body.data.tags != null) {
                                            async.forEach(req.body.data.tags, function (tag, callback) { //The second argument (callback) is the "task callback" for a specific task
                                                const sql = 'INSERT INTO TAGS ("reportUuid", "tag") VALUES ($1, $2)';
                                                const values = [req.body.data.reportUuid, tag.toLowerCase().replace(/#/g, "")];
                                                client.query(sql, values, function (err, result) {
                                                    if (err) {
                                                        console.error("Error while running query " + sql + values, err);
                                                        callback(err);
                                                    } else
                                                        callback();
                                                });
                                            }, function (err) {
                                                done();
                                                if (err)
                                                    res.status(500).end();
                                                else
                                                    res.status(201).end();
                                            });
                                        } else {
                                            done();
                                            res.status(201).end();
                                        }
                                    }
                                });
                                //});//end updateFlightInfos
                            }//end else
                        });
                    } else {
                        res.json({"test": true});
                    }
                }
            }
            console.log(new Date().toISOString() + " - POST /measurements : end");
        });

        app.put('/users', function (req, res, next) {
            console.log(new Date().toISOString() + " - PUT /users : begin");
            if (typeof (req.body.apiKey) != "string" || typeof (req.body.data) != "object") {
                res.status(400).json({
                    error: {
                        code: "100",
                        message: "You must send a JSON with a string apiKey and an object data"
                    }
                });
            } else {
                if (verifyApiKey(res, req.body.apiKey, true, true)) {
                    if (!(req.body.data instanceof Array) || req.body.data.length > 1000000) {
                        res.status(400).json({error: {code: "101", message: "data should be an array"}});
                    } else {
                        //1. check validity
                        let isValid = true;
                        for (let i = 0; i < req.body.data.length; i++) {
                            if (typeof (req.body.data[i].userId) != "string" || typeof (req.body.data[i].userPwd) != "string"
                                || req.body.data[i].userId.length > 100 || req.body.data[i].userPwd.length > 100 || req.body.data[i].userId == "" || req.body.data[i].userPwd == "") {
                                res.status(400).json({
                                    error: {
                                        code: "102",
                                        message: "Element " + i + " in data does not contains valid userId and valid userPwd"
                                    }
                                });
                                isValid = false;
                                break;
                            }
                            for (let j = 0; j < req.body.data.length; j++) {
                                if (j < i && req.body.data[i].userId == req.body.data[j].userId) {
                                    res.status(400).json({
                                        error: {
                                            code: "104",
                                            message: req.body.data[i].userId + " is present twice or more"
                                        }
                                    });
                                    isValid = false;
                                }
                            }
                            if (isValid == false)
                                break;
                        }

                        //2. insert users in APIUSERS table
                        if (isValid) {
                            pool.connect(function (err, client, done) {
                                if (err) {
                                    done();
                                    console.error("Could not connect to PostgreSQL", err);
                                    res.status(500).end();
                                } else {
                                    const sql = 'DELETE FROM APIUSERS';
                                    client.query(sql, [], function (err, result) {
                                        if (err) {
                                            done();
                                            console.error("Error while running query " + sql, err);
                                            res.status(500).end();
                                        } else {
                                            async.forEach(req.body.data, function (user, callback) { //The second argument (callback) is the "task callback" for a specific task
                                                const sql = 'INSERT INTO APIUSERS ("userId", "userPwd") VALUES ($1, $2)';
                                                const values = [user.userId, user.userPwd];
                                                client.query(sql, values, function (err, result) {
                                                    if (err) {
                                                        console.error("Error while running query " + sql + values, err);
                                                        callback(err);
                                                    } else
                                                        callback();
                                                });
                                            }, function (err) {
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
            if (typeof (req.body.apiKey) != "string" || typeof (req.body.data) != "object") {
                res.status(400).json({
                    error: {
                        code: "100",
                        message: "You must send a JSON with a string apiKey and an object data"
                    }
                });
            } else {
                if (verifyApiKey(res, req.body.apiKey, true, true)
                    && verifyData(res, req.body.data, true, "qualification")
                    && verifyData(res, req.body.data, true, "qualificationVotesNumber")) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            const sql = 'UPDATE MEASUREMENTS SET "qualification"=$1,"qualificationVotesNumber"=$2 WHERE "reportUuid"=$3';
                            const values = [req.body.data.qualification, req.body.data.qualificationVotesNumber, req.params.reportUuid];
                            client.query(sql, values, function (err, result) {
                                done();
                                if (err) {
                                    console.error("Error while running query " + sql, err);
                                    res.status(500).end();
                                } else {
                                    if (result.rowCount == 0)
                                        res.status(400).json({
                                            error: {
                                                code: "104",
                                                message: "reportUuid does not exists"
                                            }
                                        });
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
            if (typeof (req.body.apiKey) != "string" || typeof (req.body.data) != "object") {
                res.status(400).json({
                    error: {
                        code: "100",
                        message: "You must send a JSON with a string apiKey and an object data"
                    }
                });
            } else {
                if (verifyApiKey(res, req.body.apiKey, true, true)
                    && verifyData(res, req.body.data, true, "reportUuid")
                    && verifyData(res, req.body.data, true, "tag")) {
                    pool.connect(function (err, client, done) {
                        if (err) {
                            done();
                            console.error("Could not connect to PostgreSQL", err);
                            res.status(500).end();
                        } else {
                            const sql = 'UPDATE TAGS SET "qualification"=$1,"qualificationVotesNumber"=$2 WHERE "reportUuid"=$3';
                            const values = [req.body.data.qualification, req.body.data.qualificationVotesNumber, req.params.reportUuid];
                            client.query(sql, values, function (err, result) {
                                done();
                                if (err) {
                                    console.error("Error while running query " + sql, err);
                                    res.status(500).end();
                                } else {
                                    if (result.rowCount == 0)
                                        res.status(400).json({
                                            error: {
                                                code: "104",
                                                message: "reportUuid does not exists"
                                            }
                                        });
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
        app.get('/:lang/upload', function (req, res, next) {
            console.log(new Date().toISOString() + " - GET :lang/upload : begin");
            if (req.params.lang == "fr" || req.params.lang == "en") {
                res.render('uploadfile.ejs', {
                    lang: req.params.lang,
                    userId: "",
                    userPwd: "",
                    measurementEnvironment: "",
                    measurementHeight: "",
                    rain: "",
                    flightNumber: "",
                    description: "",
                    tags: JSON.stringify([]),
                    result: ""
                });
            } else
                res.status(404).end();
            console.log(new Date().toISOString() + " - GET :lang/upload : end");
        });

        app.get('/upload', function (req, res, next) {
            console.log(new Date().toISOString() + " - GET /upload : begin");
            res.render('uploadfile.ejs', {
                lang: getLanguage(req),
                userId: "",
                userPwd: "",
                measurementEnvironment: "",
                measurementHeight: "",
                rain: "",
                flightNumber: "",
                description: "",
                tags: JSON.stringify([]),
                result: ""
            });
            console.log(new Date().toISOString() + " - GET /upload : end");
        });

        app.post('/upload', upload.single('file'), function (req, res, next) {
            console.log(new Date().toISOString() + " - POST /upload : begin");

            let message = "";
            const tags = [];
            let submittedTags = true;
            let nbTags = 0;
            while (submittedTags) {
                nbTags += 1;
                if (nbTags > 9 || req.body["tag" + nbTags] == null || typeof (req.body["tag" + nbTags]) != "string")
                    submittedTags = false;
                else if (req.body["tag" + nbTags] != "")
                    tags.push(req.body["tag" + nbTags]);
            }

            if (req.body.lang == null || typeof (req.body.lang) != "string" || (req.body.lang != "fr" && req.body.lang != "en"))
                res.status(404).end();
            else if (req.body.userId == null || typeof (req.body.userId) != "string" || req.body.userId == "" || req.body.userId.length > 100)
                res.render('uploadfile.ejs', {
                    lang: req.body.lang,
                    userId: req.body.userId,
                    userPwd: req.body.userPwd,
                    measurementHeight: req.body.measurementHeight,
                    measurementEnvironment: req.body.measurementEnvironment,
                    rain: req.body.rain,
                    flightNumber: req.body.flightNumber,
                    description: req.body.description,
                    tags: JSON.stringify(tags),
                    result: "Username is mandatory"
                });
            else if (req.body.userPwd == null || typeof (req.body.userPwd) != "string" || req.body.userPwd == "" || req.body.userPwd.length > 100)
                res.render('uploadfile.ejs', {
                    lang: req.body.lang,
                    userId: req.body.userId,
                    userPwd: req.body.userPwd,
                    measurementHeight: req.body.measurementHeight,
                    measurementEnvironment: req.body.measurementEnvironment,
                    rain: req.body.rain,
                    flightNumber: req.body.flightNumber,
                    description: req.body.description,
                    tags: JSON.stringify(tags),
                    result: "Password is mandatory"
                });
            else {
                const measurementEnvironmentValues = ["countryside", "city", "ontheroad", "inside", "plane"];
                if (req.body.measurementEnvironment == null || typeof (req.body.measurementEnvironment) != "string" || measurementEnvironmentValues.indexOf(req.body.measurementEnvironment) == -1)
                    res.render('uploadfile.ejs', {
                        lang: req.body.lang,
                        userId: req.body.userId,
                        userPwd: req.body.userPwd,
                        measurementHeight: req.body.measurementHeight,
                        measurementEnvironment: req.body.measurementEnvironment,
                        rain: req.body.rain,
                        flightNumber: req.body.flightNumber,
                        description: req.body.description,
                        tags: JSON.stringify(tags),
                        result: "Measurement environment should be in [countryside | city | ontheroad | inside | plane]"
                    });
                else if (req.body.measurementEnvironment != "plane" && (req.body.measurementHeight == null || typeof (req.body.measurementHeight) != "string" || req.body.measurementHeight == "" || parseFloat(req.body.measurementHeight) != parseInt(req.body.measurementHeight)))
                    res.render('uploadfile.ejs', {
                        lang: req.body.lang,
                        userId: req.body.userId,
                        userPwd: req.body.userPwd,
                        measurementHeight: req.body.measurementHeight,
                        measurementEnvironment: req.body.measurementEnvironment,
                        rain: req.body.rain,
                        flightNumber: req.body.flightNumber,
                        description: req.body.description,
                        tags: JSON.stringify(tags),
                        result: "Measurement height should be an integer"
                    });
                else if (req.body.measurementEnvironment != "plane" && (req.body.rain == null || typeof (req.body.rain) != "string" || req.body.rain == "" || (req.body.rain != "true" && req.body.rain != "false")))
                    res.render('uploadfile.ejs', {
                        lang: req.body.lang,
                        userId: req.body.userId,
                        userPwd: req.body.userPwd,
                        measurementHeight: req.body.measurementHeight,
                        measurementEnvironment: req.body.measurementEnvironment,
                        rain: req.body.rain,
                        flightNumber: req.body.flightNumber,
                        description: req.body.description,
                        tags: JSON.stringify(tags),
                        result: "Rain should be a boolean (true or false)"
                    });
                else if (req.body.measurementEnvironment == "plane" && (req.body.flightNumber == null || typeof (req.body.flightNumber) != "string" || req.body.flightNumber == "" || (req.body.flightNumber.length > 25)))
                    res.render('uploadfile.ejs', {
                        lang: req.body.lang,
                        userId: req.body.userId,
                        userPwd: req.body.userPwd,
                        measurementHeight: req.body.measurementHeight,
                        measurementEnvironment: req.body.measurementEnvironment,
                        rain: req.body.rain,
                        flightNumber: req.body.flightNumber,
                        description: req.body.description,
                        tags: JSON.stringify(tags),
                        result: "Flight Number is not valid"
                    });
                else if (req.body.description == null || typeof (req.body.description) != "string" || req.body.description.length > 1000)
                    res.render('uploadfile.ejs', {
                        lang: req.body.lang,
                        userId: req.body.userId,
                        userPwd: req.body.userPwd,
                        measurementHeight: req.body.measurementHeight,
                        measurementEnvironment: req.body.measurementEnvironment,
                        rain: req.body.rain,
                        flightNumber: req.body.flightNumber,
                        description: req.body.description,
                        tags: JSON.stringify(tags),
                        result: "Description is not valid"
                    });
                else if (req.file == null)
                    res.render('uploadfile.ejs', {
                        lang: req.body.lang,
                        userId: req.body.userId,
                        userPwd: req.body.userPwd,
                        measurementHeight: req.body.measurementHeight,
                        measurementEnvironment: req.body.measurementEnvironment,
                        rain: req.body.rain,
                        flightNumber: req.body.flightNumber,
                        description: req.body.description,
                        tags: JSON.stringify(tags),
                        result: "You have to choose a file"
                    });
                else {
                    let file = req.file.buffer.toString("utf-8");
                    const sha256 = SHA256(file).toString();
                    const md5 = MD5(file).toString();
                    console.log(req.file);
                    let lines = file.split(new RegExp('\r\n|\r|\n'));

                    if (lines.length > 100000)
                        res.render('uploadfile.ejs', {
                            lang: req.body.lang,
                            userId: req.body.userId,
                            userPwd: req.body.userPwd,
                            measurementHeight: req.body.measurementHeight,
                            measurementEnvironment: req.body.measurementEnvironment,
                            rain: req.body.rain,
                            flightNumber: req.body.flightNumber,
                            description: req.body.description,
                            tags: JSON.stringify(tags),
                            result: "Your file contains too many lines (more than 100000 lines)"
                        });
                    else {
                        let measurementsLinesValid = 0;
                        let measurementsTakenInAccount = 0;
                        let measurementsOk = 0;

                        let errorMessage = "";
                        let stopIt = false;

                        let firstMeasurement = true;
                        let totalHitsNumber;
                        let linesCount;
                        let startTime;
                        let latitude;
                        let longitude;
                        let accuracy;
                        let altitude;
                        let mm;
                        let hh;

                        //to avoid a maximum call stack size exceeded we cut the file in 1000 lines chunks
                        const loops = []; // loops will contain the chunks number
                        for (let i = 0; i <= Math.floor(lines.length / 1000); i++) {
                            loops.push(i);
                        }

                        // for each chunk
                        async.forEachSeries(loops, function (index, callbackLoop) {
                            let subLines;
                            if ((index * 1000 + 1000) > lines.length)
                                subLines = lines.slice(index * 1000, lines.length);
                            else
                                subLines = lines.slice(index * 1000, index * 1000 + 1000);

                            // treatment of the chunk
                            if (stopIt == false) {
                                // for each line of the chunk
                                async.forEachSeries(subLines, function (line, callback) { //see https://github.com/Safecast/bGeigieMini for the format of the file
                                    if (line.match(/^#/) || stopIt) {
                                        callback(); //log line are not treated
                                    } else {
                                        const values = line.split(",");

                                        if (values.length == 15 && values[6] == "A" && values[12] == "A" && isNaN(values[3]) == false && (parseFloat(values[3]) == parseInt(values[3]))
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
                                                if (hh != null && hh.length > 1 && mm != null) {
                                                    latitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                                    if (values[8] == "S")
                                                        latitude = latitude * -1;
                                                }
                                                mm = values[9].match(/\d\d\.\d*/);
                                                hh = /(\d*)\d\d\./.exec(values[9]);
                                                if (hh != null && hh.length > 1 && mm != null) {
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

                                                const data = {};
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
                                                if (hh != null && hh.length > 1 && mm != null) {
                                                    data.endLatitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                                    if (values[8] == "S")
                                                        data.endLatitude = data.endLatitude * -1;
                                                }
                                                mm = values[9].match(/\d\d\.\d*/);
                                                hh = /(\d*)\d\d\./.exec(values[9]);
                                                if (hh != null && hh.length > 1 && mm != null) {
                                                    data.endLongitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                                    if (values[10] == "W")
                                                        data.endLongitude = data.endLongitude * -1;
                                                }
                                                data.endAccuracy = parseFloat(values[13]);
                                                data.endAltitude = parseInt(values[11]);
                                                let epoch = data.startTime.getTime() / 1000;
                                                if (epoch.toString().length > 10)
                                                    epoch = epoch.toString().substr(0, 10);
                                                else if (epoch.toString().length < 10)
                                                    epoch = "0000000000".substring(0, 10 - epoch.toString().length) + epoch.toString();
                                                data.reportUuid = "ff" + md5.substr(0, 6) + "-" + md5.substr(6, 4) + "-4" + md5.substr(10, 3) + "-a" + md5.substr(13, 3) + "-" + md5.substr(16, 2) + epoch.toString(); // Uuid is ffxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx with 18 characters from sha-256 file and epoch startTime
                                                data.manualReporting = false;
                                                data.organisationReporting = "openradiation.net/upload " + properties.version;
                                                data.reportContext = "routine";
                                                data.description = req.body.description;
                                                data.measurementEnvironment = req.body.measurementEnvironment;
                                                if (req.body.measurementEnvironment == "plane")
                                                    data.flightNumber = req.body.flightNumber;
                                                else {
                                                    data.measurementHeight = parseInt(req.body.measurementHeight);
                                                    data.rain = req.body.rain == "true";
                                                }
                                                data.tags = tags.slice();
                                                data.tags.push("safecast");
                                                data.tags.push("file_" + sha256.substr(0, 18));
                                                data.userId = req.body.userId;
                                                data.userPwd = req.body.userPwd;

                                                // here we retrieve data for the next measurement
                                                totalHitsNumber = 0;
                                                linesCount = 1;
                                                startTime = new Date(values[2]);
                                                mm = values[7].match(/\d\d\.\d*/);
                                                hh = /(\d*)\d\d\./.exec(values[7]);
                                                if (hh != null && hh.length > 1 && mm != null) {
                                                    latitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                                    if (values[8] == "S")
                                                        latitude = latitude * -1;
                                                }
                                                mm = values[9].match(/\d\d\.\d*/);
                                                hh = /(\d*)\d\d\./.exec(values[9]);
                                                if (hh != null && hh.length > 1 && mm != null) {
                                                    longitude = parseFloat(hh[1]) + parseFloat(mm[0]) / 60;
                                                    if (values[10] == "W")
                                                        longitude = longitude * -1;
                                                }
                                                accuracy = parseFloat(values[13]);
                                                altitude = parseInt(values[11]);

                                                const json = {
                                                    "apiKey": properties.submitFormAPIKey,
                                                    "data": data
                                                };

                                                const options = {
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

                                                const post_req = https.request(options, function (post_res) {
                                                    let result = '';
                                                    post_res.setEncoding('utf8');
                                                    post_res.on('data', function (chunk) {
                                                        result += chunk;
                                                    });
                                                    post_res.on('end', function () {
                                                        if (post_res.statusCode == 201) {
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
                                                }).on('error', function (e) {
                                                    console.error("Error while trying to post measurement : " + e.message);
                                                    stopIt = true;
                                                    res.status(500).end();
                                                    callback();
                                                });

                                                // post the data
                                                post_req.write(JSON.stringify(json), encoding = 'utf8');
                                                post_req.end();
                                            }
                                            //else
                                            //    callback(); //only one line all minute is treated
                                        } else {
                                            callback(); //invalid lines are not treated
                                        }
                                    }
                                }, function (err) {

                                    console.log(req.file.originalname + " processed at " + index * 1000);  //chunk is done now
                                    if (err) {
                                        console.log("error : " + err);
                                        stopIt = true;
                                        res.render('uploadfile.ejs', {
                                            lang: req.body.lang,
                                            userId: req.body.userId,
                                            userPwd: req.body.userPwd,
                                            measurementHeight: req.body.measurementHeight,
                                            measurementEnvironment: req.body.measurementEnvironment,
                                            rain: req.body.rain,
                                            flightNumber: req.body.flightNumber,
                                            description: req.body.description,
                                            tags: JSON.stringify(tags),
                                            result: "<strong>Error during the processing</strong> : " + err
                                        });

                                    } else {
                                        if (measurementsOk == 0) { //we prefer to stop the treatment
                                            stopIt = true;
                                            res.render('uploadfile.ejs', {
                                                lang: req.body.lang,
                                                userId: req.body.userId,
                                                userPwd: req.body.userPwd,
                                                measurementHeight: req.body.measurementHeight,
                                                measurementEnvironment: req.body.measurementEnvironment,
                                                rain: req.body.rain,
                                                flightNumber: req.body.flightNumber,
                                                description: req.body.description,
                                                tags: JSON.stringify(tags),
                                                result: "<strong>Error during the processing</strong> : " + errorMessage
                                            });
                                        }
                                    }
                                    callbackLoop();
                                });
                            } else {
                                callbackLoop();
                            }
                        }, function (err) {
                            console.log(req.file.originalname + " processed");  //everything is done now
                            if (stopIt == false) {
                                message = "The file " + req.file.originalname + " has been processed : " + measurementsOk + " measurement(s) are stored in the OpenRadiation database.<br>";
                                message += "The file contained " + measurementsLinesValid + " valid lines, and " + measurementsTakenInAccount + " measurements have been extracted (one per minute).<br>";
                                if (measurementsTakenInAccount != measurementsOk) {
                                    message += "Amongst them, " + (measurementsTakenInAccount - measurementsOk) + " have been refused, like this one : <br><i>" + errorMessage + "</i><br><br>";
                                }
                                message += "Measurements have been tagged <i>#safecast</i> <i>#file_" + sha256.substr(0, 18) + "</i>. You can now close this page.<br><br><br>";
                                message += "<iframe frameborder=\"0\" style=\"height:90%;width:90%;left:auto;right:auto;min-height:400px;\" height=\"90%\" width=\"90%\" src=\"" + properties.mappingURL + "/openradiation/file_" + sha256.substr(0, 18) + "/all/all/all/0/100/0/100\"></iframe>";
                                res.render('uploadfile.ejs', {
                                    lang: req.body.lang,
                                    userId: req.body.userId,
                                    userPwd: req.body.userPwd,
                                    measurementHeight: req.body.measurementHeight,
                                    measurementEnvironment: req.body.measurementEnvironment,
                                    rain: req.body.rain,
                                    flightNumber: req.body.flightNumber,
                                    description: req.body.description,
                                    tags: JSON.stringify(tags),
                                    result: message
                                });
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
        const asinh = function (x) {
            return Math.log(x + Math.sqrt(1 + x * x));
        };

        app.get('/i/:z/:x/:y.png', function (req, res, next) {
            console.log(new Date().toISOString() + " - GET /i/" + req.params.z + "/" + req.params.x + "/" + req.params.y + ".png : begin");

            if (isNaN(req.params.z) || isNaN(req.params.x) || isNaN(req.params.y)
                || parseInt(req.params.z) < 0 || parseInt(req.params.z) > 16
                || parseInt(req.params.x) < 0 || parseInt(req.params.x) >= Math.pow(2, 2 * parseInt(req.params.z))
                || parseInt(req.params.y) < 0 || parseInt(req.params.y) >= Math.pow(2, 2 * parseInt(req.params.z))) {
                res.status(500).end();
            } else {
                const x = parseInt(req.params.x);
                const y = parseInt(req.params.y);
                const z = parseInt(req.params.z);

                const pngFileName = __dirname + '/public/png/{z}_{x}_{y}.png'.replace('{z}_{x}_{y}', z + "_" + x + "_" + y);

                fs.access(pngFileName, (err) => {
                    if (err) {
                        const btilex = x.toString(2);
                        const btiley = y.toString(2);
                        let quadkey = "";
                        let cx, cy;

                        for (let q = 0; q < z; q++) //from right to left
                        {
                            if (btilex.length > q)
                                cx = parseInt(btilex.substr(btilex.length - q - 1, 1));
                            else
                                cx = 0;

                            if (btiley.length > q)
                                cy = parseInt(btiley.substr(btiley.length - q - 1, 1));
                            else
                                cy = 0;
                            quadkey = (cx + 2 * cy) + quadkey;
                        }

                        //console.log("x, y, z, quadkey = " + x + ";" + y + ";" + z + ";" + quadkey);

                        const sql = 'SELECT "tile", "opacity" FROM TILES WHERE "quadKey"=$1';
                        const values = [quadkey];

                        pool.connect(function (err, client, done) {
                            if (err) {
                                done();
                                console.error("Could not connect to PostgreSQL", err);
                                res.status(500).end();
                            } else {
                                client.query(sql, values, function (err, result) {
                                    done();
                                    if (err) {
                                        console.error("Error while running query " + sql + values, err);
                                        res.status(500).end();
                                    } else {
                                        if (result.rowCount == 0) {
                                            const transparentTileFileName = __dirname + '/public/transparent_tile.png';
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
                                        } else {
                                            const png = new PNG({
                                                width: 256,
                                                height: 256,
                                                filterType: -1
                                            });

                                            const tile = result.rows[0].tile;
                                            const opacity = result.rows[0].opacity;

                                            let value;
                                            let opac;

                                            let idx_value = 0;
                                            let idx_opacity = 0;
                                            // for each value stored from left to right, then top to bottom
                                            for (let pix_x = 0; pix_x < 256; pix_x++) {
                                                for (let pix_y = 0; pix_y < 256; pix_y++) {
                                                    value = parseInt(tile.substr(idx_value, 16), 2); // value is stored in nSv/h
                                                    opac = parseInt(opacity.substr(idx_opacity, 7), 2);

                                                    if (opac > 100)
                                                        opac = 100;
                                                    //idx in png is stored from top to bottom, then left to right
                                                    const idx = (pix_x + pix_y * 256) << 2;

                                                    png.data[idx + 3] = Math.floor(255 * (opac / 100.0));

                                                    if (value == 65535) { // it is a null value
                                                        png.data[idx] = 255;    //R
                                                        png.data[idx + 1] = 255; //G
                                                        png.data[idx + 2] = 255; //B
                                                        png.data[idx + 3] = 0; //opacity
                                                    } else if (value < 45) {
                                                        png.data[idx] = 3; //R
                                                        png.data[idx + 1] = 3; //G
                                                        png.data[idx + 2] = 230; //B
                                                    } else if (value < 72) {
                                                        png.data[idx] = 17; //R
                                                        png.data[idx + 1] = 84; //G
                                                        png.data[idx + 2] = 238; //B
                                                    } else if (value < 114) {
                                                        png.data[idx] = 35; //R
                                                        png.data[idx + 1] = 172; //G
                                                        png.data[idx + 2] = 246; //B
                                                    } else if (value < 181) {
                                                        png.data[idx] = 51; //R
                                                        png.data[idx + 1] = 250; //G
                                                        png.data[idx + 2] = 254; //B
                                                    } else if (value < 287) {
                                                        png.data[idx] = 34; //R
                                                        png.data[idx + 1] = 248; //G
                                                        png.data[idx + 2] = 175; //B
                                                    } else if (value < 454) {
                                                        png.data[idx] = 16; //R
                                                        png.data[idx + 1] = 247; //G
                                                        png.data[idx + 2] = 89; //B
                                                    } else if (value < 720) {
                                                        png.data[idx] = 0; //R
                                                        png.data[idx + 1] = 245; //G
                                                        png.data[idx + 2] = 15; //B
                                                    } else if (value < 1142) {
                                                        png.data[idx] = 59; //R
                                                        png.data[idx + 1] = 247; //G
                                                        png.data[idx + 2] = 13; //B
                                                    } else if (value < 1809) {
                                                        png.data[idx] = 129; //R
                                                        png.data[idx + 1] = 249; //G
                                                        png.data[idx + 2] = 10; //B
                                                    } else if (value < 2867) {
                                                        png.data[idx] = 195; //R
                                                        png.data[idx + 1] = 251; //G
                                                        png.data[idx + 2] = 8; //B
                                                    } else if (value < 4545) {
                                                        png.data[idx] = 255; //R
                                                        png.data[idx + 1] = 253; //G
                                                        png.data[idx + 2] = 6; //B
                                                    } else if (value < 7203) {
                                                        png.data[idx] = 255; //R
                                                        png.data[idx + 1] = 222; //G
                                                        png.data[idx + 2] = 6; //B
                                                    } else if (value < 11416) {
                                                        png.data[idx] = 254; //R
                                                        png.data[idx + 1] = 192; //G
                                                        png.data[idx + 2] = 7; //B
                                                    } else if (value < 18092) {
                                                        png.data[idx] = 254; //R
                                                        png.data[idx + 1] = 161; //G
                                                        png.data[idx + 2] = 7; //B
                                                    } else if (value < 28675) {
                                                        png.data[idx] = 253; //R
                                                        png.data[idx + 1] = 131; //G
                                                        png.data[idx + 2] = 7; //B
                                                    } else if (value < 45446) {
                                                        png.data[idx] = 253; //R
                                                        png.data[idx + 1] = 100; //G
                                                        png.data[idx + 2] = 7; //B
                                                    } else if (value < 72027) { //todo : value format is limited to 65535
                                                        png.data[idx] = 252; //R
                                                        png.data[idx + 1] = 69; //G
                                                        png.data[idx + 2] = 8; //B
                                                    } else if (value < 114115) {
                                                        png.data[idx] = 252; //R
                                                        png.data[idx + 1] = 39; //G
                                                        png.data[idx + 2] = 8; //B
                                                    } else {
                                                        png.data[idx] = 251; //R
                                                        png.data[idx + 1] = 8; //G
                                                        png.data[idx + 2] = 8; //B
                                                    }

                                                    idx_value = idx_value + 16;
                                                    idx_opacity = idx_opacity + 7;
                                                }
                                            }

                                            if (z > 7) {
                                                res.writeHead(200, {'Content-Type': 'image/png'});
                                                png.pack().pipe(res);
                                            } else {  // 7 to limit the number of files, while at this zoom level, we have 4^7 image files
                                                png.pack().pipe(fs.createWriteStream(pngFileName)).on('finish', function () {
                                                    //var img = fs.readFileSync(pngFileName);
                                                    //res.writeHead(200, {'Content-Type': 'image/png' });
                                                    //res.end(img, 'binary');
                                                    //if (z > 7) // 7 to limit the number of files, because at this zoom level, we have 4^7 image files
                                                    //  fs.unlinkSync(pngFileName);
                                                    res.writeHead(200, {'Content-Type': 'image/png'});
                                                    const fileStream = fs.createReadStream(pngFileName);
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
                        res.writeHead(200, {'Content-Type': 'image/png'});
                        const fileStream = fs.createReadStream(pngFileName);
                        fileStream.pipe(res);
                        //res.end(img, 'binary');
                    }
                });
            }
            //console.log(new Date().toISOString() + " - GET /i/:z/:x/:y.png : end");
        });

        app.get('/:lang?/openradiation', function (req, res, next) {
            if (req.params.lang == undefined || req.params.lang == "fr" || req.params.lang == "en") {
                let lang;
                if (req.params.lang == undefined)
                    lang = getLanguage(req);
                else
                    lang = req.params.lang;
                res.render('openradiation.ejs', {
                    lang: lang,
                    apiKey: mutableOpenRadiationMapApiKey,
                    measurementURL: properties.measurementURL,
                    withLocate: true,
                    fitBounds: false,
                    zoom: 5,
                    latitude: 46,
                    longitude: 7,
                    tag: "",
                    userId: "",
                    qualification: "groundlevel",
                    atypical: "all",
                    rangeValueMin: 0,
                    rangeValueMax: 100,
                    rangeDateMin: 0,
                    rangeDateMax: 100
                });
            } else
                res.status(404).end();
        });

        app.get('/:lang?/openradiation/:zoom/:latitude/:longitude', function (req, res, next) {
            if ((isNaN(req.params.zoom) == false && parseFloat(req.params.zoom) == parseInt(req.params.zoom) && parseInt(req.params.zoom) >= 0 && parseInt(req.params.zoom) <= 18)
                && (isNaN(req.params.latitude) == false)
                && (isNaN(req.params.longitude) == false)
                && (req.params.lang == undefined || req.params.lang == "fr" || req.params.lang == "en")) {
                let lang;
                if (req.params.lang == undefined)
                    lang = getLanguage(req);
                else
                    lang = req.params.lang;
                res.render('openradiation.ejs', {
                    lang: lang,
                    apiKey: mutableOpenRadiationMapApiKey,
                    measurementURL: properties.measurementURL,
                    withLocate: false,
                    fitBounds: false,
                    zoom: req.params.zoom,
                    latitude: req.params.latitude,
                    longitude: req.params.longitude,
                    tag: "",
                    userId: "",
                    qualification: "groundlevel",
                    atypical: "all",
                    rangeValueMin: 0,
                    rangeValueMax: 100,
                    rangeDateMin: 0,
                    rangeDateMax: 100
                });
            } else {
                res.status(404).end();
            }
        });

        app.get('/:lang?/openradiation/:tag/:userId/:qualification/:atypical/:rangeValueMin/:rangeValueMax/:rangeDateMin/:rangeDateMax', function (req, res, next) {
            if ((req.params.qualification == "all" || req.params.qualification == "plane" || req.params.qualification == "wrongmeasurement" || req.params.qualification == "groundlevel" || req.params.qualification == "temporarysource")
                && (req.params.atypical == "all" || req.params.atypical == "true" || req.params.atypical == "false")
                && (isNaN(req.params.rangeValueMin) == false && parseFloat(req.params.rangeValueMin) == parseInt(req.params.rangeValueMin) && parseInt(req.params.rangeValueMin) >= 0 && parseInt(req.params.rangeValueMin) <= 100)
                && (isNaN(req.params.rangeValueMax) == false && parseFloat(req.params.rangeValueMax) == parseInt(req.params.rangeValueMax) && parseInt(req.params.rangeValueMax) >= 0 && parseInt(req.params.rangeValueMax) <= 100 && parseInt(req.params.rangeValueMin) <= parseInt(req.params.rangeValueMax))
                && (isNaN(req.params.rangeDateMin) == false && parseFloat(req.params.rangeDateMin) == parseInt(req.params.rangeDateMin) && parseInt(req.params.rangeDateMin) >= 0 && parseInt(req.params.rangeDateMin) <= 100)
                && (isNaN(req.params.rangeDateMax) == false && parseFloat(req.params.rangeDateMax) == parseInt(req.params.rangeDateMax) && parseInt(req.params.rangeDateMax) >= 0 && parseInt(req.params.rangeDateMax) <= 100 && parseInt(req.params.rangeDateMin) <= parseInt(req.params.rangeDateMax))
                && (req.params.lang == undefined || req.params.lang == "fr" || req.params.lang == "en")) {
                let tag;
                if (req.params.tag == "all")
                    tag = "";
                else
                    tag = req.params.tag;
                let userId;
                if (req.params.userId == "all")
                    userId = "";
                else
                    userId = req.params.userId;
                let lang;
                if (req.params.lang == undefined)
                    lang = getLanguage(req);
                else
                    lang = req.params.lang;
                let qualification;
                qualification = req.params.qualification;

                res.render('openradiation.ejs', {
                    lang: lang,
                    apiKey: mutableOpenRadiationMapApiKey,
                    measurementURL: properties.measurementURL,
                    withLocate: false,
                    fitBounds: true,
                    zoom: 1,
                    latitude: 46,
                    longitude: 7,
                    tag: tag,
                    userId: userId,
                    qualification: qualification,
                    atypical: req.params.atypical,
                    rangeValueMin: req.params.rangeValueMin,
                    rangeValueMax: req.params.rangeValueMax,
                    rangeDateMin: req.params.rangeDateMin,
                    rangeDateMax: req.params.rangeDateMax
                });
            } else
                res.status(404).end();
        });

        app.get('/:lang?/openradiation/:zoom/:latitude/:longitude/:tag/:userId/:qualification/:atypical/:rangeValueMin/:rangeValueMax/:rangeDateMin/:rangeDateMax', function (req, res, next) {
            if ((isNaN(req.params.zoom) == false && parseFloat(req.params.zoom) == parseInt(req.params.zoom) && parseInt(req.params.zoom) >= 0 && parseInt(req.params.zoom) <= 18)
                && (isNaN(req.params.latitude) == false)
                && (isNaN(req.params.longitude) == false)
                && (req.params.qualification == "all" || req.params.qualification == "plane" || req.params.qualification == "wrongmeasurement" || req.params.qualification == "groundlevel" || req.params.qualification == "temporarysource")
                && (req.params.atypical == "all" || req.params.atypical == "true" || req.params.atypical == "false")
                && (isNaN(req.params.rangeValueMin) == false && parseFloat(req.params.rangeValueMin) == parseInt(req.params.rangeValueMin) && parseInt(req.params.rangeValueMin) >= 0 && parseInt(req.params.rangeValueMin) <= 100)
                && (isNaN(req.params.rangeValueMax) == false && parseFloat(req.params.rangeValueMax) == parseInt(req.params.rangeValueMax) && parseInt(req.params.rangeValueMax) >= 0 && parseInt(req.params.rangeValueMax) <= 100 && parseInt(req.params.rangeValueMin) <= parseInt(req.params.rangeValueMax))
                && (isNaN(req.params.rangeDateMin) == false && parseFloat(req.params.rangeDateMin) == parseInt(req.params.rangeDateMin) && parseInt(req.params.rangeDateMin) >= 0 && parseInt(req.params.rangeDateMin) <= 100)
                && (isNaN(req.params.rangeDateMax) == false && parseFloat(req.params.rangeDateMax) == parseInt(req.params.rangeDateMax) && parseInt(req.params.rangeDateMax) >= 0 && parseInt(req.params.rangeDateMax) <= 100 && parseInt(req.params.rangeDateMin) <= parseInt(req.params.rangeDateMax))
                && (req.params.lang == undefined || req.params.lang == "fr" || req.params.lang == "en")) {
                let tag;
                if (req.params.tag == "all")
                    tag = "";
                else
                    tag = req.params.tag;
                let userId;
                if (req.params.userId == "all")
                    userId = "";
                else
                    userId = req.params.userId;
                let lang;
                if (req.params.lang == undefined)
                    lang = getLanguage(req);
                else
                    lang = req.params.lang;
                let qualification;
                qualification = req.params.qualification;

                res.render('openradiation.ejs', {
                    lang: lang,
                    apiKey: mutableOpenRadiationMapApiKey,
                    measurementURL: properties.measurementURL,
                    withLocate: false,
                    fitBounds: false,
                    zoom: req.params.zoom,
                    latitude: req.params.latitude,
                    longitude: req.params.longitude,
                    tag: tag,
                    userId: userId,
                    qualification: qualification,
                    atypical: req.params.atypical,
                    rangeValueMin: req.params.rangeValueMin,
                    rangeValueMax: req.params.rangeValueMax,
                    rangeDateMin: req.params.rangeDateMin,
                    rangeDateMax: req.params.rangeDateMax
                });
            } else
                res.status(404).end();
        });
    }

//9. mailjet feedbacks
    if (properties.submitApiFeature) {
        app.post('/feedback', async function (req, res, next) {
            console.log(new Date().toISOString() + " - POST /Feedback : begin");
            if (typeof (req.body.apiKey) != "string" || typeof (req.body.data) != "object") {
                console.dir(req.body);
                console.log("You must send a JSON with a string apiKey and an object data");
                res.status(400).json({
                    error: {
                        code: "100",
                        message: "You must send a JSON with a string apiKey and an object data"
                    }
                });
            } else {
                if (verifyApiKey(res, req.body.apiKey, false, true)
                    && verifyData(res, req.body.data, false, "feedback")
                ) {
                    try {
                        let response = await axios.post(
                            "https://api.mailjet.com/v3.1/send",
                            req.body.data,
                            {
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: "Basic " + Buffer.from(properties.feedbackApiPublicKey + ":" + properties.feedbackApiPrivateKey).toString("base64"),
                                }
                            });
                        console.log("Mailjet feedback status : " + response.status + " " + response.statusText);
                        res.status(response.status).json({'status': response.statusText}).end();
                    } catch (error) {
                        console.error("Erreur 500 while sending feedback", error.code);
                        res.status(500).end();
                    }
                }
            }
            console.log(new Date().toISOString() + " - POST /feedback : end");
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

        const privateKey = fs.readFileSync(__dirname + '/' + properties.certKeyFile, 'utf8');
        const certificate = fs.readFileSync(__dirname + '/' + properties.certCrtFile, 'utf8');
        const credentials = {key: privateKey, cert: certificate};
        const httpsServer = https.createServer(credentials, app);

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

        const httpServer = http.createServer(app);

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



