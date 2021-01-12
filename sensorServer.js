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

const options = { open: { port: 49162, host: 'localhost'} }
const osc = new OSC({ plugin: new OSC.DatagramPlugin(options) })

// Activate Python connection
var spawn = require('child_process').spawn

var beep = require('beepbeep')

// Define the Python DFA script to be used
let py = {}
let py_iterations = 0 
let should_restart = true

var interval_data = {}
var interval_dataString = {}
var interval_iterations = 0
var first_time = true



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
                    component.fileStream.write( "Timestamp,Address,Acc_x,Acc_y,Acc_z,Gyr_x,Gyr_y,Gyr_z,Mag_x,Mag_y,Mag_z\n" );
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
              
                // setInterval(() => {
                //    // send these messages to `localhost:11245`
                //    osc.send(new OSC.Message('/response', Math.random()), {port: 4000})
                // }, 1000)
            })
            // console.log('Getting Parameters')
            // console.log(parameters)
            // console.log('Iteration:', interval_iterations)
           
            // TODO don't attach to address, instead the signals go to each sensor code 
            // TODO port set up in the interface
            // TODO change the interface make it easier
            if (parameters.address == 'd4-22-cd-00-03-74') {

                if (!interval_data[parameters.address]) {
                    interval_data[parameters.address] = []
                }
                else {
                    interval_data[parameters.address].push((Math.abs(parameters.acc_x) + Math.abs(parameters.acc_y) + Math.abs(parameters.acc_z))/3)
                }
                
                osc.send(new OSC.Message('/acc_x/2', parameters.acc_x), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/acc_y/2', parameters.acc_y), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/acc_z/2', parameters.acc_z), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/gyr_x/2', parameters.gyr_x), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/gyr_y/2', parameters.gyr_y), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/gyr_z/2', parameters.gyr_z), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/mag_x/2', parameters.mag_x), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/mag_y/2', parameters.mag_y), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/mag_z/2', parameters.mag_z), {port: 49162, host: 'localhost'})

            }
            else if (parameters.address == 'd4-22-cd-00-03-56') {

                if (!interval_data[parameters.address]) {
                    interval_data[parameters.address] = []
                }
                else {
                    interval_data[parameters.address].push((Math.abs(parameters.acc_x) + Math.abs(parameters.acc_y) + Math.abs(parameters.acc_z))/3)
                }
                
                osc.send(new OSC.Message('/acc_x/1', parameters.acc_x), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/acc_y/1', parameters.acc_y), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/acc_z/1', parameters.acc_z), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/gyr_x/1', parameters.gyr_x), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/gyr_y/1', parameters.gyr_y), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/gyr_z/1', parameters.gyr_z), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/mag_x/1', parameters.mag_x), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/mag_y/1', parameters.mag_y), {port: 49162, host: 'localhost'})
                osc.send(new OSC.Message('/mag_z/1', parameters.mag_z), {port: 49162, host: 'localhost'})

            }

             /* Considering we are at 60 Hz we want the DFA check function to load every 20 seconds  
             after the first 40 seconds, so 60 x 40 = 2400 iterations, then 1200 */

             interval_iterations++

             let max_iterations = 1200


             // If we have more than 1 sensor, we multiply this max by the numeber of sensors

             let total_sensors = 1

             if (Object.keys(interval_data).length != 0) {
                 total_sensors = Object.keys(interval_data).length
             }

             // Fix it so that we measure whether to trigger based on the number of values in each sensor

             if (interval_iterations == max_iterations * total_sensors) {
                 
                     if (!first_time) {

                         console.log('Firing the Function on Data')
                         console.log(interval_data)
                        
                         // For each sensor, calculate the Fractal signature

                         for (let sensor in interval_data) {


                            calculateDFA(sensor, interval_data, py_iterations, max_iterations) 
      

                         }

                         py_iterations++

                        

                                        
                     }
                     else {
                         // next time the function will fire
                         first_time = false
                     }
                 
                     // reset counter
                     interval_iterations = 0

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
    interval_iterations = 0
    first_time = true

}



// ---------------------------------------------------------------------------------------
// -- Calculate chaos signature of the movement --
// ---------------------------------------------------------------------------------------

function calculateDFA(sensor, interval_data, py_iterations, max_iterations) {

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

         console.log('Sensor:',sensor);
         console.log('Alpha Component:',parseFloat(interval_dataString[sensor]));
         console.log('based on the array length:', interval_data[sensor].length)
         console.log(' ')
       

         if (interval_dataString[sensor] < 0.42) {
             console.log('negative correlation, mean-reverting')
             
             // beep([0,400,400,1100,1100,400])
         }
         else if (interval_dataString[sensor] >= 0.42 && interval_dataString[sensor] <= 0.58) {
             console.log('random white noise movement, unpredictable')
             // beep(3)
         }
         else if (interval_dataString[sensor] > 0.58 && interval_dataString[sensor] < 0.90) {
             console.log('regular, mundane movement, positive feedback')
             // beep([0,1100,1100,400,400,1100])
         }
         else if (interval_dataString[sensor] > 0.90 && interval_dataString[sensor] < 1.10) {
             console.log('fractal movement, self-similar')
            //  beep(5)
         }
         else if (interval_dataString[sensor] > 1.10) {
             console.log('organized, highly complex (pathological) movement')
             // beep([0,400,400,400,400,400,400,400])
         }

         // TODO make another function which sends composite OSC

         interval_data[sensor] = interval_data[sensor].filter((_, i) => i >= max_iterations)

         for (let i = 0; i < 20; i++) {

            setTimeout(()=>{
                osc.send(new OSC.Message('/alpha/' + sensor, parseFloat(interval_dataString[sensor])), {port: 49162, host: 'localhost'})
            },50*i)

            if (i == 19) {
                setTimeout(()=>{
                    interval_dataString[sensor] = ''
                },2000)
            }
         }

     });

 
     

     // Remove the first 1200 elements from the interval_data array for the next iteration

     

}

// =======================================================================================
// Export the Sensor Server class
// =======================================================================================
module.exports = SensorServer;