//  Copyright (c) 2003-2020 Xsens Technologies B.V. or subsidiaries worldwide.
//  All rights reserved.
//  
//  Redistribution and use in source and binary forms, with or without modification,
//  are permitted provided that the following conditions are met:
//  
//  1.      Redistributions of source code must retain the above copyright notice,
//           this list of conditions, and the following disclaimer.
//  
//  2.      Redistributions in binary form must reproduce the above copyright notice,
//           this list of conditions, and the following disclaimer in the documentation
//           and/or other materials provided with the distribution.
//  
//  3.      Neither the names of the copyright holders nor the names of their contributors
//           may be used to endorse or promote products derived from this software without
//           specific prior written permission.
//  
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
//  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
//  MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL
//  THE COPYRIGHT HOLDERS OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
//  SPECIAL, EXEMPLARY OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT 
//  OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
//  HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY OR
//  TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
//  SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.THE LAWS OF THE NETHERLANDS 
//  SHALL BE EXCLUSIVELY APPLICABLE AND ANY DISPUTES SHALL BE FINALLY SETTLED UNDER THE RULES 
//  OF ARBITRATION OF THE INTERNATIONAL CHAMBER OF COMMERCE IN THE HAGUE BY ONE OR MORE 
//  ARBITRATORS APPOINTED IN ACCORDANCE WITH SAID RULES.
//  

// =======================================================================================
// Client side scripting for the Xsens DOT server.
// =======================================================================================

var socket = io();

var eventHandlerFunctions = {};
setEventHandlerFunctions();

var scanControlButton,
    measurementControlButton,
    launchStreamingButton,
    stopMeasuringButton,
    measurementPayloadList,
    syncingModal,
    measurementMode,
    headingResetTip,
    headingResetButton,
    oscPortInput,
    oscHostInput,
    syncControlButton;

var discoveredSensors = [],
    connectedSensors  = [],
    measuringSensors  = [];

var lastHeadingStatusList = [];

var scanningTimeoutId;

var measuringPayloadId = -1;

var lastSensorsDataTimeMap = [];
var lastSensorDataTime     = 0;

// change this to true if sync should be enabled by default
var isSyncingEnabled = false;

const MEASURING_PAYLOAD_TYPE_COMPLETE_EULER           = '16';
const MEASURING_PAYLOAD_TYPE_EXTENDED_QUATERNION      = '2';
const MEASURING_PAYLOAD_TYPE_RATE_QUANTITIES_WITH_MAG = '20';
const MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_1            = '22';
const MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_2            = '23';
const MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_3            = '24';

const ID_LOGO_IMAGE                = "logoImage";
const ID_CONNECTION_CONTROL_BUTTON = "connectionControlButton";
const ID_SENSOR_DATA_INDICATOR     = "sensorDataIndicator";

const TEXT_CONNECT    = "Connect";
const TEXT_DISCONNECT = "Disconnect";

const HEADING_STATUS_XRM_HEADING = 1;

// alpha fractal parameters
var alphaTimeline = {}
var alphaScore = {}
var cumulativeAlphaTimeline = []
var cumulativeAlphaScore = []
let recommenderIterations = 3 
let triggered_length = 0

let show_alfa = false

// graph of live parameters
let oscGraph = {}
let oscData = {}
let oscGraphLabels = {}


window.onload = function( eventName, parameters  )
{
    scanControlButton = document.getElementById("scanControlButton");

    measurementControlButton = document.getElementById("measurementControlButton");
    measurementControlButton.disabled = true;
    measurementControlButton.hidden = true;

    launchStreamingButton = document.getElementById("launchStreamingButton")
    launchStreamingButton.disabled = true;
    launchStreamingButton.hidden = true;

    stopMeasuringButton = document.getElementById("stopMeasuringButton");
    stopMeasuringButton.hidden = true;

    measurementPayloadList = document.getElementById("measurementPayloadList");

    syncingModal = document.querySelector(".modal");

    measurementMode = document.getElementById("measurementMode");
    headingResetTip = document.getElementById("headingResetTip");
    headingResetButton = document.getElementById("headingResetButton");

    syncControlButton = document.getElementById("syncControlButton");
    syncControlButton.hidden = measurementControlButton.hidden;

    oscPortInput= document.getElementById("osc_port");
    oscHostInput = document.getElementById("osc_host");

    getLocalStorageOSCData()

    getLocalStorageData()

    getConnectedSensors();

    getFileList();
}

window.onunload = function( eventName, parameters  )
{
    stopScanning();
}

