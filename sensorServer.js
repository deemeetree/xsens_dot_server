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
// Sensor Server
// Documentation: documentation/Xsens DOT Server - Sensor Server.pdf
// =======================================================================================

// =======================================================================================
// Packages
// =======================================================================================
var fs                  = require('fs');
var BleHandler          = require('./bleHandler');
var WebGuiHandler       = require('./webGuiHandler');
var FunctionalComponent = require('./functionalComponent');
var SyncManager         = require('./syncManager');
var events              = require('events');

// =======================================================================================
// Constants
// =======================================================================================
const RECORDINGS_PATH = "/data/",
      RECORDING_BUFFER_TIME = 1000000;

// =======================================================================================
// State transitions table
// =======================================================================================

// Activate OSC server
const OSC = require('osc-js')

var osc_options = { open: { port: 49162, host: 'localhost'} }
var osc = new OSC({ plugin: new OSC.DatagramPlugin(osc_options) })

// Activate Python connection
var spawn = require('child_process').spawn

var beep = require('beepbeep')

// Define the Python DFA script to be used
let py = {}

var interval_data = {}
var interval_dataString = {}
var interval_iterations = {}

let max_iterations = 1200

let terminal_detail = 'all'
let terminal_debug = false


var transitions =
[
    // -- Powering-on --

	{
		stateName: 'Powering-on',
		eventName: 'blePoweredOn',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            // NOP
	    }
    },
    {
		stateName: 'Idle',
        eventName: 'oscUpdate',
        nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            console.log('oscUpdate event')
            let _osc_options = osc_options.open
            osc.close({_osc_options});
            
            console.log('port:',parameters.port)
            console.log('host:',parameters.host)

            osc_options = { open: { port: parameters.port, host: parameters.host} }
            osc = new OSC({ plugin: new OSC.DatagramPlugin(osc_options) })
            console.log(osc.status())

	    }
    },
    {
		stateName: 'Idle',
        eventName: 'updateTerminal',
        nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            console.log('terminal settings update')
            
            if (parameters && parameters.show) {
                terminal_detail = parameters.show
            }

            if (parameters && parameters.debug) {
                if (parameters.debug == "true" || parameters.debug == true || parameters.debug == 1) {
                    terminal_debug = true
                }
                else {
                    terminal_debug = false
                }
            }

	    }
    },
    {
		stateName: 'Recording',
        eventName: 'averageAlpha',
        nextState: 'Recording',
		
		transFunc:function( component, parameters )
	    {
             
         let alpha_exponent = parseFloat(parameters.alpha)
         let alpha_score = ''
         let alpha_note = ''
         let alpha_result = {}

         alpha_result = getAlphaType(alpha_exponent)

         alpha_score = alpha_result['score']
         alpha_note = alpha_result['note']

        // Display the symbol
        if (terminal_detail != 'sensors' && terminal_detail != 'historical') {
         console.log(' ')
         if (terminal_debug) {
            console.log(' ')
            console.log('~~~~~~[ALL LAST AVERAGE]~~~~~~~')
         }
         generateConsoleSymbol('AVRG', alpha_exponent, alpha_score, 'ALL', alpha_note)
         if (terminal_debug) {
             console.log('~~~~~~~~[END AVERAGE]~~~~~~~~~~')
             console.log(' ')
         }
         console.log(' ')
         if (terminal_debug) {
         // DEBUG values
            console.log('Sensor: ALL');
            console.log('Alpha Component:',alpha_exponent);
         }
        }

         sendAlphaViaOSC('alpha_avrg', 'all', alpha_exponent, alpha_note)

	    }
    },
    {
		stateName: 'Recording',
        eventName: 'eightOSAdvice',
        nextState: 'Recording',
		
		transFunc:function( component, parameters )
	    {
          
            let alpha_exponent = parseFloat(parameters.alpha)
            let alpha_score = ''
            let alpha_note = ''
            let alpha_state = ''
            let alpha_signal = ''
            let alpha_result = {}
   
            alpha_result = getAlphaType(alpha_exponent)
            
            // this is for the image
            alpha_score = alpha_result['score']

            // this is for the OSC and Text
            alpha_note = parameters.note
            alpha_advice = parameters.advice
            alpha_state = parameters.state
            alpha_signal = parameters.signal
   
           // Display the symbol
           if (terminal_detail != 'sensors' && terminal_detail != 'average') {
            console.log(' ')
            if (terminal_debug) {
                console.log(' ')
                console.log('++++++[ALL HISTORICAL]++++++')
            }
            generateConsoleSymbol('ALL', alpha_exponent, alpha_score, 'HST', alpha_note, alpha_signal)
            if (terminal_debug) {
                console.log(' ')
                console.log('state: ' + alpha_state)
                console.log('advice: ' + alpha_advice)
                console.log('note: ' + alpha_note + ' | signal: ' + alpha_signal)
                console.log(' ')
                console.log('++++++[END HISTORICAL]++++++')
                console.log(' ')
            }
            console.log(' ')
            if (terminal_debug) {
            // DEBUG values
             console.log('Sensor: ALL');
             console.log('Alpha Component:',alpha_exponent);
            }
            }
   
            sendAlphaViaOSC('alpha_history', 'all', alpha_exponent, alpha_note, alpha_signal)

	    }
    },
    {
		stateName: 'Recording',
        eventName: 'sensorAdvice',
        nextState: 'Recording',
		
		transFunc:function( component, parameters )
	    {
          
            let alpha_exponent = parseFloat(parameters.alpha)
            let alpha_score = ''
            let alpha_note = ''
            let alpha_state = ''
            let alpha_signal = ''
            let alpha_sensor = ''
            let alpha_result = {}
   
            alpha_result = getAlphaType(alpha_exponent)
            
            // this is for the image
            alpha_score = alpha_result['score']

            // this is for the OSC and Text
            alpha_note = parameters.note
            alpha_advice = parameters.advice
            alpha_state = parameters.state
            alpha_signal = parameters.signal
            alpha_sensor = parameters.sensor

            let ac = alpha_sensor.slice(-2)
   
           // Display the symbol

           if (terminal_detail != 'average') {
                console.log(' ')
                
                if (terminal_debug) {
                    console.log(' ')
                    console.log('++++++['+ac+'] HISTORICAL++++++')
                }       
                
                generateConsoleSymbol(alpha_sensor, alpha_exponent, alpha_score, 'HST', alpha_note, alpha_signal)

                if (terminal_debug) {
                    console.log(' ')
                    console.log('state: ' + alpha_state)
                    console.log('advice: ' + alpha_advice)
                    console.log('note: ' + alpha_note + ' | signal: ' + alpha_signal)
                    console.log(' ')
                    console.log('++++[END ['+ac+'] HISTORICAL]++++')
                    console.log(' ')
                }
                console.log(' ')
                if (terminal_debug) {
                // DEBUG values
                console.log('Sensor:',parameters.sensor);
                console.log('Alpha Component:',alpha_exponent);
                }
            }
   
            sendAlphaViaOSC('alpha_history', alpha_sensor, alpha_exponent, alpha_note, alpha_signal)

	    }
    },
    {
		stateName: 'Idle',
		eventName: 'startScanning',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            component.sensors = {};
            component.discoveredSensors = [];

            if (globalConnectedSensors != null && globalConnectedSensors != undefined)
            {
                globalConnectedSensors.forEach( function (sensor)
                {
                    if( component.sensors[sensor.address] == undefined )
                    {
                        component.sensors[sensor.address] = sensor;
                    }
                    component.discoveredSensors.push( sensor );
                });
            }

            component.ble.startScanning();
	    }
    },
    {
		stateName: 'Idle',
		eventName: 'bleScanningStarted',
		nextState: 'Scanning',
		
		transFunc:function( component, parameters )
	    {
            component.gui.sendGuiEvent( 'scanningStarted' );	   
        }
    },
    {
		stateName: 'Idle',
		eventName: 'connectSensors',
		nextState: 'Connect next?',
		
		transFunc:function( component, parameters )
	    {
	    }
    },

    // -- Scanning --

    {
		stateName: 'Scanning',
		eventName: 'bleSensorDiscovered',
		nextState: 'New sensor?',
		
		transFunc:function( component, parameters )
	    {
            component.discoveredSensor = parameters.sensor;
	    }
    },
    {
		stateName: 'Scanning',
		eventName: 'stopScanning',
		nextState: 'Scanning',
		
		transFunc:function( component, parameters )
	    {
            component.ble.stopScanning();
	    }
    },
    {
		stateName: 'Scanning',
		eventName: 'bleScanningStopped',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            component.gui.sendGuiEvent( 'scanningStopped' );
	    }
    },

    // -- Discovering --

    {
		stateName: 'New sensor?',
		eventName: 'yes',
		nextState: 'Scanning',
		
		transFunc:function( component, parameters )
	    {
            if( component.sensors[component.discoveredSensor.address] == undefined )
            {
                component.sensors[component.discoveredSensor.address] = component.discoveredSensor;
            }
            component.discoveredSensors.push( component.discoveredSensor );
            component.gui.sendGuiEvent
            ( 
                'sensorDiscovered', 
                { 
                    name:    component.discoveredSensor.name,
                    address: component.discoveredSensor.address
                } 
            );
	    }
    },
    {
		stateName: 'New sensor?',
		eventName: 'no',
		nextState: 'Scanning',
		
		transFunc:function( component, parameters )
	    {
            // NOP
	    }
    },

    // -- Connecting --

    {
		stateName: 'Connect next?',
		eventName: 'yes',
		nextState: 'Connecting',
		
		transFunc:function( component, parameters )
	    {
            if( parameters == undefined ) return;

            var address = parameters.addresses[0];

            if( address == undefined ) return;

            var sensor = component.sensors[address];

            if( sensor != undefined )
            {                
                component.ble.connectSensor( sensor );
            }
	    }
    },
    {
		stateName: 'Connect next?',
		eventName: 'no',
		nextState: 'Sensor connected',
		
		transFunc:function( component, parameters )
	    {
	    }
    },
    {
		stateName: 'Connecting',
		eventName: 'bleSensorDisconnected',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            removeSensor( parameters.sensor, component.connectedSensors );
            component.gui.sendGuiEvent( 'sensorDisconnected', {address:parameters.sensor.address} );
	    }
    },
    {
		stateName: 'Connecting',
		eventName: 'stopConnectingSensors',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            if( parameters == undefined ) return;

            var address = parameters.addresses[0];

            if( address == undefined ) return;

            var sensor = component.sensors[address];

            if( sensor != undefined )
            {
                component.ble.disconnectSensor( sensor );
            }

            var connectedSensor = component.connectedSensors.indexOf(sensor);

            if (connectedSensor == -1)
            {
                component.gui.sendGuiEvent( 'sensorDisconnected', {address:address} );
            }
	    }
    },
    {
		stateName: 'Sensor connected',
		eventName: 'stopConnectingSensors',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            if( parameters == undefined ) return;

            var address = parameters.addresses[0];

            if( address == undefined ) return;

            var sensor = component.sensors[address];

            if( sensor != undefined )
            {
                component.ble.disconnectSensor( sensor );
            }
	    }
    },
    {
		stateName: 'Idle',
		eventName: 'bleSensorConnected',
		nextState: 'Sensor disconnected?',
		
		transFunc:function( component, parameters )
	    {
            if( parameters == undefined ) return;

            var address = parameters.addresses[0];

            if( address == undefined ) return;

            var sensor = component.sensors[address];

            if( sensor != undefined )
            {
                component.ble.disconnectSensor( sensor );
            }
	    }
    },
    {
		stateName: 'StopConnectingSensors',
		eventName: 'connectSensors',
		nextState: 'StopConnectingSensors',
		
		transFunc:function( component, parameters )
	    {
	    }
    },
    {
		stateName: 'StopConnectingSensors',
		eventName: 'stopConnectingSensors',
		nextState: 'StopConnectingSensors',
		
		transFunc:function( component, parameters )
	    {
	    }
    },
    {
		stateName: 'Idle',
		eventName: 'bleSensorDisconnected',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            removeSensor( parameters.sensor, component.connectedSensors );
            component.gui.sendGuiEvent( 'sensorDisconnected', {address:parameters.sensor.address} );
	    }
    },
    {
		stateName: 'Connecting',
		eventName: 'bleSensorConnected',
		nextState: 'Sensors connected?',
		
		transFunc:function( component, parameters )
	    {
            component.connectedSensors.push( parameters.sensor );

            var sensor = [parameters.sensor.address];
            component.gui.sendGuiEvent( 'sensorConnected', {address:parameters.sensor.address, addresses:sensor} );
	    }
    },
    {
		stateName: 'Connecting',
		eventName: 'bleSensorError',
		nextState: 'Connect next?',
		
		transFunc:function( component, parameters )
	    {
	    }
    },
    {
		stateName: 'Idle',
		eventName: 'disconnectSensors',
		nextState: 'Sensor disconnected?',
		
		transFunc:function( component, parameters )
	    {
	    }
    },
    {
		stateName: 'Sensor connected',
		eventName: 'disconnectSensors',
		nextState: 'Sensor disconnected?',

		transFunc:function( component, parameters )
		{
		}
    },
    {
        stateName: 'Idle',
		eventName: 'startSyncing',
		nextState: 'Syncing',

		transFunc:function( component, parameters )
		{
            component.syncManager.startSyncing();
		}
    },
    {
		stateName: 'Sensor connected',
		eventName: 'bleSensorConnected',
		nextState: 'Sensor disconnected?',

		transFunc:function( component, parameters )
		{
		}
    },
    {
        stateName: 'Syncing',
		eventName: 'bleSensorConnected',
		nextState: 'Syncing',

		transFunc:function( component, parameters )
		{
		}
    },
    {
        stateName: 'Syncing',
		eventName: 'bleSensorDisconnected',
		nextState: 'Syncing',

		transFunc:function( component, parameters )
		{
		}
    },
    {
        stateName: 'Syncing',
		eventName: 'syncingDone',
		nextState: 'Idle',

		transFunc:function( component, parameters )
		{
		}
    },
    {
		stateName: 'Idle',
		eventName: 'startMeasuring',
		nextState: 'StartMeasuring',
		
		transFunc:function( component, parameters )
	    {
            var len = parameters.addresses;

            if( parameters == undefined ) return;

            var address = parameters.addresses[0];

            if( address == undefined ) return;

            component.measuringPayloadId = parameters.measuringPayloadId;

            var sensor = component.sensors[address];

            if( sensor != undefined )
            {
                component.ble.enableSensor( sensor, parameters.measuringPayloadId );
            }
	    }
    },
    {
		stateName: 'Sensor connected',
		eventName: 'startMeasuring',
		nextState: 'StartMeasuring',
		
		transFunc:function( component, parameters )
	    {
            var len = parameters.addresses;

            if( parameters == undefined ) return;

            var address = parameters.addresses[0];

            if( address == undefined ) return;

            component.measuringPayloadId = parameters.measuringPayloadId;

            var sensor = component.sensors[address];

            if( sensor != undefined )
            {
                component.ble.enableSensor( sensor, parameters.measuringPayloadId );
            }
	    }
    },
    {
		stateName: 'Sensor connected',
		eventName: 'bleSensorDisconnected',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            removeSensor( parameters.sensor, component.connectedSensors );
            component.gui.sendGuiEvent( 'sensorDisconnected', {address:parameters.sensor.address} );
	    }
    },
    {
		stateName: 'Sensor connected',
		eventName: 'connectSensors',
		nextState: 'Connect next?',
		
		transFunc:function( component, parameters )
	    {
	    }
    },
    {
		stateName: 'Sensor disconnected?',
		eventName: 'yes',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
	    }
    },
    {
		stateName: 'Sensor disconnected?',
		eventName: 'no',
		nextState: 'Disconnecting',
		
		transFunc:function( component, parameters )
	    {
            if( parameters == undefined ) return;

            var address = parameters.addresses[0];

            if( address == undefined ) return;

            var sensor = component.sensors[address];

            if( sensor != undefined )
            {
                component.ble.disconnectSensor( sensor );
            }
	    }
    },
    {
		stateName: 'Disconnecting',
		eventName: 'bleSensorDisconnected',
		nextState: 'Sensor disconnected?',
		
		transFunc:function( component, parameters )
	    {
            removeSensor( parameters.sensor, component.connectedSensors );
            component.gui.sendGuiEvent( 'sensorDisconnected', {address:parameters.sensor.address} );
	    }
    },
    {
		stateName: 'Sensors connected?',
		eventName: 'yes',
		nextState: 'Sensor connected',
		
		transFunc:function( component, parameters )
	    {
	    }
    },
    {
		stateName: 'Sensors connected?',
		eventName: 'no',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
	    }
    },


    // -- Measuring --

    {
		stateName: 'Start next?',
		eventName: 'yes',
		nextState: 'Enabling',
		
		transFunc:function( component, parameters )
	    {
	    }
    },
    {
		stateName: 'Start next?',
		eventName: 'no',
		nextState: 'Measuring',
		
		transFunc:function( component, parameters )
	    {
        }
    },
    {
		stateName: 'StartMeasuring',
		eventName: 'bleSensorEnabled',
		nextState: 'Start next?',
		
		transFunc:function( component, parameters )
	    {
            component.measuringSensors.push( parameters.sensor );
            component.gui.sendGuiEvent( 'sensorEnabled', {address:parameters.sensor.address} );
	    }
    },
    {
		stateName: 'StartMeasuring',
		eventName: 'bleSensorDisconnected',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            removeSensor( parameters.sensor, component.connectedSensors );
            removeSensor( parameters.sensor, component.measuringSensors );
            component.gui.sendGuiEvent( 'sensorDisconnected', {address:parameters.sensor.address} );	    
        }
    },
    {
		stateName: 'Enabling',
		eventName: 'bleSensorDisconnected',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            removeSensor( parameters.sensor, component.connectedSensors );
            removeSensor( parameters.sensor, component.measuringSensors );
            component.gui.sendGuiEvent( 'sensorDisconnected', {sensor:parameters.sensor.address} );
	    }
    },
    {
		stateName: 'Enabling',
		eventName: 'bleSensorData',
		nextState: 'Enabling',
		
		transFunc:function( component, parameters )
	    {
            // NOP
	    }
    },
    {
		stateName: 'Enabling',
		eventName: 'bleSensorError',
		nextState: 'Start next?',
		
		transFunc:function( component, parameters )
	    {
            component.ble.disconnectSensor( parameters.sensor );
	    }
    },
    {
		stateName: 'Measuring',
		eventName: 'stopMeasuring',
		nextState: 'StopMeasuring',
		
		transFunc:function( component, parameters )
	    {
            if( parameters == undefined ) return;
            
            var address = parameters.addresses[0];
            
            if( address == undefined ) return;
            
            var sensor = component.sensors[address];
            
            if( sensor != undefined )
            {
                component.ble.disableSensor( sensor, parameters.measuringPayloadId );
                component.measuringSensors.shift();
            }
	    }
    },
    {
		stateName: 'Measuring',
		eventName: 'bleSensorDisconnected',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            removeSensor( parameters.sensor, component.connectedSensors );
            removeSensor( parameters.sensor, component.measuringSensors );
            component.gui.sendGuiEvent( 'sensorDisconnected', {address:parameters.sensor.address} );
	    }
    },
    {
		stateName: 'Measuring',
		eventName: 'bleSensorData',
		nextState: 'Measuring',
		
		transFunc:function( component, parameters )
	    {
            
	    }
    },
    {
		stateName: 'Idle',
		eventName: 'enableSync',
		nextState: 'Idle',

		transFunc:function( component, parameters )
	    {
            console.log('enableSync',parameters.isSyncingEnabled);
            component.ble.enableSync( parameters.isSyncingEnabled );
	    }
    },
    {
		stateName: 'Recording',
		eventName: 'resetHeading',
		nextState: 'Recording',

		transFunc:function( component, parameters )
	    {
            parameters.measuringSensors.forEach( function (address)
            {
                var sensor = component.sensors[address];

                if( sensor != undefined )
                {
                    component.ble.resetHeading( sensor );
                }
            });
	    }
    },
    {
		stateName: 'Recording',
		eventName: 'revertHeading',
		nextState: 'Recording',

		transFunc:function( component, parameters )
	    {
            parameters.measuringSensors.forEach( function (address)
            {
                var sensor = component.sensors[address];

                if( sensor != undefined )
                {
                    component.ble.revertHeading( sensor );
                }
            });
	    }
    },
    {
		stateName: 'Measuring',
		eventName: 'startRecording',
		nextState: 'Measuring',
		
		transFunc:function( component, parameters )
	    {
            startRecordingToFile( component, parameters.filename );

            console.log('started streaming')
	    }
    },
    {
		stateName: 'Measuring',
		eventName: 'fsOpen',
		nextState: 'Recording',
		
		transFunc:function( component, parameters )
	    {
            var now = new Date();

            component.fileStream.write( "sep=,\n" );

            switch (component.measuringPayloadId)
            {
                case MEASURING_PAYLOAD_TYPE_COMPLETE_EULER:
                    component.fileStream.write( "Measurement Mode:,Complete (Euler)\n" );
                    break;

                case MEASURING_PAYLOAD_TYPE_EXTENDED_QUATERNION:
                    component.fileStream.write( "Measurement Mode:,Extended (Quaternion)\n" );
                    break;

                case MEASURING_PAYLOAD_TYPE_RATE_QUANTITIES_WITH_MAG:
                    component.fileStream.write( "Measurement Mode:,Rate quantities (with mag)\n" );
                    break;

                case MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_1:
                    component.fileStream.write( "Measurement Mode:,Custom Mode 1\n" );
                    break;

                case MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_2:
                    component.fileStream.write( "Measurement Mode:,Custom Mode 2\n" );
                    break;

                case MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_3:
                    component.fileStream.write( "Measurement Mode:,Custom Mode 3\n" );
                    break;
            }

            component.fileStream.write( "StartTime:," + now.toUTCString() + "\n" );
            component.fileStream.write( "© Xsens Technologies B. V. 2005-" + now.getFullYear() + "\n\n" );

            switch (component.measuringPayloadId)
            {
                case MEASURING_PAYLOAD_TYPE_COMPLETE_EULER:
                    component.fileStream.write( "Timestamp,Address,Euler_x,Euler_y,Euler_z,FreeAcc_x,FreeAcc_y,FreeAcc_z\n" );
                    break;

                case MEASURING_PAYLOAD_TYPE_EXTENDED_QUATERNION:
                    component.fileStream.write( "Timestamp,Address,Quaternion_w,Quaternion_x,Quaternion_y,Quaternion_z,FreeAcc_x,FreeAcc_y,FreeAcc_z,Status,ClipCountAcc,ClipCountGyr\n" );
                    break;

                case MEASURING_PAYLOAD_TYPE_RATE_QUANTITIES_WITH_MAG:
                    component.fileStream.write( "Timestamp,Address,Acc_x,Acc_y,Acc_z,Gyr_x,Gyr_y,Gyr_z,Mag_x,Mag_y,Mag_z,acc_sum,Alpha_Fractal,Alpha_Score\n" );
                    break;

                case MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_1:
                    component.fileStream.write( "Timestamp,Address,Euler_X,Euler_Y,Euler_Z,FreeAcc_x,FreeAcc_y,FreeAcc_z,Gyr_X,Gyr_Y,Gyr_Z\n" );
                    break;

                case MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_2:
                    component.fileStream.write( "Timestamp,Address,Euler_X,Euler_Y,Euler_Z,FreeAcc_x,FreeAcc_y,FreeAcc_z,Mag_x,Mag_y,Mag_z\n" );
                    break;

                case MEASURING_PAYLOAD_TYPE_CUSTOM_MODE_3:
                    component.fileStream.write( "Timestamp,Address,Quaternion_w,Quaternion_x,Quaternion_y,Quaternion_z,Gyr_X,Gyr_Y,Gyr_Z\n" );
                    break;
            }

	    }
    },
    {
		stateName: 'Stop next?',
		eventName: 'yes',
		nextState: 'Disabling',
		
		transFunc:function( component, parameters )
	    {
	    }
    },
    {
		stateName: 'Stop next?',
		eventName: 'no',
		nextState: 'Sensor connected',
		
		transFunc:function( component, parameters )
	    {
            component.gui.sendGuiEvent( 'allSensorsDisabled' );
	    }
    },
    {
		stateName: 'StopMeasuring',
		eventName: 'bleSensorDisabled',
		nextState: 'Stop next?',
		
		transFunc:function( component, parameters )
	    {
            component.gui.sendGuiEvent( 'sensorDisabled', {address:parameters.sensor.address} );
	    }
    },
    {
		stateName: 'StopMeasuring',
		eventName: 'bleSensorDisconnected',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            removeSensor( parameters.sensor, component.connectedSensors );
            removeSensor( parameters.sensor, component.measuringSensors );
            component.gui.sendGuiEvent( 'sensorDisconnected', {address:parameters.sensor.address} );	    }
    },
    {
		stateName: 'Disabling',
		eventName: 'bleSensorError',
		nextState: 'Stop next?',
		
		transFunc:function( component, parameters )
	    {
            console.log( "bleSensorError:" + parameters.error );
            component.ble.disconnectSensor( parameters.sensor );
	    }
    },
    {
		stateName: 'Disabling',
		eventName: 'bleSensorData',
		nextState: 'Disabling',
		
		transFunc:function( component, parameters )
	    {
            // NOP
	    }
    },
    {
		stateName: 'Disabling',
		eventName: 'bleSensorDisconnected',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            removeSensor( parameters.sensor, component.connectedSensors );
            removeSensor( parameters.sensor, component.measuringSensors );
            component.gui.sendGuiEvent( 'sensorDisconnected', {address:parameters.sensor.address} );
	    }
    },

    // -- Recording --

    {
		stateName: 'Recording',
		eventName: 'bleSensorDisconnected',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            removeSensor( parameters.sensor, component.connectedSensors );
            removeSensor( parameters.sensor, component.measuringSensors );
            component.gui.sendGuiEvent( 'sensorDisconnected', {address:parameters.sensor.address} );
	    }
    },
    {
		stateName: 'Recording',
		eventName: 'bleSensorData',
		nextState: 'Store data?',
		
		transFunc:function( component, parameters )
	    {
            component.lastTimestamp = parameters.timestamp;

            osc.on('open', () => {
                console.log('NEW OSC OPEN', osc_options)
                // setInterval(() => {
                //    // send these messages to `localhost:11245`
                //    osc.send(new OSC.Message('/response', Math.random()), {port: 4000})
                // }, 1000)
            })

            // console.log('Getting Parameters')
            // console.log(parameters)
           

//          let acc_sum = (Math.abs(parameters.acc_x) + Math.abs(parameters.acc_y) + Math.abs(parameters.acc_z))/3 // MEAN DEVIATION

  //         let acc_sum = Math.sqrt(((parameters.acc_x*parameters.acc_x) + (parameters.acc_y*parameters.acc_y) + (parameters.acc_z*parameters.acc_z))/3) // STANDARD DEVIATION

 //          let acc_sum = (Math.abs(parameters.acc_x) + Math.abs(parameters.acc_y) + Math.abs(parameters.acc_z)) // ABSOLUTE SUM

  //          let acc_sum = Math.sqrt((parameters.acc_x*parameters.acc_x) + (parameters.acc_y*parameters.acc_y) + (parameters.acc_z*parameters.acc_z)) // CARTESIAN 3D DISTANCE

  //          let acc_sum = ((parameters.acc_x*parameters.acc_x) + (parameters.acc_y*parameters.acc_y) + (parameters.acc_z*parameters.acc_z))/3 // VARIANCE
   let acc_sum = Math.sqrt((parameters.gyr_x*parameters.gyr_x) + (parameters.gyr_y*parameters.gyr_y) + (parameters.gyr_z*parameters.gyr_z)) // CARTESIAN 3D DISTANCE GYRO
  //let acc_sum = Math.sqrt((parameters.mag_x*parameters.mag_x) + (parameters.mag_y*parameters.mag_y) + (parameters.mag_z*parameters.mag_z    )) // CARTESIAN 3D DISTANCE GYRO
            if (!interval_data[parameters.address]) {
                interval_data[parameters.address] = []
            }
            else {
                interval_data[parameters.address].push(acc_sum)
            }

            parameters['acc_sum'] = acc_sum
            
            osc.send(new OSC.Message('/acc_x/' + parameters.address, parameters.acc_x), {port: osc_options.open.port, host: osc_options.open.host})
            osc.send(new OSC.Message('/acc_y/' + parameters.address, parameters.acc_y), {port: osc_options.open.port, host: osc_options.open.host})
            osc.send(new OSC.Message('/acc_z/' + parameters.address, parameters.acc_z), {port: osc_options.open.port, host: osc_options.open.host})
            osc.send(new OSC.Message('/acc_sum/' + parameters.address, parameters.acc_sum), {port: osc_options.open.port, host: osc_options.open.host})
            osc.send(new OSC.Message('/gyr_x/' + parameters.address, parameters.gyr_x), {port: osc_options.open.port, host: osc_options.open.host})
            osc.send(new OSC.Message('/gyr_y/' + parameters.address, parameters.gyr_y), {port: osc_options.open.port, host: osc_options.open.host})
            osc.send(new OSC.Message('/gyr_z/' + parameters.address, parameters.gyr_z), {port: osc_options.open.port, host: osc_options.open.host})
            // osc.send(new OSC.Message('/mag_x/' + parameters.address, parameters.mag_x), {port: osc_options.open.port, host: osc_options.open.host})
            // osc.send(new OSC.Message('/mag_y/' + parameters.address, parameters.mag_y), {port: osc_options.open.port, host: osc_options.open.host})
            // osc.send(new OSC.Message('/mag_z/' + parameters.address, parameters.mag_z), {port: osc_options.open.port, host: osc_options.open.host})

            
             /* Considering we are at 60 Hz we want the DFA check function to load every 20 seconds  
             after the first 40 seconds, so 60 x 40 = 2400 iterations, then 1200 */

             // Trigger the function on the basis of the number of values in the sensor

             if (interval_data[parameters.address].length == max_iterations * 2) {
                  
                    if (!interval_iterations[parameters.address]) {
                        interval_iterations[parameters.address] = 1
                    }
                    else {
                        ++interval_iterations[parameters.address]
                    }

                    // DEBUG BELOW
                    // console.log('Firing the Function on Data')
                    // console.log(interval_data)

                    
                    // console.log('firing on iterations:', interval_iterations)
                    
                    
                
                    // For each sensor, calculate the Fractal signature

                    calculateDFA(parameters.address, interval_data, interval_iterations[parameters.address], max_iterations, component, parameters) 


             }


            component.csvBuffer += Object.values(parameters).join() + '\n';

            component.gui.sendGuiEvent( 'sensorOrientation', parameters );
	    }
    },
    {
		stateName: 'Recording',
		eventName: 'stopRecording',
		nextState: 'Recording',
		
		transFunc:function( component, parameters )
	    {
            component.fileStream.write( component.csvBuffer );
            component.fileStream.end();
            console.log('stopped streaming')
	    }
    },
    {
		stateName: 'Recording',
		eventName: 'fsClose',
		nextState: 'Idle',
		
		transFunc:function( component, parameters )
	    {
            component.gui.sendGuiEvent( 'recordingStopped' );
	    }
    },
    {
		stateName: 'Store data?',
		eventName: 'yes',
		nextState: 'Recording',
		
		transFunc:function( component, parameters )
	    {
            component.fileStream.write( component.csvBuffer );
            component.csvBuffer = "";
            component.lastWriteTime = component.lastTimestamp;
	    }
    },
    {
		stateName: 'Store data?',
		eventName: 'no',
		nextState: 'Recording',
		
		transFunc:function( component, parameters )
	    {
            // NOP
	    }
    }
];

