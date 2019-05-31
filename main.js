const AudioContext = require('web-audio-engine').StreamAudioContext
const Speaker = require('speaker')
const iohook = require('iohook')
const fs = require('fs')

const maxSpeed = 2.5
const minSpeed = 0.5
const rampTime = 15

const lerp = (v0, v1, t) => v0 * (1 - t) + v1 * t
const unlerp = (v0, v1, x) => (x - v0) / (v1 - v0)
const clamp = (min, max) => (value) => value < min ? min : value > max ? max : value
const equalEpsilon = (x, y) => Math.abs(x - y) < Number.EPSILON

const step = 0.01
let commandValue = 0.5
function readCommandValue () {
  //return commandValue
  return 1
}

async function main () {
  let context = new AudioContext()

  context.pipe(new Speaker({ channels: 2, bitDepth: 16, sampleRate: 44100 }))
  context.resume()

  let source
  let gainNode = context.createGain()

  context.decodeAudioData(fs.readFileSync('engine.wav'), audioBuffer => {
    source = context.createBufferSource()
    source.buffer = audioBuffer
    source.loop = true
    source.playbackRate.setValueAtTime(minSpeed, 0)
    source.connect(gainNode)
    gainNode.connect(context.destination)
    source.start()
  })

  // let lastStepTime = process.hrtime.bigint()

  setInterval(() => {
    if (!source) {
      return
    }

    let commandValue = readCommandValue()
    // let currentValue = unlerp(minSpeed, maxSpeed, source.playbackRate.value)
    // let ramp
    // if (equalEpsilon(currentValue, commandValue)) {
    //   lastStepTime = process.hrtime.bigint()
    //   ramp = 1.0
    // } else {
    //   let elapsed = Number(process.hrtime.bigint() - lastStepTime)
    //   ramp = clamp(0.0, 1.0)(elapsed / (rampTime * 1000000))
    // }
    // source.playbackRate.value = lerp(minSpeed, maxSpeed, commandValue * ramp)
    source.playbackRate.linearRampToValueAtTime(lerp(minSpeed, maxSpeed, commandValue), 2)
  }, 100)

  iohook.on('keydown', e => {
    // e.rawcode: up arrow 38, down arrow 40, spacebar 32
    switch (e.rawcode) {
      case 32: // spacebar
        // playStartSound()
        break
      case 38: // up arrow
        commandValue = clamp(0, 1)(commandValue + step)
        break
      case 40: // down arrow
        commandValue = clamp(0, 1)(commandValue - step)
        break
    }
  })

  //iohook.start()
}

main()
