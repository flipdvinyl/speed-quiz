import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { GameState, Player, QuizQuestion } from './types';
import { quizQuestions } from './data';
import './App.css';

function App() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [gameTimeLeft, setGameTimeLeft] = useState(120);
  const [timeLeftDecimal, setTimeLeftDecimal] = useState(0);
  const [gameTimeLeftDecimal, setGameTimeLeftDecimal] = useState(0);
  const [usedQuestions, setUsedQuestions] = useState<Set<number>>(new Set());
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [playerName, setPlayerName] = useState('');
  const [rankings, setRankings] = useState<Player[]>([]);
  const [animationKey, setAnimationKey] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionText, setTransitionText] = useState('');
  const [typingText, setTypingText] = useState('');
  const [typingPhase, setTypingPhase] = useState<'typing' | 'hold' | 'deleting' | 'none'>('none');
  const [visibleCharCount, setVisibleCharCount] = useState(0);
  const answerInputRef = useRef<HTMLInputElement>(null);

  // 게임 시작
  const startGame = useCallback(() => {
    if (!playerName.trim()) return; // 이름이 없으면 시작하지 않음
    setGameState('playing');
    setScore(0);
    setGameTimeLeft(120);
    setGameTimeLeftDecimal(0);
    setUsedQuestions(new Set());
    setCurrentQuestion(null);
    setUserAnswer('');
    setIsCorrect(null);
    setAnimationKey(0);
  }, [playerName]);

  // 다음 문제 선택
  const getNextQuestion = useCallback(() => {
    const availableQuestions = quizQuestions.filter(q => !usedQuestions.has(q.id));
    if (availableQuestions.length === 0) {
      // 모든 문제를 다 사용했으면 다시 섞기
      setUsedQuestions(new Set());
      return quizQuestions[Math.floor(Math.random() * quizQuestions.length)];
    }
    return availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
  }, [usedQuestions]);

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

  // 다음 문제로 넘어가기
  const goToNextQuestion = useCallback(() => {
    if (!currentQuestion) return;
    
    setIsTransitioning(true);
    setTransitionText('다음문제');
    setUsedQuestions(prev => new Set([...prev, currentQuestion.id]));
    setUserAnswer('');
    setIsCorrect(null);
    
    // 타이핑 애니메이션 시작 (완료 후 전환)
    startTypingAnimation('다음문제', () => {
      setCurrentQuestion(getNextQuestion());
      setTimeLeft(15);
      setTimeLeftDecimal(0);
      setAnimationKey(prev => prev + 1);
      setIsTransitioning(false);
      setTransitionText('');
    });
  }, [currentQuestion, getNextQuestion, startTypingAnimation]);

  // 문제 제출
  const submitAnswer = useCallback(() => {
    if (!currentQuestion || !userAnswer.trim()) return;

    const isAnswerCorrect = userAnswer.trim().toLowerCase() === currentQuestion.word.toLowerCase();
    setIsCorrect(isAnswerCorrect);

    if (isAnswerCorrect) {
      // 남은 초의 앞자리 수로 점수 계산
      const timeScore = Math.floor(timeLeft);
      setScore(prev => prev + timeScore);
      setIsTransitioning(true);
      setUsedQuestions(prev => new Set([...prev, currentQuestion.id]));
      setUserAnswer('');
      setIsCorrect(null);
      
      // 타이핑 애니메이션 시작 (완료 후 전환)
      startTypingAnimation('🎉 정답 🎉', () => {
        setCurrentQuestion(getNextQuestion());
        setTimeLeft(15);
        setTimeLeftDecimal(0);
        setAnimationKey(prev => prev + 1);
        setIsTransitioning(false);
        setTransitionText('');
      });
    } else {
      setUserAnswer('');
      setIsCorrect(false);
    }
  }, [currentQuestion, userAnswer, getNextQuestion, timeLeft]);

  // 이름 입력 시 엔터키 처리
  const handleNameKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && playerName.trim()) {
      startGame();
    }
  }, [playerName, startGame]);

  // 게임 종료
  const endGame = useCallback(() => {
    setGameState('gameOver');
    const newPlayer: Player = {
      name: playerName || '익명',
      score,
      timestamp: Date.now()
    };
    setRankings(prev => [...prev, newPlayer].sort((a, b) => b.score - a.score).slice(0, 10));
  }, [playerName, score]);

  // 랭킹 보기
  const showRankings = useCallback(() => {
    setGameState('ranking');
  }, []);

  // 시작 화면으로 돌아가기
  const goToStart = useCallback(() => {
    setGameState('start');
  }, []);

  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (gameState === 'playing') {
        if (e.key === 'Enter') {
          submitAnswer();
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

      // 소수점 타이머 (0.01초마다 업데이트)
      const decimalTimer = setInterval(() => {
        setGameTimeLeftDecimal(prev => {
          if (prev <= 0.01) {
            return 0.99;
          }
          return prev - 0.01;
        });
      }, 10);

      return () => {
        clearInterval(gameTimer);
        clearInterval(decimalTimer);
      };
    }
  }, [gameState, endGame]);

  // 문제 타이머
  useEffect(() => {
    if (gameState === 'playing' && currentQuestion) {
      const questionTimer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            // 시간 초과 시 자동으로 다음 문제로 넘어가기
            goToNextQuestion();
            return 15;
          }
          return prev - 1;
        });
      }, 1000);

      // 소수점 타이머 (0.01초마다 업데이트)
      const decimalTimer = setInterval(() => {
        setTimeLeftDecimal(prev => {
          if (prev <= 0.01) {
            return 0.99;
          }
          return prev - 0.01;
        });
      }, 10);

      return () => {
        clearInterval(questionTimer);
        clearInterval(decimalTimer);
      };
    }
  }, [gameState, currentQuestion, goToNextQuestion]);



  // 첫 문제 설정
  useEffect(() => {
    if (gameState === 'playing' && !currentQuestion) {
      setCurrentQuestion(getNextQuestion());
    }
  }, [gameState, currentQuestion, getNextQuestion]);

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
            <h1 className="title">광고 상식 스피드 퀴즈</h1>
          </div>
        )}
        {gameState !== 'playing' && (
          <h1 className="title">광고 상식 스피드 퀴즈</h1>
        )}
        
        {gameState === 'start' && (
          <div className="start-screen">
            <h2>광고 산업 상식 퀴즈</h2>
            <p>2분 동안 최대한 많은 광고 용어를 맞춰보세요!</p>
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
                {/* 시간 오버레이 */}
                <div 
                  key={`time-overlay-${animationKey}`}
                  className={`time-overlay ${isTransitioning ? 'hidden' : ''}`}
                />
                
                {/* 큰 정답 영역 */}
                <div className="answer-placeholder-container">
                  <div 
                    key={animationKey}
                    className={`answer-placeholder ${isTransitioning ? 'transitioning' : ''}`}
                  >
                    {isTransitioning ? (typingPhase !== 'none' ? 
                    typingText.split('').map((char, index) => (
                      <span 
                        key={index} 
                        style={{ 
                          opacity: index < visibleCharCount ? 1 : 0,
                          transition: 'opacity 0.1s ease'
                        }}
                      >
                        {char}
                      </span>
                    )) : transitionText) : currentQuestion.word.split('').map((char, index) => (
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
                  <div className="description">“ {currentQuestion.description} ”</div>
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
            <div className="game-over-buttons">
              <button onClick={() => {
                setPlayerName('');
                startGame();
              }} className="restart-btn">
                다시 시작
              </button>
              <button onClick={showRankings} className="ranking-btn">
                랭킹 보기
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