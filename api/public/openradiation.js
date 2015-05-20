function timeValue2Str(timeValue)
{
   var tDate = new Date();
   tDate.setTime(timeValue);
   var str = tDate.getFullYear();
   if (tDate.getMonth() < 9)
	str += "-0" + (tDate.getMonth() + 1);
   else
        str += "-" + (tDate.getMonth() + 1);
   if (tDate.getDate() < 10)
        str += "-0" + tDate.getDate();
   else
        str += "-" + tDate.getDate();
   return str;
   
   //todo : toLocaleDateString() ?
}

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
   openradiation_map = L.map('openradiation_map').setView([46.609464,2.471888], 6);
   
   //if you want to locate the client
   if (withLocate)
       openradiation_map.locate({setView : true});
   
   // add an OpenStreetMap tile layer
   L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
   }).addTo(openradiation_map);
   
   openradiation_map.on('popupopen', function(e) {
        //alert('yo ' + e.popup._source.reportUuid); // + e.value + e.reportUuid);
            e.popup.setContent("<div>Super ca marche </div>");
            
            $.ajax({
                type: 'GET',
                url: 'http://localhost:8080/measurements/' + e.popup._source.reportUuid + '?apiKey=82ace4264f1ac5f83fe3d37319784149&response=complete',
                //dataType: "jsonp",
                //jsonpCallback: "_test",
                //cache: false,
                timeout: 5000,
                //beforeSend: function() {
                //    $("#loader").css("display", "inline"); },
                success: function(res) {

                    var htmlPopup = "<div><div><strong class=\"gris\">" + formatISODate(res.data.startTime) + "</strong></div>";
                     
                    if (res.data.userId != null)
                        htmlPopup += "<div><strong>" + res.data.userId + "</strong></div>";
                    htmlPopup += "<strong>" + res.data.value + " µSv/h</strong><br/>";

                    if (typeof(res.data.enclosedObject) != "undefined")
                        htmlPopup = htmlPopup + "<div><img class=\"img-rounded\" src=\"" + res.data.enclosedObject + "\"/></div><br>";
                    else
                        htmlPopup = htmlPopup + "<div><img class=\"img-rounded\" src=\"images/marker-icon.png\"/></div><br>";
                        
                    if (typeof(res.data.qualification) != "undefined") {
                        htmlPopup += "<div><span>";
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
                        htmlPopup += ", " + res.data.qualificationVotesNumber + "pouces";
                        htmlPopup += "</span><a href=\"http://www.lemonde.fr\" target=\"_top\">lemonde</a></div>";
                    }
                    
                    if (res.data.atypical == true)
                        htmlPopup += "<div><span>Mesure Atypique</span></div>";
                        
                    for (var i = 0; i < res.data.tags.length; i++)
                    {
                        htmlPopup += "<span class=\"text-muted\">#" + res.data.tags[i] + "</span>";
                    }
                    console.log(htmlPopup);
                    e.popup.setContent(htmlPopup);
                    
                    },
                error: function() {
                    alert('Error duringg data'); 
                    //$("#loader").css("display", "none"); 
                    }
                });   
                
    });
};

function openradiation_initWithBounds(latMin, lonMin, latMax, lonMax)
{
   console.log('latMin=' + latMin + ';lonMin=' + lonMin + ';latMax=' + latMax + 'lonMax=' + lonMax);
   // create a map in the "map" div, set the view to a given place and zoom with bounds to scroll the map
   openradiation_map = L.map('openradiation_map', 
            { maxBounds : [
                [latMin, lonMin], //southWest,
                [latMax, lonMax] ] //northEast 
            } ).setView([(latMin+latMax)/2 , (lonMin+lonMax)/2], 6);
  
    openradiation_map.fitBounds([ // so the map fits the given bounds
       [latMin, lonMin], //southWest,
       [latMax, lonMax]  //northEast 
    ]);
    
    // add an OpenStreetMap tile layer
   L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
   }).addTo(openradiation_map);
   
  
};

function exportCSV()
{
   
    var str = "hits number; latitude; longitude; altitude; timestamp\n";

    for(var i in openradiation_items)
    {
        if (openradiation_map.hasLayer(openradiation_listMarkers[i]))
        {
            str += openradiation_items[i].nb_coups + ";";
            
            str += openradiation_items[i].latitude + ";";
            
            str += openradiation_items[i].longitude + ";";
            
            if (openradiation_items[i].altitude != null)
                str += openradiation_items[i].altitude;
            str+= ";";
            
            str += openradiation_items[i].timestamp + ";";

            str+= "\n";  
        }
    }
    return str;
};

