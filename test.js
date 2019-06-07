const AudioContext = require('web-audio-engine').StreamAudioContext
const Speaker = require('speaker')
const fs = require('fs')

let startupSoundEffect = { file: 'lightcycle-startup.wav' }

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

  playSoundEffect(context, startupSoundEffect, 0.5)  
}

main()
