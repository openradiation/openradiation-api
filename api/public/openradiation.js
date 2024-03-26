
var isLanguageFR = false;
var flightId_selected = null;
var flightId_geodesic = null;

//if (navigator.language.indexOf('fr') != -1)
if (document.documentElement.lang == "fr")
    isLanguageFR = true; // true
    
var icon_c = L.Icon.extend({
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

var icon_1 = new icon_c({iconUrl: '/images/icon_1x_1.png', iconRetinaUrl: '/images/icon_2x_1.png'}),
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
    
var interpolation;

var translations_FR = {
      "Citizen radioactivity measurements" : "Les citoyens mesurent la radioactivité",
      "Permalink" : "Permalien",
      "Timeline" : "Profil temporel",
      "VALUE IN µSv/h" : "VALEUR EN μSv/h",
      "Your tag" : "Votre tag",
      "User" : "Utilisateur",
      "CSV FILE" : "FICHIER CSV",     
      "ALL MEASUREMENTS" : "TOUTES MESURES",
      "In flight measurement" : "Mesure en vol",
      "In flight measurements" : "Mesures en vol",
      "Wrong measurement" : "Mesures incorrecte",
      "Wrong measurements" : "Mesures incorrectes",
      "Temporary source measurement" : "Mesure d'une source",
      "Temporary source measurements" : "Mesures d'une source",
      "Ground level measurement" : "Mesure au sol",    
      "Ground level measurements" : "Mesures au sol",      
      //"Standard measurements" : "Mesures standard",
      "Non-standard measurement" : "Mesure atypique",  
      //"Non-standard measurements" : "Mesures atypiques", 
      "thumb" : "pouce",
      "More ..." : "Voir plus",
      "measurement found" : "mesure trouvée",
      "measurements found" : "mesures trouvées",
      "measurements" : "mesures",
      "Display limited to the" : "Affichage limité aux",
      "most recent measurements" : "mesures les plus récentes",
      "Why don't I see all measurements ?" : "Pourquoi je ne vois pas toutes les mesures ?",
      "Link to this map" : "Lien vers cette carte",
      "Link to the fitted map" : "Lien vers la carte ajustée",
      "Date" : "Date",
      "Dose rate (μSv/h)" : "Débit de dose (μSv/h)",
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
      "You are using Internet Explorer, which does not provide full functionality. We advise you to use a modern browser." : "Vous utilisez Internet Explorer qui ne permet pas d\'accéder à toutes les fonctionnalités. Nous vous conseillons d\'utiliser un navigateur moderne."
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
    var result = text;
    if (text.indexOf(';') > -1 || text.indexOf('\n') > -1 || text.indexOf('\r') > -1 || text.indexOf('"') > -1) 
    {
        result = result.replace(/"/g, '""');
        result = '"' + result + '"';
    }
    return result;
}


function formatISODate(ISODate)
{
    var date = new Date(ISODate);
    var str = "";
    
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

function drawPlotly() {
            
    $("#openradiation_time").css("display","block");
    
    let urlTemp = getUrl();
    
    let url;
    if (flightId_selected == null)
        url = '/measurements?apiKey=' + apiKey + "&minLatitude=" + openradiation_map.getBounds().getSouth() + "&maxLatitude=" + openradiation_map.getBounds().getNorth() + "&minLongitude=" + openradiation_map.getBounds().getWest() + "&maxLongitude=" + openradiation_map.getBounds().getEast() + urlTemp;
    else
        url = '/measurements?apiKey=' + apiKey + urlTemp + '&response=complete&withEnclosedObject=no';
    
    $.ajax({
        type: 'GET',
        url: url,
        cache: false,
        timeout: 10000,
        success: function(res) {
            let debit = {
                x: [],
                y: [],
                color: 'red',
                name: translate("Dose rate (μSv/h)"),
                mode: 'markers',
                side: 'left',
                marker: {
                    color: '#1757a2',
                    /*size: 20,
                    line: {
                      color: 'rgb(231, 99, 250)',
                      width: 2
                    }*/
                }
 
            };
            
            let layout;
            let altitude;
            if (flightId_selected != null) {
                layout = {
                    showlegend: false, 
                    margin: { l:45, r:45, t:45, b:45 },
                    title: { text:translate("Timeline"), font: { size: 12} },
                    yaxis: {tickfont: { size: 11 }, title: { text:translate("Dose rate (μSv/h)"), font: { size: 12, color: '#2446AB'}}, marker: {color: '#1757a2'}, rangemode: 'tozero'},
                    yaxis2: {
                        rangemode: 'tozero',
                        title: { text:'Altitude (m)',font: { size:12, color: '#ffac33'}},
                        overlaying: 'y',
                        side: 'right',
                        marker: {color: '#1757a2'}
                    }
                };
                altitude = {
                    x: [],
                    y: [],
                    name: 'Altitude (m)',
                    yaxis: 'y2',
                    //mode: 'lines',
                    side: 'right',
                    type: 'scatter',
                    marker: { color: '#ffac33' }
  
                };
            } else
                layout = { 
                    showlegend: false, 
                    margin: { l:45, r:45, t:45, b:45 }, 
                    title: { text:translate("Timeline"), font: { size: 12}}, 
                    yaxis: { tickfont: { size: 11 },title: { text:translate("Dose rate (μSv/h)"), font: { size: 12, color:'#2446AB'}}, marker: {color: '#1757a2'}, rangemode: 'tozero'}
                };
            
            // results are sorted by startTime so we can add them directly
            for(let i in res.data)
            {
                debit.x.push(new Date(res.data[i].startTime));
                debit.y.push(res.data[i].value.toFixed(3));
                
                if (flightId_selected != null) {
                    altitude.x.push(new Date(res.data[i].startTime));
                    altitude.y.push((res.data[i].refinedAltitude != undefined) ? res.data[i].refinedAltitude : res.data[i].altitude);
                }
            }
    
            if (flightId_selected != null) {
                Plotly.newPlot('charttime', [debit, altitude], layout, {displayModeBar: false});
            } else
                Plotly.newPlot('charttime', [debit], layout, {displayModeBar: false, pad:2});
            
           $('#charttime').focus();
        },
        error: function() {
            alert('Error during retrieving data');
        }
    });
}  

closeChartTime = function() {
    $("#openradiation_time").css("display","none");
}   
        
    
function openradiation_init(measurementURL, withLocate, zoom, latitude, longitude, tag, userId, qualification, atypical, rangeValueMin, rangeValueMax, rangeDateMin, rangeDateMax, fitBounds)
{
    // create a map in the "map" div, set the view to a given place and zoom
    openradiation_map = L.map('openradiation_map', { zoomControl: false, attributionControl: true, minZoom:2, maxZoom:17 }).setView([latitude, longitude], zoom);
       
    // add an OpenStreetMap tile layer
    //L.tileLayer('http://bissorte.irsn.fr/mapcache/tms/1.0.0/osm@g/{z}/{x}/{y}.png', { tms:true,
    //L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {// https
    //L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', { // http
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
    //uncomment to add the layer
    //openradiation_map.addLayer(interpolation);
    
    //Add title control
    var openradiation_title = L.control({
        position : 'topleft'
    });
    
    openradiation_title.onAdd = function(openradiation_map) {
        var div = L.DomUtil.create('div', 'openradiation_title');
        div.innerHTML = '<strong>' + translate("Citizen radioactivity measurements") + '</strong>';
        return div;
    };
    
    openradiation_title.addTo(openradiation_map);
        
    //Add select qualification
    var openradiation_qualification = L.control({
        position: 'topright'
    });
    openradiation_qualification.onAdd = function () {
        var div = L.DomUtil.create('div', 'openradiation_qualification');
        
        if (window.navigator.userAgent.indexOf("MSIE") > -1 || window.navigator.userAgent.indexOf("Trident") > -1)  // plane flights are not available on MSIE. And we have to add size=5 to the select otherwise it doesn't work
            div.innerHTML = '<div style="font-size:10px; text-align:center;"><span style="font-size:12px;">' + translate("You are using Internet Explorer, which does not provide full functionality. We advise you to use a modern browser.") + '</span><select id="qualification" name="qualification" size="5">\
                                    <option value="all">' + translate("ALL MEASUREMENTS") + '</option> \
                                    <option value="groundlevel">' + translate("Ground level measurements") + '</option> \
                                    <option value="plane">' + translate("In flight measurements") + '</option> \
                                    <option value="wrongmeasurement">' + translate("Wrong measurements") + '</option>\
                                    <option value="temporarysource">' + translate("Temporary source measurements") + '</option>\
                                </select>\
                            </div>';
        else
            div.innerHTML = '<div><select id="qualification" name="qualification">\
                                    <option value="all">' + translate("ALL MEASUREMENTS") + '</option> \
                                    <option value="groundlevel">' + translate("Ground level measurements") + '</option> \
                                    <option value="plane">' + translate("In flight measurements") + '</option> \
                                    <option value="wrongmeasurement">' + translate("Wrong measurements") + '</option>\
                                    <option value="temporarysource">' + translate("Temporary source measurements") + '</option>\
                                </select>\
                            </div>';
        return div;
    }
    openradiation_qualification.addTo(openradiation_map);
    
    // Add zoom control
    var zoomControl = L.control.zoom({ position: 'topleft'});
    openradiation_map.addControl(zoomControl);

    // Add openradiation filters control
    var openradiation_filters = L.control({
        position : 'bottomleft'
    });
    
    openradiation_filters.onAdd = function(openradiation_map) {
        var div = L.DomUtil.create('div', 'openradiation_filters');
        L.DomEvent.disableClickPropagation(div);      
        div.innerHTML = '<div class=\"slider_range\">\
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
                                <input id="tag" class="input" type="text" placeholder="# ' + translate("Your tag") + '"/>  \
                                <input id="userId" class="input" type="text" placeholder="' + translate("User") + '"/> \
                            </div>\
                         </div>\
                         <div class=\"download_file\">\
                            <div id=\"export\">\
                                <div>' + translate("CSV FILE") + '</div> \
                                <img src=\"/images/arrow_download.png\"/> \
                            </div>\
                         </div>\
                         <div class=\"get_links\">\
                            <div>\
                                <div><span class="openradiation_icon icon_link"></span><span id="permalink">' + translate("Permalink") + '</span></div> \
                                <div><span class="openradiation_icon icon_timeline"></span><span id="timechartlink">' + translate("Timeline") + '</span></div> \
                            </div>\
                         </div>';       
        return div;
    };
       
    openradiation_filters.addTo(openradiation_map);
    
    //$("#atypical").val(atypical);
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

    //add a toggle
    let openradiation_toggle = L.control({
        position : 'bottomleft'
    });
    openradiation_toggle.onAdd = function(openradiation_map) {
        let div = L.DomUtil.create('div', 'openradiation_toggle');
        div.innerHTML = '<strong id="nbresults"></strong>\
                <div class="openradiation_icon icon_toggle-down toggle"></div>\
                <span class="floatright"><a target="_self" href="/en/openradiation">EN</a> | <a target="_self" href="/fr/openradiation">FR</a> </span>';
        if (isLanguageFR == false)
            div.innerHTML += '<a class="floatright question" target="_blank" href="https://www.openradiation.org/en/map-and-its-limits">' + translate("Why don't I see all measurements ?") + '</a>';
        else
            div.innerHTML += '<a class="floatright question" target="_blank" href="https://www.openradiation.org/fr/la-carte-et-ses-limites">' + translate("Why don't I see all measurements ?") + '</a>';
        
        return div;
    };
    openradiation_toggle.addTo(openradiation_map);
    
    //if (withLocate == false && qualification != 'plane') // si plane 
    //    $('.openradiation_filters').css('display', 'none');
    if (window.matchMedia("(max-width: 370px)").matches) {
        $(".openradiation_filters").slideToggle();
        $(".openradiation_toggle").toggleClass('min-height');
        $(".toggle").toggleClass('icon_toggle-down');
        $(".toggle").toggleClass('icon_toggle-up');
    }
    
    // add a metric scale
    L.control.scale( { imperial:false, position:'bottomleft'}).addTo(openradiation_map);
    
    //init events of user in map
    $(document).ready(function() {
        $('#qualification').val(qualification);
        $("#tag").val(tag);
        $("#userId").val(userId);
       
        //if you want to locate the client
        openradiation_map.on('locationfound', function(e) {
            console.log("location found");
            openradiation_getItems(fitBounds);
        });
          
        openradiation_map.on('locationerror', function(e) {
            console.log("location error");
            openradiation_getItems(fitBounds);
        });    
            
        if (withLocate) {
            openradiation_map.locate({ setView : true, maxZoom:12, timeout:3000 });
        } else { 
            openradiation_getItems(fitBounds);
        }
    });
    
    // when a popup is opened we retrieve the data
    openradiation_map.on('popupopen', function(e) {
        if (e.popup._source.flightId) { // this is a geodesic popup 
            flightId_selected = e.popup._source.flightId;
            flightId_geodesic = e.popup._source;
            openradiation_getItems(false);            
        } else {
            $.ajax({ //retrieve the results from a marker popup
                type: 'GET',
                url: '/measurements/' + e.popup._source.reportUuid + '?apiKey=' + apiKey + '&response=complete',
                //dataType: "jsonp",
                //jsonpCallback: "_test",
                //cache: false,
                timeout: 15000,
                success: function(res) {

                    var htmlPopup = "<div style=\"width:200px; overflow:hidden; min-height:130px;\"><div style=\"margin-bottom:4px; border-bottom:solid #F1F1F1 1px;\"><strong style=\"color:#A4A4A4;\">" + formatISODate(res.data.startTime) + "</strong></div>";
                    
                    htmlPopup += "<div style=\"margin-right:10px; float:left;width:50px; min-height:90px;\">";

                    if (typeof(res.data.enclosedObject) != "undefined") 
                        htmlPopup = htmlPopup + "<div style=\"height:60px; margin-bottom:5px; \"><img class=\"openradiation_img\" src=\"" + res.data.enclosedObject + "\"/></div>";
                    else
                        htmlPopup = htmlPopup + "<div style=\"height:60px; margin-bottom:5px; \"><img class=\"openradiation_img\" src=\"/images/measure.png\"/></div>";
                    htmlPopup += "<div><a class=\"voirplus\" href=\"" + measurementURL.replace("{reportUuid}", res.data.reportUuid) + "\" target=\"_blank\"><p>" + translate("More ...") + "</p><p class=\"plus\">+</p></a></div>";
                    htmlPopup += "</div>";
                    
                    htmlPopup += "<div style=\"width:140px; float:left; min-height:90px;\">";
                    
                    if (res.data.measurementEnvironment != null)
                        htmlPopup += "<div style=\"float:right;\"><img src=\"/images/icon-env-" + res.data.measurementEnvironment + ".png\"/></div>";

                    if (res.data.userId != null)
                        htmlPopup += "<div><span class=\"userId\">" + res.data.userId + "</span></div>";
                    
                    htmlPopup += "<div style=\"margin-bottom:5px;\"><span class=\"value\">" + ((isLanguageFR) ? res.data.value.toFixed(3).toString().replace(".",",") : res.data.value.toFixed(3).toString().replace(",",".")) + " µSv/h</span></div>";
                    
                    if(res.data.qualification == "plane" && res.data.flightNumber != undefined) {
                        htmlPopup += "<div style=\"margin-bottom:5px;\">" +
                            "<span id='seeflightId' class=\"comment\"> "+ translate("Flight") + " " + res.data.flightNumber;

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
                                htmlPopup += translate("In flight measurement");
                                break;
                            case "wrongmeasurement":
                                htmlPopup += translate("Wrong measurement");
                                break;
                            case "temporarysource":
                                htmlPopup += translate("Temporary source measurement");
                                break;
                            case "groundlevel":
                                htmlPopup += translate("Ground level measurement");
                                break;
                        };
                        htmlPopup += " <img style=\"margin-bottom:-4px;\"src=\"/images/thumb.png\"/>+ " + res.data.qualificationVotesNumber;
                        htmlPopup += "</span></div>"
                    }
                    
                    if (res.data.atypical == true)
                        htmlPopup += "<div><span class=\"comment\">" + translate("Non-standard measurement") + "</span></div>";
                        
                    if (res.data.tags != null)
                    {
                        htmlPopup += "<div>";
                        for (var i = 0; i < res.data.tags.length; i++)
                        {
                            htmlPopup += "<span class=\"tag\">#" + res.data.tags[i] + " </span>";
                        }
                        htmlPopup += "</div>";
                    }
                    htmlPopup += "</div>";
                    htmlPopup += "</div>";
                    e.popup.setContent(htmlPopup);
                    
                },
                error: function(res, status, err) {
                    console.log(err + " : " + status); 
                }
            }); 
        }
    });
};

var urlPrev = "null";
var minLatitudePrev = -90, maxLatitudePrev = +90, minLongitudePrev = -10000, maxLongitudePrev = +10000;
var exhaustiveResultsPrev = false;

//setInterval(function(){ openradiation_getItems(false); }, 5000);

function getUrl()
{
    //var urlTemp = "&minLatitude=" + openradiation_map.getBounds().getSouth() 
    //            + "&maxLatitude=" + openradiation_map.getBounds().getNorth() 
    //            + "&minLongitude=" + openradiation_map.getBounds().getWest() 
    //            + "&maxLongitude=" + openradiation_map.getBounds().getEast();
    var urlTemp = "";
    
    var tag = $("#tag").val();
    if (tag != "")
        urlTemp+= "&tag=" + encodeURIComponent(tag);

    var userId = $("#userId").val();
    if (userId != "")
        urlTemp+= "&userId=" + encodeURIComponent(userId);
        
    var qualification = $("#qualification").val();
    if (qualification != "" && qualification != "all")
        urlTemp+= "&qualification=" + qualification;
    
    if (qualification != "plane")
        flightId_selected = null;
   
    if (flightId_selected != null)
        urlTemp+= "&flightId=" + flightId_selected;
    
    var minValue = $("#slider_minvalue").text();
    if (minValue != "" && minValue != "0")
        urlTemp+= "&minValue=" + minValue;

    var maxValue = $("#slider_maxvalue").text();
    if (maxValue != "" && maxValue != "+ ∞")
        urlTemp+= "&maxValue=" + maxValue;
    
    var minDate = $("#slider_mindate").text();
    if (minDate != "" && minDate != "- ∞" && minDate != translate("now"))
    {
        var nbHours = Math.exp((100 - $( "#slider_rangedate" ).slider( "values", 0) ) / 9) - 1;
        var NbSecond = Math.round(nbHours * 3600);
        var now =  new Date();
        now.setMilliseconds(0);
        now.setSeconds(0);
        now.setMinutes(now.getMinutes() - now.getMinutes() % 10);
       
        var minStartTime = new Date(now.getTime() - (NbSecond * 1000) );
        urlTemp+= "&minStartTime=" + minStartTime.toISOString();
    }
    
    var maxDate = $("#slider_maxdate").text();
    if (maxDate != "" && maxDate != "- ∞" && maxDate != translate("now"))
    {
        var nbHours = Math.exp((100 - $( "#slider_rangedate" ).slider( "values", 1) ) / 9) - 1;
        var NbSecond = Math.round(nbHours * 3600);
        var now =  new Date();
        now.setMilliseconds(0);
        now.setSeconds(0);
        now.setMinutes(now.getMinutes() - now.getMinutes() % 10);
       
        var maxStartTime = new Date(now.getTime() - (NbSecond * 1000) );
        urlTemp+= "&maxStartTime=" + maxStartTime.toISOString();
    }
    
    return urlTemp;
}

function retrieve_items(urlTemp, fitBounds) {

    //console.log("retrieve items : " + urlTemp);
    urlPrev = urlTemp;
    minLatitudePrev = openradiation_map.getBounds().getSouth();
    maxLatitudePrev = openradiation_map.getBounds().getNorth();
    minLongitudePrev = openradiation_map.getBounds().getWest();
    maxLongitudePrev = openradiation_map.getBounds().getEast();
    
    let url;

    if (urlTemp.indexOf("qualification=plane&flightId=") > -1)
        url = '/measurements?apiKey=' + apiKey + urlTemp + "&response=complete";
    else {
        url = '/measurements?apiKey=' + apiKey 
            + "&minLatitude=" + openradiation_map.getBounds().getSouth() 
            + "&maxLatitude=" + openradiation_map.getBounds().getNorth() 
            + "&minLongitude=" + openradiation_map.getBounds().getWest() 
            + "&maxLongitude=" + openradiation_map.getBounds().getEast() 
            + urlTemp;
    }
    $("#nbresults").text("...");
    
    $.ajax({
    type: 'GET',
    url: url, 
    //cache: false,
    timeout: 15000,
    success: function(res, statut) {
        
        if (res.data.length < 2)
        {
            exhaustiveResultsPrev = true;
            $("#nbresults").text(res.data.length + " " + translate("measurement found") );
        }
        else if (res.maxNumber == res.data.length)
        { 
            exhaustiveResultsPrev = false;
            $("#nbresults").text(translate("Display limited to the") + " " + res.data.length + " " + translate("most recent measurements") );
        }
        else
        {
            exhaustiveResultsPrev = true;
            $("#nbresults").text(res.data.length + " " + translate("measurements found") );
        }
        
        if (exhaustiveResultsPrev)
            $('.question').hide();
        else
            $('.question').show();
        
        //list all new items
        var openradiation_newitems = [];
        for (i=0; i < res.data.length; i++)
        {
            openradiation_newitems.push(res.data[i].reportUuid);
        }
        
        //for each old item
        var openradiation_olditems = [];
        openradiation_map.eachLayer(function (layer) {               
            if (layer.reportUuid != null)
            {
                if (openradiation_newitems.indexOf(layer.reportUuid) == -1)
                    openradiation_map.removeLayer(layer);
                else
                    openradiation_olditems.push(layer.reportUuid);
            }
        });
        
        //for each new item
        var bounds = [];
        for (i=0; i < res.data.length; i++)
        {
            bounds.push([(res.data[i].refinedLatitude != undefined) ? res.data[i].refinedLatitude : res.data[i].latitude, (res.data[i].refinedLongitude != undefined) ? res.data[i].refinedLongitude : res.data[i].longitude]);
                    
            if (openradiation_olditems.indexOf(res.data[i].reportUuid) == -1)
            {
                var htmlPopup = "<div></div>";
                var icon;
                
                var nSvValue = res.data[i].value * 1000;
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
          
                var marker = L.marker([(res.data[i].refinedLatitude != undefined) ? res.data[i].refinedLatitude : res.data[i].latitude, (res.data[i].refinedLongitude != undefined) ? res.data[i].refinedLongitude : res.data[i].longitude],  {icon: icon}).addTo(openradiation_map)
                    .bindPopup(htmlPopup);
                marker.reportUuid = res.data[i].reportUuid;
                //for chart time
                marker.value = res.data[i].value;
                marker.startTime = new Date(res.data[i].startTime);
            }
        }
        
        if (urlTemp.indexOf("qualification=plane&flightId=") > -1) { // if we click on a flight we change the popup and the geodesic
            flightId_geodesic.setStyle( { 'color' : '#ff4f33' }); //red
            flightId_geodesic._popup.setContent(flightId_geodesic._popup.getContent().replace("<span class=\"value\">" + " " + translate("measurements") + "</span>","<span class=\"value\">" + bounds.length + " " + translate("measurements") + "</span>")); //update popupup with nb measurements
            
            if(flightId_geodesic.airportOrigin_location != undefined && flightId_geodesic.airportDestination_location != undefined) { //if airports are known add airports locations
                bounds.unshift(flightId_geodesic.airportDestination_location); //add in first last position (airportDestination) while bounds are sorted by date desc
                bounds.push(flightId_geodesic.airportOrigin_location); // add first position (airportOrigin)
                flightId_geodesic.setLatLngs([bounds]);
                
            }
        }
        
        if (fitBounds)
            openradiation_map.fitBounds(bounds, { maxZoom: 13 } );
    },
    error: function() {
        //alert('Error during retrieving data'); 
        }
    });
}

function openradiation_getItems(fitBounds)
{
    var urlTemp = getUrl();
    
    // if qualification change to plane from an other, we add geodesics
    if (urlPrev.indexOf("qualification=plane") == -1 && $("#qualification").val() == "plane" && (window.navigator.userAgent.indexOf("MSIE") == -1 && window.navigator.userAgent.indexOf("Trident") == -1)) {
        $.ajax({
            type: 'GET',
            url: '/flights?apiKey=' + apiKey,
            timeout: 15000,
            success: function(res) {
                for (i=0; i < res.data.length; i ++)
                {
                    var points = [
                        [res.data[i].firstLatitude, res.data[i].firstLongitude],
                        [res.data[i].midLatitude, res.data[i].midLongitude],
                        [res.data[i].lastLatitude, res.data[i].lastLongitude]
                    ];

                    let html =
                        "<div style=\"background-color:#ffffff; width:200px; overflow:hidden; min-height:70px;\">" +
                        "<div style=\"margin-bottom:4px; border-bottom:solid #F1F1F1 1px;\">" +
                        "<strong>" + translate("Flight") + " " + res.data[i].flightNumber;

                    if(res.data[i].aircraftType != undefined) {
                        html += " (" + res.data[i].aircraftType + ")";
                        html += "</strong></div>";
                    } else {
                        html += "</strong></div>";
                    }

                    //html += "<div style=\"margin:10px;\">";
                    html += "<div style=\"float:right;\"><img src=\"/images/icon-env-plane.png\"/></div>";

                    html += "<div style=\"margin-bottom:5px;\"><span class=\"value\">" + " " + translate("measurements") + "</span></div>";

                    if(res.data[i].airportOrigin != undefined && res.data[i].airportDestination != undefined) {
                        html +=
                        "<table class=\"comment\">" +
                        "<tr>" +
                            "<td>" + translate("From:") + " </td>" +
                            "<td>" + res.data[i].airportOrigin +
                            "<td>" + " " + (res.data[i].departureTime != undefined ? formatISODate(res.data[i].departureTime) : "") + "</td>" +
                        "</tr>" +
                        "<tr>" +
                            "<td>" + translate("To:") + " </td>" +
                            "<td>" + res.data[i].airportDestination +
                            "<td>" + " " + (res.data[i].arrivalTime != undefined ? formatISODate(res.data[i].arrivalTime) : "")  + "</td>" +
                        "</tr>" +
                        "</table>";
                    }

                    html += "</div>";
                    html +=   '<div onclick="drawPlotly()"><span class="openradiation_icon icon_timeline"></span> <span id="timechartlink">' +
                        translate("See flight profile") + '</span></div>';
                    html += "</div>";

                    var allPointsGreaterThanZero = points.every(function(point) {
                        return point.every(function(coord) {
                            return coord && coord > 0;
                        });
                    });

                    if (allPointsGreaterThanZero) {
                        //var polyline = L.polyline(latlngs, {color: 'orange' }).addTo(openradiation_map);
                        var geodesic = L.geodesic([], {color: '#ffac33'}).bindPopup(html);
                        geodesic.setLatLngs([points]);

                        geodesic.flightId = res.data[i].flightId;
                        if (res.data[i].airportOrigin != undefined && res.data[i].airportDestination != undefined) {
                            geodesic.airportOrigin_location = [res.data[i].firstLatitude, res.data[i].firstLongitude];
                            geodesic.airportDestination_location = [res.data[i].lastLatitude, res.data[i].lastLongitude];
                        }
                        geodesic.addTo(openradiation_map);
                    }
                }            
            },
            error: function(res, status, err) {
                console.log(err + " : " + status); 
            }
        });          
    }
    
    // if qualification change from plane to an other, we remove geodesics
    if (urlPrev.indexOf("qualification=plane") > -1 && $("#qualification").val() != "plane" && (window.navigator.userAgent.indexOf("MSIE") == -1 && window.navigator.userAgent.indexOf("Trident") == -1)) {
        openradiation_map.eachLayer(function (layer) {
            if (layer.flightId != null) {
                openradiation_map.removeLayer(layer);
            }
        });   
    }

    // we retrieve results if filters are differents
    //     or one of the geographical bounds are outside the bounds of the last request (and we do not click on a flight)
    //     or geographical bounds are included and results were not exhaustive, and some items are not included in the new bounds (and we do not click on a flight)
    if (urlTemp != urlPrev)
        retrieve_items(urlTemp, fitBounds);
    else if (($("#qualification").val() != "plane" || flightId_selected == null) && (openradiation_map.getBounds().getSouth() < minLatitudePrev 
       || openradiation_map.getBounds().getNorth() > maxLatitudePrev
       || openradiation_map.getBounds().getWest() < minLongitudePrev
       || openradiation_map.getBounds().getEast() > maxLongitudePrev))
        retrieve_items(urlTemp, fitBounds);
    else if (($("#qualification").val() != "plane" || flightId_selected == null) && (openradiation_map.getBounds().getSouth() > minLatitudePrev
       || openradiation_map.getBounds().getNorth() < maxLatitudePrev 
       || openradiation_map.getBounds().getWest() > minLongitudePrev
       || openradiation_map.getBounds().getEast() < maxLongitudePrev))
    {
        var nb = 0;
        var not_included = false;
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
                //updated results without research
                if (nb < 2)
                    $("#nbresults").text(nb + " " + translate("measurement found"));
                else
                    $("#nbresults").text(nb + " " + translate("measurements found"));
            } else
                console.log("measurements not updated (not exhaustive and all the items are in the new bounds)");
        }
    } else
        console.log("no change");
};

function val2uSv(val)
{
    //empiric method to convert from 0-100 scale to the expected scale in uSv/h
    var uSv = Math.round((Math.exp(val / 11.94) * 29)) / 1000;
    
    if (uSv > 120)
        return "+ ∞";
    else if (uSv < 0.03)
        return 0;
    else
        return uSv.toFixed(3);
}

function val2date(val)
{    
    //var hour = Math.exp((40 - val) / 3) - 1; // this is the nb hour from now
    var hour = Math.exp((100 - val) / 9) - 1;
    
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
    
    $(".toggle").click(function(){
        $(".openradiation_filters").slideToggle();
        $(".openradiation_toggle").toggleClass('min-height');
        $(this).toggleClass('icon_toggle-down');
        $(this).toggleClass('icon_toggle-up');
        //$('.leaflet-control-attribution').toggle();
    });

    $( "#tag").on('input', function() {
       openradiation_getItems(false);
    });
    
    $( "#userId").on('input', function() {
       openradiation_getItems(false);
    });
    
    $( "#qualification").change(function() {
       openradiation_getItems(false);
    });

    openradiation_map.on('moveend', function(e) {
       openradiation_getItems(false);
    });

    $( "#slider_rangevalue" ).slider({
        range: true,
        min: 0,
        max: 100,
        values: [ 0, 100 ],
        slide: function( event, ui ) {
            $( "#slider_minvalue").text(val2uSv(ui.values[0]));
            $( "#slider_maxvalue").text(val2uSv(ui.values[1]));
            openradiation_getItems(false);
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
            openradiation_getItems(false);
        }
    });
    
    $( "#export" ).click(function() {
        
        //var isFileSaverSupported = !!new Blob;
        var urlTemp = getUrl();
        
        if (flightId_selected == null)
            url = '/measurements?apiKey=' + apiKey + "&minLatitude=" + openradiation_map.getBounds().getSouth() + "&maxLatitude=" + openradiation_map.getBounds().getNorth() + "&minLongitude=" + openradiation_map.getBounds().getWest() + "&maxLongitude=" + openradiation_map.getBounds().getEast() + urlTemp + "&response=complete&withEnclosedObject=no";
        else
            url = '/measurements?apiKey=' + apiKey + urlTemp + '&response=complete&withEnclosedObject=no';
           
        $.ajax({
            type: 'GET',
            url: url,
            cache: false,
            timeout: 10000,
            success: function(res) {
                var str="apparatusId;apparatusVersion;apparatusSensorType;apparatusTubeType;temperature;value;hitsNumber;calibrationFunction;startTime;endTime;latitude;longitude;accuracy;altitude;altitudeAccuracy;endLatitude;endLongitude;endAccuracy;endAltitude;endAltitudeAccuracy;deviceUuid;devicePlatform;deviceVersion;deviceModel;reportUuid;manualReporting;organisationReporting;description;measurementHeight;userId;measurementEnvironment;rain;flightNumber;seatNumber;windowSeat;storm;flightId;refinedLatitude;refinedLongitude;refinedAltitude;refinedEndLatitude;refinedEndLongitude;refinedEndAltitude;departureTime;arrivalTime;airportOrigin;airportDestination;aircraftType;firstLatitude;firstLongitude;midLatitude;midLongitude;lastLatitude;lastLongitude;dateAndTimeOfCreation;qualification;qualificationVotesNumber;reliability;atypical;tags list\n";      
                for(var i in res.data)
                {
                    str += res.data[i].apparatusId == null ? ";" : csv(res.data[i].apparatusId) + ";";
                    str += res.data[i].apparatusVersion == null ? ";" : csv(res.data[i].apparatusVersion) + ";";
                    str += res.data[i].apparatusSensorType == null ? ";" : csv(res.data[i].apparatusSensorType) + ";";
                    str += res.data[i].apparatusTubeType == null ? ";" : csv(res.data[i].apparatusTubeType) + ";";
                    str += res.data[i].temperature == null ? ";" : res.data[i].temperature + ";";
                    str += res.data[i].value + ";";
                    str += res.data[i].hitsNumber == null ? ";" : res.data[i].hitsNumber + ";";
                    str += res.data[i].calibrationFunction == null ? ";" : csv(res.data[i].calibrationFunction) + ";";
                    str += res.data[i].startTime + ";";
                    str += res.data[i].endTime == null ? ";" : res.data[i].endTime + ";";	
                    str += res.data[i].latitude + ";";	
                    str += res.data[i].longitude + ";";
                    str += res.data[i].accuracy == null ? ";" : res.data[i].accuracy + ";";	
                    str += res.data[i].altitude == null ? ";" : res.data[i].altitude + ";";	
                    str += res.data[i].altitudeAccuracy == null ? ";" : res.data[i].altitudeAccuracy + ";";
                    str += res.data[i].endLatitude == null ? ";" : res.data[i].endLatitude + ";";	
                    str += res.data[i].endLongitude == null ? ";" : res.data[i].endLongitude + ";";	
                    str += res.data[i].endAccuracy == null ? ";" : res.data[i].endAccuracy + ";";	
                    str += res.data[i].endAltitude == null ? ";" : res.data[i].endAltitude + ";";	
                    str += res.data[i].endAltitudeAccuracy == null ? ";" : res.data[i].endAltitudeAccuracy + ";";	
                    str += res.data[i].deviceUuid == null ? ";" : csv(res.data[i].deviceUuid) + ";";	
                    str += res.data[i].devicePlatform == null ? ";" : csv(res.data[i].devicePlatform) + ";";	
                    str += res.data[i].deviceVersion == null ? ";" : csv(res.data[i].deviceVersion) + ";";	
                    str += res.data[i].deviceModel == null ? ";" : csv(res.data[i].deviceModel) + ";";	
                    str += res.data[i].reportUuid + ";";
                    str += res.data[i].manualReporting ? "1;" : "0;";
                    str += res.data[i].organisationReporting == null ? ";" : csv(res.data[i].organisationReporting) + ";";		
                    str += res.data[i].description == null ? ";" : csv(res.data[i].description) + ";";	
                    str += res.data[i].measurementHeight == null ? ";" : res.data[i].measurementHeight + ";";	
                    str += res.data[i].userId == null ? ";" : csv(res.data[i].userId) + ";";
                    str += res.data[i].measurementEnvironment == null ? ";" : res.data[i].measurementEnvironment + ";";
                    str += res.data[i].rain == null ? ";" : res.data[i].rain + ";";
                    str += res.data[i].flightNumber == null ? ";" : csv(res.data[i].flightNumber) + ";";		
                    str += res.data[i].seatNumber == null ? ";" : csv(res.data[i].seatNumber) + ";";		
                    str += res.data[i].windowSeat == null ? ";" : res.data[i].windowSeat + ";";
                    str += res.data[i].storm == null ? ";" : res.data[i].storm + ";";
                    str += res.data[i].flightId == null ? ";" : res.data[i].flightId + ";";	
                    str += res.data[i].refinedLatitude == null ? ";" : res.data[i].refinedLatitude + ";";	
                    str += res.data[i].refinedLongitude == null ? ";" : res.data[i].refinedLongitude + ";";	
                    str += res.data[i].refinedAltitude == null ? ";" : res.data[i].refinedAltitude + ";";
                    str += res.data[i].refinedEndLatitude == null ? ";" : res.data[i].refinedEndLatitude + ";";	
                    str += res.data[i].refinedEndLongitude == null ? ";" : res.data[i].refinedEndLongitude + ";";	
                    str += res.data[i].refinedEndAltitude == null ? ";" : res.data[i].refinedEndAltitude + ";";
                    str += res.data[i].departureTime == null ? ";" : res.data[i].departureTime + ";";
                    str += res.data[i].arrivalTime == null ? ";" : res.data[i].arrivalTime + ";";	
                    str += res.data[i].airportOrigin == null ? ";" : csv(res.data[i].airportOrigin) + ";";	
                    str += res.data[i].airportDestination == null ? ";" : csv(res.data[i].airportDestination) + ";";	
                    str += res.data[i].aircraftType == null ? ";" : csv(res.data[i].aircraftType) + ";";	
                    str += res.data[i].firstLatitude == null ? ";" : res.data[i].firstLatitude + ";";	
                    str += res.data[i].firstLongitude == null ? ";" : res.data[i].firstLongitude + ";";	
                    str += res.data[i].midLatitude == null ? ";" : res.data[i].midLatitude + ";";
                    str += res.data[i].midLongitude == null ? ";" : res.data[i].midLongitude + ";";	
                    str += res.data[i].lastLatitude == null ? ";" : res.data[i].lastLatitude + ";";	
                    str += res.data[i].lastLongitude == null ? ";" : res.data[i].lastLongitude + ";";
                    str += res.data[i].dateAndTimeOfCreation + ";";
                    str += res.data[i].qualification == null ? ";" : res.data[i].qualification + ";";	
                    str += res.data[i].qualificationVotesNumber == null ? ";" : res.data[i].qualificationVotesNumber + ";";	
                    str += res.data[i].reliability + ";";
                    str += res.data[i].atypical ? "1;" : "0;";
                    //if (res.data[i].tags == null)
                    //    str += ";";
                    //else {
                    if (res.data[i].tags != null){
                        for (t in res.data[i].tags)
                        {
                            str += csv(res.data[i].tags[t]);
                            if (t < (res.data[i].tags.length-1) )
                                str += ";";
                        }
                    }
                    str += "\n";
                }
                
                try {
                    var blob = new Blob([str], {type: "text/csv;charset=utf-8"});
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
        if (openradiation_map.hasLayer(interpolation))
            openradiation_map.removeLayer(interpolation);
        else
            openradiation_map.addLayer(interpolation);
    });
    
    
    $( "#permalink" ).click(function() {
        var link = window.location.protocol + "//" + window.location.host + "/openradiation";
        var zoom = "/" + openradiation_map.getZoom() + "/" + openradiation_map.getCenter().lat.toFixed(7) + "/" + openradiation_map.getCenter().lng.toFixed(7);
       
        var permalink_details = "/";
        
        if ($("#tag").val() != "")
            permalink_details += $("#tag").val() +"/";
        else
            permalink_details += "all/";
        
        if ($("#userId").val() != "")
            permalink_details += $("#userId").val() +"/";
        else
            permalink_details += "all/";
        permalink_details += $("#qualification").val() + "/all/"; //all is form atypical 
        permalink_details += $( "#slider_rangevalue" ).slider( "values", 0) + "/" + $( "#slider_rangevalue" ).slider( "values", 1) + "/";
        permalink_details += $( "#slider_rangedate" ).slider( "values", 0) + "/" + $( "#slider_rangedate" ).slider( "values", 1);
        
        if (permalink_details == "/all/all/groundlevel/all/0/100/0/100") // this is the default view
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

    $( "#timechartlink" ).click(function() {
        drawPlotly();
    });
});

   


            