function setEventHandlerFunctions()
{
    eventHandlerFunctions[ 'sensorDiscovered' ] = function( eventName, parameters  )
    {
        addSensorToList( discoveredSensors, "DiscoveredSensors", parameters.address );
        
    };

    eventHandlerFunctions[ 'scanningStarted' ] = function( eventName, parameters  )
    {
        scanControlButton.innerHTML = 'Stop Scanning';
        scanControlButton.disabled = false;
    };

    eventHandlerFunctions[  'scanningStopped' ] = function( eventName, parameters  )
    {
        scanControlButton.innerHTML = 'Scan for Sensors';
        scanControlButton.disabled = false;
    };

    eventHandlerFunctions[  'sensorConnected' ] = function( eventName, parameters  )
    {
        console.log("sensorConnected " + parameters.address);

        connectedSensors.push( parameters.address );

        var logoImage = document.getElementById(ID_LOGO_IMAGE + parameters.address);
        if (logoImage != null)
        {
            logoImage.src = "Xsens_DOT_connected.png";
        }

        var element = document.getElementById(ID_CONNECTION_CONTROL_BUTTON + parameters.address);
        if (element != null)
        {
            element.innerHTML = TEXT_DISCONNECT;
            element.disabled = false;
            element.style.color = "#FFFFFF";
            element.style.background = "#EA6852";
            element.onmouseover = onButtonMouseOver;
            element.onmouseout = onButtonMouseOver;
        }

        addAlphaToList( "AlphaScores", parameters.address );

        enableOrDisableMeasurementControlButton();
        enableOrDisableLaunchStreamingButton();

    };

    eventHandlerFunctions[  'sensorDisconnected' ] = function( eventName, parameters  )
    {
        console.log("sensorDisconnected " + parameters.address);

        removeSensor( measuringSensors, parameters.address );


        
        var logoImage = document.getElementById(ID_LOGO_IMAGE + parameters.address);
        if (logoImage != null)
        {
            logoImage.src = "Xsens_DOT_disconnected.png";
        }

        var element = document.getElementById(ID_CONNECTION_CONTROL_BUTTON + parameters.address);
        if (element != null)
        {
            element.innerHTML = TEXT_CONNECT;
            element.disabled = false;
            element.style.color = "#EA6852";
            element.style.background = "#FFFFFF";
            element.onmouseover = onButtonMouseOver;
            element.onmouseout = onButtonMouseOut;
        }
        

        var idx = connectedSensors.indexOf( parameters.address );
        if( idx == -1 ) return;
    
        connectedSensors.splice(idx, 1);

        console.log("sensorDisconnected " + connectedSensors.length);

        enableOrDisableMeasurementControlButton();
        enableOrDisableLaunchStreamingButton();

        removeLastHeadingStatus(parameters.address);
    };

    eventHandlerFunctions[  'sensorEnabled' ] = function( eventName, parameters  )
    {
        measuringSensors.push( parameters.address );

        console.log("sensorEnabled " + parameters.address + ", " + measuringSensors.length);

        measurementControlButton.disabled = (measuringSensors.length == 0);
        measurementControlButton.hidden = true;

        launchStreamingButton.disabled = (measuringSensors.length == 0);
        launchStreamingButton.hidden = true;

        syncControlButton.hidden = measurementControlButton.hidden;

        stopMeasuringButton.innerHTML = "Stop Streaming";
        stopMeasuringButton.disabled = false;
        stopMeasuringButton.hidden = false;
        
        if (measuringSensors.length == 1)
        {
            sendGuiEvent( 'startRecording', {filename:getUniqueFilename()} );
        }

        enableOrDisableConnectButtons(true);

        // Show current measurement mode
        var modeStr = "";
        var isHiddenHeadingResetTip = true;
        switch (measuringPayloadId)
        {
            case MEASURING_PAYLOAD_TYPE_COMPLETE_EULER:
                modeStr = "Measurement Mode: Complete (Euler)";
                break;

            case MEASURING_PAYLOAD_TYPE_EXTENDED_QUATERNION:
                modeStr = "Measurement Mode: Extended (Quaternion)";
                break;

            case MEASURING_PAYLOAD_TYPE_RATE_QUANTITIES_WITH_MAG:
                modeStr = "Measurement Mode: Rate quantities (with mag)";
                isHiddenHeadingResetTip = false;
                break;

            case MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_1:
                modeStr = "Measurement Mode: Custom Mode 1";
                break;

            case MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_2:
                modeStr = "Measurement Mode: Custom Mode 2";
                break;

            case MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_3:
                modeStr = "Measurement Mode: Custom Mode 3";
                break;
        }
        measurementMode.innerHTML = modeStr;
        measurementMode.hidden = false;

        headingResetTip.hidden = isHiddenHeadingResetTip;
        headingResetButton.hidden = !isHiddenHeadingResetTip;
    };

    eventHandlerFunctions[  'allSensorsEnabled' ] = function( eventName, parameters  )
    {
    };

    eventHandlerFunctions[  'oscUpdate' ] = function( eventName, parameters  )
    {
        
    };

    eventHandlerFunctions[  'updateTerminal' ] = function( eventName, parameters  )
    {
    };

    eventHandlerFunctions[  'eightOSAdvice' ] = function( eventName, parameters  )
    {
    };

    eventHandlerFunctions[  'sensorAdvice' ] = function( eventName, parameters  )
    {
    };

    eventHandlerFunctions[  'averageAlpha' ] = function( eventName, parameters  )
    {
    };

    eventHandlerFunctions[  'sensorDisabled' ] = function( eventName, parameters  )
    {
        removeSensor( measuringSensors, parameters.address );

        console.log("sensorDisabled "+ parameters.address + ", " + measuringSensors.length);

        var  allSensorsDisabled = measuringSensors.length == 0;

        if (connectedSensors.length > 0)
        {
            measurementControlButton.disabled = !allSensorsDisabled;
            measurementControlButton.hidden = !allSensorsDisabled;

            launchStreamingButton.disabled = !allSensorsDisabled;
            launchStreamingButton.hidden = !allSensorsDisabled;

            syncControlButton.hidden = measurementControlButton.hidden;
        }

        if (allSensorsDisabled)
        {
            scanControlButton.disabled = false;
            stopMeasuringButton.innerHTML = "Stop Streaming";
            measurementPayloadList.style.display = '';

            headingResetTip.hidden = allSensorsDisabled;
            headingResetButton.hidden = allSensorsDisabled;
        }

        stopMeasuringButton.hidden = allSensorsDisabled;
        measurementMode.hidden = allSensorsDisabled;

        enableOrDisableConnectButtons(false);
        getFileList();
    };

    eventHandlerFunctions[  'allSensorsDisabled' ] = function( eventName, parameters  )
    {
    };

    eventHandlerFunctions[ 'recordingStopped' ] = function( eventName, parameters  )
    {
    };

    eventHandlerFunctions[ 'alphaCalculated' ] = function( eventName, parameters  )
    {
        console.log("Received Alpha", parameters)

        
        // Update alphaTimeline for each sensor

        if (!alphaTimeline[parameters.sensor]) {
            alphaTimeline[parameters.sensor] = []
        }

        // Add the last value to alphaTimeline for this sensor

        alphaTimeline[parameters.sensor].push(parseFloat(parameters.alpha).toFixed(2))

       // Update alphaScore for each sensor
        let alpha_type = getAlphaType(parseFloat(parameters.alpha).toFixed(2))

        if (!alphaScore[parameters.sensor]) {
            alphaScore[parameters.sensor] = []
        }

        // Add alpha type to the list of values for this sensor
        alphaScore[parameters.sensor].push(alpha_type)

        // Prepare data for the console
        let html_sensorConsole = ''

        for (let sens in alphaScore) {
            html_sensorConsole += sens
            html_sensorConsole += '<br>'
            html_sensorConsole += alphaScore[sens].join(' → ')
            html_sensorConsole += '<br><br>'
        }

        // Add the data to the sensor console
        document.getElementById('sensorConsole').innerHTML = html_sensorConsole

         // Show the alpha diagnosis for each sensor

        // Get the HTML 
        let elem = document.getElementById('alpha-' + parameters.sensor)

        // Add Alpha exponent received
        elem.innerHTML = 'α: ' + parseFloat(parameters.alpha).toFixed(2);


        let alpha_info = ''

        if (alpha_type == 'random') {
            alpha_info = 'UNIFORM'
         }
         else if (alpha_type == 'regular') {
            alpha_info = 'REGULAR'
         }
         else if (alpha_type == 'fractal') {
            alpha_info = 'FRACTAL'
         }
         else if (alpha_type == 'complex') {
            alpha_info = 'COMPLEX'
        }

        elem.innerHTML += '<br>' + alpha_info;

        // Let's now add the image
        // Get the image DIV
        let sensor_image_container = document.getElementById('alpha-image-' + parameters.sensor)

         // Adding alpha component image
        var sensor_image = document.createElement('div')
        let add_alpha = ''
        let add_css = ''
        if (alpha_type == 'regular') add_css = 'moveup'
        if (alpha_type == 'random') add_css = 'moveright'
        if (show_alfa == true) {
            add_alpha = '<span class="alphatext ' + add_css + '">' + parseFloat(parameters.alpha).toFixed(2).slice(-3) + '</span>'
            
        }
        sensor_image.innerHTML = add_alpha + '<img class="alphaimage" src="alphas/' + alpha_type + '.png" width="120" height="120">';
        sensor_image.style.width = "20%";
        sensor_image.style.position = "relative";
        sensor_image.style.padding = "10px";
        sensor_image.style.color = "#FFFFFF";
        sensor_image.style.flex = "1";

        
        sensor_image_container.appendChild(sensor_image);

        sensor_image_container.scrollLeft = sensor_image_container.scrollWidth;
        
        // Update the general sensor sum

        // How many alphas we have for this particular sensor?
        let current_length = alphaTimeline[parameters.sensor].length

        // How many total sensors we have?
        let sensors_num = Object.keys(alphaTimeline).length

        // What's the total length of all the alphas for all the sensors?
        let cumulative_length = 0
        
        for (let s in alphaTimeline) {
            cumulative_length += alphaTimeline[s].length
        }
        
        // Let's check if we accumulated enough alphas for this sensor 
        // to calculate a historical recommendation for this sensor

        if (current_length % recommenderIterations == 0) {


            // Let us now cut the last N values from the cumulative alpha exponent and type
            let thisAlpha = alphaTimeline[parameters.sensor].slice(-recommenderIterations)
            let thisScore = alphaScore[parameters.sensor].slice(-recommenderIterations)

            // What was the total cumulative Alpha exponent the last (3) iterations?
            let thisTotal = 0

            for (let a of thisAlpha) {
                thisTotal += parseFloat(a)
            } 

            // Calculate average for the cumulative alpha
            let thisCumAlpha = thisTotal / recommenderIterations

            let thisCumScore = getAlphaType(parseFloat(thisCumAlpha).toFixed(2))
           
            // For HTML output
            let cum_alpha_score = thisScore.join(' → ')

            // let's now see what has been the last cumulative average score

            let this_score_state = ''
            let this_score_recommendation = ''
            let this_note = ''
            let this_sensor = parameters.sensor
            let this_signal = ''
            let this_advice = ''

            
            let alpha_all_historic = getHistoricAlphaType(thisScore) 

            this_score_state = alpha_all_historic.description
            this_score_recommendation = alpha_all_historic.recommendation
            this_note = alpha_all_historic.note
            this_signal = alpha_all_historic.signal
            this_advice = alpha_all_historic.advice

            // Get the HTML 
            let elem_advice = document.getElementById('advice-' + this_sensor)

            // Add Alpha exponent received
            elem_advice.innerHTML = this_score_state;


            elem_advice.innerHTML += '<br>→ ' + this_advice;


            sendGuiEvent( 'sensorAdvice', {alpha: parseFloat(thisCumAlpha).toFixed(2), sensor: this_sensor, note: this_note, state: this_score_state, advice: this_advice, signal: this_signal } );




        }

        
        // Calculate the average for all the sensors if the time is right

        // for Debug
        // console.log('cumulative_length', cumulative_length)
        // console.log('triggered_length', triggered_length)
        // console.log('sensors_num', sensors_num)
        // console.log('current_length', current_length)

        if ((((cumulative_length - triggered_length) >= sensors_num) && cumulative_length != 1 && sensors_num != 1) ||
            (sensors_num == 1 && ((cumulative_length - triggered_length) >= recommenderIterations))) {

               
            // Set the number of data points at the point of this update
            if (sensors_num != 1) {
                triggered_length = cumulative_length 
            }

            // Create an empty array for the last alphas of each sensor
            let last_alphas = []
            
            // Push the last alpha of each sensor in the last_alphas array
            for (let s in alphaTimeline) {
                last_alphas.push(alphaTimeline[s].slice(-1).pop())
            }

            let average_alpha = 0
            let total_alpha = 0
    
            // Calculate total
            for (let l of last_alphas) {
                total_alpha += parseFloat(l)
            }

            // console.log('total_alpha', total_alpha)
            // console.log('last_alphas.length', last_alphas.length)
    
            // Calculate the average alpha exponent across all the sensors
            average_alpha = total_alpha / last_alphas.length
    
            // console.log('average_alpha',average_alpha)

            // Add this average alpha to the array
            cumulativeAlphaTimeline.push(average_alpha)

            // Get the type of the alpha 
            let cumulative_alpha_type = getAlphaType(parseFloat(average_alpha).toFixed(2))

            // Add this alpha to the cumulative alpha type array 
            cumulativeAlphaScore.push(cumulative_alpha_type)

            // Display this in the doc
            document.getElementById('alphaConsole').innerHTML = cumulativeAlphaScore.join(' → ')

            let last_alpha_recommendation = ''

            if (cumulative_alpha_type == 'random') {
                last_alpha_recommendation = 'uniform or repetitive'
             }
             else if (cumulative_alpha_type == 'regular') {
                last_alpha_recommendation = 'regular variability'
             }
             else if (cumulative_alpha_type == 'fractal') {
                last_alpha_recommendation = 'fractal variability'
             }
             else if (cumulative_alpha_type == 'complex') {
                last_alpha_recommendation = 'complex phase-shifting'
            }

            // Update HTML
            document.getElementById('lastAverageAlpha').innerHTML = 'current average alpha for all sensors: ' + parseFloat(average_alpha).toFixed(2) + ', ' + last_alpha_recommendation

            // Send to the server, so that we send the OSC
            sendGuiEvent( 'averageAlpha', {alpha: parseFloat(average_alpha).toFixed(2), alpha_score: cumulative_alpha_type, description: last_alpha_recommendation } );

            // Let us now cut the last N values from the cumulative alpha exponent and type
            let cumAlpha = cumulativeAlphaTimeline.slice(-recommenderIterations)

            let cumScore = cumulativeAlphaScore.slice(-recommenderIterations)
            
            // Are we at least recommenderIterations (3) iterations?
            if (cumAlpha.length == recommenderIterations) {

                let cum_alpha_recommendation = ''

                // What was the total cumulative Alpha exponent the last (3) iterations?

                let total_last = 0

                for (let a of cumAlpha) {
                    total_last += parseFloat(a)
                } 

                // Calculate average for the cumulative alpha

                let avCumAlpha = total_last / recommenderIterations

                let average_alpha_type = getAlphaType(parseFloat(avCumAlpha).toFixed(2))

                // Show a recommendation

                if (average_alpha_type == 'random') {
                    cum_alpha_recommendation = 'make it more variable or change pattern'
                    cum_alpha_description = 'uniform or repetitive'
                 }
                 else if (average_alpha_type == 'regular') {
                    cum_alpha_recommendation = 'introduce fractality or be more uniform'
                    cum_alpha_description = 'medium variability'
                 }
                 else if (average_alpha_type == 'fractal') {
                    cum_alpha_recommendation = 'change the pattern or reduce variability'
                    cum_alpha_description = 'fractal variability'
                 }
                 else if (average_alpha_type == 'complex') {
                    cum_alpha_recommendation = 'make it more uniform or self-similar'
                    cum_alpha_description = 'complex phase-shifting'
                }

                // Image output

               let cum_alpha_image_container = document.getElementById('HistoricalAlphaImage')

                // Adding alpha component image
               let cum_alpha_image = document.createElement('div')
               let add_alpha_av = ''
               let add_css = ''
               if (average_alpha_type == 'regular') add_css = 'moveup'
               if (average_alpha_type == 'random') add_css = 'moveright'
               if (show_alfa == true) {
                    add_alpha_av = '<span class="alphatext ' + add_css + '">' + parseFloat(avCumAlpha).toFixed(2).slice(-3) + '</span>'
                    
               }
               cum_alpha_image.innerHTML = add_alpha_av + '<img class="alphaimage" src="alphas/' + average_alpha_type + '.png" width="120" height="120">';
               cum_alpha_image.style.width = "20%";
               cum_alpha_image.style.padding = "10px";
               cum_alpha_image.style.position = "relative";
               cum_alpha_image.style.color = "#FFFFFF";
               cum_alpha_image.style.flex = "1";

               cum_alpha_image_container.appendChild(cum_alpha_image);

               
       
               cum_alpha_image_container.scrollLeft = cum_alpha_image_container.scrollWidth;

               
                // For HTML output
                let cum_alpha_score = cumScore.join(' → ')

                // let's now see what has been the last cumulative average score

                let cum_score_description = ''
                let cum_score_recommendation = ''
                let cum_note = ''
                let cum_signal = ''
                let cum_advice = ''

                
                let alpha_all_historic = getHistoricAlphaType(cumScore) 

                cum_score_description = alpha_all_historic.description
                cum_score_recommendation = alpha_all_historic.recommendation
                cum_note = alpha_all_historic.note
                cum_signal = alpha_all_historic.signal
                cum_advice = alpha_all_historic.advice


                document.getElementById('alphaRecommendation').innerHTML = 
                'average alpha last ' + recommenderIterations + ' iterations: ' + 
                parseFloat(avCumAlpha).toFixed(2) + ', ' + 
                average_alpha_type + ' on average, ' + 
                cum_alpha_description + '<br>' + 
                'based on the last averages: ' + cum_alpha_recommendation + '<br><br><br>' + 
                'the last ' + recommenderIterations + ' states have been:<br>' + 
                '<h4>' + cum_alpha_score + ' | ' + cum_score_description + '</h4><br><br>' + 
                'eightos recommendation:<br><h4>' + cum_score_recommendation + '</h4>';

                console.log('avCumAlpha', avCumAlpha)
                sendGuiEvent( 'eightOSAdvice', {alpha: parseFloat(avCumAlpha).toFixed(2), note: cum_note, state: cum_score_description, advice: cum_advice, signal: cum_signal } );


            }

            
        }

       

    };
    

    eventHandlerFunctions[  'sensorOrientation' ] = function( eventName, parameters  )
    {
        const address = parameters.address;
        var now = Date.parse(new Date());

        lastSensorsDataTimeMap[address] = now;

        const diff = now - lastSensorDataTime;

        if (lastSensorDataTime == 0 || diff >= 2000)
        {
            lastSensorDataTime = now;

            measuringSensors.forEach( function (address)
            {
                var element = document.getElementById(ID_SENSOR_DATA_INDICATOR + address);
                var alpha_elem = document.getElementById('alpha-image-code-' + address);
                
                if (element != null)
                {
                    var lastDataTime = lastSensorsDataTimeMap[address];
                
                    if (lastDataTime != null && lastDataTime != undefined)
                    {
                        const diff = now - lastDataTime;

                        if (diff >= 2000)
                        {
                            element.style.color = "#6A6A6A";
                            alpha_elem.style.color = "#AAAAAA"
                        }
                        else
                        {
                            element.style.color = "#EA6852";
                            alpha_elem.style.color = "#FFFFFF"
                        }
                    }
                    else
                    {
                        element.style.color = "#6A6A6A";
                        alpha_elem.style.color = "#AAAAAA"
                    }
                }
            });
        }


        // CHart the data

        
        
        
        if (!oscData[address]) {
            oscData[address] = []
            oscGraphLabels[address] = ['1']
        }
        else {
            oscData[address].push(calculateDistance(parameters.gyr_x, parameters.gyr_y, parameters.gyr_z))
        }

        if (oscData[address].length >= 10) {
            

            let data_to_add = oscData[address]

            oscData[address] = []

            let chart = oscGraph[address]

            const data = chart.data

            if (!data.datasets[0].data[0] || data.datasets[0].data[0] == 0) {

                // first data recorded
                data.datasets[0].data = [meanOfVector(data_to_add)]
            

            }
            else {
                // show last 20 seconds only 
                if (data.datasets[0].data.length >= 120) {
                    data.datasets[0].data.shift()
                    oscGraphLabels[address].shift()
                }
                data.datasets[0].data.push(meanOfVector(data_to_add))
                
            }

            data.labels = oscGraphLabels[address]

            
            oscGraphLabels[address].push((parseInt(oscGraphLabels[address][oscGraphLabels[address].length - 1]) + 1).toString()) 
            
    
            chart.update();
            
        }   


    };

    eventHandlerFunctions[ 'syncingDone' ] = function( eventName, parameters  )
    {
        console.log( "syncingDone " + parameters.sensor + ", " + parameters.isSuccess + ", " + parameters.isAllSuccess );

        if ( parameters.isAllSuccess != undefined )
        {
            if ( parameters.isAllSuccess )
            {
                console.log( "measuringPayloadId " + measuringPayloadId );

                stopMeasuringButton.innerHTML = "Starting...";

                for (  i = 0; i < connectedSensors.length; i++ )
                {
                    var sensor = [connectedSensors[i]];
                    sendGuiEvent( 'startMeasuring', {addresses:sensor, measuringPayloadId: measuringPayloadId} );
                }
            } else {
                enableOrDisableMeasurementControlButton();
                enableOrDisableLaunchStreamingButton();
                enableOrDisableConnectButtons(false);
            }

            syncingModal.style.display = 'none';
        }
    };

    eventHandlerFunctions[ 'readHeadingStatus' ] = function( eventName, parameters  )
    {
        console.log( "readHeadingStatus " + parameters.address + ", " + parameters.status );

        addLastHeadingStatus( parameters );
        updateHeadingResetButton();
    };
}

