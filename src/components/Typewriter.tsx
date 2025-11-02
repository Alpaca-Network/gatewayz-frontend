import { useEffect, useState } from 'react';

interface TypewriterProps {
  texts: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  delayBeforeStart?: number;
  delayBetweenTexts?: number;
  className?: string;
  initialText?: string;
}

export default function Typewriter({
  texts,
  typingSpeed = 80,
  deletingSpeed = 40,
  delayBeforeStart = 3000, // 3 seconds before starting
  delayBetweenTexts = 2000,
  className = "",
  initialText = "",
}: TypewriterProps) {
  const [displayText, setDisplayText] = useState(initialText);
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingPaused, setTypingPaused] = useState(true); // Start paused
  const [initialDelay, setInitialDelay] = useState(true);

  useEffect(() => {
    // Initial delay before starting
    const initialTimer = setTimeout(() => {
      setInitialDelay(false);
      setTypingPaused(false);
    }, delayBeforeStart);

    return () => clearTimeout(initialTimer);
  }, [delayBeforeStart]);

  useEffect(() => {
    if (initialDelay) return;
    
    let timeout: NodeJS.Timeout;
    const currentText = texts[currentTextIndex % texts.length];

    if (typingPaused) {
      // Start deleting after pause
      timeout = setTimeout(() => {
        setTypingPaused(false);
        setIsDeleting(true);
      }, delayBetweenTexts);
    } else if (isDeleting) {
      // Deleting
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, deletingSpeed);
      } else {
        // Move to next text after deletion
        setIsDeleting(false);
        setCurrentTextIndex((prevIndex) => (prevIndex + 1) % texts.length);
      }
    } else {
      // Typing
      if (displayText.length < currentText.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentText.substring(0, displayText.length + 1));
        }, typingSpeed);
      } else {
        // Pause at end of typing
        setTypingPaused(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayText, currentTextIndex, isDeleting, typingPaused, initialDelay, texts, typingSpeed, deletingSpeed, delayBetweenTexts]);

  return (
    <span className={`inline-flex items-end ${className} whitespace-nowrap`}>
      <span className="leading-none inline-flex items-baseline">
        {displayText}
      </span>
      <span className="cursor-pulse inline-block w-0.5 h-10 bg-current ml-1 mb-0.5 flex-shrink-0"></span>
    </span>
  );
}