function openradiation_getItemsWithBounds(latMin, lonMin, latMax, lonMax, timeMin, timeMax)
{
    //ok it works : //only nb_coups, latitude, longitude, timestamp are mandatory. todo : verify this point
    //openradiation_items = [{"id":1,"nb_coups":0,"latitude":"48.847790330523644","longitude":"2.356945277130573","altitude":"60.23101806640625","timestamp":"1400601455949"},{"id":2,"nb_coups":0,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":3,"nb_coups":0,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":4,"nb_coups":1,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":5,"nb_coups":0,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":6,"nb_coups":0,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":7,"nb_coups":189,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":8,"nb_coups":398,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":9,"nb_coups":398,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":10,"nb_coups":398,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":11,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":12,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":13,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":14,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":15,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":16,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":17,"nb_coups":3155,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":18,"nb_coups":832,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":19,"nb_coups":0,"latitude":"48.886706726731326","longitude":"2.3501588271031575","altitude":"55.49455261230469","timestamp":"1400609400638"},{"id":20,"nb_coups":0,"latitude":"48.84781126748069","longitude":"2.3568476595444654","altitude":"59.437992095947266","timestamp":"1400664186933"},{"id":21,"nb_coups":0,"latitude":"48.84779189448021","longitude":"2.356952174147559","altitude":"61.824710845947266","timestamp":"1400664197522"},{"id":22,"nb_coups":1,"latitude":"48.8478123812895","longitude":"2.3568422782261074","altitude":"61.2204704284668","timestamp":"1400664247809"},{"id":23,"nb_coups":1,"latitude":"48.84781021127269","longitude":"2.356852846122639","altitude":"60.64899826049805","timestamp":"1400664253454"},{"id":24,"nb_coups":1,"latitude":"48.847822830516186","longitude":"2.3568579339585605","altitude":"60.71238708496094","timestamp":"1400664263006"},{"id":25,"nb_coups":1,"latitude":"48.84781149261343","longitude":"2.356844720190798","altitude":"59.455116271972656","timestamp":"1400664321432"},{"id":26,"nb_coups":0,"latitude":"48.847812433515976","longitude":"2.356841937909806","altitude":"59.989845275878906","timestamp":"1400664330880"},{"id":27,"nb_coups":99,"latitude":"48.84781220657082","longitude":"2.3568433470011616","altitude":"59.53089141845703","timestamp":"1400664558954"},{"id":28,"nb_coups":99,"latitude":"48.84781497476761","longitude":"2.3568258795620753","altitude":"58.898468017578125","timestamp":"1400664727746"},{"id":29,"nb_coups":99,"latitude":"48.84781032538928","longitude":"2.3568534756832302","altitude":"59.13295364379883","timestamp":"1400664732922"},{"id":30,"nb_coups":99,"latitude":"48.847811920222014","longitude":"2.35684510476955","altitude":"58.885459899902344","timestamp":"1400664742948"},{"id":31,"nb_coups":0,"latitude":"48.8478116195719","longitude":"2.3568464749259856","altitude":"58.53118896484375","timestamp":"1400665050245"},{"id":32,"nb_coups":0,"latitude":"48.84781274348364","longitude":"2.356840203911239","altitude":"58.81167984008789","timestamp":"1400665073363"},{"id":33,"nb_coups":427,"latitude":"48.847795582736836","longitude":"2.356931024041344","altitude":"60.189964294433594","timestamp":"1400679537599"},{"id":34,"nb_coups":66,"latitude":"48.84781298024653","longitude":"2.3568387087221514","altitude":"59.59257507324219","timestamp":"1400757532959"},{"id":35,"nb_coups":0,"latitude":"48.847810815375674","longitude":"2.356845527583028","altitude":"58.71615219116211","timestamp":"1400839131085"},{"id":36,"nb_coups":0,"latitude":"48.84780989096568","longitude":"2.3568550807781716","altitude":"59.15676498413086","timestamp":"1400839608852"},{"id":37,"nb_coups":0,"latitude":"48.8478155410395","longitude":"2.3568322977644707","altitude":"59.010223388671875","timestamp":"1400839617167"}];
    
    var data_url = 'https://open_geiger-c9-chsimon.c9.io/mesures/' + latMin + '/'  + lonMin + '/' + latMax + '/' + lonMax + '/' + timeMin + '/' + timeMax;

    $.ajax({
    type: 'GET',
    url: data_url,
    //dataType: "jsonp",
    //jsonpCallback: "_test",
    cache: false,
    timeout: 5000,
    //beforeSend: function() {
    //    $("#loader").css("display", "inline"); },
    success: function(data) {
        openradiation_items = data;
        openradiation_refreshData();
        //$("#loader").css("display", "none");
        },
    error: function() {
        alert('Error during retrieving data'); 
        //$("#loader").css("display", "none"); 
        }
    });    
    
    //data = '{ "items" : [  \
    //   { "id": 1, "nb_coups": 50, "location"  : [46.821547, 3.285787], "deltaT": 120, "timestamp" : "2014-03-07 15.45.02", "model"  : "OpenRadiation_RFDuino_v0.1", "login" : "Georges", "img" : "images/thumbnail.jpg" } , \
    //   { "id": 2, "value": 3, "location"  : [47.811547, 2.789787], "deltaT": 23, "timestamp" : "2014-03-03 18.45.02", "model"  : "OpenRadiation_RFDuino_v0.1", "login" : "Jeanne" } , \
    //   { "id": 3, "value": 4, "location"  : [46.903547, 1.780387], "deltaT": 120, "timestamp" : "2014-03-02 20.43.02", "model"  : "OpenRadiation_RFDuino_v0.1" } , \
    //   { "id": 4, "value": 97, "location"  : [48.227547, 2.590587], "deltaT": 23, "timestamp" : "2014-03-05 12.45.18", "login" : "Jeanne" } ,\
    //   { "id": 5, "value": 67, "location"  : [43.813547, 2.085887], "deltaT": 23, "timestamp" : "2014-03-08 13.47.02", "model"  : "OpenRadiation_RFDuino_v0.1", "login" : "Jeanne", "img" : "images/thumbnail.jpg" } \
    //] }';

    //openradiation_items = jQuery.parseJSON(data);
};