function guiEventHandler( eventName, parameters )
{
    if( eventHandlerFunctions[ eventName ] == undefined )
    {
        console.log( "WARNING: unhandled GUI event: " + eventName );
        return;
    }
    eventHandlerFunctions[ eventName ]( eventName, parameters );
}

function processFileList( files )
{
    if( files == undefined || files.length == 0 ) return;
    
    var recordings = document.getElementById("recordings");

    while( recordings.firstChild ) 
    {
        recordings.removeChild(recordings.firstChild);
    }
    
    files.forEach( function (file)
    {
        label = document.createElement("label");

        checkbox = document.createElement("input");
        checkbox.setAttribute( "type", "checkbox" );
        checkbox.setAttribute( "name", file );
        checkbox.setAttribute( "class", "file selection" );
        
        link = document.createElement("a");
        link.setAttribute( "href", "/"+file );
        link.setAttribute( "download", file );
        link.style.color = "#FFFFFF";
        link.style.marginLeft = "8px";
        link.innerHTML = file;
        newLine = document.createElement( "br" );

        recordings.appendChild(label);
        label.appendChild(checkbox);
        label.appendChild(link);
        label.appendChild(newLine);
    });
}

function enableOrDisableConnectButtons(disabled)
{
    discoveredSensors.forEach( function (address)
    {
        var element = document.getElementById(ID_CONNECTION_CONTROL_BUTTON + address);
        if (element != null)
        {
            element.disabled = disabled;
        }
    });
}

