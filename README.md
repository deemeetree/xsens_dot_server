# EightOS xSens Fractal Control
This modification of Xsens DOT Server records a signal from xSens DOT sensors (logging it to a CSV file) and sends it via the OSC signal to the specified port / host. 

It will also apply Detrended Fluctuation Analysis to the signal (currently, the average of all acceleration signals on each sensor) and calculate its according Alpha exponent, which shows how fractal the signal is. 

The Alpha exponent at around 0.5 indicates random walk (sensor in an idle state), between 0.6 and 0.9 is a positively correlated signal, betweeen 0.9 and 1.1 the signal has fractal (self-similar, scale-free) properties, more than 1.1 is a complex signal where the bigger is the scale, the higher are the deviations and they are not scale-free. 

In EightOS we aim to go through various Alpha exponents in a movement session, so that both the individuals and the group can experience all the different states (randomness, positive correlation, fractality, and disruption). It relates to the variability principle described on [EightOS.IO](https://8os.io) in more detail. 




## XSens Overview
Xsens DOT Server is a simple web server that can scan, connect and start measurement with Xsens DOT on Windows, macOS and Raspberry Pi. The system is built using Node.js in combination with [Noble](https://github.com/abandonware/noble). 

**Functions**
* Scan sensor
* Connect sensor
* Synchronization
* Real-time streaming - While you can get all measurement modes (exclude high fidelity modes), 6 modes are currently supported in Xsens DOT Server:
  * Complete (Euler)
  * Extended (Quaternion)
  * Rate quantities (with mag)
  * Custom mode 1
  * Custom mode 2
  * Custom mode 3
* Data logging
* Heading reset
* OSC streaming

Get more information about Xsens DOT in [Develepor Page](https://www.xsens.com/developer) and [Base](https://base.xsens.com/hc/en-us/categories/360002285079-Wearable-Sensor-Platform).

## Important Notices
* Disconnect all Bluetooth peripherals (mouse, keyboard) before start Xsens DOT Server to ensure stable Bluetooth connections. 
* Firmware support:
  * v1.6.0

## Documentation
* [System Architecture](https://github.com/xsens/xsens_dot_server/blob/master/documentation/Xsens%20DOT%20Server%20-%20System%20Architecture.pdf): system architecture of Xsens DOT Server.
* [Sensor Server](https://github.com/xsens/xsens_dot_server/blob/master/documentation/Xsens%20DOT%20Server%20-%20Sensor%20Server.pdf): application and workflow control.
* [BLE Handler](https://github.com/xsens/xsens_dot_server/blob/master/documentation/Xsens%20DOT%20Server%20-%20BLE%20Handler.pdf): creates an abstraction from the BLE protocol.
* [Web GUI Handler](https://github.com/xsens/xsens_dot_server/blob/master/documentation/Xsens%20DOT%20Server%20-%20Web%20GUI%20Handler.pdf): the web server
* [Noble](https://github.com/noble/noble): Node package that implements an interface with the BLE radio (i.e. driver).
* [Web Client](https://github.com/xsens/xsens_dot_server/blob/master/documentation/Xsens%20DOT%20Server%20-%20Web%20Client.pdf): a web browser that can run on any computer on the local network and that renders an HTML page that implements the GUI.

## Set up the environment
* [Windows](#set-up-on-windows)
* [macOS](#set-up-on-macos)
* [Rasberry Pi](#set-up-on-raspberry-pi)

### Set up on Windows
#### Prerequisites
* Windows 10, Windows 7
* Compatible Bluetooth 4.0 USB adapter or above
* Recommend to use Chrome or Firefox 

#### Install the following tools
* Install Python 3.8.3 from the [Micfrosoft Store package](https://docs.python.org/3/using/windows.html#the-microsoft-store-package) 
* Install [Node.js-v12.16.2-x64](https://nodejs.org/download/release/v12.16.2/node-v12.16.2-x64.msi)
  * Keep clicking **Next** to complete the installation.
  * Enter `npm -v` in command prompt to check if the installation is successful.<br>
&nbsp;<img height="60" src="images/image002.gif"/>

* Install [node-gyp](https://github.com/nodejs/node-gyp#installation)
   ```sh
   npm install -g node-gyp
   ```
* Install all the required tools and configurations using Microsoft's [windows-build-tools](https://github.com/felixrieseberg/windows-build-tools) from an elevated PowerShell or CMD.exe (run as Administrator)
   ```sh
   npm install --global --production windows-build-tools
   ```
* Install [Zadig](https://zadig.akeo.ie/) to setup WinUSB driver:
  * Find Bluetooth adapter inforamtion in Device Manager <br>
&nbsp;<img height="250" src="images/image006.gif"/>
  * Open Zadig, goto **Options**, enable "**List All Devices**"
  * Find your Bluetooth adapter, change the driver to **WinUSB**. Then click **Replace Driver** <br>
&nbsp;<img height="200" src="images/image007.gif"/>

  * Note: please retry several times if the intallation fails. Or restart the computer and try again. 


### Set up on macOS
#### Install following tools
* Install [Xcode](https://apps.apple.com/ca/app/xcode/id497799835?mt=12) 
* Install [node.js 8.9.4](https://nodejs.org/download/release/v8.9.4/)
  * You can install [*n*](https://www.npmjs.com/package/n) package to easily manage Node.js versions.

**Note**: For some operating systems (e.g. macOS), the address is not available unless a connection has been established first. If this is the case, the address of the peripheral is set to a counter. This address will be used until the server is restarted and the sensor is discovered again.

### Set up on Raspberry Pi
#### Prerequisites
* Raspberry Pi 4 Model B 4GB RAM / Raspberry Pi 3 Model B+, 1 GB RAM
* Install [Raspberry Pi OS](https://www.raspberrypi.org/downloads/raspberry-pi-os/)

#### Installation steps
* Install dependcies 
  ```sh
  sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
  sudo apt-get install build-essential checkinstall libssl-dev
  ```

* Download Node.js 8.x: 
  ```sh
  curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
  ```
 * Install `npm`:
   ```sh
   sudo apt-get install npm
   ```
 * Install Node.js 8.x: 
   ```sh
   sudo npm install -g n
   sudo n 8.11.1
   node -v
   ```

## Run Xsens DOT Server

===
BEFORE YOU RUN IT FOR THE FIRST TIME
===

0. Open Terminal

1. Clone repository
   ```sh
   git clone https://github.com/deemeetree/xsens_dot_server.git
   ```
2. Enter Xsens DOT Server project `cd ./xsens_dot_server` 
   
3. Install the dependency packages `npm install`
   
4. Install the required Python packages using Conda (python package management) or directly:

a. If you're doing it on a Mac or Windows, go to the https://www.anaconda.com/products/individual and download it to your computer and follow the installation instructions

b. On Raspberry P you have two ways: b.1 — [APT-GET](https://stackoverflow.com/questions/52240336/conda-problem-on-rp3-could-not-find-some-dependencies-for-package-blas-op) or b.2 — [MINICONDA](https://stackoverflow.com/questions/39371772/how-to-install-anaconda-on-raspberry-pi-3-model-b). The `apt-get` way is easier. You just have to do:

```
sudo apt-get install python-numpy python-scipy python-pandas python-matplotlib
```

5. If you used Conda or Miniconda, activate the correct environment:
   ```
   conda create -n eightos numpy pandas matplotlib scipy
   ```
   then 
   ```
   conda activate eightos
   ```

If the current conda (python) environment is set to eightos OR if you installed the Python packages via `apt-get`, you can now run the application

===
TO RUN THE APPLICATION
===

0. Make sure you are in the Terminal or open it on your computer.

1. Make sure you are in the `xsens-dot-server` folder. If not, go to that folder:
   ```
   cd xsens-dot-server
   ```

2. Run Xsens DOT Server
   * Windows and macOS: `node xsensDotServer`
   * Raspberry Pi: `sudo node xsensDotServer`
  
   If everything is good, the Terminal will show you the host address for the application
  
3. Open Xsens DOT server in browser
   * Run http://localhost:8080/ or http://127.0.0.1:8080/ you are able to use Xsens DOT Server

4. Map OSC port as necessary (port / host)

5. Click `Start Scanning`

6. Connect to the Sensors

7. Click `Start Streaming`


===
ALPHA LOGIC AND OSC NOTES
===

## Alpha Values and OSC Notes

There are *4 states* of the Alpha possible. They are calculated for each separate sensor and for all the sensors at the same time every 30 seconds. 

The value (usually ~0.3 to 1.5 max) is sent to the OSC `/alpha/sensor_id` channel every 30-40 seconds, where `sensor_id` is the ID of the sensor.

--

1. alpha <= 0.60 (Note: A) UNIFORM / RANDOM
Repetitive, Uniform, Random Movement (0/1, up/down, left/right). Also when the sensors are on the table, not moving

![](/images/alphas/random-black.png "InfraNodus Interface")

--

2. alpha > 0.60 && alpha < 0.90 (Note: B) REGULAR
Regular movement (e.g. standard dancing, doing stuff, walking). Most of the time we are here

![](/images/alphas/regular-black.png "InfraNodus Interface")

--

3. alpha >= 0.90 && alpha <= 1.10 (Note: C) FRACTAL
Fractal movement — this is what we're looking for - variative movement, butoh, adaptive movement.

![](/images/alphas/fractal-black.png "InfraNodus Interface")

--

4. alpha > 1.10 (Note: D) COMPLEX
Complex movements with phase shifts — changing patterns of movement.

![](/images/alphas/complex-black.png "InfraNodus Interface")

--

### OSC Note

This same signal also sends the state via the OSC `/alpha_note/sensor_id` channel. 

A for random (1), B for regular (2), C for fractal (3), D for complex (4)

--


## Average Alpha For All Sensors

An average alpha is also calculated for all the sensors, so we can see the state of the whole system (all the dancers or all the body parts) at every point of time.

The alpha is sent to 

`/alpha_avrg/all`. 

The OSC note (as above - A, B, C or D) is sent to 

`/alpha_avrg_note/all`.

In terminal it's called SENSOR AVERAGE ALPHA

--

## Historical Alphas and OSC Notes


### For Each Sensor

For each sensor we also calculate the historical Alpha that shows how the state evolved over time. 

For this we take the last 3 states of that sensor, calculate an average of those last 3 states, and send the Alpha to 

`/alpha_history/sensor_id` 

as well as the OSC note (A, B, C or D) to 

`/alpha_history_note/sensor_id` where `sensor_id` is the sensor. 


### For All Sensors

We also calculate the global historical state for all the sensors. 

For that, we take the last 3 global states (last 3 **Average** states of the system) and calculae the Alpha for all those states. This Alpha is sent to 

`/alpha_history/all`

--

## Special Recommendation Signal

Finally, each historical state can have more than 4 states, because we are dealing with the combination of the last 3 states. 

So that means that it could be, for example, ABC, but also BBC and so on. 

This is why there are more values for Historical notes than for the standard alpha states. Because we have more possible states. 

We also use it to provide an advice: based on the last 3 states (regular, fractal, random or complex) what you should do next. 

--

This can be sent as as **Note** to `/alpha_history_note/sensor_id` for each sensor and `/alpha_history_note/all` for all the sensors.

THIS NOTE CAN HAVE VALUES FROM `E` to `V` (in alphabetical order) - LOTS OF VARIETY - 18 states

--

And as a **Signal** (less options) to `/alpha_history_signal/sensor_id` for each sensor and `/alpha_history_signal/all` for all the sensors.

THE SIGNAL HAS LESS VARIETY: `V`, `L`, `R`, `F`, `W`, `S`, `T`, `M` -  8 states

We also provide an advice for the next action based on this logic. The advice is encoded via the OSC **Signal** code above.

This advice is also displayed in the Terminal and in the Browser.

--

We have total 18 combinations and the logic is as follows:

1. ALL LAST 3 STATES ARE RANDOM / UNIFORM
      
advice: 'VARIATE' | note: 'E' | signal: 'V'
        
2. ALL LAST 3 STATES ARE REGULAR 
   
advice: 'FRACTALIZE' | note: 'F' | signal = 'F'

3.  ALL LAST 3 STATES ARE FRACTAL
   
advice: 'LOOP' | note: 'G' | signal: 'L'

4. ALL LAST 3 STATES ARE COMPLEX

advice: 'RELAX' | note: 'H' | signal: 'R'

More logic is exemplified below. We analyze the last two states to know where the history is coming to and the first two states to know where it's coming from. Based on that we decide on the advice to give. 

```
    else if (last_two == 'random') {
        cum_score_advice = 'MAINTAIN'
        cum_note = 'I'
        cum_signal = 'M'
    }
    else if (first_two == 'random') {
        cum_score_advice = 'LOOP OR VARIATE'
        cum_note = 'J'
        cum_signal = 'W'
    }
    else if (last_two == 'regular') {
        cum_score_advice = 'MAINTAIN'
        cum_note = 'K'
        cum_signal = 'M'
    }
    else if (first_two == 'regular') {
        cum_score_advice = 'MAINTAIN'
        cum_note = 'L'
        cum_signal = 'M'
    }
    else if (last_two == 'fractal') {
        cum_score_advice = 'FRACTALIZE'
        cum_note = 'N'
        cum_signal = 'F'
    }
    else if (first_two == 'fractal') {
        cum_score_advice = 'VARIATE'
        cum_note = 'O'
        cum_signal = 'V'
    }
    else if (last_two == 'complex') {
        cum_score_advice = 'DISRUPT'
        cum_note = 'P'
        cum_signal = 'T'
    }
    else if (first_two == 'complex') {
        cum_score_advice = 'VARIATE'
        cum_note = 'Q'
        cum_signal = 'V'
    }
    else if (counts_alpha['random'] == 2 && last_two != 'random' && first_two != 'random') {
        cum_score_advice = 'CHOOSE'
        cum_note = 'R'
        cum_signal = 'S'
    }
    else if (counts_alpha['regular'] == 2 && last_two != 'regular' && first_two != 'regular') {
        cum_score_description = 'unstable regular'
        cum_score_advice = 'LOOP OR VARIATE'
        cum_note = 'S' 
        cum_signal = 'W'
    }
    else if (counts_alpha['fractal'] == 2 && last_two != 'fractal' && first_two != 'fractal') {
        cum_score_description = 'unstable fractal'
        cum_score_advice = 'FRACTALIZE'
        cum_note = 'T'
        cum_signal = 'F'
    }
    else if (counts_alpha['complex'] == 2 && last_two != 'complex' && first_two != 'complex') {
        cum_score_description = 'unstable complex'
        cum_score_advice = 'DISRUPT'
        cum_note = 'U'
        cum_signal = 'T'
    }
    else {
        cum_score_description = 'diverse'
        cum_score_advice = 'FRACTALIZE'
        cum_note = 'V'
        cum_signal = 'F'
    }
```


-- 
 

# Known issues
1. [Connection] Unable to connect sensors in Mac with Bluetooth 5.0.
2. [Connection] Connection with firmware 1.3.0 sensors may fail in Windows. You can:
   * use firmware 1.0.0
   * or use a Bluetooth dongle which support 4.0 or above. Refer to [Add Bluetooth adapter](#add-bluetooth-adapter) to configure your Bluetooth dongle.

--

# Troubleshooting
### Add Bluetooth adapter
If you encounter `Error: No compatible USB Bluetooth 4.0 device found!` when try to run Xsens DOT Sever on Windows, it means you need to add your Bluetooth adapter to the USB device list:
 1. Open Device Manager, find the VID and PID of your Bluetooth adapter.<br>
&nbsp;<img height="300" src="images/image011.gif"/>
 2. Open source code: *xsens_dot_server\node_modules\bluetooth-hci-socket\lib\usb.js*
 3. Add Bluetooth VID & PID in usb.js (line 66), save and close.<br>
&nbsp;<img height="80" src="images/image012.gif"/>
 4. Run Xsens DOT Server again.
 
 #### Reinstall Bluetooth adapter
 After replacing the Bluetooth adapter with WinUSB driver, you cannot connect to Bluetooth devices with your PC. Here is the way to reinstall the Bluetooth adapter:
  1. Go to **Device Manager** -> **Universal Serial Bus devices**
  2. Find your converted WinUSB driver and uninstall
  3. In **Device Manager**, go to **Action** (top menu), then **Scan for hardware changes** and let it reinstall
  4. You should able to find your Bluetooth adapter back in **Bluetooth**.

## Bug reports and feedback
All feedback is welcome and helps us to improve!

Please report all bugs by [rasing an issue](https://github.com/xsens/xsens_dot_server/issues/new).

You can also raise app development questions and feature requests of Xsens DOT in our [Community Forum](https://base.xsens.com/hc/en-us/community/topics).
