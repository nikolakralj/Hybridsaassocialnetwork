import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "./ui/button";

interface IntroPageProps {
  onEnter: () => void;
}

export function IntroPage({ onEnter }: IntroPageProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Auto-skip after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      onEnter();
    }, 5000);

    // Update progress bar
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 2; // 50 updates over 5 seconds
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [onEnter]);

  // Track mouse position for parallax effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) - 0.5;
      const y = (e.clientY / window.innerHeight) - 0.5;
      setMousePosition({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Animated grid canvas background
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let animationFrameId: number;
    let time = 0;

    const animate = () => {
      time += 0.005;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw animated grid
      const gridSize = 60;
      const offsetX = (Math.sin(time) * 20);
      const offsetY = (Math.cos(time * 0.8) * 20);

      ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.lineWidth = 1;

      // Vertical lines
      for (let x = offsetX; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = offsetY; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw floating particles
      const particleCount = 30;
      for (let i = 0; i < particleCount; i++) {
        const x = (Math.sin(time + i * 0.5) * 300) + canvas.width / 2;
        const y = (Math.cos(time * 0.7 + i * 0.3) * 200) + canvas.height / 2;
        const size = Math.sin(time + i) * 2 + 3;
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, size * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated canvas background */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none opacity-40"
      />

      {/* Animated gradient orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-full blur-3xl"
        animate={{
          x: mousePosition.x * 50,
          y: mousePosition.y * 50,
          scale: [1, 1.2, 1],
        }}
        transition={{
          x: { type: "spring", stiffness: 50, damping: 20 },
          y: { type: "spring", stiffness: 50, damping: 20 },
          scale: { duration: 8, repeat: Infinity, ease: "easeInOut" }
        }}
      />
      
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full blur-3xl"
        animate={{
          x: mousePosition.x * -30,
          y: mousePosition.y * -30,
          scale: [1, 1.3, 1],
        }}
        transition={{
          x: { type: "spring", stiffness: 50, damping: 20 },
          y: { type: "spring", stiffness: 50, damping: 20 },
          scale: { duration: 10, repeat: Infinity, ease: "easeInOut" }
        }}
      />

      {/* Floating geometric shapes */}
      <FloatingShape delay={0} size={80} left="10%" top="20%" />
      <FloatingShape delay={2} size={60} left="80%" top="30%" />
      <FloatingShape delay={4} size={100} left="15%" top="70%" />
      <FloatingShape delay={3} size={70} left="85%" top="75%" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 max-w-4xl">
        {/* Sparkle badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 mb-8"
        >
          <Sparkles className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-medium text-white">
            Welcome to the future of work
          </span>
        </motion.div>

        {/* Logo/Brand */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mb-8"
        >
          <h1 className="text-7xl md:text-9xl font-bold tracking-tight leading-none mb-4">
            <span className="bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
              WorkGraph
            </span>
          </h1>
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-2xl leading-relaxed font-light"
        >
          Where technical freelancers
          <br />
          <span className="bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent font-medium">
            find work, ship projects, and get paid
          </span>
        </motion.p>

        {/* Enter button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
        >
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={onEnter}
              size="lg"
              className="h-16 px-12 text-lg rounded-2xl font-semibold bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 shadow-2xl shadow-blue-500/50 transition-all duration-300"
            >
              Enter WorkGraph
              <ArrowRight className="w-6 h-6 ml-3" strokeWidth={2.5} />
            </Button>
          </motion.div>
        </motion.div>

        {/* Auto-skip indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.2 }}
          className="mt-12 flex flex-col items-center gap-3"
        >
          <p className="text-xs text-gray-400">Auto-entering in {Math.ceil((100 - progress) / 20)}s</p>
          <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-blue-400 to-purple-400"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        </motion.div>
      </div>

      {/* Skip button - top right */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        onClick={onEnter}
        className="absolute top-8 right-8 px-4 py-2 text-sm text-gray-400 hover:text-white backdrop-blur-sm bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all duration-300"
      >
        Skip intro
      </motion.button>
    </div>
  );
}

// Floating geometric shape component
function FloatingShape({ delay, size, left, top }: { delay: number; size: number; left: string; top: string }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ left, top }}
      animate={{
        y: [0, -30, 0],
        rotate: [0, 180, 360],
        opacity: [0.3, 0.6, 0.3],
      }}
      transition={{
        duration: 8,
        delay,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      <div 
        className="bg-gradient-to-br from-blue-400/20 to-purple-400/20 backdrop-blur-sm rounded-lg border border-white/10"
        style={{ width: size, height: size }}
      />
    </motion.div>
  );
}
