
/**
 * Remove all geodesic's lines on the map
 * @param m map
 */
function removeOtherPlaneTrack() {
    for (let i in openradiation_map._layers) {
        if(openradiation_map._layers[i]._path != undefined && !openradiation_map._layers[i].flightData != undefined) {
            try {
                openradiation_map.removeLayer(openradiation_map._layers[i]);
            } catch(e) {
                console.log("problem with " + e + openradiation_map._layers[i]);
            }
        }
    }
    return true;
}

/**
 * add all plane track with GET /flights?apiKeys=****
 *
 * and prepare a popup in case of click on a line
 *      value for popup :   flightID
 *                          departureTime
 *                          arrivalTime
 *                          airportOrigin
 *                          airportDestination
 *                          aircraftType
 *                          + show tempory profile
 *
 */
function initPlaneTrack () {
    $.ajax({
        type: 'GET',
        url: '/flights?apiKey=' + apiKey,
        timeout: 15000,
        success: function(res) {
            const options = {
                weight: 7,
                opacity: 0.5,
                color: 'orange',
            };

            for (let i=1; i < res.data.length; i ++)
            {
                let points = [
                    [res.data[i].firstLatitude, res.data[i].firstLongitude],
                    [res.data[i].midLatitude, res.data[i].midLongitude],
                    [res.data[i].lastLatitude, res.data[i].lastLongitude]
                ];

                let flightData = {}
                flightData.points = points;
                flightData.flightId = res.data[i].flightId;
                flightData.flightNumber = res.data[i].flightNumber;
                flightData.airportOrigin = res.data[i].airportOrigin;
                flightData.airportDestination = res.data[i].airportDestination;
                flightData.aircraftType = res.data[i].aircraftType;
                flightData.startTime = res.data[i].departureTime;
                flightData.arrivalTime = res.data[i].arrivalTime;

                let geodesic = L.geodesic([], options).addTo(openradiation_map).addEventListener("click", function(e) {clickOnLine(e)});
                geodesic.setLatLngs([points]);

                //popup values
                geodesic.flightData = flightData;
            }
        },
        error: function(res, status, err) {
            console.log(err + " : " + status);
        }
    });
}

/**
 * Show popup of click on a marker
 *
 * @param e event
 * @param measurementURL
 */
function clickOnMarker(e, measurementURL) {
    $.ajax({
        type: 'GET',
        url: '/measurements/' + e.popup._source.reportUuid + '?apiKey=' + apiKey + '&response=complete',
        timeout: 15000,
        success: function(res) {
            let htmlPopup = constructMarkerPopup(res, measurementURL,e);
            e.popup.setContent(htmlPopup);
            if(res.data.flightId > 0) {
                clickOnFlightId(res,e);
            }
        },
        error: function(res, status, err) {
            console.log(err + " : " + status);
        }
    });
}

function clickOnFlightId(res, e){
    $('#seeflightId').click(function () {
       clickOnLine(res.data.flightId);
    })
}

/**
 *  when user click on a flight number of a marker
 * @param flightId
 */
function getFlightData(flightId) {
    let flightData = {}
    $.ajax({
        type: 'GET',
        url: '/flights' + '?apiKey=' + apiKey + '&flightId=' + flightId + '&response=complete',
        timeout: 15000,
        success: function(res) {
            const options = {
                weight: 7,
                opacity: 0.5,
                color: 'orange',
            };

            let points = [
                [res.data[0].firstLatitude, res.data[0].firstLongitude],
                [res.data[0].midLatitude, res.data[0].midLongitude],
                [res.data[0].lastLatitude, res.data[0].lastLongitude]
            ];

            flightData.points = points;
            flightData.flightId = res.data[0].flightId;
            flightData.flightNumber = res.data[0].flightNumber;
            flightData.airportOrigin = res.data[0].airportOrigin;
            flightData.airportDestination = res.data[0].airportDestination;
            flightData.aircraftType = res.data[0].aircraftType;
            flightData.startTime = res.data[0].departureTime;
            flightData.arrivalTime = res.data[0].arrivalTime;

            let geodesic = L.geodesic([], options).addTo(openradiation_map).addEventListener("click", function(e) {clickOnLine(e)});
            geodesic.setLatLngs([points]);

            //popup values
            geodesic.flightData = flightData;
        },
        error: function(res, status, err) {
            console.log(err + " : " + status);
        }
    });
    return flightData;
}

/**
 *  Show popup of click on a flight line
 * @param e event
 */
