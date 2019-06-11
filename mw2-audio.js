const AudioContext = require('web-audio-engine').StreamAudioContext
const Speaker = require('speaker')
const fs = require('fs')
const os = require('os')
const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

const maxSpeed = 2.5
const minSpeed = 0.5

const lerp = (v0, v1, t) => v0 * (1 - t) + v1 * t

let commandValue = 0.0

class SoundEffect {
  constructor (context, file) {
    this.context = context
    this.bufferPromise = fs.promises.readFile(file).then(audioData => context.decodeAudioData(audioData))
  }

  async play (gain) {
    if (this.playing) {
      return
    } else {
      this.playing = true
    }

    let effectSource = this.context.createBufferSource()
    effectSource.onended = () => { this.playing = false }
    effectSource.buffer = await this.bufferPromise
    let individualGainNode = this.context.createGain()
    effectSource.connect(individualGainNode).connect(this.context.destination)
    individualGainNode.gain.setValueAtTime(gain || 1, this.context.currentTime)
    effectSource.start(this.context.currentTime + 0.001) // small offset to work around a timing bug in Web-Audio-Engine?
  }
}

let port = new SerialPort(os.platform() === 'linux' ? '/dev/ttyACM0' : 'COM8', err => {
  if (err) {
    console.log('Serial connection failed, aborting')
    process.exit(1)
  }
})
const parser = port.pipe(new Readline())

async function main () {
  let context = new AudioContext()
  context.pipe(new Speaker({ channels: 2, bitDepth: 16, sampleRate: 44100 }))
  context.resume()

  let startupSoundEffect = new SoundEffect(context, 'lightcycle-startup.wav')
  let hornSoundEffect = new SoundEffect(context, 'lightcycle-horn.wav')
  let bootSoundEffect = new SoundEffect(context, 'boot.wav')

  let engineSource = context.createBufferSource()
  let gainNode = context.createGain()
  gainNode.gain.setValueAtTime(0.0001, context.currentTime)
  engineSource.buffer = await context.decodeAudioData(fs.readFileSync('lightcycle-engine.wav'))
  engineSource.loop = true
  engineSource.playbackRate.setValueAtTime(lerp(minSpeed, maxSpeed, commandValue), context.currentTime)
  engineSource.playbackRate.value = minSpeed
  engineSource.connect(gainNode).connect(context.destination)
  engineSource.start()

  bootSoundEffect.play(0.5)

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
    engineSource.playbackRate.exponentialRampToValueAtTime(target, context.currentTime + 0.005)
  }, 32)

  parser.on('data', val => {
    let parsedVal = Number(val)
    if (Number.isInteger(parsedVal)) {
      commandValue = Number(val) / 100
    } else {
      switch (val.trim()) {
        case 'horn':
          hornSoundEffect.play(0.5)
          break
        case 'startup':
          startupSoundEffect.play(3)
          break
      }
    }
  })

  port.on('close', () => {
    console.log('Serial disconnect detected, aborting')
    process.exit(1)
  })
  port.on('disconnect', () => {
    console.log('Serial disconnect detected, aborting')
    process.exit(1)
  })
}

main()
