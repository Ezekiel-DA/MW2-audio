const SerialPort = require('serialport')

let port = new SerialPort('COM9')

function sendAndPrepNext (msg) {
  port.write(`${msg}\n`)
  setTimeout(sendAndPrepNext.bind(null, msg), Math.random()*300)
}

sendAndPrepNext('startup')
sendAndPrepNext('horn')