// =======================================================================================
// Choice-points
// =======================================================================================

var choicePoints =
[
    {
        name:'Connect next?', 
        evalFunc: function( component, parameters )
        {
            if( parameters == undefined ) return;

            var address = parameters.addresses[0];

            if( address == undefined ) return;

            var sensor = component.sensors[address];
            var connectedSensor = component.connectedSensors.indexOf(sensor);

            if( sensor != undefined && connectedSensor == -1)
            {
                return true;
            }

            return false;
        }
    },
    {
        name:'Start next?', 
        evalFunc: function( component, parameters )
        {
            return false;
        }
    },
    {
        name:'Store data?', 
        evalFunc: function( component )
        {
            return ( component.lastTimestamp - component.lastWriteTime > RECORDING_BUFFER_TIME );
        }
    },
    {
        name:'Stop next?', 
        evalFunc: function( component )
        {
            return false;
        }
    },
    {
        name:'Sensor disconnected?', 
        evalFunc: function( component, parameters )
        {
            if( parameters == undefined ) return;

            var address = parameters.addresses[0];

            if( address == undefined ) return;

            var sensor = component.sensors[address];
            var connectedSensor = component.connectedSensors.indexOf(sensor);

            if( sensor != undefined && connectedSensor == -1 )
            {
                return true;
            }

            return false;
        }
    },
    {
        name:'New sensor?', 
        evalFunc: function( component )
        {
            return ( component.discoveredSensors.indexOf(component.discoveredSensor) == -1 );
        }
    },
    {
        name:'Sensors connected?', 
        evalFunc: function( component, parameters )
        {
            if( parameters == undefined ) return;

            var address = parameters.addresses[0];

            if( address == undefined ) return;

            var sensor = component.sensors[address];
            var connectedSensor = component.connectedSensors.indexOf(sensor);

            if( sensor != undefined && connectedSensor != -1 )
            {
                return true;
            }

            return false;
        }
    },
   
];