function openradiation_getItems()
{
    //ok it works : //only nb_coups, latitude, longitude, timestamp are mandatory. todo : verify this point
    //openradiation_items = [{"id":1,"nb_coups":0,"latitude":"48.847790330523644","longitude":"2.356945277130573","altitude":"60.23101806640625","timestamp":"1400601455949"},{"id":2,"nb_coups":0,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":3,"nb_coups":0,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":4,"nb_coups":1,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":5,"nb_coups":0,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":6,"nb_coups":0,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":7,"nb_coups":189,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":8,"nb_coups":398,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":9,"nb_coups":398,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":10,"nb_coups":398,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":11,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":12,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":13,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":14,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":15,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":16,"nb_coups":601,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":17,"nb_coups":3155,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":18,"nb_coups":832,"latitude":"48.847774717252015","longitude":"2.3570102467435534","altitude":"67.01400756835938","timestamp":"1400602398361"},{"id":19,"nb_coups":0,"latitude":"48.886706726731326","longitude":"2.3501588271031575","altitude":"55.49455261230469","timestamp":"1400609400638"},{"id":20,"nb_coups":0,"latitude":"48.84781126748069","longitude":"2.3568476595444654","altitude":"59.437992095947266","timestamp":"1400664186933"},{"id":21,"nb_coups":0,"latitude":"48.84779189448021","longitude":"2.356952174147559","altitude":"61.824710845947266","timestamp":"1400664197522"},{"id":22,"nb_coups":1,"latitude":"48.8478123812895","longitude":"2.3568422782261074","altitude":"61.2204704284668","timestamp":"1400664247809"},{"id":23,"nb_coups":1,"latitude":"48.84781021127269","longitude":"2.356852846122639","altitude":"60.64899826049805","timestamp":"1400664253454"},{"id":24,"nb_coups":1,"latitude":"48.847822830516186","longitude":"2.3568579339585605","altitude":"60.71238708496094","timestamp":"1400664263006"},{"id":25,"nb_coups":1,"latitude":"48.84781149261343","longitude":"2.356844720190798","altitude":"59.455116271972656","timestamp":"1400664321432"},{"id":26,"nb_coups":0,"latitude":"48.847812433515976","longitude":"2.356841937909806","altitude":"59.989845275878906","timestamp":"1400664330880"},{"id":27,"nb_coups":99,"latitude":"48.84781220657082","longitude":"2.3568433470011616","altitude":"59.53089141845703","timestamp":"1400664558954"},{"id":28,"nb_coups":99,"latitude":"48.84781497476761","longitude":"2.3568258795620753","altitude":"58.898468017578125","timestamp":"1400664727746"},{"id":29,"nb_coups":99,"latitude":"48.84781032538928","longitude":"2.3568534756832302","altitude":"59.13295364379883","timestamp":"1400664732922"},{"id":30,"nb_coups":99,"latitude":"48.847811920222014","longitude":"2.35684510476955","altitude":"58.885459899902344","timestamp":"1400664742948"},{"id":31,"nb_coups":0,"latitude":"48.8478116195719","longitude":"2.3568464749259856","altitude":"58.53118896484375","timestamp":"1400665050245"},{"id":32,"nb_coups":0,"latitude":"48.84781274348364","longitude":"2.356840203911239","altitude":"58.81167984008789","timestamp":"1400665073363"},{"id":33,"nb_coups":427,"latitude":"48.847795582736836","longitude":"2.356931024041344","altitude":"60.189964294433594","timestamp":"1400679537599"},{"id":34,"nb_coups":66,"latitude":"48.84781298024653","longitude":"2.3568387087221514","altitude":"59.59257507324219","timestamp":"1400757532959"},{"id":35,"nb_coups":0,"latitude":"48.847810815375674","longitude":"2.356845527583028","altitude":"58.71615219116211","timestamp":"1400839131085"},{"id":36,"nb_coups":0,"latitude":"48.84780989096568","longitude":"2.3568550807781716","altitude":"59.15676498413086","timestamp":"1400839608852"},{"id":37,"nb_coups":0,"latitude":"48.8478155410395","longitude":"2.3568322977644707","altitude":"59.010223388671875","timestamp":"1400839617167"}];
    
    $.ajax({
    type: 'GET',
    url: 'http://localhost:8080/measurements?apiKey=82ace4264f1ac5f83fe3d37319784149',
    //dataType: "jsonp",
    //jsonpCallback: "_test",
    cache: false,
    timeout: 5000,
    //beforeSend: function() {
    //    $("#loader").css("display", "inline"); },
    success: function(data) {
        
        openradiation_items = data.data;
        console.dir(openradiation_items);
        openradiation_refreshData();
        //$("#loader").css("display", "none");
        },
    error: function() {
        alert('Error during retrieving data'); 
        //$("#loader").css("display", "none"); 
        }
    });    
    
    //data = '{ "items" : [  \
    //   { "id": 1, "nb_coups": 50, "location"  : [46.821547, 3.285787], "deltaT": 120, "timestamp" : "2014-03-07 15.45.02", "model"  : "OpenRadiation_RFDuino_v0.1", "login" : "Georges", "img" : "images/thumbnail.jpg" } , \
    //   { "id": 2, "value": 3, "location"  : [47.811547, 2.789787], "deltaT": 23, "timestamp" : "2014-03-03 18.45.02", "model"  : "OpenRadiation_RFDuino_v0.1", "login" : "Jeanne" } , \
    //   { "id": 3, "value": 4, "location"  : [46.903547, 1.780387], "deltaT": 120, "timestamp" : "2014-03-02 20.43.02", "model"  : "OpenRadiation_RFDuino_v0.1" } , \
    //   { "id": 4, "value": 97, "location"  : [48.227547, 2.590587], "deltaT": 23, "timestamp" : "2014-03-05 12.45.18", "login" : "Jeanne" } ,\
    //   { "id": 5, "value": 67, "location"  : [43.813547, 2.085887], "deltaT": 23, "timestamp" : "2014-03-08 13.47.02", "model"  : "OpenRadiation_RFDuino_v0.1", "login" : "Jeanne", "img" : "images/thumbnail.jpg" } \
    //] }';

    //openradiation_items = jQuery.parseJSON(data);
};



