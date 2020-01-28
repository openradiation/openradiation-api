
let isLanguageFR = false;
let isflightLine = false;
//if (navigator.language.indexOf('fr') != -1)
if (document.documentElement.lang == "fr")
    isLanguageFR = true; // true
    
let icon_c = L.Icon.extend({
    options: {
        shadowUrl: '/images/marker-shadow_1.png',
        shadowRetinaUrl: '/images/marker-shadow_1-2x.png',
        iconSize:     [15, 25], //[12, 20],
        shadowSize:   [20, 20],
        iconAnchor:   [8, 25], // point of the icon which will correspond to marker's location from the top / left corner
        shadowAnchor: [6, 20], // the same for the shadow
        popupAnchor:  [0, -28] // point from which the popup should open relative to the iconAnchor
    }
});

let icon_1 = new icon_c({iconUrl: '/images/icon_1x_1.png', iconRetinaUrl: '/images/icon_2x_1.png'}),
    icon_2 = new icon_c({iconUrl: '/images/icon_1x_2.png', iconRetinaUrl: '/images/icon_2x_2.png'}),
    icon_3 = new icon_c({iconUrl: '/images/icon_1x_3.png', iconRetinaUrl: '/images/icon_2x_3.png'}),
    icon_4 = new icon_c({iconUrl: '/images/icon_1x_4.png', iconRetinaUrl: '/images/icon_2x_4.png'}),
    icon_5 = new icon_c({iconUrl: '/images/icon_1x_5.png', iconRetinaUrl: '/images/icon_2x_5.png'}),
    icon_6 = new icon_c({iconUrl: '/images/icon_1x_6.png', iconRetinaUrl: '/images/icon_2x_6.png'}),
    icon_7 = new icon_c({iconUrl: '/images/icon_1x_7.png', iconRetinaUrl: '/images/icon_2x_7.png'}),
    icon_8 = new icon_c({iconUrl: '/images/icon_1x_8.png', iconRetinaUrl: '/images/icon_2x_8.png'}),
    icon_9 = new icon_c({iconUrl: '/images/icon_1x_9.png', iconRetinaUrl: '/images/icon_2x_9.png'}),
    icon_10 = new icon_c({iconUrl: '/images/icon_1x_10.png', iconRetinaUrl: '/images/icon_2x_10.png'}),
    icon_11 = new icon_c({iconUrl: '/images/icon_1x_11.png', iconRetinaUrl: '/images/icon_2x_11.png'}),
    icon_12 = new icon_c({iconUrl: '/images/icon_1x_12.png', iconRetinaUrl: '/images/icon_2x_12.png'}),
    icon_13 = new icon_c({iconUrl: '/images/icon_1x_13.png', iconRetinaUrl: '/images/icon_2x_13.png'}),
    icon_14 = new icon_c({iconUrl: '/images/icon_1x_14.png', iconRetinaUrl: '/images/icon_2x_14.png'}),
    icon_15 = new icon_c({iconUrl: '/images/icon_1x_15.png', iconRetinaUrl: '/images/icon_2x_15.png'}),
    icon_16 = new icon_c({iconUrl: '/images/icon_1x_16.png', iconRetinaUrl: '/images/icon_2x_16.png'}),
    icon_17 = new icon_c({iconUrl: '/images/icon_1x_17.png', iconRetinaUrl: '/images/icon_2x_17.png'}),
    icon_18 = new icon_c({iconUrl: '/images/icon_1x_18.png', iconRetinaUrl: '/images/icon_2x_18.png'}),
    icon_19 = new icon_c({iconUrl: '/images/icon_1x_19.png', iconRetinaUrl: '/images/icon_2x_19.png'});
    
let interpolation;