function enableOrDisableMeasurementControlButton()
{
    measurementControlButton.disabled = connectedSensors.length == 0;
    measurementControlButton.hidden = connectedSensors.length == 0 || measuringSensors.length != 0;

    syncControlButton.hidden = measurementControlButton.hidden;

    if (measuringSensors.length == 0)
        measurementPayloadList.style.display = '';

    stopMeasuringButton.hidden = measuringSensors.length == 0;
}

function enableOrDisableLaunchStreamingButton()
{
    launchStreamingButton.disabled = connectedSensors.length == 0;
    launchStreamingButton.hidden = connectedSensors.length == 0 || measuringSensors.length != 0;
}

function loadConnectedSensors( connectedSensors )
{
    console.log("loadConnectedSensors " + connectedSensors);

    if (connectedSensors != null && connectedSensors != undefined) {
        this.connectedSensors = connectedSensors;

        this.connectedSensors.forEach( function (address)
        {
            addSensorToList( discoveredSensors, "DiscoveredSensors", address );
            addAlphaToList( "AlphaScores", address );

            var logoImage = document.getElementById(ID_LOGO_IMAGE + address);
            if (logoImage != null)
            {
                logoImage.src = "Xsens_DOT_connected.png";
            }

            var element = document.getElementById(ID_CONNECTION_CONTROL_BUTTON + address);
            if (element != null)
            {
                element.innerHTML = TEXT_DISCONNECT;
                element.disabled = false;
                element.style.color = "#FFFFFF";
                element.style.background = "#EA6852";
                element.onmouseover = onButtonMouseOver;
                element.onmouseout = onButtonMouseOver;
            }
    
            enableOrDisableMeasurementControlButton();
            enableOrDisableLaunchStreamingButton();
        });

        
    }
}