// =======================================================================================
// Class definition
// =======================================================================================
class SensorServer extends FunctionalComponent
{
    constructor()
    {        
        super( "SensorServer", transitions, choicePoints );

        var component = this;

        this.bleEvents = new events.EventEmitter();
        this.bleEvents.on( 'bleEvent', function(eventName, parameters )
        {
            component.eventHandler( eventName, parameters );
        });

        this.syncingEvents      = new events.EventEmitter();

        // Properties
        this.sensors            = {};
        this.discoveredSensors  = [];
        this.connectedSensors   = [];
        this.measuringSensors   = [];
        this.discoveredSensor   = null;
        this.fileStream         = null;
        this.csvBuffer          = "";
        this.recordingStartime  = 0;
        this.measuringPayloadId = 0;
        this.lastTimestamp      = 0;
        this.lastWriteTime      = 0;
        this.gui                = new WebGuiHandler(this);
        this.ble                = new BleHandler(this.bleEvents, this.syncingEvents, this.gui);
        this.syncManager        = new SyncManager(this.ble, this.gui, this.syncingEvents);
    }
}

// =======================================================================================
// Local functions
// =======================================================================================

// ---------------------------------------------------------------------------------------
// -- Remove sensor --
// ---------------------------------------------------------------------------------------
function removeSensor( sensor, sensorList )
{
    var idx = sensorList.indexOf( sensor );
    if( idx != -1 )
    {
        sensorList.splice( idx, 1 );
    }
}

