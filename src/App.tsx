import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { QuizQuestion, Player, GameState } from './types';
import { quizQuestions } from './data';
import Confetti from './Confetti';
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

// 게임 안내 문장들
const gameIntroSentences = [
  "님 수퍼톤의 광고 상식 스피드 퀴즈에 도전해주셔서 감사합니다!",
  "이 게임은 2분동안 목소리로 제공하는 스피드 퀴즈를 최대한 빠르게 많이 맞추는 퀴즈 입니다.",
  "이 게임에 사용된 모든 목소리는 수퍼톤의 TTS기능을 사용해 수퍼톤이 보유한 캐릭터들이 발화한 목소리 입니다.",
  "답변은 한국어로만 입력하면 됩니다. 그럼 게임도 즐기고 수퍼톤의 생동감 있는 TTS도 즐겨보세요. 경품도 마련되어 있답니다. 그럼 시작!"
];

// 랜덤 목소리 선택 함수
const getRandomVoice = () => {
  const randomIndex = Math.floor(Math.random() * voiceList.length);
  return voiceList[randomIndex];
};

// 문장 분석 함수 - TTS용 텍스트와 화면 표시용 텍스트 분리
const analyzeText = (text: string): { ttsText: string; displayText: string } => {
  // 단어A::단어B:: 패턴 찾기 (OOOO::땡땡땡땡:: 형식)
  const pattern = /([A-Z]+)::([^:]+)::/g;
  let ttsText = text;
  let displayText = text;
  
  console.log('🔍 analyzeText 입력:', text);
  
  // 모든 패턴을 찾아서 처리
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const fullMatch = match[0]; // 전체 매치 (단어A::단어B::)
    const displayWord = match[1]; // 화면 표시용 (단어A)
    const ttsWord = match[2]; // TTS 발화용 (단어B)
    
    console.log('🔍 패턴 발견:', { fullMatch, displayWord, ttsWord });
    
    // TTS 텍스트에서 전체 패턴을 TTS 단어로 교체
    ttsText = ttsText.replace(fullMatch, ttsWord);
    
    // 화면 표시 텍스트에서 전체 패턴을 화면 표시 단어로 교체
    displayText = displayText.replace(fullMatch, displayWord);
  }
  
  console.log('🔍 analyzeText 결과:', { ttsText, displayText });
  
  return { ttsText, displayText };
};