function clickOnLine(e) {
    let flightId;
    let data;

    if(e.target != undefined) {
        //click on line
        flightId = e.target.flightData.flightId;
        data = e.target.flightData;
    } else {
        //click on popup marker
        flightId = e;
        data = getFlightData(flightId);
    }

    $.ajax({
         type: 'GET',
         url: '/measurements' + '?apiKey=' + apiKey + '&flightId=' + flightId + '&response=complete',
         timeout: 15000,
         success: function (measurementsData) {
             $('.question').hide();
             let points = showMarker(measurementsData);
             showPlaneLine(data, points);
             listenLineClickUser();
         },
         error: function (res, status, err) {
             console.log(err + " : " + status);
         }
    })
}

/**
 * when the user click on the map, that will return on plane's view
 * but if the user just move the map, it will the same view
 */
function listenLineClickUser() {
    let map = $('#openradiation_map');

    map.on('mousedown', function (evt) {
        map.on('mouseup mousemove', function (evt) {
            if (evt.type === 'mouseup') {
                isflightLine=false;
                $('.question').show();
                openradiation_getItems(true);
                map.off('mouseup');
                map.off('mousedown');
                map.off('mousemove');
            } else {
                map.off('mouseup');
                map.off('mousemove');
            }
        });
    });
}

function showPlaneLine(data, points) {
    if(removeOtherPlaneTrack()) {
        const options = {
            weight: 7,
            opacity: 0.5,
            color: 'orange',
        };

        //add the first and the end point of line
        let objectLine = L.geodesic([], options).addTo(openradiation_map).bindPopup(constructFlightPopup(data,(points.length)));

        objectLine.setLatLngs([points]);
        //values for popup
        objectLine.flightData = data;
        objectLine.openPopup();
    }
}

/**
 *  flightID
 *  departureTime
 *  arrivalTime
 *  airportOrigin
 *  airportDestination
 *  aircraftType
 *  + show tempory profile
 *
 * @param e
 * @param numberMeasures
 */
function constructFlightPopup(data, numberMeasures) {
    //add flightId on url for timeline
    window.location.flightId = data.flightId;

    let html =
        "<div class='popupFlight' style=\"background-color:#ffffff; width:280px; overflow:hidden; min-height:130px;\">" +
        "<div style=\"margin:10px; border-bottom:solid #F1F1F1 1px;\">" +
        "<strong>" + translate("Flight") + " " + data.flightNumber;

    if(data.aircraftType != undefined) {
        html += " (" + data.aircraftType + ")";
        html += "</strong></div>";
    } else {
        html += "</strong></div>";
    }

    html += "<div style=\"margin:10px;\">";
    html += "<div style=\"float:right;\"><img src=\"/images/icon-env-plane.png\"/></div>";

    html += "<div style=\"margin-bottom:5px;\"><span class=\"value\">" + showIfExist(numberMeasures) + " " +
        translate("measurements") + "</span></div>";

    if(data.airportOrigin != undefined && data.airportDestination != undefined) {
        html +=
        "<table>" +
        "<tr>" +
            "<td class='value'>" + translate("From:") + " </td>" +
            "<td class='value'>" + data.airportOrigin +
            "<td class='value'>" + " - " + showIfExist(formatISODate(data.startTime)) + "</td>" +
        "</tr>" +
        "<tr>" +
            "<td class='value'>" + translate("To:") + " </td>" +
            "<td class='value'>" + data.airportDestination +
            "<td class='value'>" + " - " + showIfExist(formatISODate(data.arrivalTime)) + "</td>" +
        "</tr>" +
        "</table>";
    }

    html += "</div>";
    html +=   '<div><ul onclick="clickOnProfilTemporel(true)"><span class="openradiation_icon icon_timeline"></span> <span id="timechartlink">' +
        translate("See flight profile") + '</span></ul></div>';

    html += "</div>";
    return html;
}