// ---------------------------------------------------------------------------------------
// -- Start recording to file --
// ---------------------------------------------------------------------------------------
function startRecordingToFile( component, name )
{
    var dataDir = process.cwd() + RECORDINGS_PATH;
    if (!fs.existsSync(dataDir))
    {
        fs.mkdirSync(dataDir);
    }

    var fullPath = dataDir + name + ".csv";

    if (fs.existsSync(fullPath))
    {
        console.log('The logging file exists!');
        return;
    }

    component.fileStream = fs.createWriteStream( fullPath );
    
    const hrTime = process.hrtime();
    component.recordingStartTime = hrTime[0] * 1000000 + hrTime[1] / 1000;
    component.lastWriteTime = component.recordingStartTime;

    component.csvBuffer = "";

    component.fileStream.on( 'open', function() 
    {
        component.eventHandler( 'fsOpen' );
    });

    component.fileStream.on( 'close', function() 
    {
        component.eventHandler( 'fsClose' );
    });

    // Reset parameters

    interval_data = {}
    interval_dataString = {}
    interval_iterations = {}
    

}



// ---------------------------------------------------------------------------------------
// -- Calculate chaos signature of the movement --
// ---------------------------------------------------------------------------------------

function calculateDFA(sensor, interval_data, py_iterations, max_iterations, component, parameters) {

     if (!py[sensor]) {
        py[sensor] = []
     }

     // Create a python process for this sensor 
     py[sensor][py_iterations] = spawn('python', ['dfa.py'])
    
     // We have to stringify the data first otherwise our python process wont recognize it
     py[sensor][py_iterations].stdin.write(JSON.stringify(interval_data[sensor]));

     py[sensor][py_iterations].stdin.end();

     /*Here we are saying that every time our node application receives data 
     from the python process output stream(on 'data'), 
     we want to convert that received data into a string 
     and append it to the overall dataString.*/

     if (!interval_dataString[sensor]) {
         interval_dataString[sensor] = ''
     }

     py[sensor][py_iterations].stdout.on('data', function(data){
         interval_dataString[sensor] = data.toString();
     });

     
      /*Once the stream is done (on 'end') we want to simply log the received data to the console.*/
     py[sensor][py_iterations].stdout.on('end', function(){

       
       
         let alpha_exponent = parseFloat(interval_dataString[sensor])
         let alpha_score = ''
         let alpha_note = ''
         let alpha_result = {}

         alpha_result = getAlphaType(alpha_exponent)

         alpha_score = alpha_result['score']
         alpha_note = alpha_result['note']

        // Display the symbol
        if (terminal_detail == 'all' || terminal_detail == 'sensors') {
         generateConsoleSymbol(sensor, interval_dataString[sensor], alpha_score, null, alpha_note)
        }

        // DEBUG values
        //  console.log('Sensor:',sensor);
        //  console.log('Alpha Component:',parseFloat(interval_dataString[sensor]));
        if (terminal_debug) {
           console.log('based on the array length:', interval_data[sensor].length)
        }
         

         // TODO make another function which sends composite OSC

         interval_data[sensor] = interval_data[sensor].filter((_, i) => i >= max_iterations)

         sendAlphaViaOSC('alpha', sensor, alpha_exponent, alpha_note)

         // Send a global event to inform the UI about the alpha
         component.gui.sendGuiEvent( 'alphaCalculated', {sensor: sensor, alpha: alpha_exponent} );

         // Add alpha to the CSV
        
         parameters['Alpha_Fractal'] = alpha_exponent
         parameters['Alpha_Score'] = alpha_score

         component.csvBuffer += Object.values(parameters).join() + '\n';

          // TODO maybe move that
            //   if (i == 19) {
            //     setTimeout(()=>{
            //         interval_dataString[sensor] = ''
            //     },2000)
            // }


     });

 
     

     // Remove the first 1200 elements from the interval_data array for the next iteration

     

}

