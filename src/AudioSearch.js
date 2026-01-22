import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faStop } from '@fortawesome/free-solid-svg-icons';
import { getConfig } from '@edx/frontend-platform';
import FocusTrap from 'focus-trap-react';

class AudioSearch extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isListening: false,
      showModal: false,
      interimText: '',
      finalText: '',
      debugMessage: '',
      canRespeak: false,
      canSearch: false,
      transcriptBuffer: [],
      modalMessage: '',
      recordingStartTime: null,
      announcement: '',
      isFocusOnSTopBTN: false
    };

    this.mediaRecorder = React.createRef();
    this.streamRef = React.createRef();
    this.audioChunksRef = React.createRef();
    this.isStoppingRef = React.createRef();
    this.isStartingRef = React.createRef();
    this.speechRecognition = React.createRef();
    this.audioChunksRef.current = [];
    this.isStoppingRef.current = false;
    this.isStartingRef.current = false;
    this.recordingTimeout = null;
    this.nonModalNodes = [];

    this.abortControllerRef = React.createRef();
    this.sessionIdRef = React.createRef();
    this.sessionIdRef.current = null;
    this.abortControllerRef.current = null;
  }

  

  componentDidUpdate(prevProps, prevState) {
    
    if (this.state.showModal && !prevState.showModal) {
 
    }
    else if (!this.state.showModal && prevState.showModal) {
      this.setState({ announcement: 'Voice search dialog closed' });
    }

    // if (this.state.finalText !== prevState.finalText || this.state.interimText !== prevState.interimText) {
    //   this.forceUpdate();
    //   console.log('Text updated, forcing re-render', { finalText: this.state.finalText, interimText: this.state.interimText, timestamp: new Date().toISOString() });
    // }
  }

  componentDidMount() {
    document.addEventListener('keydown', this.handleEscKey);
    if (window.location.protocol !== 'https:' && process.env.NODE_ENV !== 'development') {
      console.warn('Running on HTTP, transcription may fail due to CORS or security restrictions', { timestamp: new Date().toISOString() });
      this.setState({ debugMessage: 'Please use HTTPS to ensure transcription works correctly.' });
    }
  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleEscKey);
    console.log('AudioSearch unmounting, triggering cleanup', { timestamp: new Date().toISOString() });
    this.handleStopRecording(true);
    this.stopAllTracks();
    if (this.speechRecognition.current) {
      this.speechRecognition.current.stop();
      this.speechRecognition.current = null;
    }
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }

    this.sessionIdRef.current = null;
    if (this.abortControllerRef.current) {
      this.abortControllerRef.current.abort();
      this.abortControllerRef.current = null;
    }
  }

  stopAllTracks = () => {
    if (this.streamRef.current) {
      this.streamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`Track ${track.id} (${track.kind}) stopped`, { readyState: track.readyState, timestamp: new Date().toISOString() });
        this.setState({ debugMessage: `Track ${track.id} stopped` });
      });
      this.streamRef.current = null;
    }
  };

  handleMediaRecorderStop = async () => {
    console.log('handleMediaRecorderStop called', { isStopping: this.isStoppingRef.current, chunks: this.audioChunksRef.current.length, interimText: this.state.interimText, transcriptBuffer: this.state.transcriptBuffer, timestamp: new Date().toISOString() });
    const currentSessionId = this.sessionIdRef.current;

    if (!this.isStoppingRef.current) {
      console.warn('MediaRecorder stopped unexpectedly', { chunks: this.audioChunksRef.current.length, interimText: this.state.interimText, timestamp: new Date().toISOString() });
      this.setState({ debugMessage: 'MediaRecorder stopped unexpectedly, ignoring' });
      this.cleanupAfterStop();
      return;
    }

    const totalSize = this.audioChunksRef.current.reduce((sum, chunk) => sum + (chunk.size || 0), 0) || 0;
    const recordingDuration = this.state.recordingStartTime ? (new Date().getTime() - this.state.recordingStartTime) / 1000 : 0;
    console.log('MediaRecorder onstop processing', { isStopping: this.isStoppingRef.current, chunks: this.audioChunksRef.current.length, totalSize, recordingDuration, timestamp: new Date().toISOString() });

    try {
      const mimeType = this.mediaRecorder.current.mimeType || 'audio/webm';
      const audioBlob = new Blob(this.audioChunksRef.current, { type: mimeType });
      console.log('Audio blob created', { size: audioBlob.size, type: mimeType, chunks: this.audioChunksRef.current.length, duration: recordingDuration, timestamp: new Date().toISOString() });
      this.setState({ debugMessage: `Sending audio to transcription API, MIME: ${mimeType}, size: ${audioBlob.size}`, modalMessage: 'Processing transcription...' });

      const formData = new FormData();
      formData.append('audio', audioBlob, `recording.${mimeType.split('/')[1]}`);
      formData.append('language', this.props.currentLang || 'en-US');

      console.log('Initiating transcription API call', { url: `${getConfig().LMS_BASE_URL}/explore-courses/api/transcribe-audio/`, mimeType, size: audioBlob.size, timestamp: new Date().toISOString() });
      try {
        const response = await fetch(`${getConfig().LMS_BASE_URL}/explore-courses/api/transcribe-audio/`, {
        // const response = await fetch(`${getConfig().LMS_BASE_URL}/explore-courses/api/mx-transcribe-audio/`, {
          method: 'POST',
          body: formData,
          signal: this.abortControllerRef.current.signal,
          credentials: 'include',
        });
        console.log('Transcription API response received', { status: response.status, headers: Object.fromEntries(response.headers.entries()), sessionId: currentSessionId, timestamp: new Date().toISOString() });
        const data = await response.json();
        console.log('Transcription API data parsed', { data, sessionId: currentSessionId, timestamp: new Date().toISOString() });
        // NEW: Guard against late responses
        if (this.sessionIdRef.current !== currentSessionId) {
          console.log('Ignoring late API response for old session', { currentSessionId, newSessionId: this.sessionIdRef.current });
          return;
        }
        if (response.ok) {
          if (data.text) {
            console.log('Transcription successful', { text: data.text, timestamp: new Date().toISOString() });
            this.setState({ 
              finalText: data.text, 
              canSearch: true, 
              canRespeak: true, 
              debugMessage: 'Transcription successful: ' + data.text, 
              isListening: false, 
              modalMessage: '',
            }, () => {
              console.log('State updated with transcription', { finalText: this.state.finalText, canSearch: this.state.canSearch, timestamp: new Date().toISOString() });
              const voiceText = document.getElementById('voiceText');
              if (voiceText) {
            

                voiceText.focus();
           
              }
              this.forceUpdate();
            });
          } else {
            console.log('Transcription returned empty text, using interimText', { interimText: this.state.interimText, transcriptBuffer: this.state.transcriptBuffer, timestamp: new Date().toISOString() });
            const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Sorry, I couldn’t understand that. Please speak again.';
            if (this.sessionIdRef.current !== currentSessionId) return;
            this.setState({
              debugMessage: 'No speech detected in audio, falling back to interimText.',
              showModal: true,
              isListening: false,
              canRespeak: true,
              canSearch: !!this.state.transcriptBuffer.length || !!this.state.interimText,
              modalMessage: '',
              finalText: fallbackText,
            }, () => {
              console.log('State updated with empty transcription', { finalText: this.state.finalText, canSearch: this.state.canSearch, timestamp: new Date().toISOString() });
              const voiceText = document.getElementById('voiceText');
              if (voiceText) {
                // voiceText.setAttribute('aria-live', 'assertive');
                voiceText.focus();
                // setTimeout(() => {
                //   if (voiceText) {
                //     voiceText.setAttribute('aria-live', 'polite');
                //   }
                // }, 2000);
              }
            });
          }
        } else {
          console.error('Transcription API error:', { status: response.status, error: data.error || 'Unknown error', data, timestamp: new Date().toISOString() });
          // const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Transcription error. Please try again.';
          const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Sorry, I couldn’t understand that. Please speak again.';
          if (this.sessionIdRef.current !== currentSessionId) return;
          this.setState({
            debugMessage: 'Transcription error: ' + (data.error || 'Unknown error'),
            showModal: true,
            isListening: false,
            canRespeak: true,
            canSearch: !!this.state.transcriptBuffer.length || !!this.state.interimText,
            modalMessage: '',
            finalText: fallbackText,
          }, () => {
            console.log('State updated with transcription error', { finalText: this.state.finalText, canSearch: this.state.canSearch, timestamp: new Date().toISOString() });
            const voiceText = document.getElementById('voiceText');
            if (voiceText) {
                voiceText.focus();

              // voiceText.setAttribute('aria-live', 'assertive');
              // voiceText.focus();
              // setTimeout(() => {
              //   if (voiceText) {
              //     voiceText.setAttribute('aria-live', 'polite');
              //     }
              //   }, 2000);
              }
            });
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log('Transcription API aborted due to modal close', { sessionId: currentSessionId, timestamp: new Date().toISOString() });
            this.setState({ debugMessage: 'Session canceled' });
            return;  // Don't process further
          }

          console.error('Transcription API fetch error:', { error: error.message, stack: error.stack, timestamp: new Date().toISOString() });
          const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Sorry, I couldn’t understand that. Please speak again.';
          if (this.sessionIdRef.current !== currentSessionId) return;
          this.setState({
            debugMessage: 'Transcription fetch error: ' + error.message,
            showModal: true,
            isListening: false,
            canRespeak: true,
            canSearch: !!this.state.transcriptBuffer.length || !!this.state.interimText,
            modalMessage: '',
            finalText: fallbackText,
          }, () => {
            console.log('State updated with fetch error', { finalText: this.state.finalText, canSearch: this.state.canSearch, timestamp: new Date().toISOString() });
            const voiceText = document.getElementById('voiceText');
            if (voiceText) {
              // voiceText.setAttribute('aria-live', 'assertive');
              voiceText.focus();
              // setTimeout(() => {
              //   if (voiceText) {
              //     voiceText.setAttribute('aria-live', 'polite');
              //   }
              // }, 2000);
            }
          });
        }
      } catch (error) {
        console.error('Error in handleMediaRecorderStop:', { error: error.message, stack: error.stack, timestamp: new Date().toISOString() });
        if (this.sessionIdRef.current !== currentSessionId) {
          console.log('Ignoring late processing error for old session', { currentSessionId, newSessionId: this.sessionIdRef.current });
          return;
        }
        const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Sorry, I couldn’t understand that. Please speak again.';
        this.setState({
          debugMessage: 'Processing error: ' + error.message,
          showModal: true,
          isListening: false,
          canRespeak: true,
          canSearch: !!this.state.transcriptBuffer.length || !!this.state.interimText,
          modalMessage: '',
          finalText: fallbackText,
        }, () => {
          console.log('State updated with processing error', { finalText: this.state.finalText, canSearch: this.state.canSearch, timestamp: new Date().toISOString() });
          const voiceText = document.getElementById('voiceText');
          if (voiceText) {
            // voiceText.setAttribute('aria-live', 'assertive');
            voiceText.focus();
            // setTimeout(() => {
            //   if (voiceText) {
            //     voiceText.setAttribute('aria-live', 'polite');
            //   }
            // }, 2000);
          }
        });
      }

      this.cleanupAfterStop();
    };

    cleanupAfterStop = () => {
      console.log('Cleaning up after MediaRecorder stop', { timestamp: new Date().toISOString() });
      this.audioChunksRef.current = [];
      this.stopAllTracks();
      this.mediaRecorder.current = null;
      if (this.speechRecognition.current) {
        this.speechRecognition.current.stop();
        this.speechRecognition.current = null;
      }
      this.isStartingRef.current = false;
      this.isStoppingRef.current = false;
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
      }
      this.setState({ recordingStartTime: null });


      this.sessionIdRef.current = null;
      if (this.abortControllerRef.current) {
        this.abortControllerRef.current.abort();
        this.abortControllerRef.current = null;
      }
    };

    handleAudioSearch = async () => {
      if (this.isStartingRef.current || this.isStoppingRef.current) {
        console.log('Audio search or cleanup in progress, ignoring', { timestamp: new Date().toISOString() });
        this.setState({ debugMessage: 'Audio search or cleanup in progress, ignoring', canRespeak: true });
        return;
      }
      // this.setState({ announcement: 'MX Voice search dialog open' });

      console.log('handleAudioSearch started', { currentLang: this.props.currentLang, browser: navigator.userAgent, timestamp: new Date().toISOString() });

    

      this.setState({
        // announcement: 'Voice search dialog open',
        announcement: '',
        showModal: true,
        isListening: false,
        interimText: '',
        finalText: '',
        debugMessage: 'Opening voice search modal',
        canRespeak: true,
        canSearch: false,
        transcriptBuffer: [],
        modalMessage: 'Click Speak to start speaking, then click Stop after you finish.',
        recordingStartTime: null,
        isFocusOnSTopBTN: false,
        }, () => {
          // NEW: Reset session and abort on modal open
          this.sessionIdRef.current = null;
          if (this.abortControllerRef.current) {
            this.abortControllerRef.current.abort();
            this.abortControllerRef.current = null;
          }
        });


        // NEW: Delay before focusing voiceText and announcing instruction
            // setTimeout(() => {
            //   const voiceText = document.getElementById('voiceText');
            //   console.log('Delayed focus to voiceText', voiceText);
            //   if (voiceText) {
            //     voiceText.focus();
           
            //     setTimeout(() => {
            //       this.setState({ announcement: '' });
            //     }, 3000);
            //   }
            // }, 2000);  //  (2 seconds here)

    };

    handleSpeak = async () => {
      if (this.isStartingRef.current || this.isStoppingRef.current || this.state.isListening) {
        console.log('Speak ignored: recording or cleanup in progress', { timestamp: new Date().toISOString() });
        this.setState({ debugMessage: 'Speak ignored: recording or cleanup in progress', canRespeak: true });
        return;
      }
      this.isStartingRef.current = true;
      console.log('handleSpeak started', { currentLang: this.props.currentLang, browser: navigator.userAgent, timestamp: new Date().toISOString() });

      // Reset recording state
      this.audioChunksRef.current = [];
      this.stopAllTracks();
      if (this.mediaRecorder.current) {
        this.mediaRecorder.current.onstop = null;
        this.mediaRecorder.current.ondataavailable = null;
        if (this.mediaRecorder.current.state !== 'inactive') {
          try {
            this.mediaRecorder.current.stop();
            console.log('MediaRecorder stopped during reset', { state: this.mediaRecorder.current.state, timestamp: new Date().toISOString() });
          } catch (error) {
            console.log('Error stopping MediaRecorder during reset:', { error: error.message, timestamp: new Date().toISOString() });
          }
        }
        this.mediaRecorder.current = null;
      }
      if (this.speechRecognition.current) {
        this.speechRecognition.current.stop();
        this.speechRecognition.current = null;
      }
      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
      }

      this.setState({
        isListening: false,
        interimText: '',
        finalText: '',
        debugMessage: 'Initializing recording...',
        canRespeak: false,
        canSearch: false,
        transcriptBuffer: [],
        modalMessage: 'Preparing to record, please wait...',
        recordingStartTime: null,
      });

      try {
        // Warn about HTTP in development, block in production
        if (window.location.protocol !== 'https:') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Running on HTTP in development, transcription may be unreliable due to CORS or security restrictions', { protocol: window.location.protocol, timestamp: new Date().toISOString() });
            this.setState({ debugMessage: 'Warning: Running on HTTP, transcription may fail. Consider enabling HTTPS.' });
          } else {
            console.error('HTTPS required for reliable transcription', { protocol: window.location.protocol, timestamp: new Date().toISOString() });
            this.setState({
              debugMessage: 'HTTPS required for transcription. Please enable HTTPS.',
              isListening: false,
              showModal: true,
              canRespeak: true,
              modalMessage: '',
              finalText: 'Please use HTTPS to enable voice transcription.',
            }, () => {
              console.log('State updated with HTTPS error', { finalText: this.state.finalText, timestamp: new Date().toISOString() });
            });
            this.isStartingRef.current = false;
            return;
          }
        }

        // Initialize Web Speech API
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          console.error('Web Speech API not supported in this browser', { browser: navigator.userAgent, timestamp: new Date().toISOString() });
          this.setState({
            debugMessage: 'Web Speech API not supported. Falling back to server-side transcription.',
            isListening: false,
            showModal: true,
            canRespeak: true,
            modalMessage: 'Voice recognition not supported in this browser. Server-side transcription will be used.',
          }, () => {
            console.log('State updated with Speech API error', { modalMessage: this.state.modalMessage, timestamp: new Date().toISOString() });
          });
        } else {
          this.speechRecognition.current = new SpeechRecognition();
          this.speechRecognition.current.lang = this.props.currentLang || 'en-US';
          this.speechRecognition.current.interimResults = true;
          this.speechRecognition.current.continuous = true;
          this.speechRecognition.current.maxAlternatives = 1;

          this.speechRecognition.current.onresult = (event) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript.trim();
              if (event.results[i].isFinal) {
                final += transcript + ' ';
              } else {
                interim += transcript + ' ';
              }
            }
            const combinedTranscript = this.state.transcriptBuffer.join(' ') + final + interim;
            console.log('SpeechRecognition result', { interim, final, combinedTranscript, eventResults: event.results.length, timestamp: new Date().toISOString() });
            this.setState(
              {
                interimText: combinedTranscript.trim(),
                transcriptBuffer: final ? [...this.state.transcriptBuffer, final.trim()] : this.state.transcriptBuffer,
                debugMessage: `Interim text: ${combinedTranscript.trim()}`,
              },
              () => {
                console.log('State updated with interim text', { interimText: this.state.interimText, transcriptBuffer: this.state.transcriptBuffer, timestamp: new Date().toISOString() });
              }
            );
          };

          this.speechRecognition.current.onerror = (event) => {
            console.error('SpeechRecognition error:', { error: event.error, timestamp: new Date().toISOString() });
            let errorMessage = 'Error in voice recognition. Server-side transcription will be used.';
            if (event.error === 'no-speech') {
              errorMessage = 'Listening for speech...';
            } else if (event.error === 'not-allowed') {
              errorMessage = 'Microphone access denied for real-time transcription. Server-side transcription will be used.';
            } else if (event.error === 'aborted') {
              errorMessage = 'Voice recognition aborted. Server-side transcription will be used.';
            }
            this.setState({
              debugMessage: `SpeechRecognition error: ${event.error}`,
              modalMessage: errorMessage,
            }, () => {
              console.log('State updated with SpeechRecognition error', { modalMessage: this.state.modalMessage, interimText: this.state.interimText, timestamp: new Date().toISOString() });
            });
            if (event.error !== 'aborted' && this.state.isListening && this.speechRecognition.current) {
              try {
                this.speechRecognition.current.start();
                console.log('SpeechRecognition restarted after error', { error: event.error, timestamp: new Date().toISOString() });
              } catch (error) {
                console.error('Failed to restart SpeechRecognition:', { error: error.message, timestamp: new Date().toISOString() });
              }
            }
          };

          this.speechRecognition.current.onend = () => {
            console.log('SpeechRecognition ended', { isListening: this.state.isListening, timestamp: new Date().toISOString() });
            if (this.state.isListening && this.speechRecognition.current) {
              try {
                this.speechRecognition.current.start();
                console.log('SpeechRecognition restarted', { timestamp: new Date().toISOString() });
              } catch (error) {
                console.error('Failed to restart SpeechRecognition:', { error: error.message, timestamp: new Date().toISOString() });
                this.setState({
                  debugMessage: `SpeechRecognition restart failed: ${error.message}`,
                  modalMessage: 'Voice recognition interrupted. Server-side transcription will be used.',
                }, () => {
                  console.log('State updated with SpeechRecognition restart failure', { modalMessage: this.state.modalMessage, timestamp: new Date().toISOString() });
                });
              }
            }
          };
        }

        // Acquire microphone stream
        try {
          this.streamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true },
          });
          console.log('Microphone stream acquired', { 
            active: this.streamRef.current.active, 
            tracks: this.streamRef.current.getTracks().map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })), 
            timestamp: new Date().toISOString() 
          });
          this.setState({ debugMessage: 'Microphone stream acquired' });
        } catch (error) {
          console.error('Microphone access error:', { error: error.name, message: error.message, timestamp: new Date().toISOString() });
          let errorMessage = 'Unexpected error accessing microphone. Please try again.';
          if (error.name === 'NotAllowedError') {
            errorMessage = 'Microphone access denied. Please enable microphone permissions in your browser settings.';
          } else if (error.name === 'NotFoundError') {
            errorMessage = 'No microphone found. Please connect a microphone and try again.';
          }
          this.setState({
            debugMessage: `Microphone error: ${error.message}`,
            isListening: false,
            showModal: true,
            canRespeak: true,
            modalMessage: '',
            finalText: errorMessage,
          }, () => {
            console.log('State updated with microphone error', { finalText: this.state.finalText, timestamp: new Date().toISOString() });
          });
          this.isStartingRef.current = false;
          return;
        }

        // Verify stream
        if (!this.streamRef.current.active || this.streamRef.current.getAudioTracks().length === 0) {
          console.error('Invalid stream: no audio tracks or inactive', {
            streamActive: this.streamRef.current?.active,
            audioTracks: this.streamRef.current?.getAudioTracks().map(t => ({ id: t.id, enabled: t.enabled, readyState: t.readyState })),
            timestamp: new Date().toISOString(),
          });
          this.setState({
            debugMessage: 'Invalid microphone stream: no audio tracks or inactive',
            isListening: false,
            showModal: true,
            canRespeak: true,
            modalMessage: '',
            finalText: 'Invalid microphone stream. Please check your microphone and try again.',
          }, () => {
            console.log('State updated with invalid stream error', { finalText: this.state.finalText, timestamp: new Date().toISOString() });
          });
          this.stopAllTracks();
          this.isStartingRef.current = false;
          return;
        }

        // Initialize MediaRecorder
        let mimeType = 'audio/webm;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'audio/webm';
          this.setState({ debugMessage: 'Falling back to MIME type: audio/webm' });
        }
        this.mediaRecorder.current = new MediaRecorder(this.streamRef.current, { mimeType });
        this.mediaRecorder.current.onstart = () => {
          console.log('MediaRecorder started', { state: this.mediaRecorder.current?.state || 'null', timestamp: new Date().toISOString() });
          this.setState({ debugMessage: `MediaRecorder started, state: ${this.mediaRecorder.current?.state || 'null'}` });
        };
        this.mediaRecorder.current.ondataavailable = (event) => {
          console.log('MediaRecorder data available', { 
            size: event.data.size, 
            type: event.data.type, 
            totalChunks: this.audioChunksRef.current.length + 1, 
            timestamp: new Date().toISOString() 
          });
          if (event.data.size > 0) {
            this.audioChunksRef.current.push(event.data);
            this.setState({ debugMessage: `Audio chunk received, size: ${event.data.size}, total chunks: ${this.audioChunksRef.current.length}` });
          } else {
            console.log('Empty audio chunk received', { timestamp: new Date().toISOString() });
            this.setState({ debugMessage: 'Empty audio chunk received' });
          }
        };
        this.mediaRecorder.current.onstop = this.handleMediaRecorderStop;

        // Start SpeechRecognition and MediaRecorder
        try {
          if (this.speechRecognition.current) {
            this.speechRecognition.current.start();
            console.log('SpeechRecognition started', { lang: this.speechRecognition.current.lang, timestamp: new Date().toISOString() });
          }
          this.mediaRecorder.current.start(100);
          console.log('MediaRecorder start called', { state: this.mediaRecorder.current?.state || 'null', timestamp: new Date().toISOString() });
          this.setState({ 
            debugMessage: `MediaRecorder started`, 
            isListening: true, 
            modalMessage: 'Listening for speech...',
            recordingStartTime: new Date().getTime(),
          }, () => {
            console.log('State updated with recording start', { isListening: this.state.isListening, modalMessage: this.state.modalMessage, timestamp: new Date().toISOString() });
            this.sessionIdRef.current = Date.now().toString();
            this.abortControllerRef.current = new AbortController();
            console.log('New session started', { sessionId: this.sessionIdRef.current });
            
            // NEW: Play beep sound after state update (confirms "Listening for speech...")
        //  if (this.state.isListening) {
        //       this.playBeepSound();
        //     }
            

              // const voiceText = document.getElementById('voiceText');
              // if (voiceText) {
              //   voiceText.focus();
           
              // }

          // setTimeout(() => {
          //     if (this.state.isListening) {
          //       this.playBeepSound();
          //     }
          //   }, 3000);

            

          //   const stopButton = document.getElementById('stopButton');
          //     if (stopButton) {
          //       stopButton.focus();
           
          //     }


        //   setTimeout(() => {
        //   if (this.state.isListening) {
        //     this.playBeepSound();
        //     const stopButton = document.getElementById('stopButton');
        //     if (stopButton) {
        //       // // NEW: Temporarily clear aria-label to suppress announcement on focus
        //       // const originalLabel = stopButton.getAttribute('aria-label');
        //       // stopButton.setAttribute('aria-label', '');  // Empty = silent focus
        //       stopButton.focus();
              
        //       // Restore after a brief delay (NVDA announces instantly, so 100ms is enough)
        //       // setTimeout(() => {
        //       //   if (stopButton && originalLabel) {
        //       //     stopButton.setAttribute('aria-label', originalLabel);
        //       //   }
        //       // }, 100);
        //     }
        //   }
        // }, 3000);

        

        setTimeout(() => {
        if (this.state.isListening) {
          this.playBeepSound();
          
        }
      }, 3000);

              
          });
        } catch (error) {
          console.error('Error starting MediaRecorder or SpeechRecognition:', { error: error.message, timestamp: new Date().toISOString() });
          this.setState({
            debugMessage: `Error starting recording: ${error.message}`,
            isListening: false,
            showModal: true,
            canRespeak: true,
            modalMessage: '',
            finalText: 'Error starting microphone. Please check permissions and try again.',
          }, () => {
            console.log('State updated with recording error', { finalText: this.state.finalText, timestamp: new Date().toISOString() });
          });
          this.stopAllTracks();
          if (this.speechRecognition.current) {
            this.speechRecognition.current.stop();
            this.speechRecognition.current = null;
          }
          this.isStartingRef.current = false;
          return;
        }

        // Set 3-minute timeout
        this.recordingTimeout = setTimeout(() => {
          console.log('Recording timeout reached (3 minutes)', { timestamp: new Date().toISOString() });
          this.setState({ debugMessage: 'Recording stopped after 3 minutes' });
          this.handleStopRecording(false);
        }, 180000);

        this.isStartingRef.current = false;
      } catch (error) {
        console.error('Unexpected error in handleSpeak:', { error: error.name, message: error.message, timestamp: new Date().toISOString() });
        let errorMessage = 'Unexpected error accessing microphone. Please try again.';
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Microphone access denied. Please enable microphone permissions in your browser settings.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone and try again.';
        }
        this.setState({
          debugMessage: `Unexpected error: ${error.message}`,
          isListening: false,
          showModal: true,
          canRespeak: true,
          modalMessage: '',
          finalText: errorMessage,
        }, () => {
          console.log('State updated with unexpected error', { finalText: this.state.finalText, timestamp: new Date().toISOString() });
        });
        this.stopAllTracks();
        this.isStartingRef.current = false;
        this.isStoppingRef.current = false;
      }
    };

    handleStopRecording = (closeModal = false) => {
      // if (this.isStoppingRef.current) {
      //   console.log('Stop recording ignored: already stopping', { timestamp: new Date().toISOString() });
      //   this.setState({ debugMessage: 'Stop recording ignored: already stopping' });
      //   return;
      // }

      this.isStoppingRef.current = true;
      console.log('Stop recording initiated', { showModal: this.state.showModal, isListening: this.state.isListening, interimText: this.state.interimText, transcriptBuffer: this.state.transcriptBuffer, recordingStartTime: this.state.recordingStartTime, timestamp: new Date().toISOString() });
      this.setState({ 
        debugMessage: 'Stop recording initiated', 
        isListening: false, 
        modalMessage: 'Processing transcription...',
        finalText: this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Processing transcription...',
        canRespeak: false,
        isFocusOnSTopBTN: false
      }, () => {
        console.log('State updated with stop initiated', { finalText: this.state.finalText, modalMessage: this.state.modalMessage, timestamp: new Date().toISOString() });
      });

      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
      }

      if (this.speechRecognition.current) {
        this.speechRecognition.current.stop();
        console.log('SpeechRecognition stopped', { timestamp: new Date().toISOString() });
        this.speechRecognition.current = null;
      }

      if (this.mediaRecorder.current && this.mediaRecorder.current.state !== 'inactive') {
        try {
          console.log('MediaRecorder stop triggered', { state: this.mediaRecorder.current.state, timestamp: new Date().toISOString() });
          this.mediaRecorder.current.stop();
          this.setState({ debugMessage: `MediaRecorder stop triggered, state: ${this.mediaRecorder.current.state}` });
        } catch (error) {
          console.error('Error stopping MediaRecorder:', { error: error.message, timestamp: new Date().toISOString() });
          const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Error stopping recording. Please try again.';
          this.setState({ 
            debugMessage: `Error stopping MediaRecorder: ${error.message}`,
            showModal: true,
            isListening: false,
            canRespeak: true,
            canSearch: !!this.state.transcriptBuffer.length || !!this.state.interimText,
            modalMessage: '',
            finalText: fallbackText,
          }, () => {
            console.log('State updated with stop error', { finalText: this.state.finalText, canSearch: this.state.canSearch, timestamp: new Date().toISOString() });
            const voiceText = document.getElementById('voiceText');
            if (voiceText) {
              voiceText.setAttribute('aria-live', 'assertive');
              voiceText.focus();
              // setTimeout(() => {
              //   if (voiceText) {
              //     voiceText.setAttribute('aria-live', 'polite');
              //   }
              // }, 2000);
            }
          });
          this.cleanupAfterStop();
          return;
        }
      } else {
        console.log('MediaRecorder already stopped or not initialized', { state: this.mediaRecorder.current?.state || 'null', timestamp: new Date().toISOString() });
        const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Sorry, I couldn’t understand that. Please speak again.';
        this.setState({ 
          debugMessage: 'MediaRecorder already stopped or not initialized',
          showModal: closeModal ? false : this.state.showModal,
          isListening: false,
          canRespeak: true,
          canSearch: !!this.state.transcriptBuffer.length || !!this.state.interimText,
          modalMessage: '',
          finalText: fallbackText,
        }, () => {
          console.log('State updated with no audio', { finalText: this.state.finalText, canSearch: this.state.canSearch, timestamp: new Date().toISOString() });
          const voiceText = document.getElementById('voiceText');
          if (voiceText) {
            voiceText.setAttribute('aria-live', 'assertive');
            voiceText.focus();
            // setTimeout(() => {
            //   if (voiceText) {
            //     voiceText.setAttribute('aria-live', 'polite');
            //   }
            // }, 2000);
          }
        });
        this.cleanupAfterStop();
        return;
      }

     


      if (closeModal) {
        // NEW: Abort pending API and clear state
        if (this.abortControllerRef.current) {
          this.abortControllerRef.current.abort();
          console.log('API aborted on modal close', { sessionId: this.sessionIdRef.current });
        }
        this.setState({ finalText: '', interimText: '', transcriptBuffer: [] });
        this.sessionIdRef.current = null;
        this.abortControllerRef.current = null;
        
        this.setState({
          showModal: false,
          announcement: 'Voice search dialog closed',
        }, () => {
          console.log('Modal closed on cancel', { timestamp: new Date().toISOString() });
        });
        this.cleanupAfterStop();
        return;
      }

      console.log('Stop recording completed', { isStarting: this.isStartingRef.current, isStopping: this.isStoppingRef.current, showModal: this.state.showModal, interimText: this.state.interimText, transcriptBuffer: this.state.transcriptBuffer, timestamp: new Date().toISOString() });
    };




    handleEscKey = (event) => {
    if (event.key === 'Escape' && this.state.showModal) {
      event.stopPropagation();
      event.preventDefault();
      console.log('ESC key detected - closing modal');
      // Clear any ongoing recording/audio
      this.audioChunksRef.current = [];
      if (this.recordingTimeout) clearTimeout(this.recordingTimeout);
      if (this.speechRecognition.current) {
        this.speechRecognition.current.stop();
        this.speechRecognition.current = null;
      }
      this.handleStopRecording(true);  // Closes modal and cleans up
    }

    else {

      if (!this.state.isListening) return;  // Only during listening

          const isTab = event.key === 'Tab';
          if (!isTab) return;

          // One-time redirect: Only if not yet focused on Stop this session
          if (!this.state.isFocusOnSTopBTN) {
            const stopButton = document.getElementById('stopButton');
            if (!stopButton) return;

            const currentFocus = document.activeElement;
            const isInCycle = currentFocus.id === 'stopButton' || currentFocus.id === 'voiceText';
            if (!isInCycle) {
              event.preventDefault();
              stopButton.focus();
              this.setState({ isFocusOnSTopBTN: true });  // Set flag: Now allow normal tabbing
              console.log('First tab redirected to Stop button during listening');
              return;  // Exit: Don't let FocusTrap interfere on first tab
            }
            // If already in cycle on first tab, still set flag (normal flow starts)
            this.setState({ isFocusOnSTopBTN: true });
          }
    }


  };

  // getSpeakAriaLabel = () => {
  //   const base = 'Speak button';
  //   if (this.state.isListening || this.isStartingRef.current || this.isStoppingRef.current || !this.state.canRespeak) {
  //     return `${base}, unavailable`;
  //   }
  //   return `${base}, select to start speaking`;
  // };

  // getStopAriaLabel = () => {
  //   const base = 'Stop button';
  //   if (!this.state.isListening || this.isStoppingRef.current) {
  //     return `${base}, unavailable`;
  //   }
  //   return `${base}, select to stop speaking`;
  // };

  // getSearchAriaLabel = () => {
  //   const base = 'Search button';
  //   if (!this.state.canSearch) {
  //     return `${base}, unavailable`;
  //   }
  //   return `${base}, select to search with transcribed text`;
  // };


  getSpeakDescription = () => {  
    if (this.state.isListening || this.isStartingRef.current || this.isStoppingRef.current || !this.state.canRespeak) {
      return 'unavailable';
    }
    return 'select to start speaking';
    };

  getStopDescription = () => {
    if (!this.state.isListening || this.isStoppingRef.current) {
      return 'unavailable';
    }
    return 'select to stop speaking';
  };

  getSearchDescription = () => {
    if (!this.state.canSearch) {
      return 'unavailable';
    }
    return 'select to search with transcribed text';
  };


  playBeepSound = async () => {
  if (!window.AudioContext) {
    console.warn('Web Audio API not supported, skipping beep', { timestamp: new Date().toISOString() });
    return;
  }

  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Resume if suspended (e.g., first user interaction)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Beep config: 800Hz sine wave, 200ms duration, volume fade-in/out for smoothness
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Frequency
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, audioContext.currentTime); // Start silent
    gainNode.gain.linearRampToValueAtTime(0.9, audioContext.currentTime + 0.01); // Quick fade-in to 30% volume
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2); // Fade out over 200ms

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);

    console.log('Beep sound played', { timestamp: new Date().toISOString() });

    // Cleanup after playback
    oscillator.onended = () => {
      audioContext.close();
    };
  } catch (error) {
    console.error('Error playing beep sound:', { error: error.message, timestamp: new Date().toISOString() });
    // Don't disrupt UX—just log
  }
};




