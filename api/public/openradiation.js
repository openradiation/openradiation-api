
var icon_c = L.Icon.extend({
    options: {
        shadowUrl: '/images/marker-shadow_1.png',
        shadowRetinaUrl: '/images/marker-shadow_1-2x.png',
        iconSize:     [12, 20],
        shadowSize:   [20, 20],
        iconAnchor:   [6, 20], // point of the icon which will correspond to marker's location from the top / left corner
        shadowAnchor: [6, 20], // the same for the shadow
        popupAnchor:  [0, -23] // point from which the popup should open relative to the iconAnchor
    }
});

var icon_1 = new icon_c({iconUrl: '/images/marker-icon_1.png', iconRetinaUrl: '/images/marker-icon_1-2x.png'}),
    icon_2 = new icon_c({iconUrl: '/images/marker-icon_2.png', iconRetinaUrl: '/images/marker-icon_2-2x.png'}),
    icon_3 = new icon_c({iconUrl: '/images/marker-icon_3.png', iconRetinaUrl: '/images/marker-icon_3-2x.png'}),
    icon_4 = new icon_c({iconUrl: '/images/marker-icon_4.png', iconRetinaUrl: '/images/marker-icon_4-2x.png'}),
    icon_5 = new icon_c({iconUrl: '/images/marker-icon_5.png', iconRetinaUrl: '/images/marker-icon_5-2x.png'}),
    icon_6 = new icon_c({iconUrl: '/images/marker-icon_6.png', iconRetinaUrl: '/images/marker-icon_6-2x.png'}),
    icon_7 = new icon_c({iconUrl: '/images/marker-icon_7.png', iconRetinaUrl: '/images/marker-icon_7-2x.png'}),
    icon_8 = new icon_c({iconUrl: '/images/marker-icon_8.png', iconRetinaUrl: '/images/marker-icon_8-2x.png'}),
    icon_9 = new icon_c({iconUrl: '/images/marker-icon_9.png', iconRetinaUrl: '/images/marker-icon_9-2x.png'}),
    icon_10 = new icon_c({iconUrl: '/images/marker-icon_10.png', iconRetinaUrl: '/images/marker-icon_10-2x.png'}),
    icon_11 = new icon_c({iconUrl: '/images/marker-icon_11.png', iconRetinaUrl: '/images/marker-icon_11-2x.png'}),
    icon_12 = new icon_c({iconUrl: '/images/marker-icon_12.png', iconRetinaUrl: '/images/marker-icon_12-2x.png'}),
    icon_13 = new icon_c({iconUrl: '/images/marker-icon_13.png', iconRetinaUrl: '/images/marker-icon_13-2x.png'}),
    icon_14 = new icon_c({iconUrl: '/images/marker-icon_14.png', iconRetinaUrl: '/images/marker-icon_14-2x.png'}),
    icon_15 = new icon_c({iconUrl: '/images/marker-icon_15.png', iconRetinaUrl: '/images/marker-icon_15-2x.png'}),
    icon_16 = new icon_c({iconUrl: '/images/marker-icon_16.png', iconRetinaUrl: '/images/marker-icon_16-2x.png'});
    
var interpolation;

function formatISODate(ISODate)
{
    var date = new Date(ISODate);
    var str = "";
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
    return str;
}