// ---------------------------------------------------------------------------------------
// -- Send Alpha via OSC  --
// ---------------------------------------------------------------------------------------


function sendAlphaViaOSC(message, sensor, alpha_exponent, alpha_note, alpha_signal) {

    for (let i = 0; i < 20; i++) {

        setTimeout(()=>{
            osc.send(new OSC.Message('/' + message + '/' + sensor, alpha_exponent), {port: osc_options.open.port, host: osc_options.open.host})
        },50*i)

        setTimeout(()=>{
            osc.send(new OSC.Message('/' + message + '_note/' + sensor, alpha_note), {port: osc_options.open.port, host: osc_options.open.host})
        },50*i)

        if (alpha_signal) {
            setTimeout(()=>{
                osc.send(new OSC.Message('/' + message + '_signal/' + sensor, alpha_signal), {port: osc_options.open.port, host: osc_options.open.host})
            },50*i)
        }
       
     }
}



// ---------------------------------------------------------------------------------------
// -- Calculate the alpha type  --
// ---------------------------------------------------------------------------------------


function getAlphaType(alpha) {

    if (alpha < 0.42) {
        return {score:'random', note: 'A'}
    }
    else if (alpha >= 0.42 && alpha <= 0.63) {
        return  {score:'random', note: 'A'}
    }
    else if (alpha > 0.63 && alpha < 0.90) {
       return  {score:'regular', note: 'B'}
    }
    else if (alpha >= 0.90 && alpha <= 1.10) {
       return {score:'fractal', note: 'C'}
    }
    else if (alpha > 1.10) {
       return {score:'complex', note: 'D'}
    }
}