function addSensorToList( sensorList, sensorListName, address, clickHandler )
{
    sensorList.push( address );

    var lineHeight = "38px";

    var sensorListElement = document.getElementById(sensorListName);

    var label = document.createElement("div");
    label.setAttribute( "id", sensorListName+address );
    label.style.width = "600px";
    label.style.display = "flex";

    sensorListElement.appendChild(label);

    var logo = document.createElement("img");
    logo.id = ID_LOGO_IMAGE + address;
    logo.src = "Xsens_DOT_disconnected.png";
    logo.style.width = "32px";
    logo.style.height = lineHeight;
    label.appendChild(logo);

    var sensorDataIndicatorDiv = document.createElement("div");
    sensorDataIndicatorDiv.style.width = "32px";
    sensorDataIndicatorDiv.style.height = lineHeight;
    sensorDataIndicatorDiv.style.display = "box";
    sensorDataIndicatorDiv.style.boxPack = "center";
    sensorDataIndicatorDiv.style.background = "#00000000";
    sensorDataIndicatorDiv.style.boxOrient = "vertical";
    sensorDataIndicatorDiv.textAlign = "center";

    var sensorDataIndicator = document.createElement("label");
    sensorDataIndicator.id = ID_SENSOR_DATA_INDICATOR + address;
    sensorDataIndicator.style.width = "16px";
    sensorDataIndicator.style.height = "16px";
    sensorDataIndicator.style.color = "#00000000";
    sensorDataIndicator.innerHTML = "▶";
    sensorDataIndicator.style.lineHeight = lineHeight;
    sensorDataIndicator.style.background = "#00000000";
    sensorDataIndicator.style.margin = "0px";

    sensorDataIndicatorDiv.appendChild(sensorDataIndicator);
    label.appendChild(sensorDataIndicatorDiv);

    var sensorAddress = document.createElement('label');
    sensorAddress.innerHTML = address;
    sensorAddress.style.padding = "10px";
    sensorAddress.style.color = "#FFFFFF";
    sensorAddress.style.flex = "1";
    sensorAddress.style.fontSize = "16px";
    label.appendChild(sensorAddress);

    // Adding alpha component data
    var sensorAlpha = document.createElement('label')
    sensorAlpha.innerHTML = 'alpha: n/a';
    sensorAlpha.id = 'alpha-' + address;
    sensorAlpha.style.padding = "10px";
    sensorAlpha.style.color = "#FFFFFF";
    sensorAlpha.style.flex = "1";
    sensorAlpha.style.fontSize = "16px";
    label.appendChild(sensorAlpha);

    // Adding alpha component data
    var sensorAdvice = document.createElement('label')
    sensorAdvice.innerHTML = 'last ' + recommenderIterations +  ' states: n/a';
    sensorAdvice.id = 'advice-' + address;
    sensorAdvice.style.padding = "10px";
    sensorAdvice.style.color = "#FFFFFF";
    sensorAdvice.style.flex = "1";
    sensorAdvice.style.fontSize = "16px";
    label.appendChild(sensorAdvice);

    var connectionControlButton = document.createElement("button");
    connectionControlButton.id = ID_CONNECTION_CONTROL_BUTTON + address;
    connectionControlButton.name = address;
    connectionControlButton.innerHTML = TEXT_CONNECT;
    initButtonStyle(connectionControlButton);

    connectionControlButton.onclick = connectionControlButtonClicked;
    connectionControlButton.onmouseover = onButtonMouseOver;
    connectionControlButton.onmouseout = onButtonMouseOut;

    label.appendChild(connectionControlButton);


    var newLine = document.createElement( "br" );
    label.appendChild(newLine);
}

function removeAlphaFromList( sensorListName, address )
{
    let idx = sensorList.indexOf( address );
    if( idx == -1 ) return;

    let element = document.getElementById(sensorListName+address);
    element.parentNode.removeChild(element);
}

function addAlphaToList(sensorListName, address, clickHandler )
{

    var lineHeight = "38px";

    let sensorListElement = document.getElementById(sensorListName);

    var label = document.createElement("div");
    label.setAttribute( "id", sensorListName+address );
    label.style.width = "100vw";
    
    label.style.display = 'flex';
    sensorListElement.appendChild(label);


    var sensorAddress = document.createElement('div');
    sensorAddress.innerHTML = address.slice(-2);
    sensorAddress.id = 'alpha-image-code-' + address;
    sensorAddress.style.padding = "10px";
    sensorAddress.style.width = "10%";
    sensorAddress.style.color = "#666666";
    sensorAddress.style.flex = "1";
    sensorAddress.style.fontSize = "45px";
    label.appendChild(sensorAddress);

    // Adding alpha component data
    var sensorAlpha = document.createElement('div')
    sensorAlpha.innerHTML = ' ';
    sensorAlpha.style['max-width'] = "90%";
    sensorAlpha.style.height = "163px";
    sensorAlpha.id = 'alpha-image-' + address;
    sensorAlpha.class = 'horizontalAlpha'
    sensorAlpha.style.padding = "10px";
    sensorAlpha.style['margin-right'] = "20px"
    sensorAlpha.style['overflow-x'] = 'scroll';
    sensorAlpha.style.color = "#FFFFFF";
    sensorAlpha.style.display = "flex";
    label.appendChild(sensorAlpha);

    let alphas_Container = document.getElementById('alpha-image-' + address)

    // Adding alpha component image
    var sensor_chart = document.createElement('canvas')
    sensor_chart.style.width = "100%";
    sensor_chart.style.height = "150px";
    sensor_chart.id = 'osc-chart-' + address;
    sensor_chart.style.position = "absolute";
    sensor_chart.style.padding = "20px 0px 40px 0px";
    sensor_chart.style.margin = "0px";
    sensor_chart.style.right = "0"
    sensor_chart.style.float = "right"
    sensor_chart.style.color = "#FFFFFF";
    sensor_chart.style.flex = "1";
    sensor_chart.style['text-align'] = "right"
    label.appendChild(sensor_chart);

    var newLine = document.createElement( "br" );
    label.appendChild(newLine);


    // build a chart for canvas

    

    let graph_data = {
        labels: [],
        datasets: []
    }

    let all_data = [] 

    let chart_labels = []

    graph_data = {
        labels: ['0'],
        datasets: [{
            label: 'speed',
            data: [0],
            borderWidth: 5,
            pointBorderWidth: 1,
            pointRadius: 0,
            tension: 0.4,
            borderColor: 'rgba(0, 220, 184, 1)',
            backgroundColor: 'rgba(0, 220, 184, 1)',
            pointBackgroundColor: 'rgba(0, 220, 184, 1)',
            fill: false
        }]
    }

    // rgba(0, 220, 184, 1)

    chart_labels = ['0']

    all_data = [1]

    let ctx = document.getElementById('osc-chart-' + address).getContext('2d');
    
    oscGraph[address] = new Chart(ctx, {
        type: 'line',
        data: graph_data,
        defaultFontSize: 10,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              intersect: false,
            },
            scales: {
                y: {
                    // max: Math.max.apply(this, all_data),
                    beginAtZero: true,
                    scale: 'logarithmic',
                    display: false,
                    ticks: {
                        stepSize: 1,
                    }
                },
                x: {
                    display: false
                }
         
            },
            plugins: {
                legend: {
                    display: false,
                }
            }
        }
    });

    
    
}

