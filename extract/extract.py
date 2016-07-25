#!/usr/bin/python
import psycopg2
#import psycopg2.extras
import sys
import pprint


conn_string = "host='" + sys.argv[1] + "' dbname='" + sys.argv[2] + "' user='" + sys.argv[3] + "' password='" + sys.argv[4] + "'"

conn = psycopg2.connect(conn_string)
cursor = conn.cursor()

measurements_file = open("./out/measurements.txt","w")
cursor.copy_to(measurements_file,"MEASUREMENTS",';','')

tags_file = open("./out/tags.txt","w")
cursor.copy_to(tags_file,"TAGS",';','')

columns = ['"apparatusId"','"apparatusVersion"','"apparatusSensorType"','"apparatusTubeType"','"temperature"','"value"','"hitsNumber"','"startTime"','"endTime"','"latitude"','"longitude"','"accuracy"','"altitude"','"altitudeAccuracy"','"deviceUuid"','"devicePlatform"','"deviceVersion"','"deviceModel"','"reportUuid"','"manualReporting"','"organisationReporting"','"reportContext"','"description"','"measurementHeight"','"userId"','"measurementEnvironment"','"dateAndTimeOfCreation"','"qualification"','"qualificationVotesNumber"','"reliability"','"atypical"']

measurements_withoutEnclosedObject_file = open("./out/measurements_withoutEnclosedObject.txt","w")
cursor.copy_to(measurements_withoutEnclosedObject_file,"MEASUREMENTS",';','',columns)