// TTS API 호출 함수
const generateTTS = async (text: string, abortController?: AbortController): Promise<string> => {
  try {
    // 문장 분석하여 TTS용 텍스트 추출
    const { ttsText } = analyzeText(text);
    
    // 랜덤 목소리 선택
    const randomVoice = getRandomVoice();
    
    const requestBody = {
      text: ttsText, // 분석된 TTS용 텍스트 사용
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
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [showNameError, setShowNameError] = useState(false);
  const [rankings, setRankings] = useState<Player[]>([]);
  const [rankingScrollIndex, setRankingScrollIndex] = useState(0);
  const [animationKey, setAnimationKey] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionText, setTransitionText] = useState('');
  const [typingText, setTypingText] = useState('');
  const [typingPhase, setTypingPhase] = useState<'typing' | 'hold' | 'deleting' | 'none'>('none');
  const [visibleCharCount, setVisibleCharCount] = useState(0);
  const [descriptionTypingText, setDescriptionTypingText] = useState('');
  const [descriptionTypingPhase, setDescriptionTypingPhase] = useState<'typing' | 'none'>('none');
  const [descriptionVisibleCharCount, setDescriptionVisibleCharCount] = useState(0);
  const [startScreenTypingText, setStartScreenTypingText] = useState('');
  const [startScreenTypingPhase, setStartScreenTypingPhase] = useState<'typing' | 'hold' | 'deleting' | 'none'>('none');
  const [startScreenVisibleCharCount, setStartScreenVisibleCharCount] = useState(0);
  const startScreenTypingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startScreenDeletingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startScreenHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startScreenInputRef = useRef<HTMLInputElement>(null);
  const startScreenAnimationRef = useRef<boolean>(false);
  const escapeKeyRef = useRef<boolean>(false);
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string>('');
  const answerInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // 안내 페이지 관련 상태
  const [introCurrentSentence, setIntroCurrentSentence] = useState(0);
  const [introIsPlaying, setIntroIsPlaying] = useState(false);
  const [introCurrentAudio, setIntroCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const introSkipRef = useRef<boolean>(false); // 안내 페이지 스킵 방지용
  const introEnterBlockRef = useRef<boolean>(false); // Enter 키 입력 차단용
  const [introTypingProgress, setIntroTypingProgress] = useState(0); // 타이핑 진행도
  const introTTSRequestRef = useRef<AbortController | null>(null); // TTS 요청 취소용
  const [introTTSBuffer, setIntroTTSBuffer] = useState<Map<number, string>>(new Map()); // TTS 버퍼
  const introTTSBufferRef = useRef<Map<number, string>>(new Map()); // 동기적 버퍼 참조
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
    
    // 현재 인덱스부터 최소 10개 문제를 버퍼링
    const bufferCount = Math.min(10, questionOrder.length);
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
    
    // 처음 10개 문제를 미리 버퍼링
    const bufferCount = Math.min(10, initialQuestionOrder.length);
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

  // 안내 페이지 TTS 재생 함수
  const playIntroTTS = useCallback(async (sentenceIndex: number) => {
    // 스킵되었는지 확인
    if (introSkipRef.current) {
      console.log('⏭️ 안내 TTS 재생 중단됨 (스킵됨)');
      return;
    }
    
    if (sentenceIndex >= gameIntroSentences.length) {
      // 모든 문장 재생 완료
      setIntroIsPlaying(false);
      console.log('🎬 안내 TTS 재생 완료');
      
      // 1초 후 게임 시작
      setTimeout(() => {
        startActualGame();
      }, 1000);
      return;
    }
    
    try {
      const sentence = gameIntroSentences[sentenceIndex];
      const fullSentence = sentenceIndex === 0 ? `${playerName}${sentence}` : sentence;
      
      console.log(`🎤 안내 TTS 재생: ${sentenceIndex + 1}/${gameIntroSentences.length} - "${fullSentence}"`);
      
      // 타이핑 효과 시작 (강제로 0으로 초기화)
      setIntroTypingProgress(0);
      
      // 약간의 지연 후 타이핑 시작 (초기화 완료 보장)
      setTimeout(() => {
        const typingInterval = setInterval(() => {
          setIntroTypingProgress(prev => {
            if (prev >= fullSentence.length) {
              clearInterval(typingInterval);
              return fullSentence.length;
            }
            return prev + 1;
          });
        }, 50); // 타이핑 속도
      }, 200); // 초기화 지연 증가 (200ms)
      
      let audioUrl: string;
      
      // 동기적으로 버퍼에서 확인
      const hasInBuffer = introTTSBufferRef.current.has(sentenceIndex);
      console.log(`🔍 안내 버퍼 확인: 문장 ${sentenceIndex + 1}, 버퍼에 있음: ${hasInBuffer}`);
      
      if (hasInBuffer) {
        audioUrl = introTTSBufferRef.current.get(sentenceIndex)!;
        console.log(`📦 버퍼에서 안내 TTS 사용: 문장 ${sentenceIndex + 1}`);
        
        // 버퍼에서 제거 (성공적으로 재생된 후에만)
        introTTSBufferRef.current.delete(sentenceIndex);
        setIntroTTSBuffer(prev => {
          const newBuffer = new Map(prev);
          newBuffer.delete(sentenceIndex);
          console.log(`📦 안내 버퍼에서 제거됨: 문장 ${sentenceIndex + 1}, 남은 버퍼: ${newBuffer.size}개`);
          return newBuffer;
        });
        
      } else {
        // 버퍼에 없으면 우선순위를 높여 TTS 생성
        console.log(`🚨 안내 버퍼에 없음 - 우선순위 TTS 생성: 문장 ${sentenceIndex + 1}`);
        
        // 랜덤 목소리 선택
        const randomVoice = getRandomVoice();
        
        const requestBody = {
          text: fullSentence,
          voice_id: randomVoice.id,
          style: randomVoice.style,
          voice_settings: {
            pitch_shift: 0,
            pitch_variance: 1,
            speed: randomVoice.speed
          }
        };
        
        console.log(`🎤 안내 TTS API 요청: ${randomVoice.name} (${randomVoice.style})`);
        
        // 새로운 AbortController 생성
        const abortController = new AbortController();
        introTTSRequestRef.current = abortController;
        
        const response = await fetch('https://quiet-ink-groq.vercel.app/api/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: abortController.signal
        });
        
        if (!response.ok) {
          throw new Error(`TTS API 호출 실패: ${response.status}`);
        }
        
        // 요청이 취소되었는지 확인
        if (abortController.signal.aborted) {
          console.log('❌ 안내 TTS 요청 취소됨');
          return;
        }
        
        const audioBlob = await response.blob();
        
        // 요청이 취소되었는지 다시 확인
        if (abortController.signal.aborted) {
          console.log('❌ 안내 TTS 요청 취소됨 (오디오 생성 후)');
          URL.revokeObjectURL(URL.createObjectURL(audioBlob));
          return;
        }
        
        audioUrl = URL.createObjectURL(audioBlob);
      }
      
      // 오디오 재생
      const audio = new Audio(audioUrl);
      introAudioRef.current = audio;
      setIntroCurrentAudio(audio);
      
      // 오디오 재생 완료 대기
      await new Promise<void>((resolve, reject) => {
        audio.addEventListener('canplaythrough', () => {
          // 스킵되었는지 다시 확인
          if (introSkipRef.current) {
            console.log(`⏭️ 안내 TTS 재생 중단됨 (스킵됨): ${sentenceIndex + 1}/${gameIntroSentences.length}`);
            URL.revokeObjectURL(audioUrl);
            resolve();
            return;
          }
          
          audio.play().then(() => {
            console.log(`✅ 안내 TTS 재생 시작: ${sentenceIndex + 1}/${gameIntroSentences.length}`);
          }).catch(reject);
        }, { once: true });
        
        audio.addEventListener('ended', () => {
          console.log(`✅ 안내 TTS 재생 완료: ${sentenceIndex + 1}/${gameIntroSentences.length}`);
          URL.revokeObjectURL(audioUrl);
          resolve();
        }, { once: true });
        
        audio.addEventListener('error', reject, { once: true });
        audio.load();
      });
      
      // 다음 문장들을 미리 버퍼링 (백그라운드에서)
      setTimeout(() => {
        // 스킵되었는지 확인
        if (!introSkipRef.current) {
          startIntroBuffering(sentenceIndex + 1);
        }
      }, 100);
      
      // 다음 문장 재생 (타이핑 진행도 완전 초기화)
      setIntroCurrentSentence(sentenceIndex + 1);
      setIntroTypingProgress(0); // 다음 문장을 위해 타이핑 진행도 초기화
      setTimeout(() => {
        // 스킵되었는지 확인
        if (!introSkipRef.current) {
          playIntroTTS(sentenceIndex + 1);
        }
      }, 500); // 문장 간 0.5초 간격
      
    } catch (error) {
      console.error('❌ 안내 TTS 재생 실패:', error);
      // 에러 발생 시에도 다음 문장으로 진행
      setIntroCurrentSentence(sentenceIndex + 1);
      setTimeout(() => {
        playIntroTTS(sentenceIndex + 1);
      }, 1000);
    }
  }, [playerName, gameIntroSentences]);

  // 안내 페이지 TTS 버퍼링 함수
  const bufferIntroTTS = useCallback(async (sentenceIndex: number) => {
    // 스킵되었는지 확인
    if (introSkipRef.current) {
      console.log(`⏭️ 안내 TTS 버퍼링 중단됨 (스킵됨): 문장 ${sentenceIndex + 1}`);
      return null;
    }
    
    console.log(`📦 안내 TTS 버퍼링 시작: 문장 ${sentenceIndex + 1}`);
    
    // 이미 버퍼에 있으면 스킵
    if (introTTSBufferRef.current.has(sentenceIndex)) {
      console.log(`⏭️ 이미 버퍼에 존재하여 스킵: 문장 ${sentenceIndex + 1}`);
      return introTTSBufferRef.current.get(sentenceIndex);
    }
    
    try {
      const sentence = gameIntroSentences[sentenceIndex];
      const fullSentence = sentenceIndex === 0 ? `${playerName}${sentence}` : sentence;
      
      // 랜덤 목소리 선택
      const randomVoice = getRandomVoice();
      
      const requestBody = {
        text: fullSentence,
        voice_id: randomVoice.id,
        style: randomVoice.style,
        voice_settings: {
          pitch_shift: 0,
          pitch_variance: 1,
          speed: randomVoice.speed
        }
      };
      
      console.log(`📦 안내 TTS 버퍼링 API 요청: 문장 ${sentenceIndex + 1} - ${randomVoice.name}`);
      
      const response = await fetch('https://quiet-ink-groq.vercel.app/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        throw new Error(`TTS API 호출 실패: ${response.status}`);
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // 동기적으로 버퍼에 추가
      introTTSBufferRef.current.set(sentenceIndex, audioUrl);
      
      // 상태도 업데이트 (UI 동기화용)
      setIntroTTSBuffer(prev => {
        const newBuffer = new Map(prev);
        newBuffer.set(sentenceIndex, audioUrl);
        console.log(`✅ 안내 TTS 버퍼링 완료: 문장 ${sentenceIndex + 1}, 현재 버퍼 크기: ${newBuffer.size}`);
        return newBuffer;
      });
      
      return audioUrl;
    } catch (error) {
      console.error(`❌ 안내 TTS 버퍼링 실패: 문장 ${sentenceIndex + 1}`, error);
    }
    return null;
  }, [playerName, gameIntroSentences]);

  // 안내 페이지 순차적 버퍼링 함수
  const startIntroBuffering = useCallback(async (startIndex: number) => {
    // 스킵되었는지 확인
    if (introSkipRef.current) {
      console.log(`⏭️ 안내 페이지 순차적 버퍼링 중단됨 (스킵됨)`);
      return;
    }
    
    console.log(`🚀 안내 페이지 순차적 버퍼링 시작: 문장 ${startIndex + 1}부터`);
    
    // 남은 문장들을 버퍼링
    for (let i = startIndex; i < gameIntroSentences.length; i++) {
      // 각 반복마다 스킵 상태 확인
      if (introSkipRef.current) {
        console.log(`⏭️ 안내 페이지 순차적 버퍼링 중단됨 (스킵됨): 문장 ${i + 1}`);
        return;
      }
      
      if (introTTSBufferRef.current.has(i)) {
        console.log(`⏭️ 이미 버퍼됨: 문장 ${i + 1}`);
        continue;
      }
      
      console.log(`📦 버퍼링 대상: 문장 ${i + 1}`);
      await bufferIntroTTS(i);
      
      // 버퍼링 간격 (서버 부하 방지)
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    console.log(`✅ 안내 페이지 순차적 버퍼링 완료`);
  }, [gameIntroSentences, bufferIntroTTS]);

  // 안내 페이지 TTS 리소스 정리 함수
  const cleanupIntroTTS = useCallback(() => {
    console.log('🧹 안내 페이지 TTS 리소스 정리 시작');
    
    // 진행 중인 TTS 요청 취소
    if (introTTSRequestRef.current) {
      introTTSRequestRef.current.abort();
      introTTSRequestRef.current = null;
      console.log('🧹 안내 페이지 TTS 요청 취소됨');
    }
    
    // 현재 재생 중인 오디오 정지 (더 강력한 정리)
    if (introAudioRef.current) {
      introAudioRef.current.pause();
      introAudioRef.current.currentTime = 0;
      introAudioRef.current.src = ''; // src를 비워서 완전히 정리
      introAudioRef.current.load(); // 강제로 로드하여 정리
      introAudioRef.current = null;
      console.log('🧹 안내 페이지 오디오 정지됨');
    }
    
    // 현재 오디오 상태 정리 (더 강력한 정리)
    if (introCurrentAudio) {
      introCurrentAudio.pause();
      introCurrentAudio.currentTime = 0;
      introCurrentAudio.src = ''; // src를 비워서 완전히 정리
      introCurrentAudio.load(); // 강제로 로드하여 정리
      setIntroCurrentAudio(null);
      console.log('🧹 안내 페이지 현재 오디오 정리됨');
    }
    
    // TTS 버퍼 정리
    if (introTTSBuffer.size > 0) {
      introTTSBuffer.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      setIntroTTSBuffer(new Map());
      introTTSBufferRef.current.clear();
      console.log('🧹 안내 페이지 TTS 버퍼 정리됨');
    }
    
    // 타이핑 진행도 초기화
    setIntroTypingProgress(0);
    
    // 재생 상태 중지
    setIntroIsPlaying(false);
    
    // 현재 문장 인덱스 초기화
    setIntroCurrentSentence(0);
    
    // 모든 타이머 강제 정리 (안내 페이지 관련)
    const highestTimeoutId = setTimeout(";");
    for (let i = 0; i < highestTimeoutId; i++) {
      clearTimeout(i);
    }
    const highestIntervalId = setInterval(";");
    for (let i = 0; i < highestIntervalId; i++) {
      clearInterval(i);
    }
    
    // 페이지의 모든 오디오 요소 강제 정지
    const allAudioElements = document.querySelectorAll('audio');
    allAudioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      audio.load();
    });
    
    console.log('🧹 안내 페이지 TTS 리소스 정리 완료');
  }, [introCurrentAudio, introTTSBuffer]);

  // 실제 게임 시작 함수
  const startActualGame = useCallback(() => {
    console.log('🎮 실제 게임 시작');
    
    // 안내 페이지 TTS 리소스 정리
    cleanupIntroTTS();
    
    // 안내 페이지 관련 상태 완전 초기화
    setIntroIsPlaying(false);
    setIntroTypingProgress(0);
    setIntroCurrentSentence(0);
    introSkipRef.current = false;
    introEnterBlockRef.current = false;
    
    // 추가적인 강제 정리
    // 모든 타이머 강제 정리
    const highestTimeoutId = setTimeout(";");
    for (let i = 0; i < highestTimeoutId; i++) {
      clearTimeout(i);
    }
    const highestIntervalId = setInterval(";");
    for (let i = 0; i < highestIntervalId; i++) {
      clearInterval(i);
    }
    
    // 페이지의 모든 오디오 요소 강제 정지
    const allAudioElements = document.querySelectorAll('audio');
    allAudioElements.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
      audio.src = '';
      audio.load();
    });
    
    // 100ms 후 다시 한번 정리 (비동기 작업 완료 대기)
    setTimeout(() => {
      const allAudioElements2 = document.querySelectorAll('audio');
      allAudioElements2.forEach(audio => {
        audio.pause();
        audio.currentTime = 0;
        audio.src = '';
        audio.load();
      });
    }, 100);
    
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
    
    // 본게임 진입 시 BGM 재생
    setTimeout(() => {
      playBGM();
    }, 500);
    
    // 추가 버퍼링 시작 (백그라운드에서)
    setTimeout(() => {
      startSequentialBuffering();
    }, 100);
  }, [questionOrder, generateQuestionOrder, cleanupCurrentAudio, startSequentialBuffering, activateAudioContext, cleanupIntroTTS]);

  // 게임 시작 (안내 페이지로 이동)
  const startGame = useCallback(() => {
    if (!playerName.trim()) return; // 이름이 없으면 시작하지 않음
    
    console.log('🎬 안내 페이지 시작');
    
    // 안내 페이지 상태 초기화
    setIntroCurrentSentence(0);
    setIntroIsPlaying(true);
    setIntroTypingProgress(0); // 타이핑 진행도 초기화
    introSkipRef.current = false; // 스킵 방지 플래그 초기화
    introEnterBlockRef.current = true; // Enter 키 차단 시작
    
    // 타이핑 진행도 강제 초기화 (추가 지연)
    setTimeout(() => {
      setIntroTypingProgress(0);
    }, 50);
    
    // 안내 페이지로 이동
    setGameState('intro');
    
    // 오디오 컨텍스트 활성화
    activateAudioContext();
    
    // 2초 후 Enter 키 입력 허용
    setTimeout(() => {
      introEnterBlockRef.current = false;
      console.log('✅ 안내 페이지 Enter 키 입력 허용');
    }, 2000);
    
    // 첫 번째 문장은 즉시 재생, 나머지는 버퍼링
    setTimeout(() => {
      playIntroTTS(0);
      // 백그라운드에서 나머지 문장들 버퍼링
      setTimeout(() => {
        startIntroBuffering(1);
      }, 500);
    }, 1000);
  }, [playerName, playIntroTTS, activateAudioContext]);

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

  // 문제 설명 타이핑 애니메이션 함수
  const startDescriptionTypingAnimation = useCallback((text: string) => {
    setDescriptionTypingPhase('typing');
    setDescriptionTypingText(text);
    setDescriptionVisibleCharCount(0);
    
    // 타이핑 애니메이션 (더 빠른 속도)
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex < text.length) {
        setDescriptionVisibleCharCount(currentIndex + 1);
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setDescriptionTypingPhase('none');
      }
    }, 30); // 타이핑 속도 (더 빠름)
  }, []);

  // 시작 화면 타이핑 애니메이션 함수
  const startScreenTypingAnimation = useCallback((text: string, onComplete?: () => void) => {
    console.log('🎬 타이핑 애니메이션 시작:', text);
    
    // 이전 타이머 정리
    if (startScreenTypingTimerRef.current) {
      clearInterval(startScreenTypingTimerRef.current);
      startScreenTypingTimerRef.current = null;
    }
    
    // 상태 초기화
    setStartScreenTypingPhase('typing');
    setStartScreenTypingText(text);
    setStartScreenVisibleCharCount(0);
    
    // 타이핑 애니메이션
    let currentIndex = 0;
    const typingInterval = setInterval(() => {
      if (currentIndex < text.length) {
        setStartScreenVisibleCharCount(currentIndex + 1);
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        startScreenTypingTimerRef.current = null;
        console.log('✅ 타이핑 완료');
        // 애니메이션 완료 후 콜백 실행
        if (onComplete) {
          onComplete();
        }
      }
    }, 25); // 타이핑 속도 (2배 빠름)
    
    startScreenTypingTimerRef.current = typingInterval;
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
          // 문제 설명 타이핑 애니메이션 시작
          startDescriptionTypingAnimation(analyzeText(newQuestion.description).displayText);
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
  }, [currentQuestion, questionOrder, currentQuestionIndex, startTypingAnimation, startDescriptionTypingAnimation, generateAndPlayTTS, isTransitioning, isProcessingNextQuestion, currentAudioUrl, setBGMVolume]);

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
      
      // 콘페티 애니메이션 강제 재시작 (이전 애니메이션이 진행 중이어도)
      setShowConfetti(false);
      
      // 다음 프레임에서 새로운 애니메이션 시작
      requestAnimationFrame(() => {
        setShowConfetti(true);
        
        // 이전 타이머가 있다면 정리
        if (confettiTimerRef.current) {
          clearTimeout(confettiTimerRef.current);
        }
        
        // 5초 후 콘페티 숨기기 (타이머 ID 저장)
        const confettiTimer = setTimeout(() => {
          setShowConfetti(false);
        }, 5000);
        
        confettiTimerRef.current = confettiTimer;
      });
      
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
          // 문제 설명 타이핑 애니메이션 시작
          startDescriptionTypingAnimation(analyzeText(newQuestion.description).displayText);
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
  }, [currentQuestion, userAnswer, questionOrder, currentQuestionIndex, timeLeft, isTransitioning, startTypingAnimation, startDescriptionTypingAnimation, generateAndPlayTTS, isProcessingNextQuestion, currentAudioUrl, setBGMVolume]);

  // URL에서 name 파라미터 추출 및 디코딩 함수
  const extractNameFromURL = useCallback((url: string): string => {
    try {
      // URL 객체 생성
      const urlObj = new URL(url);
      // name 파라미터 추출
      const nameParam = urlObj.searchParams.get('name');
      if (nameParam) {
        // URL 디코딩
        const decodedName = decodeURIComponent(nameParam);
        console.log('🔗 URL에서 이름 추출:', { original: nameParam, decoded: decodedName });
        return decodedName;
      }
    } catch (error) {
      console.error('❌ URL 파싱 실패:', error);
    }
    return '';
  }, []);

  // 이름 입력 시 엔터키 처리
  const handleNameKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (playerName.trim()) {
        setShowNameError(false);
        playSilentAudio();
        startGame();
      } else {
        setShowNameError(true);
      }
    }
  }, [playerName, startGame]);

  // 이름 입력 필드 변경 처리 (URL 자동 감지)
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    
    // URL 패턴 감지 (http:// 또는 https:// 또는 @로 시작하는 경우)
    if (inputValue.startsWith('http://') || inputValue.startsWith('https://') || inputValue.startsWith('@')) {
      const urlToProcess = inputValue.startsWith('@') ? inputValue.substring(1) : inputValue;
      const extractedName = extractNameFromURL(urlToProcess);
      
      if (extractedName) {
        setPlayerName(extractedName);
        setShowNameError(false);
        console.log('✅ URL에서 이름 자동 추출 완료:', extractedName);
      } else {
        setPlayerName(inputValue);
      }
    } else {
      setPlayerName(inputValue);
    }
    
    if (showNameError) {
      setShowNameError(false);
    }
  }, [extractNameFromURL, showNameError]);

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
    setRankingScrollIndex(0);
    const newPlayer: Player = {
      name: playerName || '익명',
      score,
      timestamp: Date.now()
    };
    setRankings(prev => [...prev, newPlayer].sort((a, b) => b.score - a.score).slice(0, 10));
  }, [playerName, score, cleanupAllResources, stopBGM]);

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
    
    // 안내 페이지 TTS 리소스 정리
    cleanupIntroTTS();
    
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
    
    // 안내 페이지 상태 초기화
    setIntroCurrentSentence(0);
    setIntroIsPlaying(false);
    setIntroTypingProgress(0); // 타이핑 진행도 초기화
    introSkipRef.current = false; // 스킵 플래그 초기화
    introEnterBlockRef.current = false; // Enter 키 차단 플래그 초기화
    
    // 시작 화면 타이핑 애니메이션 초기화
    if (startScreenTypingTimerRef.current) {
      clearInterval(startScreenTypingTimerRef.current);
      startScreenTypingTimerRef.current = null;
    }
    if (startScreenDeletingTimerRef.current) {
      clearInterval(startScreenDeletingTimerRef.current);
      startScreenDeletingTimerRef.current = null;
    }
    if (startScreenHoldTimerRef.current) {
      clearTimeout(startScreenHoldTimerRef.current);
      startScreenHoldTimerRef.current = null;
    }
    
    // 모든 타이머 강제 정리
    const highestTimeoutId = setTimeout(";");
    for (let i = 0; i < highestTimeoutId; i++) {
      clearTimeout(i);
    }
    const highestIntervalId = setInterval(";");
    for (let i = 0; i < highestIntervalId; i++) {
      clearInterval(i);
    }
    
    setStartScreenTypingPhase('none');
    setStartScreenTypingText('');
    setStartScreenVisibleCharCount(0);
    startScreenAnimationRef.current = false;
    
    // 문제 순서 초기화 (새로운 게임을 위해)
    setQuestionOrder([]);
    
    // 버퍼 초기화 (새로운 게임을 위해)
    ttsBufferRef.current.clear();
    setTtsBuffer(new Map());
    
    console.log('🔄 시작 화면으로 이동 완료, 초기 버퍼링 준비');
  }, [currentAudioUrl, stopBGM, introCurrentAudio]);

  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // 키보드 이벤트 디바운싱 (중복 방지)
      if (e.repeat) return; // 키 반복 방지
      
      if (gameState === 'playing') {
        if (e.key === 'Enter') {
          submitAnswer();
        }
      } else if (gameState === 'gameOver') {
        if (e.key === 'Enter') {
          goToStart();
        }
      } else if (gameState === 'intro') {
        if (e.key === 'Enter' && !introSkipRef.current && !introEnterBlockRef.current) {
          // 안내 페이지에서 Enter 키로 스킵 (중복 방지 + 차단 해제 후)
          console.log('⏭️ 안내 페이지 스킵');
          introSkipRef.current = true; // 스킵 플래그 설정
          
          // 즉시 모든 안내 페이지 상태 초기화
          setIntroIsPlaying(false);
          setIntroTypingProgress(0);
          setIntroCurrentSentence(0);
          
          // 안내 페이지 TTS 리소스 정리
          cleanupIntroTTS();
          
          // 바로 게임 시작
          setTimeout(() => {
            startActualGame();
          }, 100);
        } else if (e.key === 'Enter' && introEnterBlockRef.current) {
          // Enter 키가 차단된 상태에서는 무시
          console.log('🚫 Enter 키 입력 차단됨');
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!escapeKeyRef.current) {
          escapeKeyRef.current = true;
          goToStart();
          setTimeout(() => {
            escapeKeyRef.current = false;
          }, 500);
        }
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
      } else if (gameState === 'gameOver') {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setRankingScrollIndex(prev => Math.max(0, prev - 1));
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const maxScrollIndex = Math.max(0, Math.ceil(rankings.length / 3) - 1);
          setRankingScrollIndex(prev => Math.min(maxScrollIndex, prev + 1));
        }
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, submitAnswer, goToNextQuestion, goToStart, introCurrentAudio, startActualGame]);

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
        
        // 첫 번째 문제 설명 타이핑 애니메이션 즉시 시작
        startDescriptionTypingAnimation(analyzeText(firstQuestion.description).displayText);
        
        // 초기 버퍼링이 완료되었을 가능성이 높으므로 짧은 대기 후 TTS 재생
        setTimeout(() => {
          generateAndPlayTTS(firstQuestion);
        }, 500); // 초기 버퍼링을 고려하여 대기 시간 단축
      }
    }
  }, [gameState, currentQuestion, questionOrder, generateAndPlayTTS, startDescriptionTypingAnimation, ttsBuffer]);

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

  // 안내 페이지에서 시작 화면으로 돌아갈 때 초기 버퍼링 재시작
  useEffect(() => {
    if (gameState === 'start' && questionOrder.length === 0 && !isBuffering && introCurrentSentence === 0) {
      console.log('🔄 안내 페이지에서 돌아온 후 초기 버퍼링 재시작');
      // 약간의 지연 후 초기 버퍼링 시작
      setTimeout(() => {
        startInitialBuffering();
      }, 500);
    }
  }, [gameState, questionOrder.length, isBuffering, startInitialBuffering, introCurrentSentence]);



  // 시작 화면에서 첫 번째 랜덤 문제 뿌리기
  useEffect(() => {
    if (gameState === 'start' && startScreenTypingPhase === 'none' && startScreenTypingText === '' && !startScreenAnimationRef.current) {
      // 중복 실행 방지
      startScreenAnimationRef.current = true;
      
      // 랜덤 문제 선택
      const randomIndex = Math.floor(Math.random() * quizQuestions.length);
      const randomQuestion = quizQuestions[randomIndex];
      const displayText = analyzeText(randomQuestion.description).displayText;
      
      console.log('🎬 첫 번째 랜덤 문제 뿌리기 (인덱스:', randomIndex, '):', displayText);
      
      // 타이핑 애니메이션 시작
      startScreenTypingAnimation(displayText, () => {
        console.log('✅ 문제 표시 완료');
        // 1초 후 다음 문제 준비
        setTimeout(() => {
          // 상태를 초기화하여 다음 문제가 뿌려지도록 함
          setStartScreenTypingPhase('none');
          setStartScreenTypingText('');
          setStartScreenVisibleCharCount(0);
          // 다음 애니메이션 허용
          startScreenAnimationRef.current = false;
        }, 1000);
      });
    }
    
    // cleanup 함수: 게임 상태가 변경되거나 컴포넌트 언마운트 시 타이머 정리
    return () => {
      if (gameState !== 'start') {
        startScreenAnimationRef.current = false;
      }
    };
  }, [gameState, startScreenTypingPhase, startScreenTypingAnimation]);

  // 시작 화면 진입 시 플레이어 이름 초기화
  useEffect(() => {
    if (gameState === 'start') {
      setPlayerName('');
      setShowNameError(false);
    }
  }, [gameState]);

  // 시작 화면에서 입력 박스 포커스 유지
  useEffect(() => {
    if (gameState === 'start' && startScreenInputRef.current) {
      // 즉시 포커스 설정
      startScreenInputRef.current.focus();
      
      const interval = setInterval(() => {
        if (startScreenInputRef.current && document.activeElement !== startScreenInputRef.current) {
          startScreenInputRef.current.focus();
        }
      }, 100);

      return () => clearInterval(interval);
    }
  }, [gameState]);

  // 게임 종료 화면에서 콘페티 반복
  useEffect(() => {
    if (gameState === 'gameOver') {
      // 즉시 첫 번째 콘페티 시작
      setShowConfetti(true);
      
      // 3초 간격으로 콘페티 반복
      const confettiInterval = setInterval(() => {
        setShowConfetti(false);
        setTimeout(() => {
          setShowConfetti(true);
        }, 100);
      }, 3000);

      return () => {
        clearInterval(confettiInterval);
        setShowConfetti(false);
      };
    } else {
      // 게임 종료가 아닐 때는 콘페티 중지
      setShowConfetti(false);
    }
  }, [gameState]);



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
      {/* 콘페티 애니메이션 */}
      <Confetti isActive={showConfetti} duration={5000} />
      
      <div className="container">
        {gameState === 'playing' && (
          <div className="quiz-title-fixed">
            <div className="subtitle">수퍼톤 TTS로 듣고 풀어보는</div>
            <h1 className="title">광고 상식 스피드 퀴즈</h1>
          </div>
        )}
        {gameState !== 'playing' && (
          <div className="quiz-title-fixed">
            <div className="subtitle">수퍼톤 TTS로 듣고 풀어보는</div>
            <h1 className="title">광고 상식 스피드 퀴즈</h1>
          </div>
        )}
        
        {gameState === 'start' && (
          <div className="game-screen">
            {/* 게임 정보 영역 숨김 */}
            <div className="game-info" style={{ visibility: 'hidden' }}>
              <div className="timer">
                <div className="timer-label">남은 시간</div>
                <div className="timer-value">--</div>
                <span className="timer-unit">초</span>
              </div>
              <div className="score">
                <div className="score-label">내 점수</div>
                <div className="score-value">--</div>
                <span className="score-unit">점</span>
              </div>
            </div>
            
            {/* 시작 화면 타이핑 애니메이션 */}
            <div className="question-container">
              <div className="description-container" style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0vh' }}>
                <div className="description" style={{ 
                  fontSize: '5vw',
                  padding: '0 5%', 
                  textAlign: 'center',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  maxWidth: '100%'
                }}>
                  {startScreenTypingPhase === 'typing' ? 
                    startScreenTypingText.split('').map((char, index) => {
                      const isEmoji = /\p{Emoji}/u.test(char);
                      return (
                        <span 
                          key={index} 
                          style={{ 
                            opacity: index < startScreenVisibleCharCount ? 1 : 0
                          }}
                          className={isEmoji ? 'emoji-char' : ''}
                        >
                          {char}
                          {index === startScreenVisibleCharCount - 1 && <span className="typing-cursor">|</span>}
                        </span>
                      );
                    }) : 
                    <>
                      {startScreenTypingText}
                      <span className="typing-cursor" style={{ opacity: 0 }}>|</span>
                    </>
                  }
                </div>
              </div>

              {/* 문제 화면과 같은 위치의 입력 영역 */}
              <div className="answer-section">
                <div className="keyboard-hints">
                  <span>게임시작: Enter</span>
                </div>
                <div className="answer-input">
                  <input
                    ref={startScreenInputRef}
                    type="text"
                    placeholder="이름을 입력하세요"
                    value={playerName}
                    onChange={handleNameChange}
                    onKeyPress={handleNameKeyPress}
                    className={`answer-field ${showNameError ? 'error-placeholder' : ''}`}
                    style={{
                      color: playerName.trim() === '' ? '#999' : 'black'
                    }}
                    autoFocus
                  />
                </div>
                <div className="description-container">
                  <div className="description">
                    광고 상식 퀴즈에 도전하고 경품을 받아가세요!
                  </div>
                </div>
              </div>
            </div>
            
            {isBuffering && (
              <div className="buffering-status">
                <span style={{ 
                  position: 'fixed', 
                  bottom: '10px', 
                  right: '20px', 
                  opacity: 0.5,
                  fontSize: 'inherit'
                }}>
                  {ttsBuffer.size}
                </span>
              </div>
            )}
          </div>
        )}

        {gameState === 'intro' && (
          <div className="game-screen">
            {/* 게임 제목 영역 */}
            <div className="quiz-title-fixed">
              <div className="subtitle">수퍼톤 TTS로 듣고 풀어보는</div>
              <h1 className="title">광고 상식 스피드 퀴즈</h1>
            </div>
            
            {/* 게임 정보 영역 숨김 */}
            <div className="game-info" style={{ visibility: 'hidden' }}>
              <div className="timer">
                <div className="timer-label">남은 시간</div>
                <div className="timer-value">--</div>
                <span className="timer-unit">초</span>
              </div>
              <div className="score">
                <div className="score-label">내 점수</div>
                <div className="score-value">--</div>
                <span className="score-unit">점</span>
              </div>
            </div>
            
            {/* 안내 페이지 내용 */}
            <div className="question-container">
              <div className="description-container" style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '0vh' }}>
                <div className="description" style={{ 
                  fontSize: '2.2vw',
                  padding: '0 5%', 
                  textAlign: 'center',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  maxWidth: '100%',
                  lineHeight: '1.6'
                }}>
                  {gameIntroSentences.map((sentence, index) => {
                    const isCurrentSentence = index === introCurrentSentence;
                    const isCompleted = index < introCurrentSentence;
                    const fullSentence = index === 0 ? `${playerName}${sentence}` : sentence;
                    
                    return (
                      <div 
                        key={index} 
                        style={{ 
                          marginBottom: '2vh',
                          opacity: isCompleted ? 1 : (isCurrentSentence ? 0.8 : 0.3),
                          fontWeight: isCurrentSentence ? 'bold' : 'normal',
                          color: isCurrentSentence ? '#000' : '#333'
                        }}
                      >
                        {isCurrentSentence && introIsPlaying && introTypingProgress > 0 ? 
                          fullSentence.split('').map((char, charIndex) => {
                            const isEmoji = /\p{Emoji}/u.test(char);
                            return (
                              <span 
                                key={charIndex} 
                                style={{ 
                                  opacity: charIndex < introTypingProgress ? 1 : 0
                                }}
                                className={isEmoji ? 'emoji-char' : ''}
                              >
                                {char}
                                {charIndex === introTypingProgress - 1 && <span className="typing-cursor">|</span>}
                              </span>
                            );
                          }) : 
                          isCompleted ? 
                            fullSentence : 
                            (isCurrentSentence ? '' : '') // 현재 문장이지만 타이핑 진행도가 0이면 빈 화면
                        }
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 하단 영역 */}
              <div className="answer-section">
                <div className="keyboard-hints">
                  <span>소개 넘기기: Enter</span>
                </div>
                <div className="answer-input">
                  {/* 빈 입력 영역 (위치 맞추기용) */}
                </div>
                <div className="description-container">
                  <div className="description">
                    {/* 상태 표시 메시지 제거 */}
                  </div>
                </div>
              </div>
            </div>
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
                    <div className="description">
                      {
                        descriptionTypingPhase === 'typing' ? 
                        descriptionTypingText.split('').map((char, index) => {
                          const isEmoji = /\p{Emoji}/u.test(char);
                          return (
                            <span 
                              key={index} 
                              style={{ 
                                opacity: index < descriptionVisibleCharCount ? 1 : 0
                              }}
                              className={isEmoji ? 'emoji-char' : ''}
                            >
                              {char}
                              {index === descriptionVisibleCharCount - 1 && <span className="typing-cursor">|</span>}
                            </span>
                          );
                        }) : 
                        <>
                          {analyzeText(currentQuestion.description).displayText}
                          <span className="typing-cursor" style={{ opacity: 0 }}>|</span>
                        </>
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {gameState === 'gameOver' && (
          <div className="game-screen">
            {/* 빈 게임 정보 영역 (위치 맞추기용) */}
            <div className="game-info" style={{ visibility: 'hidden' }}>
              <div className="timer">
                <div className="timer-label">남은 시간</div>
                <div className="timer-value">--</div>
                <span className="timer-unit">초</span>
              </div>
              <div className="score">
                <div className="score-label">내 점수</div>
                <div className="score-value">--</div>
                <span className="score-unit">점</span>
              </div>
            </div>
            
            {/* 게임 종료 제목 */}
            <div style={{ minHeight: '20vh', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '-10vh' }}>
              <div className="description" style={{ 
                fontSize: '6vw',
                padding: '0 5%', 
                textAlign: 'center',
                wordWrap: 'break-word',
                whiteSpace: 'pre-wrap',
                maxWidth: '100%'
              }}>
                게임종료!
              </div>
            </div>

            {/* 게임 종료 정보 (좌중우 3개 셀로 분할) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0 5%', width: '100%', minHeight: '40vh', marginTop: '5vh', marginBottom: '5vh' }}>
              {/* 좌측 셀 - 최종 점수 */}
              <div style={{ width: '33%', textAlign: 'left', padding: '0 10px' }}>
                <div className="description" style={{ 
                  fontSize: '4vw',
                  textAlign: 'left',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}>
                  {playerName || '익명'}님의{'\n'}최종 점수는{'\n'}{score}점 입니다!
                </div>
              </div>

              {/* 중앙 셀 - 최종 등수 */}
              <div style={{ width: '33%', textAlign: 'left', padding: '0 10px' }}>
                <div className="description" style={{ 
                  fontSize: '4vw',
                  textAlign: 'left',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}>
                  {playerName || '익명'}님은{'\n'}{rankings.length}명 중{'\n'}{rankings.findIndex(p => p.name === (playerName || '익명') && p.score === score) + 1}등 입니다!
                </div>
              </div>

              {/* 우측 셀 - 랭킹 */}
              <div style={{ width: '33%', textAlign: 'left', padding: '0 10px' }}>
                <div className="description" style={{ 
                  fontSize: '3vw',
                  textAlign: 'left',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '30vh',
                  overflowY: 'hidden'
                }}>
                  {rankings.slice(rankingScrollIndex * 3, (rankingScrollIndex + 1) * 3).map((player, index) => (
                    <div key={player.timestamp} style={{ marginBottom: '10px' }}>
                      {rankingScrollIndex * 3 + index + 1}위 {player.name}님 {player.score}점
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 단축키 안내 */}
            <div className="answer-section">
              <div className="keyboard-hints">
                <span>다시시작: Enter</span>
              </div>
              <div className="answer-input">
                {/* 빈 입력 영역 (위치 맞추기용) */}
              </div>
              <div className="description-container">
                {/* 빈 설명 영역 (위치 맞추기용) */}
              </div>
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