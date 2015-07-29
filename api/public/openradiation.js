var icon1 = L.icon({
    iconUrl: 'images/marker-icon_bleu.png',
    shadowUrl: 'images/marker-shadow_modifie.png',
    iconSize:     [18, 30], // size of the icon
    shadowSize:   [30, 30], // size of the shadow
    iconAnchor:   [9, 30], // point of the icon which will correspond to marker's location from the top / left corner
    shadowAnchor: [9, 30],  // the same for the shadow
    popupAnchor:  [0, -33] // point from which the popup should open relative to the iconAnchor
});
var icon2 = L.icon({
    iconUrl: 'images/marker-icon_bleufonce.png',
    shadowUrl: 'images/marker-shadow_modifie.png',
    iconSize:     [18, 30], // size of the icon
    shadowSize:   [30, 30], // size of the shadow
    iconAnchor:   [9, 30], // point of the icon which will correspond to marker's location from the top / left corner
    shadowAnchor: [9, 30],  // the same for the shadow
    popupAnchor:  [0, -33] // point from which the popup should open relative to the iconAnchor
});
var icon3 = L.icon({
    iconUrl: 'images/marker-icon_violet.png',
    shadowUrl: 'images/marker-shadow_modifie.png',
    iconSize:     [18, 30], // size of the icon
    shadowSize:   [30, 30], // size of the shadow
    iconAnchor:   [9, 30], // point of the icon which will correspond to marker's location from the top / left corner
    shadowAnchor: [9, 30],  // the same for the shadow
    popupAnchor:  [0, -33] // point from which the popup should open relative to the iconAnchor
});
var icon4 = L.icon({
    iconUrl: 'images/marker-icon_rouge.png',
    shadowUrl: 'images/marker-shadow_modifie.png',
    iconSize:     [18, 30], // size of the icon
    shadowSize:   [30, 30], // size of the shadow
    iconAnchor:   [9, 30], // point of the icon which will correspond to marker's location from the top / left corner
    shadowAnchor: [9, 30],  // the same for the shadow
    popupAnchor:  [0, -33] // point from which the popup should open relative to the iconAnchor
});

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

function openradiation_init(withLocate)
{
   // create a map in the "map" div, set the view to a given place and zoom
   openradiation_map = L.map('openradiation_map', { zoomControl: false, attributionControl: true}).setView([46.609464,2.471888], 6);
   
   //if you want to locate the client
   if (withLocate)
       openradiation_map.locate({setView : true});
   
   // add an OpenStreetMap tile layer
   L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors | &copy; <a href="http://www.openradiation.org/copyright">OpenRadiation</a> <span id="\hide_filters\">| Filtres +/-</span>'
   }).addTo(openradiation_map);
   
    //add an interpolation map layer
    interpolation = 
      new L.TileLayer('i/{z}/{x}/{y}.png',
      {
        opacity: 0.6
      });
    //openradiation_map.addLayer(interpolation);
    
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
                                <img src=\"images/arrow_download.png\"/> \
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
                url: '/measurements/' + e.popup._source.reportUuid + '?apiKey=82ace4264f1ac5f83fe3d37319784149&response=complete',
                //dataType: "jsonp",
                //jsonpCallback: "_test",
                //cache: false,
                timeout: 10000,
                success: function(res) {

                    var htmlPopup = "<div style=\"width:210px; overflow:auto; min-height:130px;\"><div style=\"margin-bottom:4px; border-bottom:solid #F1F1F1 1px;\"><strong style=\"color:#A4A4A4;\">" + formatISODate(res.data.startTime) + "</strong></div>";
                    
                    htmlPopup += "<div style=\"margin-right:10px; float:left;width:50px; min-height:90px;\">";

                    if (typeof(res.data.enclosedObject) != "undefined") 
                        htmlPopup = htmlPopup + "<div style=\"height:60px; margin-bottom:5px; \"><img class=\"openradiation_img\" src=\"" + res.data.enclosedObject + "\"/></div>";
                    else
                        htmlPopup = htmlPopup + "<div style=\"height:60px; margin-bottom:5px; \"><img class=\"openradiation_img\" src=\"images/measure.png\"/></div>";
                    htmlPopup += "<div><a class=\"voirplus\" href=\"" + measurementURL.replace("{reportUuid}", res.data.reportUuid) + "\" target=\"_top\"><p>Voir plus</p><p class=\"plus\">+</p></a></div>";
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
                    alert('Error during retrieving data'); 
                    }
                });           
    });
};