let translations_FR = {
      "Citizen radioactivity measurements" : "Les citoyens mesurent la radioactivité",
      "Permalink" : "Permalien",
      "Timeline" : "Profil temporel",
      "VALUE IN µSv/h" : "VALEUR EN μSv/h",
      "Your tag" : "Votre tag",
      "User" : "Utilisateur",
      "CSV FILE" : "FICHIER CSV",
      "In flight measurements" : "Mesures en vol",
      "Wrong measurements" : "Mesures incorrectes",
      "Temporary source" : "Mesures d'une source temporaire",
      "Ground level" : "Mesures au sol",
      "ALL MEASUREMENTS" : "TOUTES MESURES",    
      "Standard measurements" : "Mesures standard",
      "thumb" : "pouce",
      "More ..." : "Voir plus",
      "measurement found" : "mesure trouvée",
      "measurements found" : "mesures trouvées",
      "Display limited to the most recent" : "Affichage limité aux",
      "measurements" : "mesures les plus récentes",
      "Link to this map" : "Lien vers cette carte",
      "Link to the fitted map" : "Lien vers la carte ajustée",
      "Why don't I see all measurements ?" : "Pourquoi je ne vois pas toutes les mesures ?",
      "Date" : "Date",
      "Dose rate (μSv/h)" : "Débit de dose (μSv/h)",
      "Dose rate (μSv/h) per date" : "Débit de dose (μSv/h) par date",
      "now" : "maintenant",
      "minutes" : "minutes",
      "hour" : "heure",
      "hours" : "heures",
      "day" : "jour",
      "days" : "jours",  
      "month" : "mois",
      "months" : "mois",
      "year" : "an",
      "years" : "ans",
      "Flight" : "Vol",
      "From:" : "De:",
      "To:" : "A:",
      "See flight profile" : "Voir le profil de vol",
      "measurements" : "mesures"
    };
    
function translate(englishText)
{
    if (isLanguageFR == false)
        return englishText;
    else
    {
        if (englishText in translations_FR)
            return translations_FR[englishText];
        else
            return englishText;
    }
}

