angular.module('openradiation', [])
    .controller('openradiation_form', function($scope, $http) {
          
        $scope.form = {
            Latitude:2.3456,
            Longitude:4.567723,
            Value:0.05,
            ReportUUID:"110e8400-e29b-11d4-a716-446655440000"
        };
        
        $scope.deleteTag = function(tag) {
            if ($scope.form.Tags.indexOf(tag) > -1)
                $scope.form.Tags.splice($scope.form.Tags.indexOf(tag),1);
        };
    
        $scope.addTag = function() {
            if (typeof ($scope.form.Tags) == "undefined")
                $scope.form.Tags = [];
                
            var tag = {};
            tag.value = "";
            $scope.form.Tags.push(tag);
        
        };
        
        $scope.putUsers = function() {

            var envoi = {};
            envoi.APIPrivateKey = "82ace4264f1ac5f83fe3d37319784149";
            envoi.data = [ { UserID:"gdarley", UserPwd:"EZPOEXkeoeedmledpl" }, 
                           { UserID:"btest", UserPwd:"POEXOSLXMSLXEXEXL"}];
            
            $http.put('/users', envoi)
                .success(function(data) {
                    if (typeof(data.error) == "undefined")
                        alert("données enregistree");
                    else
                        alert("erreur : " + data.error.title);
                })
                .error(function(data) {
                    alert('pas ok ' + data);
                });  
        
        };
        
        $scope.postQualification = function() {

            var envoi = {};
            envoi.APIPrivateKey = "82ace4264f1ac5f83fe3d37319784149";
            envoi.data = { Qualification:"badsensor", QualificationVotesNumber:5};
            //[ { UserID:"gdarley", UserPwd:"EZPOEXkeoeedmledpl" }, 
              //             { UserID:"btest", UserPwd:"POEXOSLXMSLXEXEXL"}];
            
            $http.post('/measurements/872e8400-e29b-11d4-a716-446655440000', envoi)
                .success(function(data) {
                    if (typeof(data.error) == "undefined")
                        alert("donnees enregistree");
                    else
                        alert("erreur : " + data.error.title);
                })
                .error(function(data) {
                    alert('pas ok ' + data);
                });  
        
        };
        
        $scope.submitapi = function() {
            var envoi = {};
            envoi.APIKey = "50adef3bdec466edc25f40c8fedccbce";
            envoi.data = {};
            angular.copy($scope.form, envoi.data);
            envoi.data.Tags = [];
            envoi.data.ReportContext = "routine";
            envoi.data.ManualReporting = false;
            envoi.data.UserID = "BtEst";
            envoi.data.UserPwd = "POEXOSLXMSLXEXEXl";
            envoi.data.MeasurementEnvironment = "countryside";
            envoi.data.Height = 1;
            envoi.data.MeasurementHeight = 1;
            for (i in $scope.form.Tags)
            {
                envoi.data.Tags.push($scope.form.Tags[i].value);
            };
            
            $http.post('/measurements', envoi)
                .success(function(data) {

                    if (typeof(data.error) == "undefined")
                        alert("données enregistree");
                    else
                        alert("erreur : " + data.error.title);
                })
                .error(function(data) {
                    alert('pas ok' + data);
                });  
        };
    });