// ---------------------------------------------------------------------------------------
// -- Display the current state symbol --
// ---------------------------------------------------------------------------------------

function generateConsoleSymbol(sensor_code, alpha_exp, state, message_type, alpha_note, alpha_signal) {

    let a = ''
    
    if (sensor_code == 'AVRG' || sensor_code == 'HIST') {
        a = sensor_code
    }
    else {
        a = "[" + sensor_code.slice(-2) + "]"
    }
    
    let b = "α:" + parseFloat(alpha_exp).toFixed(2)
    let c = ""

    let alpha_sign = ""

    let d = '█'
    if (alpha_note) {
        d = alpha_note
    }

    let s = '█'
    if (alpha_signal) {
        s = alpha_signal
    }

    let m = '     '
    if (message_type) {
        m = ' ' + message_type + ' '
    }


    if (state == 'random') {
        c = 'uniform'
        alpha_sign = "\
        ▐"+d+"   "+m+" ╟▌    \n\
        ▐▌         ╟▌    \n\
        ▐▌ " +c +" ╟▌    \n\
        ▐▌         ╟▌    \n\
        ▐▌         ╟▌    \n\
        ▐▌  "+b +" ╟▌    \n\
        ▐▌         ╟▌    \n\
   ╓▄▄▄▄╫█▄▄▄▄▄▄▄▄▄"+s+"█▄▄▄▄▄\n\
        ▐▌         ╟▌    \n\
        ▐▌   "+a+"  ╟▌    \n\
        ▐█▄▄▄▄▄▄▄▄▄█▌    "
        
    }
    else if (state == 'regular') {
        c = 'regular'
             alpha_sign = "\
             ╟█           \n\
          " + c + "       \n\
             ╟█           \n\
             ╟█           \n\
        █  " +b+"  █      \n\
       "+s+"█▌   ╟█   ▐██     \n\
      █▌ █▌  ╟█  ╓█  █    \n\
     █▌   █▌"+a+" █─  ╙█   \n\
    ██     █▌╟█┌█`    ╟█  \n\
   ▐█       ████▌      █▌ \n\
  ╓█         █"+d+"▌  "+m+" █▌"

    }
    else if (state == 'fractal') {
        c = 'fractl'
        alpha_sign = "\
        ▀█▄ "+m+"▄█▀      \n\
          ▀█▄  ▄█▀        \n\
            ▀██▀          \n\
             "+d+"▌           \n\
             █▌           \n\
            █"+s+"██          \n\
          █▀"+a+"▀█        \n\
  ▄▄▄▄▄▄█▀`       ▀█▄▄▄▄▄▄\n\
       █▌  " +b+"  ▐█\n\
       █▌          ▐█     \n\
       ▀   " +c+"   ▀     "        
    }
    else if (state == 'complex') {
        c = 'complex'
             alpha_sign = "\
    ▀█▄             ▄█▀ \n\
      ▀█▄ "+b +"  ▄█▀   \n\
       ▀█▄      ▄█▀▀▀▀▀ \n\
         ▀█▄  ▄█▀       \n\
           └█"+d+"─         \n\
          " + c + "     \n\
            ╟▌          \n\
            ╟▌          \n\
           "+a+"        \n\
            ╟▌          \n\
        ▄▄█▀"+s+"          \n\
    ▄▄█▀▀╙  "+m+"       "     
    }


    console.log(' ')
    
    console.log(alpha_sign)
    
    console.log(' ')

}


// =======================================================================================
// Export the Sensor Server class
// =======================================================================================
module.exports = SensorServer;