var urlprecedente= "";
setInterval(function(){ openradiation_getItems(); }, 5000);

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
        var nbHours = Math.exp((40 - $( "#slider_rangedate" ).slider( "values", 0) ) / 3) - 1;
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
        var nbHours = Math.exp((40 - $( "#slider_rangedate" ).slider( "values", 1) ) / 3) - 1;
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

function openradiation_getItems()
{
    var urlTemp = getUrl();
     
    if (urlTemp != urlprecedente) {
        urlprecedente = urlTemp;
        $("#nbresults").text("...");
        $.ajax({
        type: 'GET',
        url: '/measurements?apiKey=82ace4264f1ac5f83fe3d37319784149' + urlTemp, 
        cache: false,
        timeout: 5000,
        success: function(res) {
            
            if (res.data.length < 2)
                $("#nbresults").text(res.data.length + " mesure trouvée");
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
                    if (res.data[i].value >= 2)
                        icon = icon4;
                    else if (res.data[i].value >= 0.2)
                        icon = icon3;
                    else if (res.data[i].value >= 0.04)
                        icon = icon2;
                    else
                        icon = icon1;
              
                    var marker = L.marker([res.data[i].latitude, res.data[i].longitude],  {icon: icon}).addTo(openradiation_map)
                        .bindPopup(htmlPopup);
                    marker.reportUuid = res.data[i].reportUuid;
                }
            }
        },
        error: function() {
            alert('Error during retrieving data'); 
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
    var heure = Math.exp((40 - val) / 3) - 1; // this is the nb hour from now
    
    if (heure == 0)
        return "maintenant";
    else if (heure < 0.4)
        return Math.round(heure*60 / 10) * 10 + " minutes";
    else if (heure < 20)
    {
        if (Math.round(heure) == 1)
            return "1 heure";
        else
            return Math.round(heure) + " heures";
    }
    else if (heure < 24*30)
    {
        if (Math.round(heure / 24) == 1)
            return "1 jour";
        else
            return Math.round(heure / 24) + " jours";   
    }
    else if (heure < 24*30*9)
        return Math.round(heure / 24 / 30) + " mois";
    else if (heure > 60000)
        return "- ∞";
    else {
        if (Math.round(heure /24 / 365) == 1)
            return "1 an";
        else
            return Math.round(heure /24 / 365) + " ans";
    }
}

$(function() {
    $( "#slider_rangevalue" ).slider({
        range: true,
        min: 0,
        max: 100,
        values: [ 0, 100 ],
        create: function( event, ui ) {
            $( "#slider_minvalue").text(val2uSv($( "#slider_rangevalue" ).slider( "values", 0)));
            $( "#slider_maxvalue").text(val2uSv($( "#slider_rangevalue" ).slider( "values", 1)));
        },
        slide: function( event, ui ) {
            $( "#slider_minvalue").text(val2uSv(ui.values[0]));
            $( "#slider_maxvalue").text(val2uSv(ui.values[1]));
        }
    });
    
    $( "#slider_rangedate" ).slider({
        range: true,
        min: 6,
        max: 40,
        values: [ 6, 40 ],
        create: function( event, ui ) {
            $( "#slider_mindate").text(val2date($( "#slider_rangedate" ).slider( "values", 0)));
            $( "#slider_maxdate").text(val2date($( "#slider_rangedate" ).slider( "values", 1)));
        },
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
                url: '/measurements?apiKey=82ace4264f1ac5f83fe3d37319784149' + urlTemp + "&response=complete&withEnclosedObject=no", 
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
    
    
    
});

   


            



