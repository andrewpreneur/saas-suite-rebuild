import { useEffect, useRef, useState } from "react";

interface AnimatedSectionProps {
  children: React.ReactNode;
  animation?: "fade-in" | "slide-up" | "slide-in-left" | "slide-in-right" | "scale-in" | "fade-blur";
  delay?: number;
  duration?: number;
  className?: string;
  id?: string;
}

const AnimatedSection: React.FC<AnimatedSectionProps> = ({
  children,
  animation = "fade-in",
  delay = 0,
  duration = 800,
  className = "",
  id
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setIsVisible(true);
          }, delay);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "50px"
      }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [delay]);

  const getAnimationClasses = () => {
    const baseClasses = "transition-all ease-out";
    const durationClass = duration === 600 ? "duration-600" : `duration-[${duration}ms]`;
    
    switch (animation) {
      case "fade-in":
        return `${baseClasses} ${durationClass} ${
          isVisible 
            ? "opacity-100 translate-y-0" 
            : "opacity-0 translate-y-4"
        }`;
      case "fade-blur":
        return `${baseClasses} ${durationClass} ${
          isVisible 
            ? "opacity-100 blur-0 translate-y-0" 
            : "opacity-0 blur-[10px] translate-y-5"
        }`;
      case "slide-up":
        return `${baseClasses} ${durationClass} ${
          isVisible 
            ? "opacity-100 translate-y-0" 
            : "opacity-0 translate-y-8"
        }`;
      case "slide-in-left":
        return `${baseClasses} ${durationClass} ${
          isVisible 
            ? "opacity-100 translate-x-0" 
            : "opacity-0 -translate-x-8"
        }`;
      case "slide-in-right":
        return `${baseClasses} ${durationClass} ${
          isVisible 
            ? "opacity-100 translate-x-0" 
            : "opacity-0 translate-x-8"
        }`;
      case "scale-in":
        return `${baseClasses} ${durationClass} ${
          isVisible 
            ? "opacity-100 scale-100" 
            : "opacity-0 scale-95"
        }`;
      default:
        return baseClasses;
    }
  };

  return (
    <div
      ref={ref}
      className={`${getAnimationClasses()} ${className}`}
      id={id}
    >
      {children}
    </div>
  );
};

export default AnimatedSection;