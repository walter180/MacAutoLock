'use strict';
const noble = require('noble');
const execFileSync = require('child_process').execFileSync;
const settings = require('./settings');

const handlers = {
    poweredOn: () => { 
        console.log('Starting scan');
        checkPresent();
    },
}

const defaultHandler = (stateStr) => console.log('Unexpected event', stateStr);

noble.on('stateChange', (stateStr) => {
    console.log('Got state', stateStr);
    handlers[stateStr](stateStr);
    console.log('Handled state', stateStr);
});

var autoWoke = false;
var consecutiveFailures = 0;

const CHECK_AWAY_MS = 5000; // must be larger than wait away
const CHECK_PRESENT_MS = 1000;

function getNormalizedFailures() {
    const checkSeconds = (CHECK_PRESENT_MS / 1000);
    const awayProb = consecutiveFailures / (20 - checkSeconds);
    console.log('away prob', awayProb);
    return awayProb;
}

const NORMALIZED_FAIL_THRESHOLD = 1;

(function checkAway() {
    console.log('Checking AFK');
    if(getNormalizedFailures() > NORMALIZED_FAIL_THRESHOLD && autoWoke === true) {
        console.log('User AFK');
        console.log('Sleeping screen');
        execFileSync('scripts/sleepScreen.sh');
        autoWoke = false;
    } 
    setTimeout(checkAway, CHECK_AWAY_MS);
})();

var trackedPeripherals = {};

function handlePresent() {
    autoWoke = true;
    consecutiveFailures = 0;
    console.log('User present');
    execFileSync('scripts/wakeScreen.sh');
    noble.stopScanning();
}

function getActivePeripherals() {
    return Object.keys(trackedPeripherals)
    .map((address) => {
        return trackedPeripherals[address];
    })
    .filter((state) => state);
}


function checkPresent() {
    console.log('Checking if present', trackedPeripherals);
    const connected = getActivePeripherals(); 
    if(connected.length > 0) {
        console.log('devices still connected', connected);
        handlePresent();
    } else {
        consecutiveFailures++;
        noble.startScanning();
    }
    setTimeout(checkPresent, 1000);
} 

function trackPeripheral(peripheral) {
    const {address, state} = peripheral;
    if(state === 'disconnected') {
        trackedPeripherals[address] = false;
        peripheral.connect((err) => { if(err) { throw err; }});
        peripheral.once('connect', () => {
            console.log('Peripheral connected');
            trackedPeripherals[address] = true;
            handlePresent();
        });
    } else if (state === 'connected') {
        console.log('peripheral already connected');
        trackedPeripherals[address] = true;
    }
    peripheral.once('disconnect', () => {
        console.log('Peripheral disconnected');
        trackedPeripherals[address] = false;
        console.log(trackedPeripherals);
        trackPeripheral(peripheral);
    });
    peripheral.discoverAllServicesAndCharacteristics((services, characteristics) => {
        console.log('Services', services);
        console.log('Characteristics', characteristics);
    });
}

noble.on('discover', (peripheral) => {
    const {address} = peripheral;
    const matchingDevices = settings.triggerAddrs.filter((triggerAddr) => triggerAddr === address);
    if(matchingDevices.length > 0) {
        trackPeripheral(peripheral);
        handlePresent(peripheral);
    }
});
