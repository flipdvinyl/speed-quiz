import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { QuizQuestion, Player, GameState } from './types';
import { quizQuestions } from './data';
import './App.css';

// 목소리 목록 정의
const voiceList = [
  { id: '7923018d32ff96a5d2ccc5', name: 'Goro', style: 'happy', speed: 1.2 },
  { id: '1d1e8432baf80566635226', name: 'Rachel', style: 'happy', speed: 1.2 },
  { id: 'c913e4f120724f32fb72de', name: 'Rick', style: 'embarrassed', speed: 1.2 },
  { id: '32d43349abb5df0c414df1', name: 'Evan', style: 'sad', speed: 1.2 },
  { id: '8f613eacb1f3ccd5abb1cb', name: 'Kadako', style: 'neutral', speed: 1.2 },
  { id: '812658ca9168fd9e2a9afe', name: 'Saza', style: 'neutral', speed: 1.3 },
  { id: '084714312eb4ec06fbfe51', name: 'Tilly', style: 'shy', speed: 1.2 },
  { id: '52dc253df44d06aa7f0867', name: 'Bella', style: 'angry', speed: 1.2 },
  { id: '7c8586b2869391ac4c7389', name: 'Dorothy', style: 'excited', speed: 1.2 },
  { id: '5a56362b7597d7e3218bdf', name: 'Jack', style: 'angry', speed: 1.0 },
  { id: '427bbfa89704dfba8feed4', name: 'Kaori', style: 'surprised', speed: 1.2 },
  { id: 'd2309f803e351a6683438b', name: 'Yepi', style: 'sleepy', speed: 1.1 },
  { id: '7f8873011eeba6f11b750f', name: 'Ken', style: 'angry', speed: 1.2 }
];

// 랜덤 목소리 선택 함수
const getRandomVoice = () => {
  const randomIndex = Math.floor(Math.random() * voiceList.length);
  return voiceList[randomIndex];
};

// TTS API 호출 함수
const generateTTS = async (text: string, abortController?: AbortController): Promise<string> => {
  try {
    // 랜덤 목소리 선택
    const randomVoice = getRandomVoice();
    
    const requestBody = {
      text: text,
      voice_id: randomVoice.id,
      style: randomVoice.style,
      voice_settings: {
        pitch_shift: 0,
        pitch_variance: 1,
        speed: randomVoice.speed
      }
    };
    
    console.log(`🎤 선택된 목소리: ${randomVoice.name} (${randomVoice.style}, ${randomVoice.speed}x)`);
    
    console.log('🎤 TTS API 요청:', JSON.stringify(requestBody, null, 2));
    
    // llm-api 프로젝트의 Vercel URL을 사용
    const response = await fetch('https://quiet-ink-groq.vercel.app/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: abortController?.signal
    });

    console.log('🎤 TTS API 응답 상태:', response.status);
    console.log('🎤 TTS API 응답 헤더:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API 응답 에러:', response.status, errorText);
      throw new Error(`TTS API 호출 실패: ${response.status} ${errorText}`);
    }

    const audioBlob = await response.blob();
    console.log('🎤 TTS 오디오 생성 완료:', audioBlob.size, 'bytes');
    return URL.createObjectURL(audioBlob);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('🎤 TTS API 요청 취소됨');
    } else {
      console.error('TTS 생성 실패:', error);
    }
    return '';
  }
};

// 무음 오디오 재생 함수
const playSilentAudio = () => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const source = ctx.createBufferSource();
  source.buffer = ctx.createBuffer(1, 1, 22050);
  source.connect(ctx.destination);
  source.start(0);
  setTimeout(() => ctx.close(), 300);
};

