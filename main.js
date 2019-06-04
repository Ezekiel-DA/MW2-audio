const AudioContext = require('web-audio-engine').StreamAudioContext
const Speaker = require('speaker')
const iohook = require('iohook')
const fs = require('fs')

const maxSpeed = 2.5
const minSpeed = 0.5

const lerp = (v0, v1, t) => v0 * (1 - t) + v1 * t
const clamp = (min, max) => (value) => value < min ? min : value > max ? max : value

const step = 0.025
let commandValue = 0.0

let startupSoundEffect = { file: 'lightcycle-startup.wav' }
let hornSoundEffect = { file: 'lightcycle-horn.wav' }

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
  gainNode.gain.setValueAtTime(0.01, 0)
  engineSource.buffer = await context.decodeAudioData(fs.readFileSync('lightcycle-engine.wav'))
  engineSource.loop = true
  engineSource.playbackRate.setValueAtTime(lerp(minSpeed, maxSpeed, commandValue), 0)
  engineSource.playbackRate.value = minSpeed
  engineSource.connect(gainNode).connect(context.destination)
  engineSource.start()

  let muted = true

  setInterval(() => {
    if (commandValue === 0.0 && !muted) {
      gainNode.gain.setTargetAtTime(0.01, context.currentTime, 0.25)
      muted = true
    } else if (commandValue !== 0.0 && muted) {
      gainNode.gain.exponentialRampToValueAtTime(1, context.currentTime + 1)
      muted = false
    }
  }, 100)

  iohook.on('keyup', e => {
    let current = engineSource.playbackRate.value

    switch (e.rawcode) {
      case 32: // spacebar
        playSoundEffect(context, startupSoundEffect, 3)
        break
      case 72: // h
        playSoundEffect(context, hornSoundEffect, 0.5)
        break
      case 38: // up arrow
        commandValue = clamp(0, 1)(commandValue + step)

        // engineSource.playbackRate.cancelScheduledValues(0)
        // engineSource.playbackRate.setValueAtTime(current, 0)
        engineSource.playbackRate.value = current
        break
      case 40: // down arrow
        commandValue = clamp(0, 1)(commandValue - step)

        // engineSource.playbackRate.cancelScheduledValues(0)
        // engineSource.playbackRate.setValueAtTime(current, 0)
        engineSource.playbackRate.value = current
        break
    }

    let target = lerp(minSpeed, maxSpeed, commandValue)
    // engineSource.playbackRate.exponentialRampToValueAtTime(target, 10)
    engineSource.playbackRate.setValueAtTime(target, 0)
  })

  iohook.start()
}

main()