function openradiation_init(measurementURL, withLocate, zoom, latitude, longitude, tag, userId, qualification, atypical, rangeValueMin, rangeValueMax, rangeDateMin, rangeDateMax)
{
    // create a map in the "map" div, set the view to a given place and zoom
    openradiation_map = L.map('openradiation_map', { zoomControl: false, attributionControl: true}).setView([latitude, longitude], zoom);
   
    //if you want to locate the client
    if (withLocate)
        openradiation_map.locate({setView : true, maxZoom:13 });
   
    // add an OpenStreetMap tile layer
    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors | &copy; <a href="http://www.openradiation.org/copyright">OpenRadiation</a> | <span id="\hide_filters\">Filtres +/-</span> | <span id="\permalink\">Permalink</span>'
    }).addTo(openradiation_map);
   
    //add an interpolation map layer
    interpolation = 
      new L.TileLayer('i/{z}/{x}/{y}.png',
      {
        opacity: 0.6
      });
    openradiation_map.addLayer(interpolation);
    
    var openradiation_title = L.control({
        position : 'topleft'
    });
    
    openradiation_title.onAdd = function(openradiation_map) {
        var div = L.DomUtil.create('div', 'openradiation_title');
        div.innerHTML = '<strong>Les citoyens mesurent la radioactivité</strong>';
        return div;
    };
    
    openradiation_title.addTo(openradiation_map);
    
    // add our zoom control manually where we want to
    var zoomControl = L.control.zoom({ position: 'topleft'});
    openradiation_map.addControl(zoomControl);

    // add a openradiation_filters 
    var openradiation_filters = L.control({
        position : 'bottomleft'
    });
    
    openradiation_filters.onAdd = function(openradiation_map) {
        var div = L.DomUtil.create('div', 'openradiation_filters');
        L.DomEvent.disableClickPropagation(div);      
        div.innerHTML = '<div class=\"slider_range\">\
                            <div>\
                                <div id=\"slider_rangevalue\"></div> \
                                <div><span id=\"slider_minvalue\"></span><span id=\"slider_text\">VALEUR EN μSv/h</span><span id=\"slider_maxvalue\"></span></div>\
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
                                <input id="tag" class="input" type="text" placeholder="# Votre tag"/>  \
                                <input id="userId" class="input" type="text" placeholder="Utilisateur"/> \
                            </div>\
                         </div>\
                         <div class=\"download_file\">\
                            <div id=\"export\">\
                                <div>FICHIER CSV</div> \
                                <img src=\"/images/arrow_download.png\"/> \
                            </div>\
                         </div>\
                         <div class=\"select_qualification\">\
                            <div>\
                                <select id="qualification" name="qualification"> \
                                    <option value="all">TOUTES QUALIFICATIONS</option> \
                                    <option value="seemscorrect">Semble correcte</option> \
                                    <option value="mustbeverified">Doit être vérifiée</option> \
                                    <option value="noenvironmentalcontext">Mesure non environnementale</option>\
                                    <option value="badsensor">Défaut de capteur</option>\
                                    <option value="badprotocole">Protocole non respecté</option>\
                                    <option value="baddatatransmission">Problème de transmission de données</option>\
                                </select>\
                                <select id="atypical" name="atypical"> \
                                    <option value="all">TOUTES MESURES</option> \
                                    <option value="false">Mesures standard</option> \
                                    <option value="true">Mesures atypiques</option> \
                                </select>\
                            </div>\
                         </div>';       
        return div;
    };
       
    openradiation_filters.addTo(openradiation_map);

    $("#tag").val(tag);
    $("#userId").val(userId);
    $("#qualification").val(qualification);
    $("#atypical").val(atypical);
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

    if (withLocate == false)
        $('.openradiation_filters').css('display', 'none');
    
    //add a message
    var openradiation_message = L.control({
        position : 'bottomleft'
    });
    openradiation_message.onAdd = function(openradiation_map) {
        var div = L.DomUtil.create('div', 'openradiation_message');
        div.innerHTML = '<span id="nbresults"></span>';
        return div;
    };
    openradiation_message.addTo(openradiation_map); 
      
    // add a metric scale
    L.control.scale( { imperial:false, position:'bottomleft'}).addTo(openradiation_map);
       
    openradiation_map.on('popupopen', function(e) {
            $.ajax({
                type: 'GET',
                url: '/measurements/' + e.popup._source.reportUuid + '?apiKey=' + apiKey + '&response=complete',
                //dataType: "jsonp",
                //jsonpCallback: "_test",
                //cache: false,
                timeout: 15000,
                success: function(res) {

                    var htmlPopup = "<div style=\"width:210px; overflow:auto; min-height:130px;\"><div style=\"margin-bottom:4px; border-bottom:solid #F1F1F1 1px;\"><strong style=\"color:#A4A4A4;\">" + formatISODate(res.data.startTime) + "</strong></div>";
                    
                    htmlPopup += "<div style=\"margin-right:10px; float:left;width:50px; min-height:90px;\">";

                    if (typeof(res.data.enclosedObject) != "undefined") 
                        htmlPopup = htmlPopup + "<div style=\"height:60px; margin-bottom:5px; \"><img class=\"openradiation_img\" src=\"" + res.data.enclosedObject + "\"/></div>";
                    else
                        htmlPopup = htmlPopup + "<div style=\"height:60px; margin-bottom:5px; \"><img class=\"openradiation_img\" src=\"/images/measure.png\"/></div>";
                    htmlPopup += "<div><a class=\"voirplus\" href=\"" + measurementURL.replace("{reportUuid}", res.data.reportUuid) + "\" target=\"_blank\"><p>Voir plus</p><p class=\"plus\">+</p></a></div>";
                    htmlPopup += "</div>";
                    
                    htmlPopup += "<div style=\"width:150px; float:right; min-height:90px;\">";
                    
                    if (res.data.userId != null)
                        htmlPopup += "<div><span class=\"userId\">" + res.data.userId + "</span></div>";
                    htmlPopup += "<span class=\"value\">" + res.data.value.toFixed(3).toString().replace(".",",") + " µSv/h</span><br/>";
                        
                    if (res.data.qualification != null) {
                        htmlPopup += "<div><span class=\"comment\">";
                        switch (res.data.qualification) {
                            case "seemscorrect":
                                htmlPopup += "Semble correcte";
                                break;
                            case "mustbeverified":
                                htmlPopup += "Doit être vérifiée";
                                break;
                            case "noenvironmentalcontext":
                                htmlPopup += "Mesure non environnementale";
                                break;
                            case "badsensor":
                                htmlPopup += "Défaut de capteur";
                                break;
                            case "badprotocole":
                                htmlPopup += "Protocole non respecté";
                                break;
                            case "baddatatransmission":
                                htmlPopup += "Problème de transmission de données";
                                break;
                        };
                        htmlPopup += ", " + res.data.qualificationVotesNumber + " pouce";
                        htmlPopup += res.data.qualificationVotesNumber < 2 ? "" : "s";
                        htmlPopup += "</span></div>"
                        
                    }
                    
                    if (res.data.atypical == true)
                        htmlPopup += "<div><span class=\"comment\">Mesure Atypique</span></div>";
                        
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
                    console.log(htmlPopup);
                    e.popup.setContent(htmlPopup);
                    
                    },
                error: function() {
                    //alert('Error during retrieving data'); 
                    }
                });           
    });
};


