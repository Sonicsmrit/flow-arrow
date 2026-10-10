# Wire TTS into manifest and connect speech toggle

- What: added content/speech.js to manifest content_scripts before main.js, persisted speaker preference in localStorage, wired speaker toggle directly to FlowArrow.speech.setEnabled, made offscreen recorder use dynamic transcribe URL.
- Why: voice guidance needs browser SpeechSynthesis registered and enabled to speak step instructions, and voice recording needs proper transcription endpoint resolution.
- Test: node --check passes on speech.js, widget.js, voice.js, offscreen.js, background.js; manifest JSON parses with correct script ordering.
- Contracts touched: no.
- Next/Blockers: grant microphone permission via welcome.html; connect backend /transcribe service.