function constructMarkerPopup(res, measurementURL, e) {
    let flightId = res.data.flightId;

    let htmlPopup = "<div style=\"width:200px; overflow:hidden; min-height:130px;\">" +
        "<div style=\"margin-bottom:4px; border-bottom:solid #F1F1F1 1px;\"><strong style=\"color:#A4A4A4;\">" +
        formatISODate(res.data.startTime) + "</strong></div>";

    htmlPopup += "<div style=\"margin-right:10px; float:left;width:50px; min-height:90px;\">";

    if (typeof(res.data.enclosedObject) != "undefined")
        htmlPopup = htmlPopup + "<div style=\"height:60px; margin-bottom:5px; \"><img class=\"openradiation_img\" src=\"" +
            res.data.enclosedObject + "\"/></div>";
    else
        htmlPopup = htmlPopup + "<div style=\"height:60px; margin-bottom:5px; \">" +
            "<img class=\"openradiation_img\" src=\"/images/measure.png\"/></div>";
    htmlPopup += "<div><a class=\"voirplus\" href=\"" + measurementURL.replace("{reportUuid}", res.data.reportUuid) +
        "\" target=\"_blank\"><p>" + translate("More ...") + "</p><p class=\"plus\">+</p></a></div>";
    htmlPopup += "</div>";

    htmlPopup += "<div style=\"width:140px; float:left; min-height:90px;\">";

    if (res.data.measurementEnvironment != null)
        htmlPopup += "<div style=\"float:right;\"><img src=\"/images/icon-env-" + res.data.measurementEnvironment + ".png\"/></div>";

    if (res.data.userId != null)
        htmlPopup += "<div><span class=\"userId\">" + res.data.userId + "</span></div>";

    htmlPopup += "<div style=\"margin-bottom:5px;\"><span class=\"value\">" +
        res.data.value.toFixed(3).toString().replace(".",",") + " µSv/h</span></div>";

    if(res.data.qualification == "plane" && res.data.flightNumber != undefined) {
        htmlPopup += "<div style=\"margin-bottom:5px;\">" +
            "<span id='seeflightId' class=\"value\"> "+ translate("Flight") + " " + res.data.flightNumber;

        if(res.data.aircraftType != undefined) {
            htmlPopup += " (" + res.data.aircraftType + ")";
            htmlPopup += "</span></div>";
        } else {
            htmlPopup += "</span></div>";
        }
    }
    if (res.data.qualification != null) {
        htmlPopup += "<div><span class=\"comment\">";
        switch (res.data.qualification) {
            case "plane":
                htmlPopup += translate("in Flight measurements");
                break;
            case "wrongmeasurement":
                htmlPopup += translate("Wrong measurements");
                break;
            case "temporarysource":
                htmlPopup += translate("Temporary source");
                break;
            case "groundlevel":
                htmlPopup += translate("Ground level");
                break;
        };
        if (res.data.qualificationVotesNumber > 0){
            htmlPopup += " <img style=\"margin-bottom:-4px;\"src=\"/images/thumb.png\"/>+ " + res.data.qualificationVotesNumber;
            htmlPopup += "</span></div>"
        }

    }
    if (res.data.tags != null)
    {
        htmlPopup += "<div>";
        for (let i = 0; i < res.data.tags.length; i++)
        {
            htmlPopup += "<span class=\"tag\">#" + res.data.tags[i] + " </span>";
        }
        htmlPopup += "</div>";
    }
    htmlPopup += "</div>";
    htmlPopup += "</div>";

    return htmlPopup;
}

/**
 * Show html value or show " - "
 * @param valueToShow
 * @returns {string|*}
 */
function showIfExist(valueToShow) {
    if(valueToShow != undefined && valueToShow != null && valueToShow != "NaN")
        return valueToShow;
    else
        return ' - ';
}

/**
 *
 * @param firstTimeGoogleChart
 * @returns {boolean}
 */
function clickOnProfilTemporel(firstTimeGoogleChart) {
    $("#openradiation_time").css("display","block");
    $(".openradiation_menu_footer").css("display","none");
    $(".openradiation_menu_header").css("display","block");

    if(window.location.flightId > 0) {
        drawPlotlyWithFlightId(window.location.flightId)
    } else {
        drawPlotlyWithBounds();
    }
}

function drawPlotlyWithBounds(){
    let urlTemp = getUrl();
    $.ajax({
        type: 'GET',
        url: '/measurements?apiKey=' + apiKey + "&minLatitude=" + openradiation_map.getBounds().getSouth() + "&maxLatitude=" + openradiation_map.getBounds().getNorth() + "&minLongitude=" + openradiation_map.getBounds().getWest() + "&maxLongitude=" + openradiation_map.getBounds().getEast() + urlTemp,
        cache: false,
        timeout: 10000,
        success: function(res) {
            let layout = {title:translate("Timeline"), fileopt : "overwrite", filename : "simple-node-example"};

            let debit = {
                x: [],
                y: [],
                name: translate("Dose rate (μSv/h)"),
                mode: 'markers',
                side: 'left'
            };

            let rows = [];
            // results are sorted by startTime so we can add them directly
            for(let i in res.data)
            {
                debit.x.push(new Date(res.data[i].startTime));
                debit.y.push(res.data[i].value);
            }

            Plotly.newPlot('charttime', [debit], layout);

            document.getElementById('charttime').focus();
        },
        error: function() {
            alert('Error during retrieving data');
        }
    });
}