function initButtonStyle(connectionControlButton)
{
    connectionControlButton.style.marginLeft = "20px";
    connectionControlButton.style.width = "140px";
    connectionControlButton.style.height = "36px";
    connectionControlButton.style.outline = "none";
    connectionControlButton.style.border = "2px solid #43425D";
    connectionControlButton.style.borderRadius = "4px";
    connectionControlButton.style.opacity = "1";
    connectionControlButton.style.textAlign = "center";
    connectionControlButton.style.font = "12px 'Montserrat'";
    connectionControlButton.style.letterSpacing = "0";
    connectionControlButton.style.color = "#EA6852";
    connectionControlButton.style.fontWeight = "bold";
    connectionControlButton.style.background = "#FFFFFF";
}

function onButtonMouseOver()
{
    this.style.marginLeft = "20px";
    this.style.width = "140px";
    this.style.height = "36px";
    this.style.outline = "none";
    this.style.border = "2px solid #43425D";
    this.style.borderRadius = "4px";
    this.style.opacity = "1";
    this.style.textAlign = "center";
    this.style.font = "12px 'Montserrat'";
    this.style.letterSpacing = "0";
    this.style.color = "#FFFFFF";
    this.style.fontWeight = "bold";
    this.style.background = "#EA6852";
}

function onButtonMouseOut()
{
    initButtonStyle(this);
}

function removeSensor( sensorList, address )
{
    var idx = sensorList.indexOf( address );
    if( idx == -1 ) return;

    sensorList.splice(idx,1);
}

function removeSensorFromList( sensorList, sensorListName, address )
{
    var idx = sensorList.indexOf( address );
    if( idx == -1 ) return;

    var element = document.getElementById(sensorListName+address);
    element.parentNode.removeChild(element);

    sensorList.splice(idx,1);
}

function sensorSelection( sensorList, name )
{
    var idx = sensorList.indexOf( name );
    if( idx == -1 )
    {
        sensorList.push( name );
    }
    else
    {
        sensorList.splice(idx, 1);
    }
}

function addLastHeadingStatus( parameters )
{
    var idx = -1;

    lastHeadingStatusList.forEach( function (item)
    {
        if (item.address == parameters.address)
        {
            item.status = parameters.status;
            idx++;
        }
    });

    if( idx == -1 )
    {
        lastHeadingStatusList.push( parameters );
    }

    console.log( "Add lastHeadingStatusList " + lastHeadingStatusList );
}

function removeLastHeadingStatus( address )
{
    var idx = -1;

    for (var i = 0; i < lastHeadingStatusList.length; i++)
    {
        if (lastHeadingStatusList[i].address == address)
        {
            idx = i;
            break;
        }
    }

    if( idx != -1 )
    {
        lastHeadingStatusList.splice( idx, 1 );
    }

    console.log( "Remove lastHeadingStatusList " + lastHeadingStatusList );
}

function hasHeadingResetDevice()
{
    for (var i = 0; i < lastHeadingStatusList.length; i++)
    {
        if (lastHeadingStatusList[i].status == HEADING_STATUS_XRM_HEADING)
        {
            return true;
        }
    }

    return false;
}

function updateHeadingResetButton()
{
    if (hasHeadingResetDevice())
    {
        headingResetButton.innerHTML = 'Heading Revert';
    }
    else
    {
        headingResetButton.innerHTML = 'Heading Reset';
    }
}

function updateOSCPort()
{
    localStorage.setItem('osc_port', oscPortInput.value)
    localStorage.setItem('osc_host', oscHostInput.value)
    sendGuiEvent( 'oscUpdate', {port:oscPortInput.value,host:oscHostInput.value} );
}

function updateTerminal()


{
    let setting = document.getElementById('terminalUpdate').value
    localStorage.setItem('terminal_detail', setting)
    sendGuiEvent( 'updateTerminal', {show:setting} );
}

function updateDebug() 

{

    let isChecked = document.getElementById('terminalDebug').checked;

    if (isChecked) {
        localStorage.setItem('terminal_debug', 'true')
        sendGuiEvent( 'updateTerminal', {debug:true} );
    }
    else {
        localStorage.setItem('terminal_debug', 'false')
        sendGuiEvent( 'updateTerminal', {debug:false} );
    }
    


}

function showAlfa() 

{

    let isChecked = document.getElementById('showAlpha').checked;

    if (isChecked) {
        localStorage.setItem('show_alfa', 'true')
        show_alfa = true
    }
    else {
        localStorage.setItem('show_alfa', 'false')
        show_alfa = false
    }
    


}

function getLocalStorageOSCData() 
{
    if (localStorage.getItem('osc_port')) {
        oscPortInput.value = localStorage.getItem('osc_port')
    }
    if (localStorage.getItem('osc_host')) {
        oscHostInput.value = localStorage.getItem('osc_host')
    }
    sendGuiEvent( 'oscUpdate', {port:oscPortInput.value,host:oscHostInput.value} );
}

function getLocalStorageData() {
    
    if (localStorage.getItem('terminal_detail')) {
        document.querySelector('#terminalUpdate [value="' + localStorage.getItem('terminal_detail') + '"]').selected = true;
        let setting = document.getElementById('terminalUpdate').value
        sendGuiEvent( 'updateTerminal', {show:setting} );
    }

    if (localStorage.getItem('terminal_debug') == 'true') {
        document.getElementById('terminalDebug').checked = true
        sendGuiEvent( 'updateTerminal', {debug:true} );
    }
    else {
        document.getElementById('terminalDebug').checked = false
        sendGuiEvent( 'updateTerminal', {debug:false} );
    }

    if (localStorage.getItem('show_alfa') == 'true') {
        document.getElementById('showAlpha').checked = true
        show_alfa = true
        
    }
    else {
        document.getElementById('showAlpha').checked = false
        show_alfa = false
        
    }

}

