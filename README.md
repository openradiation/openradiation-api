# OpenRadiation
## Abstract
This project aims to develop a database to store environmental radioactivity measurements. It's shared in 3 parts : 
* backend : the postgresql backend database
* request_api : a JSON Rest-like API developed in node.js to request the database
* submit_api : a JSON Rest-like API developed in node.js to submit data to the database

First at all, to use the API you need a key. Please ask by sending an email to [dev@openradiation.org](mailto:dev@openradiation.org)
For only a few tests, you're allowed to use the following key : BDE8EBC61CB089B8CC997DD7A0D0A434

## Structure of the data

Description                                                             | Mandatory    | API Name 	         |  Type     | API request
---------------------------------------------------------------------------------------|---------------------|-----------|------------ 
Unique sensor identifier                                                |              | ApparatusID         |  String   | 
Sensor firmware version                                                 |              | ApparatusVersion    |  String   | 
Sensor type : geiger / photodiode                                       |              | ApparatusSensorType |  String   | 
Tube identification (only if ApparatusSensorType = geiger)              |              | ApparatusTubeType   |  String   | 
Temperature (°C)                                                        |              | Temperature         |  Integer  | 	X
*Value (µSv/h)*                                                         |      X       | Value               |  Integer  | 	
Hits Number                                                             |              | HitsNumber          |  Integer  | 		
Date of the beginning of the measurement (ISO GMT)                      |      X       | StartTime           | Timestamp |   		
Date of the end of the measurement (ISO GMT)                            |              | EndTime             | Timestamp |   	 
Latitude                                                                |      X       | Latitude            | Real      |   
Longitude                                                               |      X       | Longitude           | Real      |   
Position accuracy                                                       |              | Accuracy            | Real      |   
Height above sea in meters                                              |              | Height              | Integer   |   
Height accuracy                                                         |              | HeightAccuracy      | Real      |   
Smartphone device UUID  (see http://plugins.cordova.io/#/package/org.apache.cordova.device)  |  | DeviceUUID | String    |   
Smartphone platform                                                     |              | DevicePlatform      | String    |   



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