var urlprecedente= "";
setInterval(function(){ openradiation_getItems(false); }, 5000);

function getUrl()
{
    var urlTemp = "&minLatitude=" + openradiation_map.getBounds().getSouth() 
                + "&maxLatitude=" + openradiation_map.getBounds().getNorth() 
                + "&minLongitude=" + openradiation_map.getBounds().getWest() 
                + "&maxLongitude=" + openradiation_map.getBounds().getEast();
    
    var tag = $("#tag").val();
    if (tag != "")
        urlTemp+= "&tag=" + tag;

    var userId = $("#userId").val();
    if (userId != "")
        urlTemp+= "&userId=" + userId;
        
    var qualification = $("#qualification").val();
    if (qualification != "" && qualification != "all")
        urlTemp+= "&qualification=" + qualification;

    var atypical = $("#atypical").val();
    if (atypical != "" && atypical != "all")
        urlTemp+= "&atypical=" + atypical;
        
    var minValue = $("#slider_minvalue").text();
    if (minValue != "" && minValue != "0")
        urlTemp+= "&minValue=" + minValue;

    var maxValue = $("#slider_maxvalue").text();
    if (maxValue != "" && maxValue != "+ ∞")
        urlTemp+= "&maxValue=" + maxValue;
    
    var minDate = $("#slider_mindate").text();
    if (minDate != "" && minDate != "- ∞" && minDate != "maintenant")
    {
        //var nbHours = Math.exp((40 - $( "#slider_rangedate" ).slider( "values", 0) ) / 3) - 1;
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
    if (maxDate != "" && maxDate != "- ∞" && maxDate != "maintenant")
    {
        //var nbHours = Math.exp((40 - $( "#slider_rangedate" ).slider( "values", 1) ) / 3) - 1;
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

function openradiation_getItems(fitBounds)
{
    var urlTemp = getUrl();
     
    if (urlTemp != urlprecedente) {
        urlprecedente = urlTemp;
        $("#nbresults").text("...");
        $.ajax({
        type: 'GET',
        url: '/measurements?apiKey=' + apiKey + urlTemp, 
        cache: false,
        timeout: 15000,
        success: function(res) {
            
            if (res.data.length < 2)
                $("#nbresults").text(res.data.length + " mesure trouvée");
            else if (res.maxNumber == res.data.length)
                $("#nbresults").text(res.data.length + " mesures affichées (non exhaustif)");
            else
                $("#nbresults").text(res.data.length + " mesures trouvées");
             
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
            for (i=0; i < res.data.length; i++)
            {
                if (openradiation_olditems.indexOf(res.data[i].reportUuid) == -1)
                {
                    var htmlPopup = "<div></div>";
                    var icon;
                    
                    var nSvValue = res.data[i].value * 1000;
                    //16 colours classes depending value in nSv/h
                    if (nSvValue < 0.395612425)
                        icon = icon_1;
                    else if (nSvValue < 1.718281828) 
                        icon = icon_2;
                    else if (nSvValue < 4.29449005)
                        icon = icon_3;
                    else if (nSvValue < 9.312258501) 
                        icon = icon_4;
                    else if (nSvValue < 19.08553692) 
                        icon = icon_5;
                    else if (nSvValue < 38.121284) 
                        icon = icon_6;
                    else if (nSvValue < 75.19785657) 
                        icon = icon_7;
                    else if (nSvValue < 147.4131591) 
                        icon = icon_8;
                    else if (nSvValue < 288.0693621) 
                        icon = icon_9;
                    else if (nSvValue < 562.0302368) 
                        icon = icon_10;
                    else if (nSvValue < 1095.633158)
                        icon = icon_11;
                    else if (nSvValue < 2134.949733) 
                        icon = icon_12;
                    else if (nSvValue < 4159.262005) 
                        icon = icon_13;
                    else if (nSvValue < 8102.083928) 
                        icon = icon_14;
                    else if (nSvValue < 15781.6524) 
                        icon = icon_15;
                    else 
                        icon = icon_16;
              
                    var marker = L.marker([res.data[i].latitude, res.data[i].longitude],  {icon: icon}).addTo(openradiation_map)
                        .bindPopup(htmlPopup);
                    marker.reportUuid = res.data[i].reportUuid;
                }
            }
            
            if (fitBounds)
            {
                var bounds = [];
                for (i=0; i < res.data.length; i++)
                {
                    bounds.push([res.data[i].latitude, res.data[i].longitude]);
                }
                openradiation_map.fitBounds(bounds, { maxZoom: 13 } );
            }
            
        },
        error: function() {
            //alert('Error during retrieving data'); 
            }
        });
    }
};

function val2uSv(val)
{
    var uSv = Math.round((Math.exp(val / 10) - 1)) / 1000;
                            
    if (uSv > 22)
        return "+ ∞";
    else if (uSv == 0)
        return 0;
    else
        return uSv.toFixed(3);
}

function val2date(val)
{    
    //var hour = Math.exp((40 - val) / 3) - 1; // this is the nb hour from now
    var hour = Math.exp((100 - val) / 9) - 1;
    
    if (hour == 0)
        return "maintenant";
    else if (hour < 0.4)
        return Math.round(hour*60 / 10) * 10 + " minutes";
    else if (hour < 20)
    {
        if (Math.round(hour) == 1)
            return "1 heure";
        else
            return Math.round(hour) + " heures";
    }
    else if (hour < 24*30)
    {
        if (Math.round(hour / 24) == 1)
            return "1 jour";
        else
            return Math.round(hour / 24) + " jours";   
    }
    else if (hour < 24*30*9)
        return Math.round(hour / 24 / 30) + " mois";
    else if (hour > 60000)
        return "- ∞";
    else {
        if (Math.round(hour /24 / 365) == 1)
            return "1 an";
        else
            return Math.round(hour /24 / 365) + " ans";
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
    
    $( "#export" ).click(function() {
        
        try {
            var isFileSaverSupported = !!new Blob;
            var urlTemp = getUrl();
    
            $.ajax({
                type: 'GET',
                url: '/measurements?apiKey=' + apiKey + urlTemp + "&response=complete&withEnclosedObject=no", 
                cache: false,
                timeout: 10000,
                success: function(res) {
                        
                    var str="Request done via openradiation.org at " + new Date().toString() + " with the parameters " + urlTemp + "\n\n";
                    str += "apparatusID,apparatusVersion,apparatusSensorType,apparatusTubeType,temperature,value,hitsNumber,startTime,endTime,latitude,longitude,accuracy,altitude,altitudeAccuracy,deviceUuid,devicePlatform,deviceVersion,deviceModel,reportUuid,manualReporting,organisationReporting,reportContext,description,measurementHeight,userId,measurementEnvironment,dateAndTimeOfCreation,qualification,qualificationVotesNumber,reliability,atypical,tags\n";
                    for(var i in res.data)
                    {
                        str += res.data[i].apparatusID == null ? "," : res.data[i].apparatusID + ",";
                        str += res.data[i].apparatusVersion == null ? "," : res.data[i].apparatusVersion + ",";
                        str += res.data[i].apparatusSensorType == null ? "," : res.data[i].apparatusSensorType + ",";
                        str += res.data[i].apparatusTubeType == null ? "," : res.data[i].apparatusTubeType + ",";
                        str += res.data[i].temperature == null ? "," : res.data[i].temperature + ",";
                        str += res.data[i].value + ",";
                        str += res.data[i].hitsNumber == null ? "," : res.data[i].hitsNumber + ",";
                        str += res.data[i].startTime + ",";
                        str += res.data[i].endTime == null ? "," : res.data[i].endTime + ",";	
                        str += res.data[i].latitude + ",";	
                        str += res.data[i].longitude + ",";
                        str += res.data[i].accuracy == null ? "," : res.data[i].accuracy + ",";	
                        str += res.data[i].altitude == null ? "," : res.data[i].altitude + ",";	
                        str += res.data[i].altitudeAccuracy == null ? "," : res.data[i].altitudeAccuracy + ",";	
                        str += res.data[i].deviceUuid == null ? "," : res.data[i].deviceUuid + ",";	
                        str += res.data[i].devicePlatform == null ? "," : res.data[i].devicePlatform + ",";	
                        str += res.data[i].deviceVersion == null ? "," : res.data[i].deviceVersion + ",";	
                        str += res.data[i].deviceModel == null ? "," : res.data[i].deviceModel + ",";	
                        str += res.data[i].reportUuid + ",";
                        str += res.data[i].manualReporting + ",";
                        str += res.data[i].organisationReporting == null ? "," : res.data[i].organisationReporting + ",";	
                        str += res.data[i].reportContext == null ? "," : res.data[i].reportContext + ",";	
                        str += res.data[i].description == null ? "," : res.data[i].description + ",";	
                        str += res.data[i].measurementHeight == null ? "," : res.data[i].measurementHeight + ",";	
                        str += res.data[i].userId == null ? "," : res.data[i].userId + ",";
                        str += res.data[i].measurementEnvironment == null ? "," : res.data[i].measurementEnvironment + ",";
                        str += res.data[i].dateAndTimeOfCreation + ",";
                        str += res.data[i].qualification == null ? "," : res.data[i].qualification + ",";	
                        str += res.data[i].qualificationVotesNumber == null ? "," : res.data[i].qualificationVotesNumber + ",";	
                        str += res.data[i].reliability + ",";
                        str += res.data[i].atypical + ",";
                        if (res.data[i].tags == null)
                            str += ",";
                        else {
                            for (t in res.data[i].tags)
                                str += res.data[i].tags[t] + ",";
                        }
                        str += "\n";
                    }
                    var blob = new Blob([str], {type: "text/plain;charset=utf-8"});
                    saveAs(blob, "export_openradiation.csv");
                },
                error: function() {
                    alert('Error during retrieving data'); 
                }
            });
        } catch (e) {
            alert("This feature is not available your old version of browser");
        }
    });
    
    $( "#hide_filters" ).click(function() {
        if ($( ".openradiation_filters" ).css('display') == "block")
        {
            $('.openradiation_filters').css('display', 'none');
        }
        else
        {
            $('.openradiation_filters').css('display', 'block');        
        }
    });
     
    $( "#hide_filters" ).dblclick(function() {
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
        permalink_details += $("#qualification").val() + "/" + $("#atypical").val() + "/";
        permalink_details += $( "#slider_rangevalue" ).slider( "values", 0) + "/" + $( "#slider_rangevalue" ).slider( "values", 1) + "/";
        permalink_details += $( "#slider_rangedate" ).slider( "values", 0) + "/" + $( "#slider_rangedate" ).slider( "values", 1);
        
        if (permalink_details == "/all/all/all/all/0/100/0/100")
            permalink_details = "";

        if (permalink_details == "")
            $( "#permalink-message" ).html("Lien vers cette carte : <a target=\"_blank\" href=\"" + link + zoom + permalink_details + "\">" + link + zoom + permalink_details + "<\/a> <br> <span id=\"permalink-close\">X</span> ");
        else
            $( "#permalink-message" ).html("Lien vers cette carte : <a target=\"_blank\" href=\"" + link + zoom + permalink_details + "\">" + link + zoom + permalink_details + "<\/a> <br> Lien vers la carte ajustée : <a target=\"_blank\" href=\"" + link + permalink_details + "\">" + link + permalink_details + "<\/a> <span id=\"permalink-close\">X</span> ");
        
        $( "#permalink-message" ).css("display","block");
        $( "#permalink-close" ).click(function() {
            $( "#permalink-message" ).css("display","none");
        });

    });
});

   


            



