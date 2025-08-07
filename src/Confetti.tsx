import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
  isActive: boolean;
  duration?: number;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
}

const Confetti: React.FC<ConfettiProps> = ({ isActive, duration = 3000 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const piecesRef = useRef<ConfettiPiece[]>([]);

  const colors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
    '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
  ];

  const createConfettiPiece = (x: number, y: number): ConfettiPiece => ({
    x,
    y,
    vx: (Math.random() - 0.5) * 8,
    vy: Math.random() * -15 - 5,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 8 + 4
  });

  const initConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 크기 설정
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // 콘페티 조각들 생성
    piecesRef.current = [];
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * canvas.width;
      const y = canvas.height + 10;
      piecesRef.current.push(createConfettiPiece(x, y));
    }
  };

  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 캔버스 클리어
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 각 콘페티 조각 업데이트 및 그리기
    piecesRef.current.forEach((piece, index) => {
      // 중력 적용
      piece.vy += 0.5;
      
      // 위치 업데이트
      piece.x += piece.vx;
      piece.y += piece.vy;
      
      // 회전 업데이트
      piece.rotation += piece.rotationSpeed;

      // 화면 밖으로 나간 조각 제거
      if (piece.y > canvas.height + 50) {
        piecesRef.current.splice(index, 1);
        return;
      }

      // 콘페티 조각 그리기
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate((piece.rotation * Math.PI) / 180);
      
      // 사각형 모양의 콘페티
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
      
      ctx.restore();
    });

    // 애니메이션 계속
    if (piecesRef.current.length > 0) {
      animationRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (isActive) {
      initConfetti();
      animate();

      // 지정된 시간 후 애니메이션 중지
      const timer = setTimeout(() => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      }, duration);

      return () => {
        clearTimeout(timer);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isActive, duration]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000
      }}
    />
  );
};

export default Confetti; 