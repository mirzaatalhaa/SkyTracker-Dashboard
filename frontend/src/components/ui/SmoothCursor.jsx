import React, { useEffect, useRef, useState } from 'react';

export const SmoothCursor = () => {
  const [hidden, setHidden] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Refs for tracking position
  const mouseRef = useRef({ x: -100, y: -100 });
  const dotRef = useRef({ x: -100, y: -100 });
  const ringRef = useRef({ x: -100, y: -100 });

  // DOM element refs
  const dotElRef = useRef(null);
  const ringElRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const onMouseMove = (e) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      setHidden(false);
    };

    const onMouseLeave = () => {
      setHidden(true);
    };

    const onMouseEnter = () => {
      setHidden(false);
    };

    const handleMouseOver = (e) => {
      const target = e.target;
      const isClickable = 
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('.cursor-pointer') ||
        target.closest('.leaflet-interactive') ||
        target.closest('[role="button"]');
      
      setHovered(!!isClickable);
    };

    window.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);
    window.addEventListener('mouseover', handleMouseOver);

    let animationFrameId;
    
    const animate = () => {
      const mouse = mouseRef.current;
      const dot = dotRef.current;
      const ring = ringRef.current;

      // Smooth interpolation factors
      dot.x += (mouse.x - dot.x) * 0.3;
      dot.y += (mouse.y - dot.y) * 0.3;

      ring.x += (mouse.x - ring.x) * 0.15;
      ring.y += (mouse.y - ring.y) * 0.15;

      if (dotElRef.current) {
        dotElRef.current.style.transform = `translate3d(${dot.x}px, ${dot.y}px, 0) translate3d(-50%, -50%, 0)`;
      }
      if (ringElRef.current) {
        ringElRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate3d(-50%, -50%, 0)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
      window.removeEventListener('mouseover', handleMouseOver);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  if (isMobile) return null;

  return (
    <>
      {/* Outer Ring */}
      <div
        ref={ringElRef}
        className="fixed top-0 left-0 rounded-full pointer-events-none will-change-transform transition-all duration-300 ease-out"
        style={{
          zIndex: 9999,
          width: hovered ? '40px' : '22px',
          height: hovered ? '40px' : '22px',
          border: '1.5px solid #a2c9ff',
          backgroundColor: hovered ? 'rgba(162, 201, 255, 0.15)' : 'rgba(162, 201, 255, 0.04)',
          boxShadow: hovered 
            ? '0 0 12px rgba(162, 201, 255, 0.4)' 
            : '0 0 4px rgba(162, 201, 255, 0.1)',
          opacity: hidden ? 0 : 1,
        }}
      />
      {/* Inner Dot */}
      <div
        ref={dotElRef}
        className="fixed top-0 left-0 rounded-full pointer-events-none will-change-transform transition-all duration-150 ease-out"
        style={{
          zIndex: 9999,
          width: hovered ? '4px' : '6px',
          height: hovered ? '4px' : '6px',
          backgroundColor: '#a2c9ff',
          boxShadow: '0 0 8px rgba(162, 201, 255, 0.6)',
          opacity: hidden ? 0 : 1,
        }}
      />
    </>
  );
};