triggerAnnouncementSequence = () => {
  // Step 1: Immediate announcement on open (already in setState, but reinforce if needed)
  this.setState({ 
    announcement: 'Voice search dialog open' 
  }, () => {
    // Step 2: Short pause for title/open to read (~500ms - covers "Voice Search" title)
    setTimeout(() => {
      // Announce instructions (queues politely after title)
      this.setState({ 
        announcement: 'Click Speak to start speaking, then click Stop after you finish.' 
      }, () => {
        // Step 3: Brief pause for instructions to complete (~1500ms - phrase takes ~1s at normal speed)
        setTimeout(() => {
          // Clear announcement to avoid repetition
          this.setState({ announcement: '' });
          
          // Step 4: Shift focus to Speak button
          const speakButton = document.getElementById('speakButton');
          console.log('Announcement sequence complete - focusing Speak button', speakButton);
          if (speakButton && this.state.showModal) {
            speakButton.focus();
          
          }
        }, 2000);  
      });
    }, 2500);  // Title read time
  });
};


    render() {
      return (
        <>
          {/* New: Screen reader announcement region */}
          <div aria-live="polite" role="status" className="sr-only"
          // aria-atomic="true"
          >
            {this.state.announcement}
          </div>
          <button
            type="button"
            onClick={() => this.handleAudioSearch()}
            className={`mic-btn border ${this.props.searchLabel} ${this.state.isListening ? 'bg-gray-300' : 'bg-white'} hover:bg-gray-100`}
            disabled={this.state.isListening || this.isStartingRef.current}
            aria-label="Voice search"
          >
            <FontAwesomeIcon icon={faMicrophone} />
          </button>
          {this.state.showModal && (
            <FocusTrap
              active={true}  // Traps focus when true
              focusTrapOptions={{
                onDeactivate: () => {
                  // Restore focus to mic button on close (a11y: returns user to trigger point)
                  const micButton = document.querySelector('button.mic-btn');
                  if (micButton) micButton.focus();
                  console.log('FocusTrap deactivated - focus restored to mic button');
                },
                onActivate: () => {
                  // NEW: Trigger announcement sequence on trap activation (post-render)
                  console.log('FocusTrap activated - starting announcement sequence');
                  this.triggerAnnouncementSequence();
                },
                escapeDeactivates: true,  // Auto-close on ESC (triggers onDeactivate)
                clickOutsideDeactivates: false,  // Prevent accidental close on outside click
                allowOutsideClick: false,
                // initialFocus: '#voiceText',  
                initialFocus: '#voiceSearchModalLabel',  
                
              }}
  >
            {/* <div className="voice-modal show" tabIndex="-1" aria-labelledby="voiceSearchModalLabel" aria-modal="true" role="dialog" */}
            <div className="voice-modal show" tabIndex="-1" aria-labelledby="voiceSearchModalLabel" aria-modal="true"
            // onKeyDown={this.handleEscKey}
            >
              <div className="modal-dialog modal-dialog-centered modal-lg" >

                <div className="mx-modal-content">
                  <div className="mx-modal-header" >
                    <h5 className="mx-modal-title" id="voiceSearchModalLabel" 
                    >
                      Voice Search
                      
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => this.handleStopRecording(true)}
                      // aria-label="Close"
                      // aria-label="Close button, select to close voice search dialog"
                      aria-label="Close"
                      aria-describedby="close-desc"
                    ></button>
                    <span id="close-desc" className="sr-only">select to close voice search dialog</span>
                  </div>

                  <div className="modal-body">
                    <p className="text-gray-700 mb-4 text-base" id="voiceText" 
                      tabIndex="0"
                      aria-labelledby="voiceLable"
                      // aria-hidden={this.state.announcement === 'Voice search dialog open'}
                      >
                        <span id="voiceLable">
                      {this.state.finalText || this.state.interimText || this.state.modalMessage || 'Click Speak to start speaking, then click Stop after you finish.'}
                        </span>
                    </p>

                    {process.env.NODE_ENV === 'dev' && this.state.debugMessage && (
                      <p className="text-xs text-gray-500 mt-2 break-words">Output: {this.state.debugMessage}</p>
                    )}
                  </div>
                  <div className="mx-modal-footer btn-modal-search">
                    <button
                      id="speakButton"
                      type="button"
                      onClick={this.handleSpeak}
                      // className="btn"
                      className={`btn ${this.state.isListening || this.isStartingRef.current || this.isStoppingRef.current || !this.state.canRespeak ? 'mx-disabled' : ''}`}
                      // disabled={this.state.isListening || this.isStartingRef.current || this.isStoppingRef.current || !this.state.canRespeak}
                      // aria-label="Start recording"
                      // aria-label={this.getSpeakAriaLabel()}
                      aria-label="speak"
                      aria-describedby="speak-desc"
                      // aria-disabled={this.state.isListening || this.isStartingRef.current || this.isStoppingRef.current || !this.state.canRespeak ? 'true' : 'false'}

                    >
                      Speak
                    </button>
                    <span id="speak-desc" className="sr-only">{this.getSpeakDescription()}</span>
                    <button
                      id="stopButton"
                      type="button"
                      // onClick={() => this.handleStopRecording(false)}
                      onClick={(e) => {
                        if (!this.state.isListening || this.isStoppingRef.current) {
                          e.preventDefault();  
                          return;  
                        }
                        this.handleStopRecording(false);  // Only calls if enabled
                      }}
                      // className="btn"
                      className={`btn ${!this.state.isListening || this.isStoppingRef.current ? 'mx-disabled' : ''}`}

                      // disabled={!this.state.isListening || this.isStoppingRef.current}
                      // aria-label="Stop recording"
                      // aria-label={this.getStopAriaLabel()}
                      aria-label="Stop"
                      aria-describedby="stop-desc"
                      // aria-disabled={!this.state.isListening || this.isStoppingRef.current ? 'true' : 'false'}

                    >
                      <FontAwesomeIcon icon={faStop} /> Stop
                    </button>
                    <span id="stop-desc" className="sr-only">{this.getStopDescription()}</span>
                    <button
                      type="button"

                      onClick={(event) => {
                        event.stopPropagation();
                        console.log('Search button clicked', { 
                          finalText: this.state.finalText, 
                          interimText: this.state.interimText, 
                          transcriptBuffer: this.state.transcriptBuffer, 
                          timestamp: new Date().toISOString(),
                        });
                        if (this.state.finalText  && this.state.canSearch) {
                          const searchText = this.state.finalText;
                          this.props.onTextUpdate(searchText);
                          if (this.props.exploreCourseUrl) {
                            const url = `${this.props.exploreCourseUrl}/search?text=${encodeURIComponent(searchText)}`;
                            console.log('Redirecting to:', url, { timestamp: new Date().toISOString() });
                            window.location = url;
                          } else {
                            console.log('No redirection, closing modal', { timestamp: new Date().toISOString() });
                            this.handleStopRecording(true);
                          }
                        }
                      }}
                      className={`btn ${!this.state.canSearch ? 'mx-disabled' : ''}`}

                      // aria-label={this.getSearchAriaLabel()}
                      aria-label="Search"
                      aria-describedby="search-desc"

                    >
                      Search
                    </button>
                    <span id="search-desc" className="sr-only">{this.getSearchDescription()}</span>
                  </div>
                </div>
              </div>
            </div>
          </FocusTrap>
          )}
        </>
      );
    }
  }

  export default AudioSearch;