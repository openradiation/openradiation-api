# OpenRadiation
## Abstract
This project aims to develop a database to store environmental radioactivity measurements. It's shared in 2 parts : 
* backend : the postgresql backend database
* api : a JSON Rest-like API developed in node.js to request the database

First at all, to use the API you need a key. Please ask by sending an email to [dev@openradiation.net](mailto:dev@openradiation.net)
For only a few tests, you're allowed to use the following key : bde8ebc61cb089b8cc997dd7a0d0a434

This project is self-sufficient, but it is designed to work with the openradiation.org website.
There is restricted access for this website to give informations about users and qualifications.
The API is designed to be installed in two parts : the submit api and the request api.

## Structure of the data

<table>
<tr><th>API Name</th><th>Type</th><th>Available for request API</th><th>Available for submit API</th><th>Description</th></tr>
<tr><td>apparatusID</td><td>String</td><td></td><td></td><td>Unique sensor identifier</td></tr>
<tr><td>apparatusVersion</td><td>String</td><td> </td><td> </td><td>Sensor firmware version</td></tr>
<tr><td>apparatusSensorType</td><td>String</td><td> </td><td> </td><td>Sensor type : geiger, photodiode</td></tr>
<tr><td>apparatusTubeType</td><td>String</td><td> </td><td> </td><td>Tube identification (only if ApparatusSensorType = geiger)</td></tr>
<tr><td>temperature</td><td>Integer</td><td></td><td></td><td>Temperature (°C) </td></tr>
<tr><td>value</td><td>Real</td><td>*</td><td>Mandatory</td><td>value (µSv/h)</td></tr>
<tr><td>hitsNumber</td><td>Integer</td><td></td><td></td><td>Hits Number</td></tr>
<tr><td>startTime</td><td>Timestamp</td><td>*</td><td>Mandatory</td><td>Date of the beginning of the measurement (ISO GMT)</td></tr>
<tr><td>endTime</td><td>Timestamp</td><td></td><td> </td><td>Date of the end of the measurement (ISO GMT)</td></tr>
<tr><td>latitude</td><td>Real</td><td>*</td><td>Mandatory</td><td>latitude</td></tr>
<tr><td>longitude</td><td>Real</td><td>*</td><td>Mandatory</td><td>longitude</td></tr>
<tr><td>accuracy</td><td>Real</td><td></td><td> </td><td>Position accuracy</td></tr>
<tr><td>height</td><td>Integer</td><td></td><td> </td><td>Height above sea in meters</td></tr>
<tr><td>heightAccuracy</td><td>Real</td><td></td><td> </td><td>Height accuracy</td></tr>
<tr><td>deviceUuid</td><td>String</td><td></td><td> </td><td>Smartphone device UUID  (see http://plugins.cordova.io/#/package/org.apache.cordova.device)</td></tr>
<tr><td>devicePlatform</td><td>String</td><td></td><td> </td><td>Smartphone device platform</td></tr>
<tr><td>deviceVersion</td><td>String</td><td></td><td> </td><td>Smartphone device OS version</td></tr>
<tr><td>deviceModel</td><td>String</td><td></td><td> </td><td>Smartphone device model</td></tr>
<tr><td>reportUuid</td><td>String</td><td>*</td><td>Mandatory</td><td>Unique measurement UUID (UUIDv4 format) client-side generated</td></tr>
<tr><td>manualReporting</td><td>Boolean</td><td></td><td></td><td>Manual Reporting : true, false (default:true). False if the data is not entered by a human being</td></tr>
<tr><td>organisationReporting</td><td>String</td><td></td><td></td><td>Software version (sample:openradiation_v1)</td></tr>
<tr><td>reportContext</td><td>String</td><td>Never</td><td></td><td>Report context : emergency, routine, exercise, test (default:test). test:data are not registrated but you can test api use, emergency and exercise:not used,routine:you should use this one !</td></tr>
<tr><td>description</td><td>String</td><td></td><td></td><td>Free description</td></tr>
<tr><td>measurementHeight</td><td>Integer</td><td></td><td></td><td>Measurement height above the ground (in meters)</td></tr>
<tr><td>tags</td><td>Json array of string</td><td></td><td></td><td>Free tags list [tag1 ; tag2]</td></tr>
<tr><td>enclosedObject</td><td>String</td><td></td><td></td><td>Base64 encoded Image. The size shoudn't exceeded 1mb and format should be closed from 600*800 pixels (width * height). The value should be a data URI scheme 'data:image/<subtype>;base64,<data>'</td></tr>
<tr><td>userId</td><td>String</td><td></td><td></td><td>Openradiation.org user id</td></tr>
<tr><td>userPwd</td><td>String</td><td>Never</td><td></td><td>Openradiation.org MD5 password (mandatory if userId is specified)</td></tr>
<tr><td>measurementEnvironment</td><td>String</td><td></td><td></td><td>Measurement Environment : countryside, city, ontheroad, inside</td></tr>
<tr><td>dateAndTimeOfCreation</td><td>Timestamp</td><td></td><td>No, but always determinated by the API</td><td>Date of registration in the database</td></tr>
<tr><td>qualification</td><td>String</td><td>*</td><td>No, determinated by the API or the website</td><td>qualification : seemscorrect, mustbeverified, noenvironmentalcontext, badsensor, badprotocole, baddatatransmission</td></tr>
<tr><td>qualificationVotesNumber</td><td>Integer</td><td></td><td>No, determinated by the API or the website</td><td>qualification Votes Number</td></tr>
<tr><td>reliability</td><td>Integer</td><td></td><td>No, but always determinated by the API and never modified</td><td>Estimated reliability that the measurement is correct. Calculated when submitted to the API as following : +1 for each filled field, + min(30,HitsNumber) if HitsNumber not null, +10 if userId not null, +20 if ManualReporting=false, +20 if MeasurementEnvironment=countryside / +10 if MeasurementEnvironment=city, +20 if MeasurementHeight=1. Expecting > 100 (if not qualification is set to mustbeverified and qualificationVotesNumber is set to 0)</td></tr>
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

The endpoint for request API is https://requestapi.openradiation.net/

By default, all requests will be limited to the 1000 last measurements within the criterias (considering startTime). 
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
* with an unique criteria : userId, qualification, tag, atypical

All these criterias can be combined :

    GET /measurements?apiKey=`apiKey`
    GET /measurements?apiKey=`apiKey`&minValue=`value`&userId=`userId`&minstartTime=`startTime`&tag=`tag`&response=complete&maxNumber=`maxNumber`&withEnclosedObject=no
    GET /measurements?apiKey=`apiKey`&minStartTime=`startTime`&maxStartTime=`startTime`&qualification=`qualification`
    
Sample : to get the last measurements all over the world

    http://requestapi.openradiation.net/measurements?apiKey=bde8ebc61cb089b8cc997dd7a0d0a434
    
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

The endpoint for submit API is https://submitapi.openradiation.net/. 

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
      
    