function csv(text)
{ 
    // if text contains ; \n \r " it is surrounded by "
    // if text contains "
    let result = text;
    if (text.indexOf(';') > -1 || text.indexOf('\n') > -1 || text.indexOf('\r') > -1 || text.indexOf('"') > -1) 
    {
        result = result.replace(/"/g, '""');
        result = '"' + result + '"';
    }
    return result;
}


function formatISODate(ISODate)
{
    let date = new Date(ISODate);
    let str = "";
    
    if (isLanguageFR) {
        if (date.getDate() < 10)
            str += "0" + date.getDate();
        else
            str += date.getDate();
        if (date.getMonth() < 9)
            str += "/0" + (date.getMonth() + 1);
        else
            str += "/" + (date.getMonth() + 1);
        str += "/" + date.getFullYear() + " - ";
        if (date.getHours() < 10)
            str += "0" + date.getHours() + "H";
        else
            str += date.getHours() + "H";
        if (date.getMinutes() < 10)
            str += "0" + date.getMinutes();
        else
            str += date.getMinutes();
    } else {
        str += date.getFullYear() + "-";
        if (date.getMonth() < 9)
            str += "0" + (date.getMonth() + 1);
        else
            str += (date.getMonth() + 1); 
        if (date.getDate() < 10)
            str += "-0" + date.getDate() + "   " ;
        else
            str += "-" + date.getDate() + "   " ;
        if (date.getHours() < 10)
            str += "0" + date.getHours() + "H";
        else
            str += date.getHours() + "H";
        if (date.getMinutes() < 10)
            str += "0" + date.getMinutes();
        else
            str += date.getMinutes();
    }
    
    return str;
}

setInterval(function(){
    if(!isflightLine)
        openradiation_getItems(false);
    }, 5000);

function openradiation_init(measurementURL, withLocate, zoom, latitude, longitude, tag, userId, qualification, atypical, rangeValueMin, rangeValueMax, rangeDateMin, rangeDateMax) {
    // create a map in the "map" div, set thme view to a given place and zoom
    openradiation_map = L.map('openradiation_map', {
        zoomControl: false,
        attributionControl: true,
        minZoom: 2,
        maxZoom: 17
    }).setView([latitude, longitude], zoom);

    //if you want to locate the client
    if (withLocate)
        openradiation_map.locate({setView: true, maxZoom: 12});

    if (isLanguageFR) {
        L.tileLayer('https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', {// see http://wiki.openstreetmap.org/wiki/FR:Serveurs/tile.openstreetmap.fr
            attribution: '&copy; <a href=\"\/\/osm.org\/copyright\">OpenStreetMap<\/a> - <a href=\"\/\/openstreetmap.fr\">OSM France<\/a> | &copy; <a href=\"\/\/www.openradiation.org\/les-donnees\">OpenRadiation</a>'
        }).addTo(openradiation_map);
    } else {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {// see http://wiki.openstreetmap.org/wiki/FR:Serveurs/tile.openstreetmap.fr
            attribution: '&copy; <a href=\"\/\/osm.org\/copyright\">OpenStreetMap<\/a> | &copy; <a href=\"\/\/www.openradiation.org\/en/\data\">OpenRadiation</a>'
        }).addTo(openradiation_map);


    }
    //add an interpolation map layer
    interpolation =
        new L.TileLayer('/i/{z}/{x}/{y}.png',
            {
                opacity: 0.6
            });

    //Add title control
    let openradiation_title = L.control({
        position: 'topleft'
    });

    openradiation_title.onAdd = function (openradiation_map) {
        let div = L.DomUtil.create('div', 'openradiation_title');
        div.innerHTML = '<strong>' + translate("Citizen radioactivity measurements") + '</strong>';
        return div;
    };

    openradiation_title.addTo(openradiation_map);

    //Add select qualification
    let openradiation_qualification = L.control({
        position: 'topright'
    });

    openradiation_qualification.onAdd = function () {
        let select = L.DomUtil.create('select', 'openradiation_qualification');
        select.classList.add("select_qualification_container");
        select.id = "select_qualification";
        select.innerHTML = '<option value="all">' + translate("ALL MEASUREMENTS") + '</option> \
                            <option value="groundlevel">' + translate("Ground level") + '</option>\
                            <option value="plane">' + translate("In flight measurements") + '</option> \
                            <option value="wrongmeasurement">' + translate("Wrong measurements") + '</option>\
                            <option value="temporarysource">' + translate("Temporary source") + '</option>';

        select.addEventListener('change', function () {
            openradiation_getItems(false);
            qualification = $(this).val();
        });
        return select;
    }
    openradiation_qualification.addTo(openradiation_map);

    // Add zoom control
    let zoomControl = L.control.zoom({ position: 'topleft'});
    openradiation_map.addControl(zoomControl);

    // Add openradiation filters control
    let openradiation_filters = L.control({
        position : 'bottomleft'
    });

    //init events of user in map
    $(document).ready(function() {
        $('#select_qualification').val('groundlevel');

        $(".toggle").click(function(){
            $(".openradiation_filters").slideToggle();
            $(this).toggleClass('icon-toggle-down');
            $(this).toggleClass('icon-toggle-up');
            $('.leaflet-control-attribution').toggle();
        });

        let elm = document.querySelectorAll("input");
        for(let i = 0; i < elm.length; i++) {
                elm[i].addEventListener("input", function() {
                    window.location.flightId = null;
                    openradiation_getItems(false);
                });
        };
    });

    openradiation_filters.onAdd = function(openradiation_map) {
        let div = L.DomUtil.create('div', 'openradiation_filters');

        L.DomEvent.disableClickPropagation(div);      
        div.innerHTML =
            '<div class=\"slider_range\">\
                <div>\
                    <div id=\"slider_rangevalue\"></div> \
                    <div><span id=\"slider_minvalue\"></span><span id=\"slider_text\">' + translate("VALUE IN µSv/h") + '</span><span id=\"slider_maxvalue\"></span></div>\
                </div>\
             </div>\
             <div class=\"slider_range\">\
                <div>\
                    <div id=\"slider_rangedate\"></div> \
                    <div><span id=\"slider_mindate\"></span><span id=\"slider_maxdate\"></span></div>\
                </div>\
             </div>\
             <div class=\"input_tag\">\
                <div>\
                    <input id="tag" class="input" type="text" placeholder="# ' + translate("Your tag") + '"/>\
                    <input id="userId" class="input" type="text" placeholder="' + translate("User") + '"/>\
                </div>\
             </div>\
             <div class=\"download_file\">\
                <div id=\"export\">\
                    <div>' + translate("CSV FILE") + '</div> \
                    <img src=\"/images/arrow_download.png\"/> \
                </div>\
             </div>\
             <div class="get_links">\
                   <ul><span class="openradiation_icon icon_link"></span><span id="permalink">' + translate("Permalink") + '</span></ul>\
                   <ul><span class="openradiation_icon icon_timeline"></span><span id="timechartlink">' + translate("Timeline") + '</span></ul>\
             </div>';
        return div;
    };

    openradiation_filters.addTo(openradiation_map);

    $("#tag").val(tag);
    $("#userId").val(userId);
    $("#qualification").val(qualification);

    $( "#slider_rangevalue" ).on( "slidecreate", function( event, ui ) {
        $( "#slider_rangevalue" ).slider("option", "values", [rangeValueMin, rangeValueMax]);
        $( "#slider_minvalue").text(val2uSv($( "#slider_rangevalue" ).slider( "values", 0)));
        $( "#slider_maxvalue").text(val2uSv($( "#slider_rangevalue" ).slider( "values", 1)));
    });
    
    $( "#slider_rangedate" ).on( "slidecreate", function( event, ui ) {
        $( "#slider_rangedate" ).slider("option", "values", [rangeDateMin, rangeDateMax]);
        $( "#slider_mindate").text(val2date($( "#slider_rangedate" ).slider( "values", 0)));
        $( "#slider_maxdate").text(val2date($( "#slider_rangedate" ).slider( "values", 1)));
    });

    if (withLocate == false && qualification != 'plane') // si plane 
        $('.openradiation_filters').css('display', 'none');


    //icon for hidden footer of map
    let openradiation_toggle = L.control({
        position : 'bottomleft'
    });
    openradiation_toggle.onAdd = function(openradiation_map) {
        let urlFlightMap = document.referrer + "/la-carte-et-ses-limites";
        let div = L.DomUtil.create('div', 'openradiation_toggle');
        div.innerHTML =
            '\
                <strong id="nbresults"></strong>\
                <div class="icon-toggle-down toggle floatright"></div>\
                <span class="floatright"><a target="_self" href="/en/openradiation">EN</a> | <a target="_self" href="/fr/openradiation">FR</a> </span>\
                <a id="getFlightMap" class="floatright" target=\\"_blank\\" href="'+ urlFlightMap +'"> \
                <span class="question">' + translate("Why don't I see all measurements ?") + '</span>\
                </a>\
            ';
        div.classList.add("topSlider");
        return div;
    };
    openradiation_toggle.addTo(openradiation_map);

    // add a metric scale
    L.control.scale( { imperial:false, position:'bottomleft'}).addTo(openradiation_map);

    openradiation_map.on('popupopen', function(e) {
        if(e.popup._source.flightData) {
            if(e.target.flightData != undefined) //do nothing if popup already open
                clickOnLine(e);
                isflightLine = true;
        } else {
            clickOnMarker(e, measurementURL);
        }
    });
};