function App() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [gameTimeLeft, setGameTimeLeft] = useState(120);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [rankings, setRankings] = useState<Player[]>([]);
  const [animationKey, setAnimationKey] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionText, setTransitionText] = useState('');
  const [typingText, setTypingText] = useState('');
  const [typingPhase, setTypingPhase] = useState<'typing' | 'hold' | 'deleting' | 'none'>('none');
  const [visibleCharCount, setVisibleCharCount] = useState(0);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string>('');
  const answerInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [questionOrder, setQuestionOrder] = useState<number[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [lastProcessedQuestionId, setLastProcessedQuestionId] = useState<number | null>(null);
  const [isProcessingNextQuestion, setIsProcessingNextQuestion] = useState(false);
  const isProcessingRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentTTSRequestRef = useRef<AbortController | null>(null);
  const [ttsBuffer, setTtsBuffer] = useState<Map<number, string>>(new Map());
  const [isBuffering, setIsBuffering] = useState(false);
  const isBufferingRef = useRef(false);
  const ttsBufferRef = useRef<Map<number, string>>(new Map()); // 동기적 버퍼 참조
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null); // BGM 오디오 참조

  // BGM 중지 함수
  const stopBGM = useCallback(() => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.pause();
      bgmAudioRef.current.currentTime = 0;
      bgmAudioRef.current = null;
      console.log('🔇 BGM 중지됨');
    }
  }, []);

  // 현재 재생 중인 오디오와 TTS 요청 정리
  const cleanupCurrentAudio = useCallback(() => {
    console.log('🧹 오디오 정리 시작');
    
    // 현재 재생 중인 오디오 정지
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      console.log('🧹 현재 재생 중인 오디오 정지됨');
    }
    
    // 진행 중인 TTS 요청 취소
    if (currentTTSRequestRef.current) {
      currentTTSRequestRef.current.abort();
      currentTTSRequestRef.current = null;
      console.log('🧹 진행 중인 TTS 요청 취소됨');
    }
    
    // 오디오 URL 정리
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      setCurrentAudioUrl('');
      console.log('🧹 오디오 URL 정리됨');
    }
    
    // BGM 중지
    stopBGM();
    
    // TTS 버퍼는 유지 (정리하지 않음)
    console.log(`📦 TTS 버퍼 유지: ${ttsBuffer.size}개 항목`);
  }, [currentAudioUrl, ttsBuffer, stopBGM]);

  // 게임 종료 시 모든 리소스 정리
  const cleanupAllResources = useCallback(() => {
    console.log('🧹 모든 리소스 정리 시작');
    
    // 현재 재생 중인 오디오 정지
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
    }
    
    // 진행 중인 TTS 요청 취소
    if (currentTTSRequestRef.current) {
      currentTTSRequestRef.current.abort();
      currentTTSRequestRef.current = null;
    }
    
    // 오디오 URL 정리
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      setCurrentAudioUrl('');
    }
    
    // TTS 버퍼 정리
    if (ttsBuffer.size > 0) {
      ttsBuffer.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      setTtsBuffer(new Map());
      console.log('🧹 TTS 버퍼 정리됨');
    }
    
    // BGM 중지
    stopBGM();
    
    console.log('🧹 모든 리소스 정리 완료');
  }, [currentAudioUrl, ttsBuffer, stopBGM]);

  // 오디오 컨텍스트 활성화 (자동 재생 정책 우회)
  const activateAudioContext = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        audioContext.resume();
        console.log('🔊 오디오 컨텍스트 활성화됨');
      }
    } catch (error) {
      console.error('❌ 오디오 컨텍스트 활성화 실패:', error);
    }
  }, []);

  // BGM 재생 함수
  const playBGM = useCallback(async () => {
    try {
      // 기존 BGM 정지
      if (bgmAudioRef.current) {
        bgmAudioRef.current.pause();
        bgmAudioRef.current.currentTime = 0;
      }
      
      // 새로운 BGM 생성
      const bgm = new Audio('/speed_quiz_bg_01.mp3');
      bgm.volume = 0.5; // 볼륨 50%
      bgm.loop = true; // 반복 재생
      bgmAudioRef.current = bgm;
      
      console.log('🎵 BGM 로딩 시작...');
      
      // 오디오 로드 완료 대기
      await new Promise((resolve, reject) => {
        bgm.addEventListener('canplaythrough', resolve, { once: true });
        bgm.addEventListener('error', reject, { once: true });
        bgm.load();
      });
      
      console.log('🎵 BGM 재생 시작 (볼륨: 50%)');
      
      // BGM 재생
      await bgm.play();
      
    } catch (error) {
      console.error('❌ BGM 재생 실패:', error);
    }
  }, []);

  // BGM 볼륨 조절 함수
  const setBGMVolume = useCallback((volume: number) => {
    if (bgmAudioRef.current) {
      bgmAudioRef.current.volume = volume;
      console.log(`🎵 BGM 볼륨 변경: ${Math.round(volume * 100)}%`);
    }
  }, []);

  // TTS 버퍼링 함수
  const bufferTTS = useCallback(async (questionId: number, questionText: string) => {
    console.log(`📦 TTS 버퍼링 시작: 문제 ID ${questionId}`);
    
    // 이미 버퍼에 있으면 스킵
    if (ttsBufferRef.current.has(questionId)) {
      console.log(`⏭️ 이미 버퍼에 존재하여 스킵: 문제 ID ${questionId}`);
      return ttsBufferRef.current.get(questionId);
    }
    
    try {
      const audioUrl = await generateTTS(questionText);
      if (audioUrl) {
        // 동기적으로 버퍼에 추가
        ttsBufferRef.current.set(questionId, audioUrl);
        
        // 상태도 업데이트 (UI 동기화용)
        setTtsBuffer(prev => {
          const newBuffer = new Map(prev);
          newBuffer.set(questionId, audioUrl);
          console.log(`✅ TTS 버퍼링 완료: 문제 ID ${questionId}, 현재 버퍼 크기: ${newBuffer.size}`);
          return newBuffer;
        });
        
        return audioUrl; // 성공 시 URL 반환
      }
    } catch (error) {
      console.error(`❌ TTS 버퍼링 실패: 문제 ID ${questionId}`, error);
    }
    return null;
  }, []);

  // 순차적 TTS 버퍼링
  const startSequentialBuffering = useCallback(async () => {
    if (isBufferingRef.current || questionOrder.length === 0) {
      console.log(`🚫 버퍼링 차단: isBuffering=${isBufferingRef.current}, questionOrder.length=${questionOrder.length}`);
      return;
    }
    
    isBufferingRef.current = true;
    setIsBuffering(true);
    console.log('🚀 순차적 TTS 버퍼링 시작');
    
    // 현재 인덱스부터 최소 3개 문제를 버퍼링
    const bufferCount = Math.min(3, questionOrder.length);
    const bufferedUrls = new Map<number, string>();
    
    // 동기적으로 현재 버퍼 상태 확인
    console.log(`📊 버퍼링 시작 시 현재 ref 버퍼: [${Array.from(ttsBufferRef.current.keys()).join(', ')}]`);
    
    for (let i = 0; i < bufferCount; i++) {
      const questionIndex = (currentQuestionIndex + i) % questionOrder.length;
      const questionId = questionOrder[questionIndex];
      const question = quizQuestions.find(q => q.id === questionId);
      
      // 동기적으로 버퍼에서 확인 (useRef 사용)
      if (question && !ttsBufferRef.current.has(questionId)) {
        // 이미 재생된 문제나 현재 재생 중인 문제는 버퍼링하지 않음
        if (lastProcessedQuestionId === questionId) {
          console.log(`⏭️ 이미 재생된 문제 스킵: 문제 ID ${questionId}`);
          continue;
        }
        
        console.log(`📦 버퍼링 대상: 문제 ID ${questionId} (인덱스 ${questionIndex}), 현재 ref 버퍼: [${Array.from(ttsBufferRef.current.keys()).join(', ')}]`);
        const audioUrl = await bufferTTS(questionId, question.description);
        if (audioUrl) {
          bufferedUrls.set(questionId, audioUrl);
          console.log(`✅ 버퍼링 완료: 문제 ID ${questionId}, 현재 ref 버퍼: [${Array.from(ttsBufferRef.current.keys()).join(', ')}]`);
        }
        // 버퍼링 간격 (서버 부하 방지)
        await new Promise(resolve => setTimeout(resolve, 500));
      } else if (question) {
        console.log(`⏭️ 이미 버퍼됨: 문제 ID ${questionId}, 현재 ref 버퍼: [${Array.from(ttsBufferRef.current.keys()).join(', ')}]`);
      }
    }
    
    isBufferingRef.current = false;
    setIsBuffering(false);
    console.log(`✅ 순차적 TTS 버퍼링 완료. 새로 버퍼된 항목: [${Array.from(bufferedUrls.keys()).join(', ')}]`);
  }, [questionOrder, currentQuestionIndex, bufferTTS, lastProcessedQuestionId]);

  // 문제 순서 생성 함수
  const generateQuestionOrder = useCallback(() => {
    const questionIds = quizQuestions.map(q => q.id);
    const shuffledIds = [...questionIds];
    
    // Fisher-Yates 셔플 알고리즘
    for (let i = shuffledIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
    }
    
    return shuffledIds;
  }, []);

  // 초기 버퍼링 함수 (첫 화면에서 실행)
  const startInitialBuffering = useCallback(async () => {
    if (isBufferingRef.current) {
      console.log(`🚫 초기 버퍼링 차단: 이미 버퍼링 중`);
      return;
    }
    
    console.log('🚀 초기 TTS 버퍼링 시작 (첫 화면)');
    
    // 문제 순서 생성 (게임 시작 전 미리 생성)
    const initialQuestionOrder = generateQuestionOrder();
    setQuestionOrder(initialQuestionOrder);
    
    isBufferingRef.current = true;
    setIsBuffering(true);
    
    // 처음 5개 문제를 미리 버퍼링
    const bufferCount = Math.min(5, initialQuestionOrder.length);
    const bufferedUrls = new Map<number, string>();
    
    console.log(`📊 초기 버퍼링 대상: ${bufferCount}개 문제`);
    
    for (let i = 0; i < bufferCount; i++) {
      const questionId = initialQuestionOrder[i];
      const question = quizQuestions.find(q => q.id === questionId);
      
      if (question && !ttsBufferRef.current.has(questionId)) {
        console.log(`📦 초기 버퍼링: 문제 ID ${questionId} (${i + 1}/${bufferCount})`);
        const audioUrl = await bufferTTS(questionId, question.description);
        if (audioUrl) {
          bufferedUrls.set(questionId, audioUrl);
        }
        // 초기 버퍼링은 더 빠르게 (서버 부하 고려)
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    isBufferingRef.current = false;
    setIsBuffering(false);
    console.log(`✅ 초기 TTS 버퍼링 완료. 버퍼된 항목: [${Array.from(bufferedUrls.keys()).join(', ')}]`);
  }, [generateQuestionOrder, bufferTTS]);

  // 게임 시작
  const startGame = useCallback(() => {
    if (!playerName.trim()) return; // 이름이 없으면 시작하지 않음
    
    // 기존 타이머 정리
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // 이미 문제 순서가 있으면 그대로 사용, 없으면 새로 생성
    if (questionOrder.length === 0) {
      const newQuestionOrder = generateQuestionOrder();
      setQuestionOrder(newQuestionOrder);
    }
    
    setCurrentQuestionIndex(0);
    setLastProcessedQuestionId(null);
    setIsProcessingNextQuestion(false);
    isProcessingRef.current = false;
    
    // 모든 리소스 정리 (버퍼는 유지)
    cleanupCurrentAudio();
    
    playSilentAudio();
    setGameState('playing');
    setScore(0);
    setGameTimeLeft(120);
    setCurrentQuestion(null);
    setUserAnswer('');
    setIsCorrect(null);
    setAnimationKey(0);
    setTimeLeft(15);
    
    // 오디오 컨텍스트 활성화
    activateAudioContext();
    
    // 추가 버퍼링 시작 (백그라운드에서)
    setTimeout(() => {
      startSequentialBuffering();
    }, 100);
  }, [playerName, questionOrder, generateQuestionOrder, cleanupCurrentAudio, startSequentialBuffering, activateAudioContext]);

  // 타이핑 애니메이션 함수
  const startTypingAnimation = useCallback((text: string, onComplete?: () => void) => {
    setTypingPhase('typing');
    setTypingText(text); // 전체 텍스트를 항상 설정
    
    // 타이핑 애니메이션 (0.5초)
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex < text.length) {
        // 보이는 글자 수를 업데이트
        setVisibleCharCount(currentIndex + 1);
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setTypingPhase('hold');
        
        // 1초 홀드 후 삭제 시작
        setTimeout(() => {
          setTypingPhase('deleting');
          let deleteIndex = text.length;
          const deletingInterval = setInterval(() => {
            if (deleteIndex > 0) {
              // 보이는 글자 수를 업데이트
              setVisibleCharCount(deleteIndex - 1);
              deleteIndex--;
            } else {
              clearInterval(deletingInterval);
              setTypingPhase('none');
              setTypingText('');
              setVisibleCharCount(0);
              // 애니메이션 완료 후 콜백 실행
              if (onComplete) {
                onComplete();
              }
            }
          }, 50); // 삭제 속도
        }, 1000);
      }
    }, 100); // 타이핑 속도
  }, []);

  // 각 글자별 애니메이션 시간 계산 함수
  const calculateCharacterAnimationTimes = useCallback((word: string) => {
    const totalChars = word.length;
    const remainingChars = totalChars - 1; // 첫 번째 글자 제외
    const remainingTime = 15 - 5; // 15초 - 5초(첫 번째 글자)
    const intervalPerChar = remainingTime / remainingChars; // 남은 글자당 간격
    
    // 첫 번째 글자는 5초로 고정
    const animationTimes = [5];
    
    // 나머지 글자들의 시간을 랜덤으로 생성
    const remainingTimes = [];
    for (let i = 0; i < remainingChars; i++) {
      remainingTimes.push(5 + intervalPerChar * (i + 1));
    }
    
    // 랜덤으로 섞기
    for (let i = remainingTimes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remainingTimes[i], remainingTimes[j]] = [remainingTimes[j], remainingTimes[i]];
    }
    
    // 첫 번째 글자 + 랜덤으로 섞인 나머지 글자들
    return [...animationTimes, ...remainingTimes];
  }, []);

  // 현재 문제의 애니메이션 시간 메모이제이션
  const currentAnimationTimes = useMemo(() => {
    if (!currentQuestion) return [];
    return calculateCharacterAnimationTimes(currentQuestion.word);
  }, [currentQuestion, calculateCharacterAnimationTimes]);

  // TTS 생성 및 재생 함수
  const generateAndPlayTTS = useCallback(async (question: QuizQuestion) => {
    console.log(`🔊 TTS 호출: 문제 ID ${question.id}, 현재 인덱스: ${currentQuestionIndex}, 마지막 처리: ${lastProcessedQuestionId}`);
    console.log(`📊 현재 버퍼 상태: ${ttsBuffer.size}개 항목, 버퍼된 문제들: [${Array.from(ttsBuffer.keys()).join(', ')}]`);
    
    // 이미 처리된 문제면 중복 처리 방지
    if (lastProcessedQuestionId === question.id) {
      console.log(`❌ 중복 처리 방지: 문제 ID ${question.id}`);
      return;
    }
    
    // 기존 오디오 정리 (BGM은 유지)
    console.log('🧹 TTS 오디오 정리 시작');
    
    // 현재 재생 중인 TTS 오디오 정지
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      console.log('🧹 현재 재생 중인 TTS 오디오 정지됨');
    }
    
    // 진행 중인 TTS 요청 취소
    if (currentTTSRequestRef.current) {
      currentTTSRequestRef.current.abort();
      currentTTSRequestRef.current = null;
      console.log('🧹 진행 중인 TTS 요청 취소됨');
    }
    
    // 오디오 URL 정리
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      setCurrentAudioUrl('');
      console.log('🧹 TTS 오디오 URL 정리됨');
    }
    
    // BGM 볼륨을 20%로 줄임 (중지하지 않음)
    setBGMVolume(0.2);
    
    // BGM이 없으면 재생 시작
    if (!bgmAudioRef.current) {
      await playBGM();
    }
    
    setLastProcessedQuestionId(question.id);
    
    try {
      let audioUrl: string;
      
      // 동기적으로 버퍼에서 확인 (useRef 사용)
      const hasInBuffer = ttsBufferRef.current.has(question.id);
      console.log(`🔍 버퍼 확인: 문제 ID ${question.id}, 버퍼에 있음: ${hasInBuffer}`);
      console.log(`📊 ref 버퍼 상태: [${Array.from(ttsBufferRef.current.keys()).join(', ')}]`);
      
      if (hasInBuffer) {
        audioUrl = ttsBufferRef.current.get(question.id)!;
        console.log(`📦 버퍼에서 TTS 사용: 문제 ID ${question.id}`);
        console.log(`🔗 오디오 URL: ${audioUrl.substring(0, 50)}...`);
        
        // 즉시 재생
        setCurrentAudioUrl(audioUrl);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        
        console.log(`🎵 버퍼 오디오 재생 시도: 문제 ID ${question.id}`);
        try {
          // 오디오 로드 완료 대기
          await new Promise((resolve, reject) => {
            audio.addEventListener('canplaythrough', resolve, { once: true });
            audio.addEventListener('error', reject, { once: true });
            audio.load();
          });
          
          await audio.play();
          console.log(`✅ 버퍼 TTS 재생 완료: 문제 ID ${question.id}`);
          
          // 재생 완료 후 버퍼에서 제거 (성공적으로 재생된 후에만)
          ttsBufferRef.current.delete(question.id);
          setTtsBuffer(prev => {
            const newBuffer = new Map(prev);
            newBuffer.delete(question.id);
            console.log(`📦 버퍼에서 제거됨: 문제 ID ${question.id}, 남은 버퍼: ${newBuffer.size}개`);
            return newBuffer;
          });
          
        } catch (playError) {
          console.error(`❌ 버퍼 오디오 재생 실패: 문제 ID ${question.id}`, playError);
          // 재생 실패 시 버퍼에서 제거하지 않음
        }
        
      } else {
        // 버퍼에 없으면 우선순위를 높여 TTS 생성
        console.log(`🚨 버퍼에 없음 - 우선순위 TTS 생성: 문제 ID ${question.id}`);
        
        // 새로운 AbortController 생성
        const abortController = new AbortController();
        currentTTSRequestRef.current = abortController;
        
        audioUrl = await generateTTS(question.description, abortController);
        
        // 요청이 취소되었으면 처리하지 않음
        if (abortController.signal.aborted) {
          console.log(`❌ TTS 요청 취소됨: 문제 ID ${question.id}`);
          return;
        }
        
        currentTTSRequestRef.current = null;
        
        // 생성된 TTS 재생
        setCurrentAudioUrl(audioUrl);
        const audio = new Audio(audioUrl);
        currentAudioRef.current = audio;
        
        console.log(`🎵 우선순위 오디오 재생 시도: 문제 ID ${question.id}`);
        try {
          // 오디오 로드 완료 대기
          await new Promise((resolve, reject) => {
            audio.addEventListener('canplaythrough', resolve, { once: true });
            audio.addEventListener('error', reject, { once: true });
            audio.load();
          });
          
          await audio.play();
          console.log(`✅ 우선순위 TTS 재생 완료: 문제 ID ${question.id}`);
        } catch (playError) {
          console.error(`❌ 우선순위 오디오 재생 실패: 문제 ID ${question.id}`, playError);
        }
      }
      
      // 다음 문제들을 미리 버퍼링 (백그라운드에서)
      setTimeout(() => {
        startSequentialBuffering();
      }, 100);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`❌ TTS 요청 취소됨: 문제 ID ${question.id}`);
      } else {
        console.error('TTS 생성 또는 재생 실패:', error);
      }
    } finally {
      // 오디오 로딩 완료
    }
  }, [lastProcessedQuestionId, currentQuestionIndex, currentAudioUrl, ttsBuffer, startSequentialBuffering, playBGM, setBGMVolume]);

  // 다음 문제로 넘어가기
  const goToNextQuestion = useCallback(() => {
    // 즉시 차단 (ref 사용)
    if (isProcessingRef.current) {
      console.log(`🚫 goToNextQuestion 즉시 차단: 이미 처리 중`);
      return;
    }
    
    if (!currentQuestion || isTransitioning || isProcessingNextQuestion) {
      console.log(`🚫 goToNextQuestion 차단: currentQuestion=${!!currentQuestion}, isTransitioning=${isTransitioning}, isProcessingNextQuestion=${isProcessingNextQuestion}`);
      return;
    }
    
    console.log(`🔄 goToNextQuestion 시작: 문제 ID ${currentQuestion.id}`);
    isProcessingRef.current = true;
    setIsProcessingNextQuestion(true);
    setIsTransitioning(true);
    setTransitionText('다음문제');
    setUserAnswer('');
    setIsCorrect(null);
    
    // 현재 TTS 오디오만 정리 (BGM은 유지)
    console.log('🧹 TTS 오디오 정리 시작');
    
    // 현재 재생 중인 TTS 오디오 정지
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      console.log('🧹 현재 재생 중인 TTS 오디오 정지됨');
    }
    
    // 진행 중인 TTS 요청 취소
    if (currentTTSRequestRef.current) {
      currentTTSRequestRef.current.abort();
      currentTTSRequestRef.current = null;
      console.log('🧹 진행 중인 TTS 요청 취소됨');
    }
    
    // 오디오 URL 정리
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      setCurrentAudioUrl('');
      console.log('🧹 TTS 오디오 URL 정리됨');
    }
    
    // BGM 볼륨을 20%로 줄임 (중지하지 않음)
    setBGMVolume(0.2);
    
          // 타이핑 애니메이션 시작 (완료 후 전환)
      startTypingAnimation('다음문제', () => {
        // 인덱스 이동 후 새로운 문제 가져오기
        const nextIndex = currentQuestionIndex + 1 >= questionOrder.length ? 0 : currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        
        const nextQuestionId = questionOrder[nextIndex];
        const newQuestion = quizQuestions.find(q => q.id === nextQuestionId);
        
        console.log(`🔄 다음 문제로 이동: 인덱스 ${currentQuestionIndex} → ${nextIndex}, 문제 ID ${nextQuestionId}`);
        
        setCurrentQuestion(newQuestion || null);
        if (newQuestion) {
          generateAndPlayTTS(newQuestion);
        }
        setTimeLeft(15);
        setAnimationKey(prev => prev + 1);
        setIsTransitioning(false);
        setTransitionText('');
        setIsProcessingNextQuestion(false);
        isProcessingRef.current = false;
        
        // 문제 화면으로 돌아왔으므로 BGM 볼륨을 50%로 복구
        setBGMVolume(0.5);
      });
  }, [currentQuestion, questionOrder, currentQuestionIndex, startTypingAnimation, generateAndPlayTTS, isTransitioning, isProcessingNextQuestion, currentAudioUrl, setBGMVolume]);

  // 문제 제출
  const submitAnswer = useCallback(() => {
    // 즉시 차단 (ref 사용)
    if (isProcessingRef.current) {
      console.log(`🚫 submitAnswer 즉시 차단: 이미 처리 중`);
      return;
    }
    
    if (!currentQuestion || !userAnswer.trim() || isTransitioning || isProcessingNextQuestion) {
      console.log(`🚫 submitAnswer 차단: currentQuestion=${!!currentQuestion}, userAnswer=${!!userAnswer.trim()}, isTransitioning=${isTransitioning}, isProcessingNextQuestion=${isProcessingNextQuestion}`);
      return;
    }

    const isAnswerCorrect = userAnswer.trim().toLowerCase() === currentQuestion.word.toLowerCase();
    setIsCorrect(isAnswerCorrect);

    if (isAnswerCorrect) {
      console.log(`✅ 정답 제출: 문제 ID ${currentQuestion.id}`);
      // 남은 초의 앞자리 수로 점수 계산
      const timeScore = Math.floor(timeLeft);
      setScore(prev => prev + timeScore);
      isProcessingRef.current = true;
      setIsTransitioning(true);
      setIsProcessingNextQuestion(true);
      setUserAnswer('');
      setIsCorrect(null);
      
      // 현재 TTS 오디오만 정리 (BGM은 유지)
      console.log('🧹 TTS 오디오 정리 시작');
      
      // 현재 재생 중인 TTS 오디오 정지
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.currentTime = 0;
        currentAudioRef.current = null;
        console.log('🧹 현재 재생 중인 TTS 오디오 정지됨');
      }
      
      // 진행 중인 TTS 요청 취소
      if (currentTTSRequestRef.current) {
        currentTTSRequestRef.current.abort();
        currentTTSRequestRef.current = null;
        console.log('🧹 진행 중인 TTS 요청 취소됨');
      }
      
      // 오디오 URL 정리
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
        setCurrentAudioUrl('');
        console.log('🧹 TTS 오디오 URL 정리됨');
      }
      
          // BGM 볼륨을 20%로 줄임 (중지하지 않음)
    setBGMVolume(0.2);
      
      // 타이핑 애니메이션 시작 (완료 후 전환)
      startTypingAnimation('정답', () => {
        // 인덱스 이동 후 새로운 문제 가져오기
        const nextIndex = currentQuestionIndex + 1 >= questionOrder.length ? 0 : currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        
        const nextQuestionId = questionOrder[nextIndex];
        const newQuestion = quizQuestions.find(q => q.id === nextQuestionId);
        
        console.log(`🔄 정답 후 다음 문제로 이동: 인덱스 ${currentQuestionIndex} → ${nextIndex}, 문제 ID ${nextQuestionId}`);
        
        setCurrentQuestion(newQuestion || null);
        if (newQuestion) {
          generateAndPlayTTS(newQuestion);
        }
        setTimeLeft(15);
        setAnimationKey(prev => prev + 1);
        setIsTransitioning(false);
        setTransitionText('');
        setIsProcessingNextQuestion(false);
        isProcessingRef.current = false;
        
        // 문제 화면으로 돌아왔으므로 BGM 볼륨을 50%로 복구
        setBGMVolume(0.5);
      });
    } else {
      setUserAnswer('');
      setIsCorrect(false);
    }
  }, [currentQuestion, userAnswer, questionOrder, currentQuestionIndex, timeLeft, isTransitioning, startTypingAnimation, generateAndPlayTTS, isProcessingNextQuestion, currentAudioUrl, setBGMVolume]);

  // 이름 입력 시 엔터키 처리
  const handleNameKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && playerName.trim()) {
      playSilentAudio();
      startGame();
    }
  }, [playerName, startGame]);

  // 게임 종료
  const endGame = useCallback(() => {
    // 타이머 정리
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // BGM 중지
    stopBGM();
    
    // 모든 리소스 정리
    cleanupAllResources();
    
    setGameState('gameOver');
    const newPlayer: Player = {
      name: playerName || '익명',
      score,
      timestamp: Date.now()
    };
    setRankings(prev => [...prev, newPlayer].sort((a, b) => b.score - a.score).slice(0, 10));
  }, [playerName, score, cleanupAllResources, stopBGM]);

  // 랭킹 보기
  const showRankings = useCallback(() => {
    setGameState('ranking');
  }, []);

  // 시작 화면으로 돌아가기
  const goToStart = useCallback(() => {
    // BGM 중지
    stopBGM();
    
    // TTS 오디오만 정리 (버퍼는 유지)
    console.log('🧹 TTS 오디오 정리 시작');
    
    // 현재 재생 중인 TTS 오디오 정지
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.currentTime = 0;
      currentAudioRef.current = null;
      console.log('🧹 현재 재생 중인 TTS 오디오 정지됨');
    }
    
    // 진행 중인 TTS 요청 취소
    if (currentTTSRequestRef.current) {
      currentTTSRequestRef.current.abort();
      currentTTSRequestRef.current = null;
      console.log('🧹 진행 중인 TTS 요청 취소됨');
    }
    
    // 오디오 URL 정리
    if (currentAudioUrl) {
      URL.revokeObjectURL(currentAudioUrl);
      setCurrentAudioUrl('');
      console.log('🧹 TTS 오디오 URL 정리됨');
    }
    
    // 게임 상태 초기화
    setGameState('start');
    setCurrentQuestion(null);
    setUserAnswer('');
    setIsCorrect(null);
    setAnimationKey(0);
    setTimeLeft(15);
    setGameTimeLeft(120);
    setScore(0);
    setCurrentQuestionIndex(0);
    setLastProcessedQuestionId(null);
    setIsProcessingNextQuestion(false);
    isProcessingRef.current = false;
    
    // 문제 순서 초기화 (새로운 게임을 위해)
    setQuestionOrder([]);
    
    // 버퍼 초기화 (새로운 게임을 위해)
    ttsBufferRef.current.clear();
    setTtsBuffer(new Map());
    
    console.log('🔄 시작 화면으로 이동 완료, 초기 버퍼링 준비');
  }, [currentAudioUrl, stopBGM]);

  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState === 'playing') {
        if (e.key === 'Enter') {
          submitAnswer();
        }
      } else if (gameState === 'gameOver') {
        if (e.key === 'Enter') {
          goToStart();
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        goToStart();
      } else if (gameState === 'playing') {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          goToNextQuestion();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setGameTimeLeft(prev => Math.min(prev + 10, 300)); // 최대 300초
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setGameTimeLeft(prev => Math.max(prev - 10, 10)); // 최소 10초
        }
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, submitAnswer, goToNextQuestion, goToStart]);

  // 게임 타이머
  useEffect(() => {
    if (gameState === 'playing') {
      const gameTimer = setInterval(() => {
        setGameTimeLeft(prev => {
          if (prev <= 1) {
            endGame();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(gameTimer);
      };
    }
  }, [gameState, endGame]);

  // 문제 타이머
  useEffect(() => {
    // 기존 타이머 정리
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (gameState === 'playing' && currentQuestion && !isTransitioning) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // 시간 초과 시 자동으로 다음 문제로 넘어가기
            goToNextQuestion();
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState, currentQuestion, isTransitioning]); // isTransitioning만 의존성으로 유지

  // 첫 문제 설정
  useEffect(() => {
    if (gameState === 'playing' && !currentQuestion && questionOrder.length > 0) {
      console.log(`🎮 첫 문제 설정: 문제 순서 길이 ${questionOrder.length}`);
      // 첫 번째 문제 (인덱스 0)를 가져오기
      const firstQuestionId = questionOrder[0];
      const firstQuestion = quizQuestions.find(q => q.id === firstQuestionId);
      
      if (firstQuestion) {
        console.log(`🎯 첫 문제 설정: 문제 ID ${firstQuestionId}`);
        console.log(`📊 현재 버퍼 상태: ${ttsBuffer.size}개 항목`);
        setCurrentQuestion(firstQuestion);
        
        // 초기 버퍼링이 완료되었을 가능성이 높으므로 짧은 대기 후 TTS 재생
        setTimeout(() => {
          generateAndPlayTTS(firstQuestion);
        }, 500); // 초기 버퍼링을 고려하여 대기 시간 단축
      }
    }
  }, [gameState, currentQuestion, questionOrder, generateAndPlayTTS, ttsBuffer]);

  // 시작 화면에서 이름 입력칸에 포커스 설정
  useEffect(() => {
    if (gameState === 'start') {
      const nameInput = document.querySelector('.name-input') as HTMLInputElement;
      if (nameInput) {
        setTimeout(() => {
          nameInput.focus();
        }, 100);
      }
    }
  }, [gameState]);

  // 첫 화면에서 초기 버퍼링 시작
  useEffect(() => {
    if (gameState === 'start' && questionOrder.length === 0 && !isBuffering) {
      console.log('🎯 첫 화면에서 초기 버퍼링 시작');
      // 약간의 지연 후 초기 버퍼링 시작 (페이지 로드 완료 후)
      setTimeout(() => {
        startInitialBuffering();
      }, 500);
    }
  }, [gameState, questionOrder.length, isBuffering, startInitialBuffering]);

  // 게임 중 입력창 포커스 유지
  useEffect(() => {
    if (gameState === 'playing' && currentQuestion && !isTransitioning) {
      const interval = setInterval(() => {
        if (answerInputRef.current && document.activeElement !== answerInputRef.current) {
          answerInputRef.current.focus();
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [gameState, currentQuestion, isTransitioning]);

  return (
    <div className="app">
      <div className="container">
        {gameState === 'playing' && (
          <div className="quiz-title-fixed">
            <div className="subtitle">수퍼톤 TTS로 듣고 풀어보는</div>
            <h1 className="title">광고 상식 스피드 퀴즈</h1>
          </div>
        )}
        {gameState !== 'playing' && (
          <div className="title-container">
            <div className="subtitle">수퍼톤 TTS로 듣고 풀어보는</div>
            <h1 className="title">광고 상식 스피드 퀴즈</h1>
          </div>
        )}
        
        {gameState === 'start' && (
          <div className="start-screen">
            <h2>광고 산업 상식 퀴즈</h2>
            <p>2분 동안 최대한 많은 광고 용어를 맞춰보세요!</p>
            {isBuffering && (
              <div className="buffering-status">
                <p>🎵 오디오 준비 중... ({ttsBuffer.size}개 완료)</p>
              </div>
            )}
            <div className="input-group">
              <input
                type="text"
                placeholder="플레이어 이름을 입력하세요"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                onKeyPress={handleNameKeyPress}
                className="name-input"
              />
            </div>
            <button onClick={startGame} className="start-btn">
              게임 시작
            </button>
            <button onClick={showRankings} className="ranking-btn">
              랭킹 보기
            </button>
          </div>
        )}

        {gameState === 'playing' && (
          <div className="game-screen">
            <div className={`game-info ${isTransitioning ? 'hidden' : ''}`}>
              <div className="timer">
                <div className="timer-label">남은 시간</div>
                <div className="timer-value">
                  {gameTimeLeft}
                </div>
                <span className="timer-unit">초</span>
              </div>
              <div className="score">
                <div className="score-label">내 점수</div>
                <div className="score-value">
                  {score}
                </div>
                <span className="score-unit">점</span>
              </div>
            </div>
            
            {currentQuestion && (
              <div className="question-container">
                {/* 프로그레스바 */}
                <div 
                  key={`progress-bar-${animationKey}`}
                  className={`progress-bar ${isTransitioning ? 'hidden' : ''}`}
                >
                  <div className="progress-fill"></div>
                </div>
                
                {/* 큰 정답 영역 */}
                <div className="answer-placeholder-container">
                  <div 
                    key={animationKey}
                    className={`answer-placeholder ${isTransitioning ? 'transitioning' : ''}`}
                  >
                    {isTransitioning ? (typingPhase !== 'none' ? 
                    <div className="typing-container">
                      {typingText.split('').map((char, index) => {
                        const isEmoji = /\p{Emoji}/u.test(char);
                        return (
                          <span 
                            key={index} 
                            style={{ 
                              opacity: index < visibleCharCount ? 1 : 0
                            }}
                            className={isEmoji ? 'emoji-char' : ''}
                          >
                            {char}
                            {index === visibleCharCount - 1 && <span className="typing-cursor">|</span>}
                          </span>
                        );
                      })}
                    </div> : transitionText) : currentQuestion.word.split('').map((char, index) => (
                      <span 
                        key={index} 
                        className="answer-character"
                        style={{
                          animation: `characterBlurAnimation ${currentAnimationTimes[index]}s linear forwards`
                        }}
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 하단 입력 영역 */}
                <div className={`answer-section ${isTransitioning ? 'hidden' : ''}`}>
                  <div className="keyboard-hints">
                    <span>입력: Enter&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;다음문제: →</span>
                  </div>
                  <div className="answer-input">
                    <input
                      ref={answerInputRef}
                      type="text"
                      value={userAnswer}
                      onChange={(e) => setUserAnswer(e.target.value)}
                      placeholder={isCorrect === false ? "틀렸습니다! 다시 시도해보세요." : "광고 용어를 입력하세요"}
                      className={`answer-field ${isCorrect === false ? 'wrong-input' : ''}`}
                      autoFocus
                    />
                  </div>
                  <div className="description-container">
                    <div className="description">“ {currentQuestion.description} ”</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {gameState === 'gameOver' && (
          <div className="game-over-screen">
            <h2>게임 종료!</h2>
            <div className="final-score">
              <p>최종 점수: <span className="score-highlight">{score}점</span></p>
              <p>플레이어: {playerName || '익명'}</p>
            </div>
            
            {/* 랭킹 표시 */}
            <div className="ranking-section">
              <h3>🏆 현재 랭킹</h3>
              <div className="rankings-preview">
                {rankings.length === 0 ? (
                  <p>아직 기록이 없습니다.</p>
                ) : (
                  rankings.slice(0, 5).map((player, index) => (
                    <div key={player.timestamp} className={`ranking-preview-item ${player.name === (playerName || '익명') && player.score === score ? 'current-player' : ''}`}>
                      <span className="rank">#{index + 1}</span>
                      <span className="player-name">{player.name}</span>
                      <span className="player-score">{player.score}점</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="game-over-buttons">
              <button onClick={() => {
                setPlayerName('');
                goToStart();
              }} className="restart-btn">
                다시 시작
              </button>
            </div>
          </div>
        )}

        {gameState === 'ranking' && (
          <div className="ranking-screen">
            <h2>🏆 랭킹</h2>
            <div className="rankings-list">
              {rankings.length === 0 ? (
                <p>아직 기록이 없습니다.</p>
              ) : (
                rankings.map((player, index) => (
                  <div key={player.timestamp} className="ranking-item">
                    <span className="rank">#{index + 1}</span>
                    <span className="player-name">{player.name}</span>
                    <span className="player-score">{player.score}점</span>
                  </div>
                ))
              )}
            </div>
            <button onClick={goToStart} className="back-btn">
              메인으로 돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;