function scanControlButtonClicked()
{
    if( scanControlButton.innerHTML == 'Scan for Sensors' )
    {
        sendGuiEvent( 'startScanning' );
        scanControlButton.innerHTML = 'Starting...';
        scanControlButton.disabled = true;

        while( discoveredSensors.length != 0 )
        {
            removeAlphaFromList("AlphaScores", discoveredSensors[0]);
            removeSensorFromList( discoveredSensors, "DiscoveredSensors", discoveredSensors[0] );
            
        }

        loadConnectedSensors(connectedSensors);

        if (scanningTimeoutId > 0)
            clearTimeout(scanningTimeoutId);

        scanningTimeoutId = setTimeout(() => {
            stopScanning();
        }, 15000);
    }
    else
    {
        stopScanning();
    }
}

function stopScanning()
{
    if( scanControlButton.innerHTML == 'Stop Scanning' )
    {
        sendGuiEvent( 'stopScanning' );
        scanControlButton.innerHTML = 'Stopping...';
        scanControlButton.disabled = true;
    }
}

function connectionControlButtonClicked()
{
    stopScanning();

    if( this.innerHTML == TEXT_CONNECT )
    {
        var sensor = [this.name];

        sendGuiEvent( 'connectSensors', {addresses:sensor} );
        this.innerHTML = "Stop connecting"
    }
    else if( this.innerHTML == 'Stop connecting')
    {
        var sensor = [this.name];
        sendGuiEvent( 'stopConnectingSensors', {addresses:sensor} );
        this.disabled = false;

        this.innerHTML = TEXT_CONNECT;
    }
    else if( this.innerHTML == TEXT_DISCONNECT )
    {
        var sensor = [this.name];
        sendGuiEvent( 'disconnectSensors', {addresses:sensor} );
        this.disabled = true;
        this.innerHTML = "Disconnecting..."
    }
}

function headingResetButtonClicked()
{
    updateHeadingResetButton();

    if (headingResetButton.innerHTML == 'Heading Reset')
    {
        sendGuiEvent( 'resetHeading', {measuringSensors: measuringSensors} );

        headingResetButton.disabled = true;
        setTimeout(() => {
            headingResetButton.innerHTML = 'Heading Revert';
            headingResetButton.disabled = false;
        }, 1000);
    }
    else if (headingResetButton.innerHTML == 'Heading Revert')
    {
        sendGuiEvent( 'revertHeading', {measuringSensors: measuringSensors} );

        headingResetButton.disabled = true;
        setTimeout(() => {
            headingResetButton.innerHTML = 'Heading Reset';
            headingResetButton.disabled = false;
        }, 1000);
    }
}

function measurementControlButtonClicked(payloadId)
{
    console.log("payloadId " + payloadId);

    stopScanning();

    measuringPayloadId = payloadId;

    if( measurementControlButton.innerHTML == 'Start Logging' )
    {
        console.log('starting to log')
        measurementControlButton.disabled = true;
        scanControlButton.disabled = true;

        measurementPayloadList.style.display = 'none';
        measurementControlButton.hidden = true;

        launchStreamingButton.disabled = true;
        launchStreamingButton.hidden = true;

        syncControlButton.hidden = measurementControlButton.hidden;

        stopMeasuringButton.hidden = false;

        if (isSyncingEnabled)
        {
            stopMeasuringButton.innerHTML = "Syncing...";
            stopMeasuringButton.disabled = true;

            sendGuiEvent( 'startSyncing', {} );
            enableOrDisableConnectButtons(true);
            syncingModal.style.display = 'block';
        }
        else
        {
            stopMeasuringButton.innerHTML = "Starting...";

            for (  i = 0; i < connectedSensors.length; i++ )
            {
                var sensor = [connectedSensors[i]];
                sendGuiEvent( 'startMeasuring', {addresses:sensor, measuringPayloadId: measuringPayloadId} );
            }

            enableOrDisableConnectButtons(true);
        }
    }
}

function syncControlButtonClicked()
{
    if (syncControlButton.innerHTML == 'Disable Sync')
    {
        syncControlButton.innerHTML = 'Enable Sync';
        isSyncingEnabled = false;
    }
    else
    {
        syncControlButton.innerHTML = 'Disable Sync';
        isSyncingEnabled = true;
    }

    sendGuiEvent( 'enableSync', {isSyncingEnabled: isSyncingEnabled} );
}

function stopMeasuringButtonClicked()
{
    sendGuiEvent( 'stopRecording' );

    stopMeasuringButton.disabled = true;
    stopMeasuringButton.innerHTML = "Stoping..."

    for (  i = 0; i < measuringSensors.length; i++ )
    {
        var address = measuringSensors[i];
        var sensor = [address];
        sendGuiEvent( 'stopMeasuring', {addresses:sensor, measuringPayloadId: measuringPayloadId} );

        var element = document.getElementById(ID_SENSOR_DATA_INDICATOR + address);

        let alpha_elem = document.getElementById('alpha-image-code-' + address);
        
        if (element != null)
        {
            element.style.color = "#00000000";
            element.style.background = "#00000000";

            alpha_elem.style.color = "#666666"

        }
    }
}

function deleteFilesButtonClick()
{
    // Get all selected 
    var selectedFiles = [];
    
    checkboxes = document.getElementsByClassName( "file selection" );
    
    for( i=0; i<checkboxes.length; i++ )
    {
        if( checkboxes[i].checked )
        {
            selectedFiles.push( checkboxes[i].getAttribute("name") );
        }
    }


    if( selectedFiles.length == 0 ) return;

    deleteFiles( selectedFiles );
}

function getAlphaType(alpha) {

    if (alpha <= 0.63) {
       return 'random'
    }
    else if (alpha > 0.63 && alpha < 0.90) {
       return 'regular'
    }
    else if (alpha >= 0.90 && alpha <= 1.10) {
       return 'fractal'
    }
    else if (alpha > 1.10) {
       return 'complex'
    }
}

