

CREATE TABLE MEASUREMENTS
(
    "apparatusId"                 VARCHAR(100),
    "apparatusVersion"            VARCHAR(100),
    "apparatusSensorType"         VARCHAR(25),
    "apparatusTubeType"           VARCHAR(100),
    "temperature"                 SMALLINT,
    "value"                       DOUBLE PRECISION NOT NULL,
    "hitsNumber"                  INTEGER,
    "startTime"                   TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    "endTime"                     TIMESTAMP WITHOUT TIME ZONE,
    "latitude"                    DOUBLE PRECISION NOT NULL,
    "longitude"                   DOUBLE PRECISION NOT NULL,
    "accuracy"                    REAL,
    "altitude"                    INTEGER,
    "altitudeAccuracy"            REAL,
    "deviceUuid"                  VARCHAR(100),
    "devicePlatform"              VARCHAR(100),
    "deviceVersion"               VARCHAR(100),
    "deviceModel"                 VARCHAR(100),
    "reportUuid"                  CHAR(36) PRIMARY KEY,
    "manualReporting"             BOOLEAN,
    "organisationReporting"       VARCHAR(100),
    "reportContext"               VARCHAR(25),
    "description"                 VARCHAR(1000),
    "measurementHeight"           INTEGER,
    "enclosedObject"              TEXT, 
    "userId"                      VARCHAR(100),
    "measurementEnvironment"      VARCHAR(25), 
    "dateAndTimeOfCreation"       TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    "qualification"               VARCHAR(25),
    "qualificationVotesNumber"    INTEGER,
    "reliability"                 INTEGER NOT NULL,
    "atypical"                    BOOLEAN NOT NULL
);

CREATE TABLE APIKEYS
(
    "apiKey"                      VARCHAR(100) PRIMARY KEY,
    "comment"                     VARCHAR(1000) NOT NULL,
    "role"                        VARCHAR(25) NOT NULL, -- test / prod / admin / mutable
    "submitAccessCount"           INTEGER NOT NULL,
    "requestAccessCount"          INTEGER NOT NULL
);

CREATE TABLE APIUSERS
(
    "userId"                      VARCHAR(100) PRIMARY KEY,
    "userPwd"                     VARCHAR(100) NOT NULL
);

CREATE TABLE TAGS
(
    "reportUuid"                  CHAR(36) NOT NULL,
    "tag"                         VARCHAR(100) NOT NULL,
    PRIMARY KEY ("reportUuid", "tag")
);

CREATE TABLE TILES
(
    "quadKey"                     VARCHAR(20) NOT NULL,
    "tile"                        BIT(1048576) NOT NULL,
    "opacity"                     BIT(458752) NOT NULL,
    PRIMARY KEY ("quadKey")
);







 