function Str2TimeValue(str)
{
   //todo : to remove 
   var tDate = new Date();
   tDate.setFullYear(str.substr(0,4));
   tDate.setMonth(parseInt(str.substr(5,2)) - 1);
   tDate.setDate(str.substr(8,2)); 
   tDate.setHours(str.substr(11,2));
   tDate.setMinutes(str.substr(14,2));
   tDate.setSeconds(str.substr(17,2));
   tDate.setMilliseconds(0);
   var timeValue=tDate.getTime();
   return timeValue;
}



function applyFilters()
{
    var date_min = $( "#timeslider" ).data('slider').getValue()[0] - 10*3600*1000; // value in milliseconds => 10 hours
    var date_max = $( "#timeslider" ).data('slider').getValue()[1] + 10*3600*1000; // value in milliseconds => 10 hours
    
    for(var i in openradiation_items)
    {
        var t = openradiation_items[i].timestamp;
        if ((t < date_min) || (t > date_max))  
        {
            if (openradiation_map.hasLayer(openradiation_listMarkers[i]))
                openradiation_map.removeLayer(openradiation_listMarkers[i]);
        }
        else
        {
           if (openradiation_map.hasLayer(openradiation_listMarkers[i]) != true)
                openradiation_map.addLayer(openradiation_listMarkers[i]);
	}
    }   
}