function drawPlotlyWithFlightId(flightId) {
    $.ajax({
        type: 'GET',
        url: '/measurements' + '?apiKey=' + apiKey + '&flightId=' + flightId + '&response=complete',
        timeout: 15000,
        success: function (res) {
            let debit = {
                x: [],
                y: [],
                name: translate("Dose rate (μSv/h)"),
                mode: 'markers',
                side: 'left'
            };

            let altitude = {
                x: [],
                y: [],
                name: 'Altitude (m)',
                yaxis: 'y2',
                mode: 'lines',
                side: 'right'
            };

            let layout = {
                title:translate("Timeline"),
                yaxis: {title: translate("Dose rate (μSv/h)")},
                yaxis2: {
                    title: 'Altitude (m)',
                    overlaying: 'y',
                    side: 'right'
                }
            };

            // results are sorted by startTime so we can add them directly
            for(let i in res.data)
            {
                let alt = (res.data[i].refinedAltitude != undefined) ? res.data[i].refinedAltitude : res.data[i].altitude;
                debit.x.push(new Date(res.data[i].startTime));
                debit.y.push(res.data[i].value);
                altitude.x.push(new Date(res.data[i].startTime));
                altitude.y.push(alt);
            }

            let data = [debit, altitude];
            Plotly.newPlot('charttime', data, layout);
            $('#charttime').focus();
        },
        error: function (res, status, err) {
            console.log(err + " : " + status);
        }
    })
}

function showMarker(res, fitBounds) {
    let points = new Array();
    let isByPlane = false;
    if(res.data[0] != undefined && res.data[0].flightNumber != undefined) {
        isByPlane = true;
    }

    if (res.data.length < 2)
    {
        exhaustiveResultsPrev = true;
        $("#nbresults").text(res.data.length + " " + translate("measurement found") );
    }
    else if (res.maxNumber == res.data.length)
    {
        exhaustiveResultsPrev = false;
        $('.question').show();
        $("#nbresults").text(translate("Display limited to the most recent") + " " + res.data.length + " " + translate("measurements") );
    }
    else
    {
        exhaustiveResultsPrev = true;
        $('.question').hide();
        $("#nbresults").text(res.data.length + " " + translate("measurements found") );
    }

    //list all new items
    let openradiation_newitems = [];
    for (let i=0; i < res.data.length; i++)
    {
        openradiation_newitems.push(res.data[i].reportUuid);
    }

    //for each old item
    let openradiation_olditems = [];
    openradiation_map.eachLayer(function (layer) {
        if (layer.reportUuid != null)
        {
            if (openradiation_newitems.indexOf(layer.reportUuid) == -1)
                openradiation_map.removeLayer(layer);
            else if(!isByPlane) {
                openradiation_olditems.push(layer.reportUuid);
            }
        }
    });

    //for each new item
    for (let i=0; i < res.data.length; i++)
    {
        if (openradiation_olditems.indexOf(res.data[i].reportUuid) == -1)
        {
            let htmlPopup = "<div></div>";
            let icon;

            let nSvValue = res.data[i].value * 1000;
            //16 colours classes depending value in nSv/h
            if (nSvValue < 45)
                icon = icon_1;
            else if (nSvValue < 72)
                icon = icon_2;
            else if (nSvValue < 114)
                icon = icon_3;
            else if (nSvValue < 181)
                icon = icon_4;
            else if (nSvValue < 287)
                icon = icon_5;
            else if (nSvValue < 454)
                icon = icon_6;
            else if (nSvValue < 720)
                icon = icon_7;
            else if (nSvValue < 1142)
                icon = icon_8;
            else if (nSvValue < 1809)
                icon = icon_9;
            else if (nSvValue < 2867)
                icon = icon_10;
            else if (nSvValue < 4545)
                icon = icon_11;
            else if (nSvValue < 7203)
                icon = icon_12;
            else if (nSvValue < 11416)
                icon = icon_13;
            else if (nSvValue < 18092)
                icon = icon_14;
            else if (nSvValue < 28675)
                icon = icon_15;
            else if (nSvValue < 45446)
                icon = icon_16;
            else if (nSvValue < 72027)
                icon = icon_17;
            else if (nSvValue < 114155)
                icon = icon_18;
            else
                icon = icon_19;

            let lat = (res.data[i].refinedLatitude != undefined) ? res.data[i].refinedLatitude : res.data[i].latitude;
            let lon = (res.data[i].refinedLongitude != undefined) ? res.data[i].refinedLongitude : res.data[i].longitude;

            points.push([lat, lon]);
            let marker = L.marker([lat, lon],  {icon: icon}).addTo(openradiation_map)
                .bindPopup(htmlPopup);

            marker.reportUuid = res.data[i].reportUuid;
            //for chart time
            marker.value = res.data[i].value;
            marker.startTime = new Date(res.data[i].startTime);
        }
    }

    if (fitBounds)
    {
        let bounds = [];
        for (let i=0; i < res.data.length; i++)
        {
            let lat = (res.data[i].refinedLatitude != undefined) ? res.data[i].refinedLatitude : res.data[i].latitude;
            let lon = (res.data[i].refinedLongitude != undefined) ? res.data[i].refinedLongitude : res.data[i].longitude;

            points.push([lat, lon]);
            bounds.push([lat, lon]);
        }
        openradiation_map.fitBounds(bounds, { maxZoom: 13 } );
    }
    return points;
}
