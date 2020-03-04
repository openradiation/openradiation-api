# OpenRadiation

## Abstract
This project aims to develop a database to store environmental radioactivity measurements. It's shared in 2 parts : 
* backend : the postgresql backend database
* api : a JSON Rest-like API developed in node.js to request the database

Source code is under licence Apache 2.0 (cf https://www.openradiation.org/fr/conditions-dutilisation#licence_apache2)

First at all, to use the API you need a key. Please ask by sending an email to [dev@openradiation.net](mailto:dev@openradiation.net)
For only a few tests, you're allowed to use the following key : bde8ebc61cb089b8cc997dd7a0d0a434

By using this API, you accept the terms of use : https://www.openradiation.org/conditions-dutilisation

This project is self-sufficient, but it is designed to work with the openradiation.org website.
There is restricted access for this website to give informations about users and qualifications.
The API is designed to be installed in two parts : the submit api and the request api.

## Structure of the data

<table>
<tr><th>API Name</th><th>Type</th><th>Available for request API</th><th>Available for submit API</th><th>Description</th></tr>
<tr><td>apparatusId</td><td>String</td><td></td><td></td><td>Unique sensor identifier</td></tr>
<tr><td>apparatusVersion</td><td>String</td><td> </td><td> </td><td>Sensor firmware version</td></tr>
<tr><td>apparatusSensorType</td><td>String</td><td> </td><td> </td><td>Sensor type : geiger, photodiode</td></tr>
<tr><td>apparatusTubeType</td><td>String</td><td> </td><td> </td><td>Tube identification (only if apparatusSensorType = geiger)</td></tr>
<tr><td>temperature</td><td>Integer</td><td></td><td></td><td>Temperature (°C) </td></tr>
<tr><td>value</td><td>Real</td><td>*</td><td>Mandatory</td><td>value (µSv/h)</td></tr>
<tr><td>hitsNumber</td><td>Integer</td><td></td><td></td><td>Hits Number</td></tr>
<tr><td>calibrationFunction</td><td>String</td><td></td><td></td><td>Calibration function used to calculate µSv/h from cps (counts per second). Format should be inline with these symbols : cps 0-9. -+/*^() max,. Example : 7.543*(cps-0.02)^2+0.001*(cps-0.02)</td></tr>
<tr><td>startTime</td><td>Timestamp</td><td>*</td><td>Mandatory</td><td>Date of the beginning of the measurement (ISO GMT)</td></tr>
<tr><td>endTime</td><td>Timestamp</td><td></td><td> </td><td>Date of the end of the measurement (ISO GMT)</td></tr>
<tr><td>latitude</td><td>Real</td><td>*</td><td>Mandatory</td><td>latitude</td></tr>
<tr><td>longitude</td><td>Real</td><td>*</td><td>Mandatory</td><td>longitude</td></tr>
<tr><td>accuracy</td><td>Real</td><td></td><td> </td><td>Position accuracy in meters</td></tr>
<tr><td>altitude</td><td>Integer</td><td></td><td> </td><td>Altitude above sea in meters</td></tr>
<tr><td>altitudeAccuracy</td><td>Real</td><td></td><td> </td><td>Altitude accuracy in meters</td></tr>
<tr><td>endLatitude</td><td>Real</td><td></td><td></td><td>latitude at the end of the measurement</td></tr>
<tr><td>endLongitude</td><td>Real</td><td></td><td></td><td>longitude at the end of the measurement</td></tr>
<tr><td>endAccuracy</td><td>Real</td><td></td><td></td><td>Position accuracy in meters at the end of the measurement</td></tr>
<tr><td>endAltitude</td><td>Integer</td><td></td><td></td><td>Altitude above sea in meters at the end of the measurement</td></tr>
<tr><td>endAltitudeAccuracy</td><td>Real</td><td></td><td></td><td>Altitude accuracy in meters at the end of the measurement</td></tr>
<tr><td>deviceUuid</td><td>String</td><td></td><td> </td><td>Smartphone device UUID  (see http://plugins.cordova.io/#/package/org.apache.cordova.device)</td></tr>
<tr><td>devicePlatform</td><td>String</td><td></td><td> </td><td>Smartphone device platform</td></tr>
<tr><td>deviceVersion</td><td>String</td><td></td><td> </td><td>Smartphone device OS version</td></tr>
<tr><td>deviceModel</td><td>String</td><td></td><td> </td><td>Smartphone device model</td></tr>
<tr><td>reportUuid</td><td>String</td><td>*</td><td>Mandatory</td><td>Unique measurement UUID (UUIDv4 format) client-side generated</td></tr>
<tr><td>manualReporting</td><td>Boolean</td><td></td><td></td><td>Manual Reporting : true, false (default:true). False if the data is not entered by a human being</td></tr>
<tr><td>organisationReporting</td><td>String</td><td></td><td></td><td>Software version (sample:openradiation_v1)</td></tr>
<tr><td>reportContext</td><td>String</td><td>Never</td><td></td><td>Report context : emergency, routine, exercise, test (default:test). test:data are not registrated but you can test api use, emergency and exercise:not used,routine:you should use this one !</td></tr>
<tr><td>description</td><td>String</td><td></td><td></td><td>Free description (only if userId is specified)</td></tr>
<tr><td>measurementHeight</td><td>Integer</td><td></td><td></td><td>Measurement height above the ground (in meters)</td></tr>
<tr><td>tags</td><td>Json array of string</td><td></td><td></td><td>Free tags list [tag1 ; tag2] (only if userId is specified)</td></tr>
<tr><td>enclosedObject</td><td>String</td><td></td><td></td><td>Base64 encoded Image. The size shoudn't exceeded 1mb and format should be closed from 600*800 pixels (width * height). The value should be a data URI scheme 'data:image/<subtype>;base64,<data>'. (only if userId is specified)</td></tr>
<tr><td>userId</td><td>String</td><td></td><td></td><td>Openradiation.org user id</td></tr>
<tr><td>userPwd</td><td>String</td><td>Never</td><td></td><td>Openradiation.org plain text password (mandatory if userId is specified)</td></tr>
<tr><td>measurementEnvironment</td><td>String</td><td></td><td></td><td>Measurement environment : countryside, city, ontheroad, inside, plane. (if plane, qualification is set to noenvironmentalcontext and qualificationVotesNumber is set to 0)</td></tr>
<tr><td>rain</td><td>Boolean</td><td></td><td></td><td>Rain : true if it rains during the measurement</td></tr>
<tr><td>flightNumber</td><td>String</td><td></td><td></td><td>if measurementEnvironment is plane, flightNumber of the commercial flight in capital letters (AITA code followed by number, example: AF179)</td></tr>
<tr><td>seatNumber</td><td>String</td><td></td><td></td><td>if measurementEnvironment is plane, seatNumber in capital letters with row number first (example: 14C)</td></tr>
<tr><td>windowSeat</td><td>Boolean</td><td></td><td></td><td>if measurementEnvironment is plane, windowSeat : true if the seat where is the sensor is next to the window</td></tr>
<tr><td>storm</td><td>Boolean</td><td></td><td></td><td>Storm : true if storm crossing during the measurement</td></tr>
<tr><td>flightId</td><td>Integer</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber setted, measurement is associated to a flightId (flightId permits to retrieve all measurements in a same flight)</td></tr>
<tr><td>refinedLatitude</td><td>Real</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber recognize, latitude is refined with the track of the plane</td></tr>
<tr><td>refinedLongitude</td><td>Real</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber recognize, longitude is refined with the track of the plane</td></tr>
<tr><td>refinedAltitude</td><td>Integer</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber recognize, altitude is refined with the track of the plane</td></tr>
<tr><td>refinedEndLatitude</td><td>Real</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber recognize, endLatitude is refined with the track of the plane</td></tr>
<tr><td>refinedEndLongitude</td><td>Real</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber recognize, endLongitude is refined with the track of the plane</td></tr>	
<tr><td>refinedEndAltitude</td><td>Integer</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber recognize, endAltitude is refined with the track of the plane</td></tr>
<tr><td>departureTime</td><td>Timestamp</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber recognize, actual departure time of the plane</td></tr>
<tr><td>arrivalTime</td><td>Timestamp</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber recognize, actual arrival time of the plane</td></tr>
<tr><td>airportOrigin</td><td>String</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber recognize, airport origin (AITA) of the plane</td></tr>
<tr><td>airportDestination</td><td>String</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber recognize, airport destination (AITA) of the plane</td></tr>	
<tr><td>aircraftType</td><td>String</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber recognize, aircraft type of the plane</td></tr>
<tr><td>firstLatitude</td><td>Real</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber setted, latitude of the first measurement or latitude of the origin airport</td></tr>
<tr><td>firstLongitude</td><td>Real</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber setted, longitude of the first measurement or longitude of the origin airport</td></tr>
<tr><td>midLatitude</td><td>Real</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber setted, latitude picked up from a measurement or in the middle of the plane track</td></tr>
<tr><td>midLongitude</td><td>Real</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber setted, longitude picked up from a measurement or in the middle of the plane track</td></tr>
<tr><td>lastLatitude</td><td>Real</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber setted, latitude of the last measurement or latitude of the destination airport</td></tr>
<tr><td>lastLongitude</td><td>Real</td><td></td><td>No, determinated by the API</td><td>if measurementEnvironment is plane and flightNumber setted, longitude of the last measurement or longitude of the destination airport</td></tr>
<tr><td>dateAndTimeOfCreation</td><td>Timestamp</td><td></td><td>No, but always determinated by the API</td><td>Date of registration in the database</td></tr>
<tr><td>qualification</td><td>String</td><td>*</td><td>No, determinated by the API or the website</td><td>plane, wrongmeasurement, temporarysource, groundlevel</td></tr>
<tr><td>qualificationVotesNumber</td><td>Integer</td><td></td><td>No, determinated by the API or the website</td><td>qualification Votes Number</td></tr>
<tr><td>reliability</td><td>Integer</td><td></td><td>No, but always determinated by the API and never modified</td><td>Estimated reliability that the measurement is correct. Calculated when submitted to the API as following : +1 for each filled field, + min(30,HitsNumber) if HitsNumber not null, +10 if userId not null, +20 if ManualReporting=false, +20 if MeasurementEnvironment=countryside / +10 if MeasurementEnvironment=city or ontheroad, +10 if MeasurementHeight=1. Expecting > 78 (if not qualification is set to mustbeverified and qualificationVotesNumber is set to 0)</td></tr>
<tr><td>atypical</td><td>Boolean</td><td>*</td><td>No, but always determinated by the API and never modified</td><td>atypical if value is not representative of an environnemental measure. No if value < 0.2 (but we should compare value to an estimated local reference ...), yes otherwise</td></tr>
</table>

## Anatomy of the OpenRadiation API

### Error codes & responses

The OpenRadiation API attempts to return appropriate HTTP status codes for ever request

<table>
<tr><th>HTTP status code</th><th>Text</th><th>Description</th></tr>
<tr><td>200</td><td>OK</td><td>API requested with success, the API will return a JSON object described as below</td>
<tr><td>201</td><td>Created</td><td>API submitted with success and ressource created</td>
<tr><td>400</td><td>Bad Request</td><td>The request is invalid. An error message is returned (described as below)</td>
<tr><td>401</td><td>Unauthorized</td><td>apiKey is incorrect. An error message is returned (described as below)</td>
<tr><td>403</td><td>Forbidden</td><td>The request is understood, but it has been refused. An error message is returned (described as below)</td>
<tr><td>404</td><td>Not Found</td><td>The URI requested is invalid</td>
<tr><td>413</td><td>Request Entity Too Large</td><td>The request entity is too large</td>
<tr><td>500</td><td>Internal Server Error</td><td>Something is broken. You can send an mail to dev@openradiation.net so that we can investigate</td>
</table>

Error message response will look like : 

    {
        "error": {
            "code": "`An application-specific error code, expressed as a string value`",
            "message": "`A short, human-readable summary of the problem`"
        }
    }

### Requesting the API

The endpoint for request API is https://request.openradiation.net/

By default, all requests will be limited to the 400 last measurements within the criterias (considering startTime). 
This max number is in the response group and defined in the properties file.

General fields in the query strings : 
* response=complete : render all fields and not only stared fields (see "Available for request API" column above), available for all requests.
* withEnclosedObject=no : the enclosedObject will not be in the response group (due to length spare considerations), available for all requests.
* maxNumber=`maxNumber` : limit the number of measurements in the response to maxNumber instead of default, only available for bulk requests. This number cannot be upper than the default maxNumber limit.

#### Simple request

To get a unique measurement having the reportUuid (reportUuid should already exist in the database): 
    
    GET /measurements/`reportUuid`?apiKey=`apiKey`   
    GET /measurements/`reportUuid`?apiKey=`apiKey`&response=complete
    GET /measurements/`reportUuid`?apiKey=`apiKey`&response=complete&withEnclosedObject=no

Response will look like : 
    
    {
        "data": {
            "reportUuid": "`reportUuid`",
            "latitude": `latitude`,
            "longitude": `longitude`,
            "value": `value`,
            "startTime": "`startTime`",
            "qualification": "`qualification`",
            "atypical": `atypical`  
        }
    }
    
#### Bulk requests

To get a multiple measurements with combined complex criterias : 

* with min/max bounds : value, startTime, latitude, longitude (sample : minValue/maxValue)
* with an unique criteria : userId, qualification, tag, atypical, flightId

All these criterias can be combined :

    GET /measurements?apiKey=`apiKey`
    GET /measurements?apiKey=`apiKey`&minValue=`value`&userId=`userId`&minstartTime=`startTime`&tag=`tag`&response=complete&maxNumber=`maxNumber`&withEnclosedObject=no
    GET /measurements?apiKey=`apiKey`&minStartTime=`startTime`&maxStartTime=`startTime`&qualification=`qualification`
    
Sample : to get the last measurements all over the world

    https://request.openradiation.net/measurements?apiKey=bde8ebc61cb089b8cc997dd7a0d0a434
    
Response will look like : 
    
    {
        "maxNumber":`maxNumber`,
        "data": [
            {
                "reportUuid": "`reportUuid`",
                "latitude": `latitude`,
                "longitude": `longitude`,
                "value": `value`,
                "startTime": "`startTime`",
                "qualification": "`qualification`",
                "atypical": `atypical`
            }, 
            {
                "reportUuid": "`reportUuid`",
                "latitude": `latitude`,
                "longitude": `longitude`,
                "value": `value`,
                "startTime": "`startTime`",
                "qualification": "`qualification`",
                "atypical": `atypical`
            },
            ...
        ]
    }
    
To get all flights : 

    GET /flights?apiKey=`apiKey`
    
Response will look like : 
    
    {
        "data": [
            {
                "flightId": "`flightId`", 
                "flightNumber": `flightNumber`, 
                "departureTime": "`departureTime`", 
                "arrivalTime": "`arrivalTime`", 
                "airportOrigin": "`airportOrigin`", 
                "airportDestination": "`airportDestination`", 
                "aircraftType": "`aircraftType`", 
                "firstLatitude": `firstLatitude`, 
                "firstLongitude": `firstLongitude`, 
                "midLatitude": `midLatitude`, 
                "midLongitude": `midLongitude`, 
                "lastLatitude": `lastLatitude`, 
                "lastLongitude": `lastLongitude`
            }, 
            {
                "flightId": "`flightId`", 
                "flightNumber": `flightNumber`, 
                "departureTime": "`departureTime`", 
                "arrivalTime": "`arrivalTime`", 
                "airportOrigin": "`airportOrigin`", 
                "airportDestination": "`airportDestination`", 
                "aircraftType": "`aircraftType`", 
                "firstLatitude": `firstLatitude`, 
                "firstLongitude": `firstLongitude`, 
                "midLatitude": `midLatitude`, 
                "midLongitude": `midLongitude`, 
                "lastLatitude": `lastLatitude`, 
                "lastLongitude": `lastLongitude`
            },
            ...
        ]
    }
    
#### Restricted access to the API

*This restricted access is only available for openradiation.org website with a special secret key*

To get the all the measurements in one specific day based on DateAndTimeOfCreation criteria (for this request there is no default maxNumber limit) :

    GET /measurements?apiKey=`apiKey`&dateOfCreation=`date`
    GET /measurements?apiKey=`apiKey`&dateOfCreation=`date`&withEnclosedObject=no&maxNumber=`maxNumber`

    Response will look like : 
    
    {
        "data": [
            {
                "reportUuid": "`reportUuid`",
                "latitude": `latitude`,
                "longitude": `longitude`,
                "value": `value`,
                "startTime": "`startTime`",
                "qualification": "`qualification`",
                "atypical": `atypical`
            }, 
            {
                "reportUuid": "`reportUuid`",
                "latitude": `latitude`,
                "longitude": `longitude`,
                "value": `value`,
                "startTime": "`startTime`",
                "qualification": "`qualification`",
                "atypical": `atypical`
            },
            ...
        ]
    }
    
### Submitting data to the API

The endpoint for submit API is https://submit.openradiation.net/. 

#### To submit a measurement

    POST /measurements 
    Content-Type: application/vnd.api+json
    Accept: application/vnd.api+json
    {
        "apiKey": "`apiKey`",
        "data": {
            "reportUuid": "`reportUuid`",
            "latitude": `latitude`,
            "longitude": `longitude`,
            "value": `value`,
            "startTime": "`startTime`"
            ....
        }
    }
    
#### Restricted access to the API

*This restricted access is only available for openradiation.org website with a special secret key*

To communicate the list of users  :

    PUT /users
    Content-Type: application/vnd.api+json
    Accept: application/vnd.api+json
    {
        "apiKey": "`apiKey`",
        "data": [{
            "userId": "`userId`",
            "userPwd": "`userPwd`"
            },{ 
                ....
            }
        ]
    }
     
To update the qualification criteria for a unique measurement :

    POST /measurements/`reportUuid`
    Content-Type: application/vnd.api+json
    Accept: application/vnd.api+json
    {
        "apiKey": "`apiKey`",
        "data": {
            "qualification": "`qualification`",
            "qualificationVotesNumber": `qualificationVotesNumber`
        }
    }
      

## Install with Docker 
This project can be start with docker 
* install docker https://docs.docker.com/docker-for-windows/install/ 

* Create your images and containers for PostreSQL 9.4 :
```
    docker-compose up -d postgres
```
* copy of your dump into the postgres container : 
```
   docker cp openradiation.dmp openradiation-api_postgres_1:/openradiation.dmp
```

* create database openradiation :
```
    docker ps --all //to see <postresID>
    docker exec -it <postresID> bash
    psql -U postgres
    create database openradiation;
```

* dump of database :
```
    \q
    pg_restore -Fc -i -U postgres -d openradiation -c /openradiation.dmp
```

* create your container nodeJS 6.9.3 :
```
    exit
    docker-compose up -d app
```
   