let urlPrev = "null";
let minLatitudePrev = -90, maxLatitudePrev = +90, minLongitudePrev = -10000, maxLongitudePrev = +10000;
let exhaustiveResultsPrev = false;



function getUrl()
{
    let urlTemp = "";
    
    let tag = $("#tag").val();
    if (tag != "")
        urlTemp+= "&tag=" + tag;

    let userId = $("#userId").val();
    if (userId != "")
        urlTemp+= "&userId=" + userId;
        
    let qualification = $(".select_qualification_container").val();
    if (qualification != "" && qualification != "all")
        urlTemp+= "&qualification=" + qualification;

    let minValue = $("#slider_minvalue").text();
    if (minValue != "" && minValue != "0")
        urlTemp+= "&minValue=" + minValue;

    let maxValue = $("#slider_maxvalue").text();
    if (maxValue != "" && maxValue != "+ ∞")
        urlTemp+= "&maxValue=" + maxValue;
    
    let minDate = $("#slider_mindate").text();
    if (minDate != "" && minDate != "- ∞" && minDate != translate("now"))
    {
        let nbHours = Math.exp((100 - $( "#slider_rangedate" ).slider( "values", 0) ) / 9) - 1;
        let NbSecond = Math.round(nbHours * 3600);
        let now =  new Date();
        now.setMilliseconds(0);
        now.setSeconds(0);
        now.setMinutes(now.getMinutes() - now.getMinutes() % 10);
       
        let minStartTime = new Date(now.getTime() - (NbSecond * 1000) );
        urlTemp+= "&minStartTime=" + minStartTime.toISOString();
    }
    
    let maxDate = $("#slider_maxdate").text();
    if (maxDate != "" && maxDate != "- ∞" && maxDate != translate("now"))
    {
        let nbHours = Math.exp((100 - $( "#slider_rangedate" ).slider( "values", 1) ) / 9) - 1;
        let NbSecond = Math.round(nbHours * 3600);
        let now =  new Date();
        now.setMilliseconds(0);
        now.setSeconds(0);
        now.setMinutes(now.getMinutes() - now.getMinutes() % 10);
       
        let maxStartTime = new Date(now.getTime() - (NbSecond * 1000) );
        urlTemp+= "&maxStartTime=" + maxStartTime.toISOString();
    }
    
    return urlTemp;
}

