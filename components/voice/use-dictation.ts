"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Live dictation with the browser's own speech recognition (Chrome, Edge,
 * Safari). Free and no key needed. Each pause ends a segment, which later
 * becomes a sentence. Chrome stops listening after a silence, so the hook
 * restarts it until the person stops on purpose.
 */

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionError = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings, then try again.",
  "service-not-allowed": "Your browser's speech service isn't available here. You can still type.",
  "audio-capture": "No microphone found. Plug one in or check your system settings.",
  network: "Speech recognition needs an internet connection.",
};

export function useDictation() {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [segments, setSegments] = useState<string[]>([]);
  const [error, setError] = useState("");
  const rec = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const collected = useRef<string[]>([]);

  useEffect(() => {
    // Known only in the browser; set after mount so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(recognitionCtor() !== null);
    return () => {
      wanted.current = false;
      rec.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError("Voice needs Chrome, Edge, or Safari. You can still type.");
      return;
    }
    setError("");
    setInterim("");
    collected.current = [];
    setSegments([]);
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          collected.current = [...collected.current, text];
          setSegments(collected.current);
        } else live += `${text} `;
      }
      setInterim(live.trim());
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wanted.current = false;
      setError(ERRORS[e.error] ?? "Voice stopped unexpectedly. Try again, or type instead.");
    };
    r.onend = () => {
      if (wanted.current) {
        try {
          r.start();
          return;
        } catch {
          // Fall through and stop.
        }
      }
      setListening(false);
      setInterim("");
    };
    rec.current = r;
    wanted.current = true;
    try {
      r.start();
      setListening(true);
    } catch {
      setError("Couldn't start the microphone. Try again.");
    }
  }, []);

  /** Stops listening and returns everything said, one entry per pause. */
  const stop = useCallback((): string[] => {
    wanted.current = false;
    rec.current?.stop();
    setListening(false);
    const all = [...collected.current];
    if (interim.trim()) all.push(interim.trim());
    setInterim("");
    return all;
  }, [interim]);

  return { supported, listening, interim, segments, error, start, stop, setError };
}
