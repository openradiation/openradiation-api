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
<tr><th>Description</th><th>Mandatory</th><th>API Name</th><th>Type</th><th>Available for request API</th><th>Available for submit API</th></tr>
<tr><td>Unique sensor identifier</td><td> </td><td>ApparatusID</td><td>String</td><td></td>td></td></tr>
<tr><td>Sensor firmware version</td><td> </td><td>ApparatusVersion</td><td>String</td><td> </td><td> </td></tr>
<tr><td>Sensor type : geiger, photodiode</td><td> </td><td>ApparatusSensorType</td><td>String</td><td> </td><td> </td></tr>
<tr><td>Tube identification (only if ApparatusSensorType = geiger)</td><td> </td><td>ApparatusTubeType</td><td>String</td><td> </td><td> </td></tr>

<tr><td>Temperature (°C) </td><td></td><td>Temperature</td><td>Integer</td><td></td><td></td></tr>
<tr><td>Value (µSv/h)</td>yes<td></td><td>Value</td><td>Real</td><td>Always</td><td> </td></tr>
<tr><td>Hits Number</td><td></td><td>HitsNumber</td><td>Integer</td><td></td><td> </td></tr>
<tr><td>Date of the beginning of the measurement (ISO GMT)</td><td>yes</td><td>StartTime</td><td>Timestamp</td><td>Always</td><td></td></tr>
<tr><td>Date of the end of the measurement (ISO GMT)</td><td></td><td>EndTime</td><td>Timestamp</td><td></td><td> </td></tr>
<tr><td>Latitude</td><td>yes</td><td>Latitude</td><td>Real</td><td>Always</td><td> </td></tr>
<tr><td>Longitude</td><td>yes</td><td>Longitude</td><td>Real</td><td>Always</td><td> </td></tr>
<tr><td>Position accuracy</td><td></td><td>Accuracy</td><td>Real</td><td></td><td> </td></tr>
<tr><td>Height above sea in meters</td><td></td><td>Height</td><td>Integer</td><td></td><td> </td></tr>
<tr><td>Height accuracy</td><td></td><td>HeightAccuracy</td><td>Real</td><td></td><td> </td></tr>
<tr><td>Smartphone device UUID  (see http://plugins.cordova.io/#/package/org.apache.cordova.device)</td><td></td><td>DeviceUUID</td><td>String</td><td></td><td> </td></tr>
<tr><td>Smartphone device platform</td><td></td><td>DevicePlatform</td><td>String</td><td></td><td> </td></tr>
<tr><td>Smartphone device OS version</td><td></td><td>DeviceVersion</td><td>String</td><td></td><td> </td></tr>
<tr><td>Smartphone device model</td><td></td><td>DeviceModel</td><td>String</td><td></td><td> </td></tr>
<tr><td>Unique measurement UUID (UUIDv4 format)</td><td>yes</td><td>ReportUUID</td><td>String</td><td>Always</td><td> </td></tr>
<tr><td>Manual Reporting : true, false (default:true)</td><td></td><td>ManualReporting</td><td>Boolean</td><td></td><td> </td></tr>
<tr><td>Software version (sample:openradiation_v1)</td><td></td><td>OrganisationReporting</td><td>String</td><td></td><td> </td></tr>
<tr><td>Report context : emergency, routine, exercise, test (default:test). test:data are not registrated, emergency and exercise:not used,routine:you should use this one !</td><td></td><td>ReportContext</td><td>String</td><td>No</td><td> </td></tr>
<tr><td>Free description</td><td></td><td>Description</td><td>String</td><td>Always</td><td></td></tr>
<tr><td>Measurement height above the ground (in meters)</td><td></td><td>MeasurementHeight</td><td>Integer</td><td></td><td> </td></tr>
<tr><td>Tags list [tag1 ; tag2]</td><td></td><td>Tags</td><td>Json array of strings</td><td>Always</td><td> </td></tr>
<tr><td>Photograph</td><td></td><td>EnclosedObject</td><td>Binary</td><td></td><td> </td></tr>
<tr><td>Openradiation.org user id</td><td></td><td>UserID</td><td>String</td><td>Always</td><td> </td></tr>
<tr><td>Openradiation.org MD5 password</td><td></td><td>UserPwd</td><td>String</td><td>no</td><td> </td></tr>
<tr><td>Measurement Environment : countryside, city, ontheroad, inside</td><td></td><td>MeasurementEnvironment</td><td>String</td><td></td><td> </td></tr>
<tr><td>Date of registration in the database</td><td></td><td>DateAndTimeOfCreation</td><td>Timestamp</td><td>no</td><td>no, determinated by the API</td></tr>
<tr><td>Qualification : seemscorrect, mustbeverified, noenvironmental, badsensor, badprotocole, baddatatransmission</td><td></td><td>Qualification</td><td>String</td><td>Always</td><td>no, determinated by the website</td></tr>
<tr><td>Qualification Votes Number</td><td></td><td>QualificationVotesNumber</td><td>Integer</td><td></td><td>no, determinated by the website</td></tr>
<tr><td>Estimated reliability of the measurement when submitted to the API</td><td></td><td>Reliability</td><td>Integer</td><td></td><td> </td></tr>


</table>



## Anatomy of the request API

The endpoint for request API is http://request_api.openradiation.net/

To get the last measurements in all the world :
    
    GET /measurements?APIKey=`APIKey`
    sample : http://request_api.openradiation.net/measurements?APIKey=BDE8EBC61CB089B8CC997DD7A0D0A434

To get a unique measurement and a few metadata having the ReportUUID : 
    
    GET /measurements/`ReportUUID`?APIKey=`APIKey`
    
To get a unique measurement and all the metadata having the ReportUUID :  
    
    GET /measurements/`ReportUUID`?APIKey=`APIKey`&Response=Complete

    GET /measurements/`ReportUUID`?APIKey=`APIKey`







