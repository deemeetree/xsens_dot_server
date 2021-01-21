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

The steps below should only be performed once

1. Clone repository
   ```sh
   git clone https://github.com/xsens/xsens_dot_server.git
   ```
2. Enter Xsens DOT Server project `cd ./xsens_dot_server` and install the dependency package `npm install`
3. Install conda (python package management) and activate the correct environment
   ```
   conda create -n eightos numpy matplotlib scipy
   ```
   then 
   ```
   conda activate eightos
   ```

If the current conda (python) environment is set to eightos, the below should work fine:

4. Run Xsens DOT Server
   * Windows and macOS: `node xsensDotServer`
   * Raspberry Pi: `sudo node xsensDotServer`
  
5. Open Xsens DOT server in browser
   * Run http://localhost:8080/ or http://127.0.0.1:8080/ you are able to use Xsens DOT Server!

## Known issues
1. [Connection] Unable to connect sensors in Mac with Bluetooth 5.0.
2. [Connection] Connection with firmware 1.3.0 sensors may fail in Windows. You can:
   * use firmware 1.0.0
   * or use a Bluetooth dongle which support 4.0 or above. Refer to [Add Bluetooth adapter](#add-bluetooth-adapter) to configure your Bluetooth dongle.

## Troubleshooting
#### Add Bluetooth adapter
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
