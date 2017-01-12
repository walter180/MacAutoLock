const noble = require('noble');
const settings = require('./settings');
const execFileSync = require('child_process').execFileSync;

const handlers = {
    poweredOn: () => { 
        console.log('Starting scan');
        noble.startScanning(); 
    },
}

const defaultHandler = (stateStr) => console.log('Unexpected event', stateStr);

noble.on('stateChange', (stateStr) => {
    console.log('Got state', stateStr);
    handlers[stateStr](stateStr);
    console.log('Handled state', stateStr);
});

function handleAway() {
    console.log('Peripheral disconnected');
    const sleepOutput = execFileSync('scripts/sleepScreen.sh');
    console.log('Sleeping screen ' + sleepOutput);
    noble.startScanning();
}

function handlePresent(peripheral) {
    const wakeOutput = execFileSync('scripts/wakeScreen.sh');
    console.log('Woke screen: ' + wakeOutput);
    noble.stopScanning();
    const {state} = peripheral;
    if(state === 'disconnected') {
        peripheral.connect((err) => {
            if(err) { throw err; }
            console.log('Connected to peripheral');
        });
    }
    peripheral.once('disconnect', handleAway);
}

noble.on('discover', (peripheral) => {
    const {address} = peripheral;
    console.log('peripheral', peripheral);
    const matchingDevices = settings.triggerAddrs.filter((triggerAddr) => triggerAddr === address);
    if(matchingDevices.length > 0) {
        handlePresent(peripheral);
    }
});