function openradiation_refreshData() 
{
    var date_min;
    var date_max;
    var i_min;
    var i_max;

    openradiation_listMarkers = new Array();
    
    for(var i in openradiation_items)
    {
        console.log(openradiation_items[i]);
        //var htmlPopup = "<div style=\"overflow:hidden;\">";
        var htmlPopup = "<div>";
        htmlPopup += "Valeur : <strong>" + openradiation_items[i].value + "</strong><br>";
        htmlPopup += timeValue2Str(openradiation_items[i].startTime) + "<br><br>";
        
        if (openradiation_items[i].userId != null)
            htmlPopup += "by <strong>" + openradiation_items[i].userId + "</strong><br>";
        if (openradiation_items[i].enclosedObject != null)
            htmlPopup = htmlPopup + "<div><img class=\"img-rounded\" src=\"" + openradiation_items[i].enclosedObject + "\"/></div><br>";       
        //if (openradiation_items[i].altitude != null)
        //    htmlPopup += "altitude : " + openradiation_items[i].altitude + " m<br>";
        //if (openradiation_items[i].deltaT != null)
        //    htmlPopup += "Δt : " + openradiation_items[i].deltaT + " s<br>";
        //if (openradiation_items[i].model != null)
        //    htmlPopup += "model : " + openradiation_items[i].model + "<br>";
     	//htmlPopup += "</div>";
     	
       // var location;
       // location[0] = openradiation_items[i].latitude;
       // location[1] = openradiation_items[i].longitude;
        //var latlng = L.latLng(openradiation_items[i].latitude,openradiation_items[i].longitude);
            //.setLatLng(latlng)
        //var popup = L.popup().setLatLng(latlng).setContent('<p>Hello world!<br />This is a nice popup.</p>'); //.addTo(openradiation_map);
        //popup.value = 
        //popup.reportUuid = openradiation_items[i].reportUuid;
        //var marker = L.marker([openradiation_items[i].latitude, openradiation_items[i].longitude]).addTo(openradiation_map).bindPopup(popup);
        
        var marker = L.marker([openradiation_items[i].latitude, openradiation_items[i].longitude]).addTo(openradiation_map)
            .bindPopup(htmlPopup);
        marker.reportUuid = openradiation_items[i].reportUuid;

        openradiation_listMarkers[i] = marker;

        //var t = Str2TimeValue(openradiation_items[i].timestamp);
        var t = openradiation_items[i].startTime;
        // get the min max
        if (i == 0) {
           date_min = t;
           date_max = t;
        } else {
            if (t < date_min) {
                date_min = t;
                i_min = i;
            }
            if (t > date_max) {
                date_max = t;
                i_max = i;
            }
        }
    }

    var timeslider = $( "#timeslider" );
    if(timeslider.length) { // timeslider doesn't exist in the embedded case
        $( "#timeslider" ).attr('data-slider-min', date_min);
        $( "#timeslider" ).attr('data-slider-max', date_max);
        $( "#timeslider" ).attr('data-slider-value', "[" + date_min + "," + date_max + "]");
        $( "#timeslider" ).slider({
            formater: function(value) {
                return timeValue2Str(value);
            }
        }).on('slideStop', applyFilters);
    }
}




