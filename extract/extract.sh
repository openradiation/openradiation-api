#!/bin/bash

#please fill these parameters :
host=localhost
database=openradiation
user=requestapi
password=requestapi
result_filename=openradiation_dataset.tar.gz
html_filename=download.html
public_directory=/appli/api/public

#change directory
basedir=$(dirname $0) 
cd $basedir

#execute extract
python extract.py $host $database $user $password

#compress results
if [ $? -ne 0 ]; 
then
   echo "error in extract.py, stopping ..."
else
   echo "python ok"
   tar cvzf ./out/$result_filename ./out/measurements.txt ./out/tags.txt ./out/measurements_withoutEnclosedObject.txt

   #creating html page
   
   echo "<!DOCTYPE html>" > ./out/$html_filename 
   echo "<html lang=\"en\">" >> ./out/$html_filename
   echo "<head>" >> ./out/$html_filename
   echo "   <meta charset=\"utf-8\">" >> ./out/$html_filename
   echo "   <meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">" >> ./out/$html_filename
   echo "   <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" >> ./out/$html_filename
   echo "   <meta name=\"description\" content=\"\">" >> ./out/$html_filename
   echo "   <meta name=\"author\" content=\"\">" >> ./out/$html_filename
   echo "   <title>openradiation : rawdata download page</title>" >> ./out/$html_filename
   echo "</head>" >> ./out/$html_filename
   echo "<body>" >> ./out/$html_filename
   echo "<h1>Download openradiation dataset (raw data)</h1>" >> ./out/$html_filename
   echo "<p>last updated date : " >> ./out/$html_filename
   echo `date "+%Y-%m-%d %H:%M"` >> ./out/$html_filename
   echo "</p>" >> ./out/$html_filename
   echo "<p>There are three csv files in the tarball. The description of the measurements files follow the github description</p>" >> ./out/$html_filename
   echo "<p>measurements.txt (one measurement by row) : " >> ./out/$html_filename
   wc -l ./out/measurements.txt | awk '{print $1}' >> ./out/$html_filename
   echo " lines</p>" >> ./out/$html_filename
   echo "<p>tags.txt (all the tags for each measurements identified by reportUuid. format reportUuid;tag) : " >> ./out/$html_filename
   wc -l ./out/tags.txt | awk '{print $1}' >> ./out/$html_filename
   echo " lines</p>" >> ./out/$html_filename
   echo "<p>measurements_withoutEnclosedObject.txt (one measurement by row without the enclosedObject column) : " >> ./out/$html_filename
   wc -l ./out/measurements_withoutEnclosedObject.txt | awk '{print $1}' >> ./out/$html_filename
   echo " lines</p>" >> ./out/$html_filename
   echo "<a href=\"$result_filename\">Download here</a>" >> ./out/$html_filename
   echo "</body>" >> ./out/$html_filename
   echo "</html>" >> ./out/$html_filename

   cp ./out/$result_filename $public_directory/$result_filename
   cp ./out/$html_filename $public_directory/$html_filename
fi

