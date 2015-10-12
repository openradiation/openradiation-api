module.exports = {
    port : 8080,
    login: "submitapi", //PgSQL
    password: "submitapi", //PgSQL
    host: "localhost", //PgSQL
    maxNumber: 400, //max number for the results of the requests
    getAPIInterval: 600000, //API Table is reloaded every ten minutes
    getUsersInterval: 600000, //Users Table is reloaded every ten minutes
    APIKeyTestInterval: 60000, //APITest every 1 minute
    APIKeyTestMaxCounter: 5, //APITest max 5 calls during APIKeyTestInterval
    measurementURL: "http://openradiation.bluestone.fr/import-measure/{reportUuid}",
    nodeUserUid:"exploit",
    nodeUserGid:"exploit",
    certKeyFile:"certs/cert.key",
    certCrtFile:"certs/cert.crt",
    submitApiFeature:true, //if the feature submitAPI is available
    requestApiFeature:true, //if the feature requestAPI is available
    mappingFeature:true, //if the feature requestAPI is available
    submitFormFeature:true, //if the feature submitForm is available
    mappingURL:"https://localhost:8080", //mapping URL
    submitAPIHost:"localhost", //submitAPI contacted via post forms
    submitAPIPort:8080, //submitAPI contacted via post forms
    version: "v0.1"
}