function retrieve_items(urlTemp, fitBounds) {

    urlPrev = urlTemp;

    minLatitudePrev = openradiation_map.getBounds().getSouth();
    maxLatitudePrev = openradiation_map.getBounds().getNorth();
    minLongitudePrev = openradiation_map.getBounds().getWest();
    maxLongitudePrev = openradiation_map.getBounds().getEast();

    $("#nbresults").text("...");
    $.ajax({
    type: 'GET',
    url: '/measurements?apiKey=' + apiKey
            + "&minLatitude=" + openradiation_map.getBounds().getSouth()
            + "&maxLatitude=" + openradiation_map.getBounds().getNorth()
            + "&minLongitude=" + openradiation_map.getBounds().getWest()
            + "&maxLongitude=" + openradiation_map.getBounds().getEast()
            + urlTemp,
    //cache: false,
    timeout: 15000,
    success: function(res) {
        showMarker(res, fitBounds);
    },
    error: function() {
        //alert('Error during retrieving data');
        }
    });
}

function openradiation_getItems(fitBounds, planeTrack)
{
    let urlTemp = getUrl();
    window.location.flightId=null;
    if(planeTrack) {
        //do nothing
    } else {
        removeOtherPlaneTrack();
    }

    if(urlTemp == '&qualification=plane')
        initPlaneTrack();

    // we retrieve results if filters are differents
    //     or one of the geographical bounds are the bounds of the last request
    //     or geographical bounds are included and results were not exhaustive, and some items are not included in the new bounds    
    if (urlTemp != urlPrev)
        retrieve_items(urlTemp, fitBounds);
    else if (openradiation_map.getBounds().getSouth() < minLatitudePrev
       || openradiation_map.getBounds().getNorth() > maxLatitudePrev
       || openradiation_map.getBounds().getWest() < minLongitudePrev
       || openradiation_map.getBounds().getEast() > maxLongitudePrev)
        retrieve_items(urlTemp, fitBounds);
    else if (openradiation_map.getBounds().getSouth() > minLatitudePrev
       || openradiation_map.getBounds().getNorth() < maxLatitudePrev
       || openradiation_map.getBounds().getWest() > minLongitudePrev
       || openradiation_map.getBounds().getEast() < maxLongitudePrev)
    {
        let nb = 0;
        let not_included = false;
        openradiation_map.eachLayer(function (layer) {
            
            if (layer.reportUuid != null) {
                if (layer.getLatLng().lng < openradiation_map.getBounds().getWest()
               || layer.getLatLng().lng > openradiation_map.getBounds().getEast()
               || layer.getLatLng().lat < openradiation_map.getBounds().getSouth()
               || layer.getLatLng().lat > openradiation_map.getBounds().getNorth())
                    not_included = true;
                else
                    nb++;
            }
        });
        if (exhaustiveResultsPrev == false && not_included == true)
            retrieve_items(urlTemp, fitBounds);
        else {
            if (exhaustiveResultsPrev) {
                if (nb < 2)
                    $("#nbresults").text(nb + " " + translate("measurement found"));
                else
                    $("#nbresults").text(nb + " " + translate("measurements found"));
            } else
                console.log("not updated (not exhaustive and all the items are in the new bounds)");
        }
    } else
        console.log("no change");
};

