#!/bin/bash

#please fill these parameters :
cert_directory=/appli/api/certs
letsencrypt_directory=/appli/letsencrypt/letsencrypt
appfile=/appli/api/api.js
export http_proxy="http://129.185.32.11:80"
export https_proxy="http://129.185.32.11:80"

#change directory
basedir=$(dirname $0) 

#stop service node.js
forever stopall

#try to renew
$letsencrypt_directory/letsencrypt-auto renew > $basedir/renew.log 2>&1
LE_STATUS=$?


/bin/cp /etc/letsencrypt/live/request.open-radiation.net/fullchain.pem $cert_directory/fullchain.pem
/bin/cp /etc/letsencrypt/live/request.open-radiation.net/privkey.pem $cert_directory/privkey.pem

forever start $appfile

if [ $LE_STATUS -ne 0 ]; then
    echo Automated renewal failed:
    cat $basedir/renew.log
    exit 1
fi



