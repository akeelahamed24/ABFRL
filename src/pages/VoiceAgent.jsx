import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { voiceAgentAPI } from '@/services/api';
import { Loader2, Mic, PhoneCall, PhoneOff, Sparkles, Volume2 } from 'lucide-react';

const INITIAL_STAGE = 'intro';
const OUTBOUND_GREETING = "Hi, I'm calling to check if you're interested in our AI service.";

const normalizeText = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const VoiceAgent = () => {
  const [stage, setStage] = useState(INITIAL_STAGE);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [lastUserSpeech, setLastUserSpeech] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [error, setError] = useState('');

  const recognitionRef = useRef(null);
  const shouldResumeRef = useRef(false);
  const callActiveRef = useRef(false);
  const speakingRef = useRef(false);
  const stageRef = useRef(INITIAL_STAGE);
  const sendingRef = useRef(false);
  const spokenTextRef = useRef('');

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    callActiveRef.current = callActive;
  }, [callActive]);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  const browserSupport = useMemo(() => {
    const speechRecognitionSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    const speechSynthesisSupported = 'speechSynthesis' in window;

    return {
      speechRecognitionSupported,
      speechSynthesisSupported,
      fullySupported: speechRecognitionSupported && speechSynthesisSupported,
    };
  }, []);

  const stopSpeakingNow = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    spokenTextRef.current = '';
    speakingRef.current = false;
    setSpeaking(false);
  };

  const isLikelySynthEcho = (transcript) => {
    const normalizedTranscript = normalizeText(transcript);
    const normalizedSpokenText = normalizeText(spokenTextRef.current);

    if (!normalizedTranscript || !normalizedSpokenText) {
      return false;
    }

    return (
      normalizedSpokenText.includes(normalizedTranscript) ||
      normalizedTranscript.includes(normalizedSpokenText)
    );
  };

  const speak = async (text) => {
    if (!text) {
      return;
    }

    if (!browserSupport.speechSynthesisSupported) {
      setLastReply(text);
      return;
    }

    stopSpeakingNow();

    await new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      spokenTextRef.current = text;
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onstart = () => {
        speakingRef.current = true;
        setSpeaking(true);
      };

      const finishSpeaking = () => {
        spokenTextRef.current = '';
        speakingRef.current = false;
        setSpeaking(false);
        resolve();
      };

      utterance.onend = finishSpeaking;
      utterance.onerror = () => {
        setError('AI speech playback ran into an issue.');
        finishSpeaking();
      };

      window.speechSynthesis.speak(utterance);
    });
  };

  const sendToAI = async (message) => {
    const cleanedMessage = message.trim();
    if (!cleanedMessage || sendingRef.current) {
      return;
    }

    sendingRef.current = true;
    setError('');
    setLastUserSpeech(cleanedMessage);

    try {
      const response = await voiceAgentAPI.sendMessage({
        message: cleanedMessage,
        stage: stageRef.current,
      });

      if (!callActiveRef.current) {
        return;
      }

      setStage(response.next_stage);
      stageRef.current = response.next_stage;
      setLastReply(response.reply);
      await speak(response.reply);
    } catch (requestError) {
      if (!callActiveRef.current) {
        return;
      }

      console.error('Voice agent request failed:', requestError);
      setError('The voice agent could not reach the backend. Please try again.');
    } finally {
      sendingRef.current = false;
    }
  };

  const ensureRecognition = () => {
    if (recognitionRef.current) {
      return recognitionRef.current;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setListening(true);
    };

    recognition.onend = () => {
      setListening(false);

      if (shouldResumeRef.current && callActiveRef.current) {
        window.setTimeout(() => {
          try {
            recognition.start();
          } catch (restartError) {
            console.debug('Speech recognition restart skipped:', restartError);
          }
        }, 250);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') {
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone permission was denied. Please allow access and try again.');
      } else {
        setError('Speech recognition stopped unexpectedly. Please restart the call.');
      }
    };

    recognition.onspeechstart = () => {
      if (speakingRef.current) {
        stopSpeakingNow();
      }
    };

    recognition.onresult = (event) => {
      let heardText = '';
      let finalTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0]?.transcript || '';
        heardText += ` ${transcript}`;

        if (event.results[index].isFinal) {
          finalTranscript += ` ${transcript}`;
        }
      }

      const interimText = heardText.trim();
      if (speakingRef.current && interimText && !isLikelySynthEcho(interimText)) {
        stopSpeakingNow();
      }

      const cleanedTranscript = finalTranscript.trim();
      if (!cleanedTranscript || isLikelySynthEcho(cleanedTranscript)) {
        return;
      }

      sendToAI(cleanedTranscript);
    };

    recognitionRef.current = recognition;
    return recognition;
  };

  const startListening = async () => {
    setError('');

    if (!browserSupport.speechRecognitionSupported) {
      setError('This browser does not support voice input. Try Chrome or Edge.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
    } catch (permissionError) {
      console.error('Microphone access failed:', permissionError);
      setError('Microphone permission is required to start the voice call.');
      return;
    }

    setStage(INITIAL_STAGE);
    stageRef.current = INITIAL_STAGE;
    setLastUserSpeech('');
    setLastReply(OUTBOUND_GREETING);
    setCallActive(true);

    callActiveRef.current = true;
    shouldResumeRef.current = true;

    const recognition = ensureRecognition();
    if (!recognition) {
      setError('Speech recognition is not available in this browser.');
      setCallActive(false);
      callActiveRef.current = false;
      shouldResumeRef.current = false;
      return;
    }

    try {
      recognition.start();
    } catch (startError) {
      console.debug('Speech recognition start skipped:', startError);
    }

    await speak(OUTBOUND_GREETING);
  };

  const stopListening = () => {
    shouldResumeRef.current = false;
    callActiveRef.current = false;
    sendingRef.current = false;

    setCallActive(false);
    setListening(false);
    setSpeaking(false);
    setStage(INITIAL_STAGE);
    stageRef.current = INITIAL_STAGE;

    stopSpeakingNow();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (stopError) {
        console.debug('Speech recognition stop skipped:', stopError);
      }
    }
  };

  useEffect(() => {
    return () => {
      shouldResumeRef.current = false;
      callActiveRef.current = false;
      stopSpeakingNow();

      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try {
          recognitionRef.current.stop();
        } catch (cleanupError) {
          console.debug('Speech recognition cleanup skipped:', cleanupError);
        }
      }
    };
  }, []);

  return (
    <Layout>
      <section className="bg-gradient-to-br from-amber-50 via-orange-50 to-emerald-50 text-slate-950">
        <div className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-start lg:px-8">
          <div className="w-full lg:w-2/3">
            <div className="mb-8 max-w-2xl">
              <Badge className="mb-4 bg-emerald-500 text-slate-950 hover:bg-emerald-400">Voice Agent Demo</Badge>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Outbound AI call flow inside your browser
              </h1>
              <p className="mt-4 text-base text-slate-700 sm:text-lg">
                Start a simulated call, let the agent speak first, and continue the conversation with live voice input.
              </p>
            </div>

            <Card className="border-orange-200 bg-white/90 text-slate-950 shadow-2xl backdrop-blur">
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-slate-950">Live Call Console</CardTitle>
                    <CardDescription className="text-slate-600">
                      Current stage: <span className="font-medium capitalize text-slate-950">{stage}</span>
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={`gap-1 border ${listening ? 'border-emerald-300 bg-emerald-100 text-emerald-900' : 'border-slate-200 bg-slate-100 text-slate-700'}`}
                    >
                      <Mic className="h-3.5 w-3.5" />
                      {listening ? 'Listening...' : 'Mic idle'}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`gap-1 border ${speaking ? 'border-orange-300 bg-orange-100 text-orange-900' : 'border-slate-200 bg-slate-100 text-slate-700'}`}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      {speaking ? 'AI Speaking...' : 'AI silent'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap gap-3">
                  <Button
                    size="lg"
                    className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                    onClick={startListening}
                    disabled={callActive}
                  >
                    <PhoneCall className="h-4 w-4" />
                    Start Call
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-slate-300 bg-white text-slate-900 hover:bg-slate-100"
                    onClick={stopListening}
                    disabled={!callActive}
                  >
                    <PhoneOff className="h-4 w-4" />
                    Stop
                  </Button>
                </div>

                {error ? (
                  <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {error}
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Caller</p>
                    <p className="mt-3 min-h-20 text-base text-slate-900">
                      {lastReply || 'Press "Start Call" to let the AI agent open the conversation.'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
                    <p className="text-xs uppercase tracking-[0.28em] text-slate-500">You</p>
                    <p className="mt-3 min-h-20 text-base text-slate-900">
                      {lastUserSpeech || 'Your spoken response will appear here once the microphone picks it up.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="w-full lg:w-1/3">
            <Card className="border-emerald-200 bg-white/90 text-slate-950 shadow-xl backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <Sparkles className="h-5 w-5 text-emerald-400" />
                  Call Status
                </CardTitle>
                <CardDescription className="text-slate-600">
                  Best results come from Chrome or Edge, especially if you use headphones.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Connection</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {callActive ? 'Call in progress' : 'Call not started'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Voice support</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">
                    {browserSupport.fullySupported ? 'Ready for voice input and output' : 'Partial browser support'}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Agent behavior</p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-800">
                    <li className="flex items-start gap-2">
                      <Loader2 className={`mt-0.5 h-4 w-4 ${callActive ? 'animate-spin text-emerald-400' : 'text-slate-500'}`} />
                      Simple stage flow: intro, qualification, closing.
                    </li>
                    <li className="flex items-start gap-2">
                      <Mic className="mt-0.5 h-4 w-4 text-emerald-400" />
                      If you start talking while the AI is speaking, playback is cancelled immediately.
                    </li>
                    <li className="flex items-start gap-2">
                      <Volume2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                      Each backend reply is turned into speech with the browser SpeechSynthesis API.
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default VoiceAgent;