function val2uSv(val)
{
    //empiric method to convert from 0-100 scale to the expected scale in uSv/h
    let uSv = Math.round((Math.exp(val / 11.94) * 29)) / 1000;
    
    if (uSv > 120)
        return "+ ∞";
    else if (uSv < 0.03)
        return 0;
    else
        return uSv.toFixed(3);
}

function val2date(val)
{    
    //let hour = Math.exp((40 - val) / 3) - 1; // this is the nb hour from now
    let hour = Math.exp((100 - val) / 9) - 1;
    
    if (hour == 0)
        return translate("now");
    else if (hour < 0.4)
        return Math.round(hour*60 / 10) * 10 + " " + translate("minutes");
    else if (hour < 20)
    {
        if (Math.round(hour) == 1)
            return "1 " + translate("hour");
        else
            return Math.round(hour) + " " + translate("hours");
    }
    else if (hour < 24*30)
    {
        if (Math.round(hour / 24) == 1)
            return "1 " + translate("day");
        else
            return Math.round(hour / 24) + " " + translate("days");   
    }
    else if (hour < 24*30*9)
    {
        if (Math.round(hour / 24 / 30) == 1)
            return "1 " + translate("month");
        else
            return Math.round(hour / 24 / 30) + " " + translate("months");
    }
    else if (hour > 60000)
        return "- ∞";
    else {
        if (Math.round(hour /24 / 365) == 1)
            return "1 " + translate("year");
        else
            return Math.round(hour /24 / 365) + " " + translate("years");
    }
}

