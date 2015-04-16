# OpenRadiation
## Abstract
This project aims to develop a database to store environmental radioactivity measurements. It's shared in 3 parts : 
* backend : the postgresql backend database
* request_api : a JSON Rest-like API developed in node.js to request the database
* submit_api : a JSON Rest-like API developed in node.js to submit data to the database

First at all, to use the API you need a key. Please ask by sending an email to [dev@openradiation.net](mailto:dev@openradiation.net)
For only a few tests, you're allowed to use the following key : BDE8EBC61CB089B8CC997DD7A0D0A434

## Structure of the data

<table>
<tr><th>API Name</th><th>Type</th><th>Available for request API</th><th>Available for submit API</th><th>Description</th></tr>
<tr><td>ApparatusID</td><td>String</td><td></td><td></td><td>Unique sensor identifier</td></tr>
<tr><td>ApparatusVersion</td><td>String</td><td> </td><td> </td><td>Sensor firmware version</td></tr>
<tr><td>ApparatusSensorType</td><td>String</td><td> </td><td> </td><td>Sensor type : geiger, photodiode</td></tr>
<tr><td>ApparatusTubeType</td><td>String</td><td> </td><td> </td><td>Tube identification (only if ApparatusSensorType = geiger)</td></tr>
<tr><td>Temperature</td><td>Integer</td><td></td><td></td><td>Temperature (°C) </td></tr>
<tr><td>Value</td><td>Real</td><td>*</td><td>Mandatory</td><td>Value (µSv/h)</td></tr>
<tr><td>HitsNumber</td><td>Integer</td><td></td><td></td><td>Hits Number</td></tr>
<tr><td>StartTime</td><td>Timestamp</td><td>*</td><td>Mandatory</td><td>Date of the beginning of the measurement (ISO GMT)</td></tr>
<tr><td>EndTime</td><td>Timestamp</td><td></td><td> </td><td>Date of the end of the measurement (ISO GMT)</td></tr>
<tr><td>Latitude</td><td>Real</td><td>*</td><td>Mandatory</td><td>Latitude</td></tr>
<tr><td>Longitude</td><td>Real</td><td>*</td><td>Mandatory</td><td>Longitude</td></tr>
<tr><td>Accuracy</td><td>Real</td><td></td><td> </td><td>Position accuracy</td></tr>
<tr><td>Height</td><td>Integer</td><td></td><td> </td><td>Height above sea in meters</td></tr>
<tr><td>HeightAccuracy</td><td>Real</td><td></td><td> </td><td>Height accuracy</td></tr>
<tr><td>DeviceUUID</td><td>String</td><td></td><td> </td><td>Smartphone device UUID  (see http://plugins.cordova.io/#/package/org.apache.cordova.device)</td></tr>
<tr><td>DevicePlatform</td><td>String</td><td></td><td> </td><td>Smartphone device platform</td></tr>
<tr><td>DeviceVersion</td><td>String</td><td></td><td> </td><td>Smartphone device OS version</td></tr>
<tr><td>DeviceModel</td><td>String</td><td></td><td> </td><td>Smartphone device model</td></tr>
<tr><td>ReportUUID</td><td>String</td><td>*</td><td>Mandatory</td><td>Unique measurement UUID (UUIDv4 format) client-side generated</td></tr>
<tr><td>ManualReporting</td><td>Boolean</td><td></td><td></td><td>Manual Reporting : true, false (default:true). False if the data is not entered by a human being</td></tr>
<tr><td>OrganisationReporting</td><td>String</td><td></td><td></td><td>Software version (sample:openradiation_v1)</td></tr>
<tr><td>ReportContext</td><td>String</td><td>Never</td><td></td><td>Report context : emergency, routine, exercise, test (default:test). test:data are not registrated but you can test api use, emergency and exercise:not used,routine:you should use this one !</td></tr>
<tr><td>Description</td><td>String</td><td></td><td></td><td>Free description</td></tr>
<tr><td>MeasurementHeight</td><td>Integer</td><td></td><td></td><td>Measurement height above the ground (in meters)</td></tr>
<tr><td>Tags</td><td>String Array</td><td></td><td></td><td>Free tags list [tag1 ; tag2]</td></tr>
<tr><td>EnclosedObject</td><td>Binary</td><td></td><td></td><td>Photograph</td></tr>
<tr><td>UserID</td><td>String</td><td></td><td></td><td>Openradiation.org user id</td></tr>
<tr><td>UserPwd</td><td>String</td><td>Never</td><td></td><td>Openradiation.org MD5 password (mandatory if UserID is specified)</td></tr>
<tr><td>MeasurementEnvironment</td><td>String</td><td></td><td></td><td>Measurement Environment : countryside, city, ontheroad, inside</td></tr>
<tr><td>DateAndTimeOfCreation</td><td>Timestamp</td><td></td><td>No, but always determinated by the API</td><td>Date of registration in the database</td></tr>
<tr><td>Qualification</td><td>String</td><td>*</td><td>No, determinated by the API or the website</td><td>Qualification : seemscorrect, mustbeverified, noenvironmentalcontext, badsensor, badprotocole, baddatatransmission</td></tr>
<tr><td>QualificationVotesNumber</td><td>Integer</td><td></td><td>No, determinated by the API or the website</td><td>Qualification Votes Number</td></tr>
<tr><td>Reliability</td><td>Integer</td><td></td><td>No, but always determinated by the API and never modified</td><td>Estimated reliability that the measurement is correct. Calculated when submitted to the API as following : +1 for each filled field, + min(30,HitsNumber) if HitsNumber not null, +10 if UserID not null, +20 if ManualReporting=false, +20 if MeasurementEnvironment=countryside / +10 if MeasurementEnvironment=city, +20 if MeasurementHeight=1. Expecting > 100 (if not Qualification is set to mustbeverified and QualificationVotesNumber is set to 0)</td></tr>
<tr><td>Atypical</td><td>Boolean</td><td>*</td><td>No, but always determinated by the API and never modified</td><td>Atypical if value is not representative of an environnemental measure. No if value < 0.2 (but we should compare value to an estimated local reference ...), yes otherwise</td></tr>
</table>

## Anatomy of the request API

The endpoint for request API is http://requestapi.openradiation.net/. 

By default, all requests will be limited to the 1000 last measurements within the criterias (considering StartTime). 
This max number is in the responseGroup and defined in the properties file.

General fields in the query strings : 

* Response=complete : render all fields and not only stared fields (see "Available for request API" column above), available for all requests.
* EnclosedObject=no : the EnclosedObject will not be in the response group (due to length spare considerations), available for all requests.
* MaxNumber=`MaxNumber` : limit the number of measurements in the response to MaxNumber instead of default, only available for bulk requests. This number cannot be upper than the default MaxNumber limit.

### Bulk requests

To get the last measurements all over the world :
    
    GET /measurements?APIKey=`APIKey`
    sample : http://requestapi.openradiation.net/measurements?APIKey=BDE8EBC61CB089B8CC997DD7A0D0A434

To get a multiple measurements with combined complex criterias : 
- with min/max bounds : Value, Startime, Latitude, Longitude (sample : minValue/maxValue)
- with an unique criteria : UserID, Qualification, Tag, Atypical

    GET /measurements?APIKey=`APIKey`&minValue=`Value`&UserID=`userid`&minStartime=`Startime`&Tag=`Tag`&Response=complete&MaxNumber=`MaxNumber`&EnclosedObject=no
    GET /measurements?APIKey=`APIKey`&minStartime=`Startime`&maxStartime=`Startime`&Qualification=`Qualification`

Response will look like : 
    
    {
        "maxnumber":`MaxNumber`,
        "data": [
            {
                "ReportUUID": "`ReportUUID`",
                "Latitude": `Latitude`,
                "Longitude": `Longitude`,
                "Value": `Value`,
                "StartTime": "`StartTime`",
                "Qualification": "`Qualification`",
                "Atypical": `Atypical`
            }, 
            {
                "ReportUUID": "`ReportUUID`",
                "Latitude": `Latitude`,
                "Longitude": `Longitude`,
                "Value": `Value`,
                "StartTime": "`StartTime`",
                "Qualification": "`Qualification`",
                "Atypical": `Atypical`
            },
            ...
        ]
    }
    
    or 
    
    {
        "error": {
            "code": "`An application-specific error code, expressed as a string value`",
            "title": "`A short, human-readable summary of the problem`"
        }
    }
    

### Simple request

To get a unique measurement having the ReportUUID (ReportUUID should already exist in the database): 
    
    GET /measurements/`ReportUUID`?APIKey=`APIKey`   
    GET /measurements/`ReportUUID`?APIKey=`APIKey`&Response=complete
    GET /measurements/`ReportUUID`?APIKey=`APIKey`&Response=complete&EnclosedObject=no

Response will look like : 
    
    {
        "data": {
            "ReportUUID": "`ReportUUID`",
            "Latitude": `Latitude`,
            "Longitude": `Longitude`,
            "Value": `Value`,
            "StartTime": "`StartTime`",
            "Qualification": "`Qualification`",
            "Atypical": `Atypical`  
        }
    }
    
or 
    
    {
        "error": {
            "code": "`An application-specific error code, expressed as a string value`",
            "title": "`A short, human-readable summary of the problem`"
        }
    }
    
### Restricted access to the API

*This restricted access is only available for openradiation.org website, with a secret key different from the API Key*

To get the all the measurements in one specific day based on DateAndTimeOfCreation criteria (for this request there is no default MaxNumber limit) :

    GET /measurements?APIPrivateKey=`APIPrivateKey`&DateOfCreation=`Date`
    GET /measurements?APIPrivateKey=`APIPrivateKey`&DateOfCreation=`Date`&EnclosedObject=no&MaxNumber=`MaxNumber`

    Response will look like : 
    
    {
        "data": [
            {
                "ReportUUID": "`ReportUUID`",
                "Latitude": `Latitude`,
                "Longitude": `Longitude`,
                "Value": `Value`,
                "StartTime": "`StartTime`",
                "Qualification": "`Qualification`",
                "Atypical": `Atypical`
            }, 
            {
                "ReportUUID": "`ReportUUID`",
                "Latitude": `Latitude`,
                "Longitude": `Longitude`,
                "Value": `Value`,
                "StartTime": "`StartTime`",
                "Qualification": "`Qualification`",
                "Atypical": `Atypical`
            },
            ...
        ]
    }
    
    or 
    
    {
        "error": {
            "code": "`An application-specific error code, expressed as a string value`",
            "title": "`A short, human-readable summary of the problem`"
        }
    }

## Anatomy of the submit API

The endpoint for request API is https://submitapi.openradiation.net/. 

By default, all requests will be limited to the 1000 last measurements within the criterias (considering StartTime). 
This max number is in the responseGroup and defined in the properties file.

### To submit a measurement

    POST /measurements 
    Content-Type: application/vnd.api+json
    Accept: application/vnd.api+json
    {
        "APIKey": `APIKey`,
        "data": {
            "ReportUUID": "`ReportUUID`",
            "Latitude": `Latitude`,
            "Longitude": `Longitude`,
            "Value": `Value`,
            "StartTime": "`StartTime`"
            ....
        }
    }
  
Response will look like : 
    
    {}
    
or 
    
    {
        "error": {
            "code": "`An application-specific error code, expressed as a string value`",
            "title": "`A short, human-readable summary of the problem`"
        }
    }
    
### Restricted access to the API

*This restricted access is only available for openradiation.org website, with a secret key different from the API Key*

To communicate the list of users  :

    PUT /users
    Content-Type: application/vnd.api+json
    Accept: application/vnd.api+json
    {
        "APIPrivateKey": `APIPrivateKey`,
        "data": [{
            "UserID": "`UserID`",
            "UserPwd": "`UserPwd`"
            },{ 
                ....
            }
        ]
    }
  
Response will look like : 
    
    {}
    
or 
    
    {
        "error": {
            "code": "`An application-specific error code, expressed as a string value`",
            "title": "`A short, human-readable summary of the problem`"
        }
    }    
    
To update the Qualification criteria for a unique measurement :

    POST /measurements/`ReportUUID`
    Content-Type: application/vnd.api+json
    Accept: application/vnd.api+json
    {
        "APIPrivateKey": `APIPrivateKey`,
        "data": {
            "Qualification": "`Qualification`",
            "QualificationVotesNumber": `QualificationVotesNumber`
        }
    }
  
Response will look like : 
    
    {}
    
or 
    
    {
        "error": {
            "code": "`An application-specific error code, expressed as a string value`",
            "title": "`A short, human-readable summary of the problem`"
        }
    }    
    