function getHistoricAlphaType(cumScore) {

    let cum_score_description = ''
    let cum_score_recommendation = ''
    let cum_score_advice = ''
    let cum_note = ''
    let cum_signal = ''

    
    let counts_alpha = {}
    let last_two = ''
    let first_two = ''

    for (var i = 0; i < cumScore.length; i++) {
        var val = cumScore[i];
        counts_alpha[val] = counts_alpha[val] ? counts_alpha[val] + 1 : 1;
        if (i == 0) {
            if (cumScore[i] == cumScore[i+1]) {
                first_two = cumScore[i]
            }
        }
        if (i == cumScore.length - 1) {
            if (cumScore[i] == cumScore[i-1]) {
                last_two = cumScore[i]
            }
        }
    }


    
    if (counts_alpha['random'] == 3) {
        cum_score_description = 'all uniform'
        cum_score_recommendation = 'make it more regular or change pattern'
        cum_score_advice = 'VARIATE'
        cum_note = 'E'
        cum_signal = 'V'
        
     }
     else if (counts_alpha['regular'] == 3) {
        cum_score_description = 'all regular'
        cum_score_recommendation = 'introduce more fractality or uniformity'
        cum_score_advice = 'FRACTALIZE'
        cum_note = 'F'
        cum_signal = 'F'
     }
     else if (counts_alpha['fractal'] == 3) {
        cum_score_description = 'all fractal'
        cum_score_recommendation = 'introduce a change in the pattern or uniformity'
        cum_score_advice = 'LOOP'
        cum_note = 'G'
        cum_signal = 'L'
     }
     else if (counts_alpha['complex'] == 3) {
        cum_score_description = 'all complex'
        cum_score_recommendation = 'introduce more uniformity or fractality'  
        cum_score_advice = 'RELAX'
        cum_note = 'H'
        cum_signal = 'R'
    }
    else if (last_two == 'random') {
        cum_score_description = 'becoming uniform'
        cum_score_recommendation = 'keep doing uniform action'
        cum_score_advice = 'MAINTAIN'
        cum_note = 'I'
        cum_signal = 'M'
    }
    else if (first_two == 'random') {
        cum_score_description = 'leaving uniform'
        cum_score_recommendation = 'return to repetitive or introduce variability'
        cum_score_advice = 'LOOP OR VARIATE'
        cum_note = 'J'
        cum_signal = 'W'
    }
    else if (last_two == 'regular') {
        cum_score_description = 'becoming regular'
        cum_score_recommendation = 'keep doing a regular action'  
        cum_score_advice = 'MAINTAIN'
        cum_note = 'K'
        cum_signal = 'M'
    }
    else if (first_two == 'regular') {
        cum_score_description = 'leaving regular'
        cum_score_recommendation = 'keep doing what you are doing'  
        cum_score_advice = 'MAINTAIN'
        cum_note = 'L'
        cum_signal = 'M'
    }
    else if (last_two == 'fractal') {
        cum_score_description = 'becoming fractal'
        cum_score_recommendation = 'stay with the fractal variability'  
        cum_score_advice = 'FRACTALIZE'
        cum_note = 'N'
        cum_signal = 'F'
    }
    else if (first_two == 'fractal') {
        cum_score_description = 'leaving fractal'
        cum_score_recommendation = 'bring back variability or make it repetitive'  
        cum_score_advice = 'VARIATE'
        cum_note = 'O'
        cum_signal = 'V'
    }
    else if (last_two == 'complex') {
        cum_score_description = 'becoming complex'
        cum_score_recommendation = 'stay with the changing of pattern'  
        cum_score_advice = 'DISRUPT'
        cum_note = 'P'
        cum_signal = 'T'
    }
    else if (first_two == 'complex') {
        cum_score_description = 'leaving complex'
        cum_score_recommendation = 'keep changing pattern or introduce variability'  
        cum_score_advice = 'VARIATE'
        cum_note = 'Q'
        cum_signal = 'V'
    }
    else if (counts_alpha['random'] == 2 && last_two != 'random' && first_two != 'random') {
        cum_score_description = 'unstable random'
        cum_score_recommendation = 'keep doing repetitive, regularize, or change pattern'  
        cum_score_advice = 'CHOOSE'
        cum_note = 'R'
        cum_signal = 'S'
    }
    else if (counts_alpha['regular'] == 2 && last_two != 'regular' && first_two != 'regular') {
        cum_score_description = 'unstable regular'
        cum_score_recommendation = 'introduce variability or highly repetitive action' 
        cum_score_advice = 'LOOP OR VARIATE'
        cum_note = 'S' 
        cum_signal = 'W'
    }
    else if (counts_alpha['fractal'] == 2 && last_two != 'fractal' && first_two != 'fractal') {
        cum_score_description = 'unstable fractal'
        cum_score_recommendation = 'focus on fractal variability'  
        cum_score_advice = 'FRACTALIZE'
        cum_note = 'T'
        cum_signal = 'F'
    }
    else if (counts_alpha['complex'] == 2 && last_two != 'complex' && first_two != 'complex') {
        cum_score_description = 'unstable complex'
        cum_score_recommendation = 'keep changing pattern'  
        cum_score_advice = 'DISRUPT'
        cum_note = 'U'
        cum_signal = 'T'
    }
    else {
        cum_score_description = 'diverse'
        cum_score_recommendation = 'focus on fractal variability or keep shifting'
        cum_score_advice = 'FRACTALIZE'
        cum_note = 'V'
        cum_signal = 'F'
    }

    return {
        description: cum_score_description, 
        recommendation: cum_score_recommendation,
        advice: cum_score_advice,
        note: cum_note,
        signal: cum_signal
    }
}


function meanOfVector (x) {
    let mean = x => x.reduce( ( p, c ) => p + c, 0 ) / x.length;
    return mean(x)
}

function calculateDistance (x,y,z) {
    return Math.sqrt((x*x) + (y*y) + (z*z)) // CARTESIAN 3D DISTANCE GYRO
}


// ---------------------------------------------------------------------------------------
// -- Handle 'guiEvent' --
// ---------------------------------------------------------------------------------------
socket.on( 'guiEvent', function( eventName, parameters )
{
    if( typeof guiEventHandler === 'undefined' )
    {
        console.log( "WARNING 'guiEventHandler()' function not defined on page!" )
    }
    else guiEventHandler( eventName, parameters );
});

// ---------------------------------------------------------------------------------------
// -- Emit 'guiEvent' with event name and parameters --
// ---------------------------------------------------------------------------------------
function sendGuiEvent( eventName, parameters )
{
    socket.emit( 'guiEvent', eventName, parameters );
}

// ---------------------------------------------------------------------------------------
// -- Get connected sensors --
// ---------------------------------------------------------------------------------------
function getConnectedSensors()
{
    socket.emit( 'getConnectedSensors' );
}

// ---------------------------------------------------------------------------------------
// -- Get file list --
// ---------------------------------------------------------------------------------------
function getFileList()
{
    socket.emit( 'getFileList' );
}

// ---------------------------------------------------------------------------------------
// -- Delete files --
// ---------------------------------------------------------------------------------------
function deleteFiles( files )
{
    socket.emit( 'deleteFiles', files );
}

// ---------------------------------------------------------------------------------------
// -- Handle 'connectedSensors' --
// ---------------------------------------------------------------------------------------
socket.on( 'connectedSensors', function( connectedSensors )
{
    if( typeof loadConnectedSensors === 'undefined' )
    {
        console.log( "WARNING 'loadConnectedSensors()' function not defined on page!" )
    }
    else loadConnectedSensors( connectedSensors );
});

// ---------------------------------------------------------------------------------------
// -- Handle 'fileList' --
// ---------------------------------------------------------------------------------------
socket.on( 'fileList', function( files )
{
    if( typeof processFileList === 'undefined' )
    {
        console.log( "WARNING 'processFileList()' function not defined on page!" )
    }
    else processFileList( files );
});

// ---------------------------------------------------------------------------------------
// -- Get a unique filename --
// ---------------------------------------------------------------------------------------
function getUniqueFilename()
{                    
    var date    = new Date();
    var year    = (date.getFullYear()).toString();
    var month   = (date.getMonth()+1).toString();
    var day     = (date.getDate()).toString();
    var hours   = (date.getHours()).toString();
    var minutes = (date.getMinutes()).toString();
    var seconds = (date.getSeconds()).toString();

    return 	year + "-" +
            month.padStart(2,"0") + "-" +
            day.padStart(2,"0") + "-" +
            hours.padStart(2,"0") + "-" +
            minutes.padStart(2,"0") + "-" +
            seconds.padStart(2,"0");		
}


