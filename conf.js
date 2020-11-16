"use strict";

var saveTimeoutSeconds = 10;
var savesPath = "https://scratch.test/saves/";
var savesId = 0;
var saves = Array(
    "test.sb3",
    "test2.sb3",
    "test4.sb3"
);

var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = window.location.search.substring(1),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
        }
    }
};

var saveName = getUrlParameter('save');
if(typeof saveName === 'undefined') {
    window.location = window.location.protocol + "//" + window.location.hostname + window.location.pathname + "?save=" + saves[0];
} else {
    fetchScratchFile(savesPath + saveName);

    window.setTimeout(function() {
        var newSave = '';

        for(var i = 0; i < saves.length - 1; i++) {
            if(saves[i].localeCompare(saveName) == 0) {
                newSave = saves[i + 1];
                break;
            }
        }

        if(newSave == '') newSave = saves[0];

        window.location = window.location.protocol + "//" + window.location.hostname + window.location.pathname + "?save=" + newSave;
    }, 10000);
}
