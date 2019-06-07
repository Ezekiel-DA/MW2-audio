const AudioContext = require('web-audio-engine').StreamAudioContext
const Speaker = require('speaker')
const fs = require('fs')
const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

const maxSpeed = 2.5
const minSpeed = 0.5

const lerp = (v0, v1, t) => v0 * (1 - t) + v1 * t

let commandValue = 0.0

let startupSoundEffect = { file: 'lightcycle-startup.wav' }
let hornSoundEffect = { file: 'lightcycle-horn.wav' }

let port = new SerialPort('/dev/ttyACM0', err => {
  if (err) {
    console.log('Serial connection failed, aborting')
    process.exit(1)
  }
})
const parser = port.pipe(new Readline())

async function playSoundEffect (context, soundEffectObject, gain) {
  if (!soundEffectObject.buffer) {
    soundEffectObject.buffer = await context.decodeAudioData(fs.readFileSync(soundEffectObject.file))
  }

  if (soundEffectObject.playing) {
    return
  }
  soundEffectObject.playing = true

  let effectSource = context.createBufferSource()
  effectSource.buffer = soundEffectObject.buffer
  let gainNode = context.createGain()
  effectSource.connect(gainNode).connect(context.destination)
  gainNode.gain.setValueAtTime(gain || 1, context.currentTime)
  effectSource.start()
  effectSource.onended = () => { soundEffectObject.playing = false }
}

async function main () {
  let context = new AudioContext()
  context.pipe(new Speaker({ channels: 2, bitDepth: 16, sampleRate: 44100 }))
  context.resume()

  let engineSource = context.createBufferSource()
  let gainNode = context.createGain()
  gainNode.gain.setValueAtTime(0.0001, 0)
  engineSource.buffer = await context.decodeAudioData(fs.readFileSync('lightcycle-engine.wav'))
  engineSource.loop = true
  engineSource.playbackRate.setValueAtTime(lerp(minSpeed, maxSpeed, commandValue), context.currentTime)
  engineSource.playbackRate.value = minSpeed
  engineSource.connect(gainNode).connect(context.destination)
  engineSource.start()

  let muted = true

  setInterval(() => {
    if (commandValue < 0.1 && !muted) {
      gainNode.gain.setTargetAtTime(0.0001, context.currentTime, 0.25)
      muted = true
    } else if (commandValue > 0.1 && muted) {
      gainNode.gain.exponentialRampToValueAtTime(1, context.currentTime + 1)
      muted = false
    }
    let target = lerp(minSpeed, maxSpeed, commandValue)
    engineSource.playbackRate.exponentialRampToValueAtTime(target, context.currentTime+0.005)
  }, 32)

  parser.on('data', val => {
    let parsedVal = Number(val)
    if (Number.isInteger(parsedVal)) {
      commandValue = Number(val) / 100
    } else {
      switch(val.trim()) {
        case 'horn':
          playSoundEffect(context, hornSoundEffect, 0.5)
          break;
        case 'startup':
          playSoundEffect(context, startupSoundEffect, 3)
          break;
      }
    }
  })

  port.on('close', () => {
    console.log('Serial disconnect detected, aborting')
  })
  port.on('disconnect', () => {
    console.log('Serial disconnect detected, aborting')
  })
}

main()
