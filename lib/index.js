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

function handleAway() {
    console.log('User AFK');
    if(autoWoke === true) {
        execFileSync('scripts/sleepScreen.sh');
        console.log('Sleeping screen');
        autoWoke = false;
    } else {
        console.log('User woke manually');
    }
}

const WAIT_AWAY_MS = 40 * 1000;
const CHECK_AWAY_MS = WAIT_AWAY_MS * 3; // must be larger than wait away
var awayTimeout = null;

var trackedPeripherals = {};

function handlePresent() {
    autoWoke = true;
    if(awayTimeout) {clearInterval(awayTimeout);}
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
    if(awayTimeout) { clearInterval(awayTimeout); }
    const connected = getActivePeripherals(); 
    if(connected.length > 0) {
        console.log('devices still connected', connected);
        handlePresent();
    } else {
        noble.startScanning();
        noble.on('scanStart', () => {
            awayTimeout = setTimeout(handleAway, WAIT_AWAY_MS);
        });
    }
    setTimeout(checkPresent, CHECK_AWAY_MS);
} 

function trackPeripheral(peripheral) {
    const {address, state} = peripheral;
    if(state === 'disconnected') {
        peripheral.connect((err) => { if(err) { throw err; }});
        peripheral.once('connect', () => {
            console.log('Peripheral connected');
            trackedPeripherals[address] = true;
            handlePresent();
        });
    } else {
        trackedPeripherals[address] = true;
    }
    peripheral.once('disconnect', () => {
        console.log('Peripheral disconnected');
        trackedPeripherals[address] = false;
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
