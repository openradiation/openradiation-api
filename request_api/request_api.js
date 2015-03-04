/* 
 * Utiliser le bouton run pour lancer le serveur.
 * Utiliser le bouton stop pour arrêter le serveur.
 * Si jamais il lui est impossible de démarrer c'est qu'un autre process est déjà en cours :
 * Ouvrir un terminal, récupérer le pid du process avec htop,
 * et lui envoyer le signal sigterm avec : kill -SIGTERM <pid>
 *
 * Cela fonctionne mieux si on lance le serveur depuis le répertoire Backend avec la commande node server.js
 */

var pg = require('pg');
var express = require('express');
var bodyParser = require('body-parser');
var properties = require('./properties.js');

var conStr = "postgres://" + properties.login + ":" + properties.password "@" + properties.host + "/openradiation";
var app = express();

app.use(express.static(__dirname + '/public'));
app.set('views', __dirname + '/views');

app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');
 
    next();
});


app.use(bodyParser.json({strict: true}));

app.put('/add', function(req, res, next) {
    var b = req.body;
    if (typeof b.nb_coups != 'undefined' && typeof b.latitude != 'undefined' && typeof b.longitude != 'undefined' && typeof b.altitude != 'undefined' && typeof b.timestamp != 'undefined') {
        var sql = "INSERT INTO mesures_test (nb_coups, latitude, longitude, altitude, timestamp) VALUES ($1, $2, $3, $4, $5)";
        pg.connect(conStr, function(err, db, done) {
            if (err) {
                return console.error("Could not connect to PostgreSQL", err);
            }
            db.query(sql, [b.nb_coups, b.latitude, b.longitude, b.altitude, b.timestamp], function(err, result) {
                done();
                if (err) {
                    return console.error("Error while running insert query", err);
                }
                console.log("Measure inserted : "+JSON.stringify(b));
            });
        });
    } else {
        console.log("Invalid JSON");
    }
    res.send("ok");
});

/* see http://jsonapi.org/format/ */

app.get('/:key/measurements/:reportUUID', function (req, res, next) {
    var result = {};
    result.error = "GET /:key/measurements/:reportUUID - invalid" + req.params.reportUUID;
    res.json(err);
    
    
}

GET /key/measurements/:reportUUID

app.get('/mesures/:latMin/:lonMin/:latMax/:lonMax/:timeMin/:timeMax', function (req, res, next) {
    pg.connect(conStr, function(err, db, done) {
        if (err) {
           return console.error("Could not connect to PostgreSQL", err);
        }
        db.query("SELECT * FROM mesures_test WHERE latitude >= $1 AND latitude <= $2 AND longitude >= $3 AND longitude <= $4 AND timestamp >= $5 AND timestamp <= $6 LIMIT 1000",
            [req.params.latMin, req.params.latMax, req.params.lonMin, req.params.lonMax, req.params.timeMin, req.params.timeMax],
            function(err, result) {
               done();
               if (err) {
                   return console.error("Error while running select query", err);
               }
               res.json(result.rows);
            }
        );
    });
});

app.get('/mesures/:latMin/:lonMin/:latMax/:lonMax', function (req, res, next) {
    pg.connect(conStr, function(err, db, done) {
        if (err) {
           return console.error("Could not connect to PostgreSQL", err);
        }
        db.query("SELECT * FROM mesures_test WHERE latitude >= $1 AND latitude <= $2 AND longitude >= $3 AND longitude <= $4 LIMIT 1000",
            [req.params.latMin, req.params.latMax, req.params.lonMin, req.params.lonMax],
            function(err, result) {
               done();
               if (err) {
                   return console.error("Error while running select query", err);
               }
               res.json(result.rows);
            }
        );
    });
});

app.get('/mesures/:timeMin/:timeMax', function (req, res, next) {
    pg.connect(conStr, function(err, db, done) {
        if (err) {
           return console.error("Could not connect to PostgreSQL", err);
        }
        db.query("SELECT * FROM mesures_test WHERE timestamp >= $1 AND timestamp <= $2 LIMIT 1000",
            [req.params.timeMin, req.params.timeMax],
            function(err, result) {
               done();
               if (err) {
                   return console.error("Error while running select query", err);
               }
               res.json(result.rows);
            }
        );
    });
});

//todo : just for test
//sample : https://open_geiger-c9-chsimon.c9.io/openradiation
app.get('/openradiation', function (req, res, next) {
    res.render('openradiation.ejs');
});

//sample : https://open_geiger-c9-chsimon.c9.io/openradiation_embedded/48.6/2.30/49.0/2.40/1400601455949/1400839617167
app.get('/openradiation_embedded/:latMin/:lonMin/:latMax/:lonMax/:timeMin/:timeMax', function (req, res, next) {
    res.render('openradiation_embedded.ejs', {latMin: req.params.latMin, lonMin: req.params.lonMin, latMax: req.params.latMax, lonMax: req.params.lonMax, timeMin: req.params.timeMin, timeMax: req.params.timeMax}); 
});

app.get('/', function (req, res, next) { // Deprecated !
    pg.connect(conStr, function(err, db, done) {
        if (err) {
           return console.error("Could not connect to PostgreSQL", err);
        }
        db.query("SELECT * FROM mesures_test", function(err, result) {
           done(); // Release db back to the pool
           if (err) {
               return console.error("Error while running select query", err);
           }
           res.json(result.rows);
        });
    });
});

app.listen(properties.port);

console.log(new Date().toISOString() + " - *** OpenRadiation request API started ***");
console.log(new Date().toISOString() + " - Listen successfully on port " + properties.port);