$(function() {

    $( "#slider_rangevalue" ).slider({
        range: true,
        min: 0,
        max: 100,
        values: [ 0, 100 ],
        slide: function( event, ui ) {
            $( "#slider_minvalue").text(val2uSv(ui.values[0]));
            $( "#slider_maxvalue").text(val2uSv(ui.values[1]));

        }
    });
    
    $( "#slider_rangedate" ).slider({
        range: true,
        min: 0, 
        max: 100,
        values: [ 0, 100 ],
        slide: function( event, ui ) {
            $( "#slider_mindate").text(val2date(ui.values[0]));
            $( "#slider_maxdate").text(val2date(ui.values[1]));
        }
    });
    $("#slider_rangedate").on('mousedown', function (){
        $("body").mouseup(function () {
            $("body").off('mouseup');
            openradiation_getItems(false, true);
        })
    })

    $("#slider_rangevalue").on('mousedown', function (){
        $("body").mouseup(function () {
            $("body").off('mouseup');
            openradiation_getItems(false, true);
        })
    })

    $( "#export" ).click(function() {
        
        //let isFileSaverSupported = !!new Blob;
        let urlTemp = getUrl();
                   
        $.ajax({
            type: 'GET',
            url: '/measurements?apiKey=' + apiKey + "&minLatitude=" + openradiation_map.getBounds().getSouth() + "&maxLatitude=" + openradiation_map.getBounds().getNorth() + "&minLongitude=" + openradiation_map.getBounds().getWest() + "&maxLongitude=" + openradiation_map.getBounds().getEast() + urlTemp + "&response=complete&withEnclosedObject=no", 
            cache: false,
            timeout: 10000,
            success: function(res) {
                let str="apparatusId;apparatusVersion;apparatusSensorType;apparatusTubeType;temperature;value;hitsNumber;calibrationFunction;startTime;endTime;latitude;longitude;accuracy;altitude;altitudeAccuracy;endLatitude;endLongitude;endAccuracy;endAltitude;endAltitudeAccuracy;deviceUuid;devicePlatform;deviceVersion;deviceModel;reportUuid;manualReporting;organisationReporting;description;measurementHeight;userId;measurementEnvironment;rain;flightNumber;seatNumber;windowSeat;storm;flightId;refinedLatitude;refinedLongitude;refinedAltitude;refinedEndLatitude;refinedEndLongitude;refinedEndAltitude;departureTime;arrivalTime;airportOrigin;airportDestination;aircraftType;firstLatitude;firstLongitude;midLatitude;midLongitude;lastLatitude;lastLongitude;dateAndTimeOfCreation;qualification;qualificationVotesNumber;reliability;tags list\n";
                for(let i in res.data)
                {
                    let data = res.data[i];
                    str += data.apparatusId == null ? ";" : csv(data.apparatusId) + ";";
                    str += data.apparatusVersion == null ? ";" : csv(data.apparatusVersion) + ";";
                    str += data.apparatusSensorType == null ? ";" : csv(data.apparatusSensorType) + ";";
                    str += data.apparatusTubeType == null ? ";" : csv(data.apparatusTubeType) + ";";
                    str += data.temperature == null ? ";" : data.temperature + ";";
                    str += data.value + ";";
                    str += data.hitsNumber == null ? ";" : data.hitsNumber + ";";
                    str += data.calibrationFunction == null ? ";" : csv(data.calibrationFunction) + ";";
                    str += data.startTime + ";";
                    str += data.endTime == null ? ";" : data.endTime + ";";
                    str += data.latitude + ";";
                    str += data.longitude + ";";
                    str += data.accuracy == null ? ";" : data.accuracy + ";";
                    str += data.altitude == null ? ";" : data.altitude + ";";
                    str += data.altitudeAccuracy == null ? ";" : data.altitudeAccuracy + ";";
                    str += data.endLatitude == null ? ";" : data.endLatitude + ";";
                    str += data.endLongitude == null ? ";" : data.endLongitude + ";";
                    str += data.endAccuracy == null ? ";" : data.endAccuracy + ";";
                    str += data.endAltitude == null ? ";" : data.endAltitude + ";";
                    str += data.endAltitudeAccuracy == null ? ";" : data.endAltitudeAccuracy + ";";
                    str += data.deviceUuid == null ? ";" : csv(data.deviceUuid) + ";";
                    str += data.devicePlatform == null ? ";" : csv(data.devicePlatform) + ";";
                    str += data.deviceVersion == null ? ";" : csv(data.deviceVersion) + ";";
                    str += data.deviceModel == null ? ";" : csv(data.deviceModel) + ";";
                    str += data.reportUuid + ";";
                    str += data.manualReporting ? "1;" : "0;";
                    str += data.organisationReporting == null ? ";" : csv(data.organisationReporting) + ";";
                    str += data.description == null ? ";" : csv(data.description) + ";";
                    str += data.measurementHeight == null ? ";" : data.measurementHeight + ";";
                    str += data.userId == null ? ";" : csv(data.userId) + ";";
                    str += data.measurementEnvironment == null ? ";" : data.measurementEnvironment + ";";
                    str += data.rain == null ? ";" : data.rain + ";";
                    str += data.flightNumber == null ? ";" : csv(data.flightNumber) + ";";
                    str += data.seatNumber == null ? ";" : csv(data.seatNumber) + ";";
                    str += data.windowSeat == null ? ";" : data.windowSeat + ";";
                    str += data.storm == null ? ";" : data.storm + ";";
                    str += data.flightId == null ? ";" : data.flightId + ";";
                    str += data.refinedLatitude == null ? ";" : data.refinedLatitude + ";";
                    str += data.refinedLongitude == null ? ";" : data.refinedLongitude + ";";
                    str += data.refinedAltitude == null ? ";" : data.refinedAltitude + ";";
                    str += data.refinedEndLatitude == null ? ";" : data.refinedEndLatitude + ";";
                    str += data.refinedEndLongitude == null ? ";" : data.refinedEndLongitude + ";";
                    str += data.refinedEndAltitude == null ? ";" : data.refinedEndAltitude + ";";
                    str += data.departureTime == null ? ";" : data.dekmpartureTime + ";";
                    str += data.arrivalTime == null ? ";" : data.arrivalTime + ";";
                    str += data.airportOrigin == null ? ";" : csv(data.airportOrigin) + ";";
                    str += data.airportDestination == null ? ";" : csv(data.airportDestination) + ";";
                    str += data.aircraftType == null ? ";" : csv(data.aircraftType) + ";";
                    str += data.firstLatitude == null ? ";" : data.firstLatitude + ";";
                    str += data.firstLongitude == null ? ";" : data.firstLongitude + ";";
                    str += data.midLatitude == null ? ";" : data.midLatitude + ";";
                    str += data.midLongitude == null ? ";" : data.midLongitude + ";";
                    str += data.lastLatitude == null ? ";" : data.lastLatitude + ";";
                    str += data.lastLongitude == null ? ";" : data.lastLongitude + ";";
                    str += data.dateAndTimeOfCreation + ";";
                    str += data.qualification == null ? ";" : data.qualification + ";";
                    str += data.qualificationVotesNumber == null ? ";" : data.qualificationVotesNumber + ";";
                    str += data.reliability + ";";
                    if (data.tags != null){
                        for (let t in data.tags)
                        {
                            str += csv(data.tags[t]);
                            if (t < (data.tags.length-1))
                                str += ";";
                        }
                    }
                    str += "\n";
                }
                
                try {
                    let blob = new Blob([str], {type: "text/csv;charset=utf-8"});
                    saveAs(blob, "export_openradiation.csv");
                } catch (e) {
                    alert("This feature is not available with your old version of browser");
                }
            },
            error: function() {
                alert('Error during retrieving data'); 
            }
        });
    });
     
    $( "#interpolationlink" ).click(function() {
        $(".openradiation_menu_footer").css("display","none");
        $(".openradiation_menu_header").css("display","block");
        
        if (openradiation_map.hasLayer(interpolation))
            openradiation_map.removeLayer(interpolation);
        else
            openradiation_map.addLayer(interpolation);
    });
    
    $( "#permalink" ).click(function() {
        $(".openradiation_menu_footer").css("display","none");
        $(".openradiation_menu_header").css("display","block");
        
        let link = window.location.protocol + "//" + window.location.host + "/openradiation";
        let zoom = "/" + openradiation_map.getZoom() + "/" + openradiation_map.getCenter().lat.toFixed(7) + "/" + openradiation_map.getCenter().lng.toFixed(7);
       
        let permalink_details = "/";

        if ($("#tag").val() != "")
            permalink_details += $("#tag").val() +"/";
        else
            permalink_details += "all/";

        if ($("#userId").val() != "")
            permalink_details += $("#userId").val() +"/";
        else
            permalink_details += "all/";
            permalink_details += $(".select_qualification_container").val() + "/all/"; // '/all/' is for atypical values
            permalink_details += $( "#slider_rangevalue" ).slider( "values", 0) + "/" + $( "#slider_rangevalue" ).slider( "values", 1) + "/";
            permalink_details += $( "#slider_rangedate" ).slider( "values", 0) + "/" + $( "#slider_rangedate" ).slider( "values", 1);

        if (permalink_details == "/all/all/all/all/0/100/0/100")
            permalink_details = "";

        if (permalink_details == "")
            $( "#permalink-message" ).html(translate("Link to this map") + " : <a target=\"_blank\" href=\"" + link + zoom + permalink_details + "\">" + link + zoom + permalink_details + "<\/a> <br> <span class=\"openradiation_icon icon_cross\" id=\"permalink-close\"></span> ");
        else
            $( "#permalink-message" ).html(translate("Link to this map") + " : <a target=\"_blank\" href=\"" + link + zoom + permalink_details + "\">" + link + zoom + permalink_details + "<\/a> <br> " + translate("Link to the fitted map") + " : <a target=\"_blank\" href=\"" + link + permalink_details + "\">" + link + permalink_details + "<\/a> <span id=\"permalink-close\">X</span> ");


        $( "#permalink-message" ).css("display","block");
        $( "#permalink-close" ).click(function() {
            $( "#permalink-message" ).css("display","none");
        });

    });
    
    let firstTimeGoogleChart = true;
    
    $( ".openradiation_menu_header").click(function(e) {
        $(".openradiation_menu_footer").css("display","block");
        $(".openradiation_menu_header").css("display","none");
        e.stopPropagation();
    });
    
    $( "#openradiation_menu_footer-close" ).click(function(e) {
        $(".openradiation_menu_header").css("display","block");
        $(".openradiation_menu_footer").css("display","none");
        e.stopPropagation();
    });    
    
    firstTimeGoogleChart = $( "#timechartlink" ).click(function() {
        clickOnProfilTemporel(firstTimeGoogleChart);
    });
    
    closeChartTime = function() {
        $("#openradiation_time").css("display","none");
    }

    $( "#slider_rangevalue" ).change

});
