'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import './page-voice-reader.css'

const STORAGE_VOICE = 'dqa-voice-reader-voice-uri'
const STORAGE_RATE = 'dqa-voice-reader-rate'
const PREVIEW_TEXT = 'Hello. This is how I will read your out-brief narrative.'

function sortVoices(voices) {
  return [...voices].sort((a, b) => {
    const aEn = a.lang.toLowerCase().startsWith('en')
    const bEn = b.lang.toLowerCase().startsWith('en')
    if (aEn !== bEn) return aEn ? -1 : 1
    const langCmp = a.lang.localeCompare(b.lang)
    if (langCmp !== 0) return langCmp
    return a.name.localeCompare(b.name)
  })
}

function groupVoicesByLang(voices) {
  const groups = {}
  for (const voice of voices) {
    const lang = voice.lang || 'unknown'
    if (!groups[lang]) groups[lang] = []
    groups[lang].push(voice)
  }
  return Object.keys(groups).sort().map(lang => ({ lang, voices: groups[lang] }))
}

export default function PageVoiceReader({ text, title = 'Listen to this page' }) {
  const [supported, setSupported] = useState(true)
  const [voices, setVoices] = useState([])
  const [voiceUri, setVoiceUri] = useState('')
  const [rate, setRate] = useState(1)
  const [status, setStatus] = useState('idle')
  const utteranceRef = useRef(null)

  const loadVoices = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const list = sortVoices(window.speechSynthesis.getVoices())
    if (list.length === 0) return
    setVoices(list)
    setVoiceUri(prev => {
      if (prev && list.some(v => v.voiceURI === prev)) return prev
      const saved = localStorage.getItem(STORAGE_VOICE)
      if (saved && list.some(v => v.voiceURI === saved)) return saved
      const preferred = list.find(v => v.lang.toLowerCase().startsWith('en'))
      return (preferred || list[0]).voiceURI
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false)
      return
    }

    const savedRate = Number(localStorage.getItem(STORAGE_RATE))
    if (!Number.isNaN(savedRate) && savedRate >= 0.5 && savedRate <= 2) {
      setRate(savedRate)
    }

    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
    return () => {
      window.speechSynthesis.onvoiceschanged = null
      window.speechSynthesis.cancel()
    }
  }, [loadVoices])

  useEffect(() => {
    if (voiceUri) localStorage.setItem(STORAGE_VOICE, voiceUri)
  }, [voiceUri])

  useEffect(() => {
    localStorage.setItem(STORAGE_RATE, String(rate))
  }, [rate])

  function getSelectedVoice() {
    return voices.find(v => v.voiceURI === voiceUri) || null
  }

  function speak(content, onEnd) {
    if (!supported || !content?.trim()) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(content)
    const voice = getSelectedVoice()
    if (voice) utterance.voice = voice
    utterance.rate = rate
    utterance.pitch = 1
    utterance.onstart = () => setStatus('playing')
    utterance.onend = () => {
      setStatus('idle')
      utteranceRef.current = null
      onEnd?.()
    }
    utterance.onerror = () => {
      setStatus('idle')
      utteranceRef.current = null
    }
    utterance.onpause = () => setStatus('paused')
    utterance.onresume = () => setStatus('playing')

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  function handlePlay() {
    if (!text?.trim()) return
    if (status === 'paused') {
      window.speechSynthesis.resume()
      setStatus('playing')
      return
    }
    speak(text)
  }

  function handlePause() {
    if (status !== 'playing') return
    window.speechSynthesis.pause()
    setStatus('paused')
  }

  function handleStop() {
    window.speechSynthesis.cancel()
    utteranceRef.current = null
    setStatus('idle')
  }

  function handlePreview() {
    speak(PREVIEW_TEXT)
  }

  function handleVoiceChange(e) {
    handleStop()
    setVoiceUri(e.target.value)
  }

  const grouped = groupVoicesByLang(voices)
  const selectedVoice = getSelectedVoice()
  const isActive = status === 'playing' || status === 'paused'

  if (!supported) {
    return (
      <div className="voice-reader voice-reader--unsupported">
        <span>Voice reading is not supported in this browser.</span>
      </div>
    )
  }

  return (
    <div className={`voice-reader${isActive ? ' voice-reader--active' : ''}`}>
      <div className="voice-reader__header">
        <div className="voice-reader__title-wrap">
          <span className="voice-reader__icon" aria-hidden="true">🔊</span>
          <div>
            <div className="voice-reader__title">{title}</div>
            <div className="voice-reader__subtitle">
              {status === 'playing' && 'Reading aloud…'}
              {status === 'paused' && 'Paused'}
              {status === 'idle' && (selectedVoice ? `${selectedVoice.name} · ${selectedVoice.lang}` : 'Choose a voice and press play')}
            </div>
          </div>
        </div>
        {isActive && (
          <div className="voice-reader__waves" aria-hidden="true">
            <span /><span /><span /><span /><span />
          </div>
        )}
      </div>

      <div className="voice-reader__controls">
        <div className="voice-reader__field voice-reader__field--voice">
          <label htmlFor="voice-reader-voice">Voice</label>
          <select
            id="voice-reader-voice"
            value={voiceUri}
            onChange={handleVoiceChange}
            disabled={voices.length === 0}
          >
            {voices.length === 0 ? (
              <option value="">Loading voices…</option>
            ) : grouped.map(group => (
              <optgroup key={group.lang} label={group.lang}>
                {group.voices.map(voice => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name}{voice.default ? ' (default)' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="voice-reader__field voice-reader__field--rate">
          <label htmlFor="voice-reader-rate">Speed · {rate.toFixed(1)}×</label>
          <input
            id="voice-reader-rate"
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={rate}
            onChange={e => setRate(Number(e.target.value))}
          />
        </div>

        <div className="voice-reader__actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePlay}
            disabled={!text?.trim() || status === 'playing'}
            title="Play"
          >
            ▶ Play
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePause}
            disabled={status !== 'playing'}
            title="Pause"
          >
            ⏸ Pause
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleStop}
            disabled={status === 'idle'}
            title="Stop"
          >
            ⏹ Stop
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePreview}
            disabled={voices.length === 0 || status === 'playing'}
            title="Preview selected voice"
          >
            ✨ Preview voice
          </button>
        </div>
      </div>
    </div>
  )
}
