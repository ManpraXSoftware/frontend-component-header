import React, { Component } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMicrophone, faStop } from '@fortawesome/free-solid-svg-icons';
import { getConfig } from '@edx/frontend-platform';

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
  }

  trapFocusInModal = (shouldTrap = true) => {
    const modal = document.querySelector('.voice-modal');
    if (shouldTrap && modal) {
      const modalNodes = Array.from(modal.querySelectorAll('*'));
      const focusableSelector = `
        a[href], 
        button:not([disabled]), 
        input:not([disabled]), 
        select:not([disabled]), 
        textarea:not([disabled]), 
        [tabindex]:not([tabindex="-1"]), 
        [contenteditable="true"], 
        area[href], 
        details, 
        summary, 
        iframe, 
        object, 
        embed, 
        li[data-testid="breadcrumb-item"], 
        li[data-testid="breadcrumb-item"] a, 
        li[data-testid="breadcrumb-item"] button, 
        li[data-testid="breadcrumb-item"] [tabindex],
        div[className="sequence-navigation-tabs-container"],
        div[className="sequence-navigation-tabs d-flex flex-grow-1"]
      `;
      
      const nonModalNodes = Array.from(document.querySelectorAll(`body *:not(.voice-modal):not(.voice-modal *)`)).filter(node => node.matches(focusableSelector));

      this.nonModalNodes = [];
      for (let i = 0; i < nonModalNodes.length; i++) {
        const node = nonModalNodes[i];
        if (!modalNodes.includes(node)) {
          node._prevTabindex = node.hasAttribute('tabindex') ? node.getAttribute('tabindex') : 'none';
          node.setAttribute('tabindex', '-1');
          node.style.outline = 'none';
          this.nonModalNodes.push(node);
        }
      }

      const firstFocusable = document.getElementById('voiceText');
      if (firstFocusable) {
        // firstFocusable.setAttribute('tabindex', '0');
        firstFocusable.focus();
      }

      const micButton = document.querySelector('button.mic-btn');
      if (micButton && !micButton.disabled) {
        micButton.disabled = true;
      }

      const headerSearchWrap = document.getElementById('headerSearchWrap');
      if (headerSearchWrap) {
        headerSearchWrap.classList.add('remove_focus');
      }

      console.log('Focus trap applied for Voice Search modal', {
        modalNodes: modalNodes.length,
        nonModalNodes: nonModalNodes.length,
        timestamp: new Date().toISOString(),
      });
    } else if (!shouldTrap && this.nonModalNodes.length > 0) {
      const failedRestorations = [];
      for (let i = 0; i < this.nonModalNodes.length; i++) {
        const node = this.nonModalNodes[i];
        if (node._prevTabindex !== 'none') {
          node.setAttribute('tabindex', node._prevTabindex);
        } else {
          node.removeAttribute('tabindex');
        }
        node.style.outline = '';
        if (node.hasAttribute('tabindex') && node.getAttribute('tabindex') === '-1') {
          failedRestorations.push({ tag: node.tagName, id: node.id, class: node.className });
        }
        node._prevTabindex = null;
      }

      console.log('Tabindex restored for non-modal elements', {
        restoredNodes: this.nonModalNodes.length,
        failedRestorations,
        timestamp: new Date().toISOString(),
      });

      const micButton = document.querySelector('button.mic-btn');
      if (micButton) {
        if (micButton.disabled) {
          micButton.disabled = false;
          console.log('Microphone button enabled', {
            tag: micButton.tagName,
            class: micButton.className,
            timestamp: new Date().toISOString(),
          });
        }

        const headerSearchWrap = document.getElementById('headerSearchWrap');
        if (headerSearchWrap) {
          headerSearchWrap.classList.remove('remove_focus');
        }
        
        micButton.focus();
        console.log('Focused microphone button after modal close', {
          tag: micButton.tagName,
          id: micButton.id,
          class: micButton.className,
          timestamp: new Date().toISOString(),
        });
      } else {
        const focusableSelector = `
          a[href], 
          button:not([disabled]), 
          input:not([disabled]), 
          select:not([disabled]), 
          textarea:not([disabled]), 
          [tabindex]:not([tabindex="-1"]), 
          [contenteditable="true"], 
          area[href], 
          details, 
          summary, 
          iframe, 
          object, 
          embed, 
          li[data-testid="breadcrumb-item"], 
          li[data-testid="breadcrumb-item"] a, 
          li[data-testid="breadcrumb-item"] button, 
          li[data-testid="breadcrumb-item"] [tabindex]
        `;
        
        const firstPageFocusable = document.querySelector(focusableSelector);
        if (firstPageFocusable) {
          firstPageFocusable.focus();
          console.log('Focused first page element after modal close', {
            tag: firstPageFocusable.tagName,
            id: firstPageFocusable.id,
            class: firstPageFocusable.className,
            timestamp: new Date().toISOString(),
          });
        }
      }

      this.nonModalNodes = [];
    }
  };

  componentDidUpdate(prevProps, prevState) {
    if (this.state.showModal && !prevState.showModal) {
      this.trapFocusInModal(true);
    } else if (!this.state.showModal && prevState.showModal) {
      this.trapFocusInModal(false);
    }
    if (this.state.finalText !== prevState.finalText || this.state.interimText !== prevState.interimText) {
      this.forceUpdate();
      console.log('Text updated, forcing re-render', { finalText: this.state.finalText, interimText: this.state.interimText, timestamp: new Date().toISOString() });
    }
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
          method: 'POST',
          body: formData,
        });
        console.log('Transcription API response received', { status: response.status, headers: Object.fromEntries(response.headers.entries()), timestamp: new Date().toISOString() });
        const data = await response.json();
        console.log('Transcription API data parsed', { data, timestamp: new Date().toISOString() });

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
                // voiceText.setAttribute('aria-live', 'polite');
                // voiceText.setAttribute('tabindex', '0');
                      // role="status"
                // voiceText.setAttribute('aria-live', 'assertive');
                // voiceText.setAttribute('role', 'status');

                voiceText.focus();
                // setTimeout(() => {
                //   if (voiceText) {
                //     voiceText.setAttribute('aria-live', 'polite');
                //   }
                // }, 2000);
              }
              this.forceUpdate();
            });
          } else {
            console.log('Transcription returned empty text, using interimText', { interimText: this.state.interimText, transcriptBuffer: this.state.transcriptBuffer, timestamp: new Date().toISOString() });
            const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'No speech detected. Please speak clearly and try again.';
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
                voiceText.setAttribute('aria-live', 'assertive');
                voiceText.focus();
                setTimeout(() => {
                  if (voiceText) {
                    voiceText.setAttribute('aria-live', 'polite');
                  }
                }, 2000);
              }
            });
          }
        } else {
          console.error('Transcription API error:', { status: response.status, error: data.error || 'Unknown error', data, timestamp: new Date().toISOString() });
          const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Transcription error. Please try again.';
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
              voiceText.setAttribute('aria-live', 'assertive');
              voiceText.focus();
              setTimeout(() => {
                if (voiceText) {
                  voiceText.setAttribute('aria-live', 'polite');
                  }
                }, 2000);
              }
            });
          }
        } catch (error) {
          console.error('Transcription API fetch error:', { error: error.message, stack: error.stack, timestamp: new Date().toISOString() });
          const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Error connecting to transcription service. Please try again.';
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
              voiceText.setAttribute('aria-live', 'assertive');
              voiceText.focus();
              setTimeout(() => {
                if (voiceText) {
                  voiceText.setAttribute('aria-live', 'polite');
                }
              }, 2000);
            }
          });
        }
      } catch (error) {
        console.error('Error in handleMediaRecorderStop:', { error: error.message, stack: error.stack, timestamp: new Date().toISOString() });
        const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Error processing audio. Please try again.';
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
            voiceText.setAttribute('aria-live', 'assertive');
            voiceText.focus();
            setTimeout(() => {
              if (voiceText) {
                voiceText.setAttribute('aria-live', 'polite');
              }
            }, 2000);
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
    };

    handleAudioSearch = async () => {
      if (this.isStartingRef.current || this.isStoppingRef.current) {
        console.log('Audio search or cleanup in progress, ignoring', { timestamp: new Date().toISOString() });
        this.setState({ debugMessage: 'Audio search or cleanup in progress, ignoring', canRespeak: true });
        return;
      }

      console.log('handleAudioSearch started', { currentLang: this.props.currentLang, browser: navigator.userAgent, timestamp: new Date().toISOString() });

      this.setState({
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
      });
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
      if (this.isStoppingRef.current) {
        console.log('Stop recording ignored: already stopping', { timestamp: new Date().toISOString() });
        this.setState({ debugMessage: 'Stop recording ignored: already stopping' });
        return;
      }

      this.isStoppingRef.current = true;
      console.log('Stop recording initiated', { showModal: this.state.showModal, isListening: this.state.isListening, interimText: this.state.interimText, transcriptBuffer: this.state.transcriptBuffer, recordingStartTime: this.state.recordingStartTime, timestamp: new Date().toISOString() });
      this.setState({ 
        debugMessage: 'Stop recording initiated', 
        isListening: false, 
        modalMessage: 'Processing transcription...',
        finalText: this.state.transcriptBuffer.join(' ') || this.state.interimText || 'Processing transcription...',
        canRespeak: false,
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
              setTimeout(() => {
                if (voiceText) {
                  voiceText.setAttribute('aria-live', 'polite');
                }
              }, 2000);
            }
          });
          this.cleanupAfterStop();
          return;
        }
      } else {
        console.log('MediaRecorder already stopped or not initialized', { state: this.mediaRecorder.current?.state || 'null', timestamp: new Date().toISOString() });
        const fallbackText = this.state.transcriptBuffer.join(' ') || this.state.interimText || 'No audio recorded. Please try again.';
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
            setTimeout(() => {
              if (voiceText) {
                voiceText.setAttribute('aria-live', 'polite');
              }
            }, 2000);
          }
        });
        this.cleanupAfterStop();
        return;
      }

      console.log('Stop recording completed', { isStarting: this.isStartingRef.current, isStopping: this.isStoppingRef.current, showModal: this.state.showModal, interimText: this.state.interimText, transcriptBuffer: this.state.transcriptBuffer, timestamp: new Date().toISOString() });
    };

    handleEscKey = (event) => {
      if (event.key === 'Escape' && this.state.showModal && !this.isStoppingRef.current) {
        event.stopPropagation();
        event.preventDefault();
        console.log('ESC key detected', { showModal: this.state.showModal, interimText: this.state.interimText, timestamp: new Date().toISOString() });
        this.audioChunksRef.current = [];
        this.isStartingRef.current = false;
        this.isStoppingRef.current = false;
        if (this.recordingTimeout) {
          clearTimeout(this.recordingTimeout);
          this.recordingTimeout = null;
        }
        if (this.speechRecognition.current) {
          this.speechRecognition.current.stop();
          this.speechRecognition.current = null;
        }
        this.handleStopRecording(true);
      }
    };

    render() {
      return (
        <>
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
            <div className="voice-modal show" tabIndex="-1" aria-labelledby="voiceSearchModalLabel" aria-modal="true" role="dialog">
              <div className="modal-dialog modal-dialog-centered modal-lg" role="dialog">
                <div className="mx-modal-content">
                  <div className="mx-modal-header">
                    <h5 className="mx-modal-title" id="voiceSearchModalLabel">
                      Voice Search
                    </h5>
                    <button
                      type="button"
                      className="btn-close"
                      onClick={() => this.handleStopRecording(true)}
                      aria-label="Close"
                      disabled={this.isStoppingRef.current}
                    ></button>
                  </div>

                  <div className="modal-body">
                    <p className="text-gray-700 mb-4 text-base" id="voiceText" 
                      tabindex="0"
                      aria-label={this.state.finalText || this.state.interimText || this.state.modalMessage || 'Click Speak to start speaking, then click Stop after you finish.'}
                      >
                        <span>
                      {this.state.finalText || this.state.interimText || this.state.modalMessage || 'Click Speak to start speaking, then click Stop after you finish.'}
                        </span>
                    </p>
                    {process.env.NODE_ENV === 'dev' && this.state.debugMessage && (
                      <p className="text-xs text-gray-500 mt-2 break-words">Output: {this.state.debugMessage}</p>
                    )}
                  </div>
                  <div className="mx-modal-footer btn-modal-search">
                    <button
                      onClick={this.handleSpeak}
                      className="btn"
                      disabled={this.state.isListening || this.isStartingRef.current || this.isStoppingRef.current || !this.state.canRespeak}
                      aria-label="Start recording"
                    >
                      Speak
                    </button>
                    <button
                      onClick={() => this.handleStopRecording(false)}
                      className="btn"
                      disabled={!this.state.isListening || this.isStoppingRef.current}
                      aria-label="Stop recording"
                    >
                      <FontAwesomeIcon icon={faStop} /> Stop
                    </button>
                    <button
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
                      className="btn"
                      disabled={!this.state.canSearch}
                      aria-label="Search with transcribed text"
                    >
                      Search
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      );
    }
  }

  export default AudioSearch;