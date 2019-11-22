// this fils must be filled and renamed properties.js
module.exports = {
    
    login: "postgres", //PgSQL
    password: "root", //PgSQL
    host: "posgres", //PgSQL
    maxNumber: 400, //max number for the results of the requests
    getAPIInterval: 300000, //API Table is reloaded every 5 minutes
    getUsersInterval: 300000, //Users Table is reloaded every 5 minutes
    APIKeyTestInterval: 60000, //APITest every 1 minute
    APIKeyTestMaxCounter: 5, //APITest max 5 calls during APIKeyTestInterval
    nodeUserUid:"linux_user",
    nodeUserGid:"linux_group",
    certKeyFile:"cert.key",
    certCrtFile:"cert.crt",
    submitApiFeature:true, //if the feature submitAPI is available
    requestApiFeature:true, //if the feature requestAPI is available
    mappingFeature:true, //if the feature requestAPI is available
    submitFormFeature:true, //if the feature submitForm is available
    submitFormAPIKey:"490242ab4978ea6da6548974522121c8", //API key for submitting data; TABLE apiKey (comment: submit.openRadiation.net)
    measurementURL: "http://localhost/import-measure/{reportUuid}",
    mappingURL:"https://localhost:8080", //mapping URL
    submitAPIHost:"127.0.0.1", //submitAPI contacted via post forms
    submitAPIPort:8080, //submitAPI contacted via post forms
    httpsPort : 8080,
    httpPort : 8083,
    flightURL : "https://userName:userPwd@flightxml.flightaware.com/json/FlightXML3/",
    //uncomment to define a proxy for flightURL
    //flightProxy : "http://user:pwd@host:port", 
    flightSearchInterval: 305000, // every 5 minutes we try to attribuate measurements to a flight
    version: "v0.7"
}

