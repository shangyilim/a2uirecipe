import { useState, useEffect } from 'react';
import {
  Clock,
  ChefHat,
  Lightbulb,
  Play,
  Pause,
  RotateCcw,
  Bell,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

export interface CookingStep {
  step?: number | string;
  title?: string;
  instruction: string;
  duration?: string;
  timerMinutes?: number | string;
  dish?: string;
  tip?: string;
}

export interface GuidedCookingCardProps {
  id?: string;
  dish?: string;
  recipeName?: string;
  steps: CookingStep[];
  onAction?: (action: { type: string; parameters?: Record<string, any> }) => void;
}

export const GuidedCookingCard = ({
  dish,
  recipeName,
  steps = [],
  onAction,
}: GuidedCookingCardProps) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [completedIndices, setCompletedIndices] = useState<Record<number, boolean>>({});
  const [isAllDone, setIsAllDone] = useState<boolean>(false);

  // Fallback if steps are empty
  if (!steps || steps.length === 0) {
    return null;
  }

  const currentStep = steps[currentIndex] || steps[0];
  const total = steps.length;
  const isLastStep = currentIndex === total - 1;
  const displayName = dish || recipeName || currentStep.dish || 'Guided Cooking';

  const handleNext = () => {
    setCompletedIndices((prev) => ({ ...prev, [currentIndex]: true }));
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsAllDone(true);
      onAction?.({
        type: 'finish_cooking',
        parameters: {
          recipe_name: displayName,
          total_steps: total,
        },
      });
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const completedCount = Object.values(completedIndices).filter(Boolean).length;
  const progressPercent = Math.round(((currentIndex + 1) / total) * 100);

  // Timer logic for the current step (if timed)
  const hasTimer = Boolean(currentStep.timerMinutes && Number(currentStep.timerMinutes) > 0);
  const totalSeconds = hasTimer ? Math.max(1, Math.round(Number(currentStep.timerMinutes) * 60)) : 0;
  const [secondsLeft, setSecondsLeft] = useState<number>(totalSeconds);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Reset timer whenever the step index changes
  useEffect(() => {
    if (hasTimer) {
      setSecondsLeft(totalSeconds);
      setIsActive(false);
      setIsFinished(false);
    }
  }, [currentIndex, totalSeconds, hasTimer]);

  useEffect(() => {
    let interval: any = null;

    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0 && isActive) {
      setIsActive(false);
      setIsFinished(true);
      setCompletedIndices((prev) => ({ ...prev, [currentIndex]: true }));
    }

    return () => clearInterval(interval);
  }, [isActive, secondsLeft, currentIndex]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timerProgress = totalSeconds > 0
    ? Math.min(100, Math.max(0, ((totalSeconds - secondsLeft) / totalSeconds) * 100))
    : 0;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden my-3">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <ChefHat size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight leading-snug">
                {displayName}
              </h3>
              <p className="text-[11px] text-emerald-100 font-medium">
                Step {currentIndex + 1} of {total} · {completedCount} of {total} checked
              </p>
            </div>
          </div>

          {/* Clickable Step Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {steps.map((_, idx) => {
              const isCurrent = idx === currentIndex;
              const isDone = Boolean(completedIndices[idx]);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                    isCurrent
                      ? 'bg-white text-emerald-700 shadow-sm ring-2 ring-emerald-300'
                      : isDone
                      ? 'bg-emerald-500/80 text-white'
                      : 'bg-black/15 text-white/80 hover:bg-black/25'
                  }`}
                  title={`Jump to Step ${idx + 1}`}
                >
                  {isDone && !isCurrent ? <CheckCircle2 size={14} /> : idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Linear Progress Bar */}
        <div className="w-full bg-black/20 h-1.5 rounded-full overflow-hidden mt-3">
          <div
            className="bg-white h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 2. Step Body (Current Step Only) */}
      {isAllDone ? (
        <div className="p-6 text-center space-y-3 bg-emerald-50/50">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-sm">
            <Sparkles size={24} />
          </div>
          <h4 className="text-base font-bold text-emerald-950">
            Cooking Complete!
          </h4>
          <p className="text-xs text-emerald-800 max-w-md mx-auto leading-relaxed">
            You have finished all {total} steps for {displayName}. Serve warm and enjoy your culinary creation!
          </p>
          <button
            type="button"
            onClick={() => {
              setIsAllDone(false);
              setCurrentIndex(0);
            }}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline pt-1"
          >
            Review steps again from the beginning
          </button>
        </div>
      ) : (
        <div className="p-5">
          {/* Step Badge and Title */}
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Step {currentStep.step ?? currentIndex + 1}
              </span>

              {currentStep.title && (
                <h4 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight">
                  {currentStep.title}
                </h4>
              )}
            </div>

            {(currentStep.duration || hasTimer) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70 shrink-0">
                <Clock size={12} className="text-amber-600" />
                <span>{currentStep.duration || `${currentStep.timerMinutes} mins`}</span>
              </span>
            )}
          </div>

          {/* Instruction Text */}
          <p className="text-xs sm:text-sm leading-relaxed text-slate-700 my-2">
            {currentStep.instruction}
          </p>

          {/* Optional Chef Tip */}
          {currentStep.tip && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/70 flex items-start gap-2.5 text-xs text-amber-900">
              <Lightbulb size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-amber-800 mr-1">Chef Tip:</span>
                <span>{currentStep.tip}</span>
              </div>
            </div>
          )}

          {/* Interactive Timer (if this step is timed) */}
          {hasTimer && (
            <div
              className={`mt-4 rounded-xl p-3.5 border transition-all ${
                isFinished
                  ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse'
                  : isActive
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-orange-500 shadow-sm'
                  : 'bg-slate-50 border-slate-200/90 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg ${
                      isActive || isFinished ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'
                    }`}
                  >
                    {isFinished ? <Bell size={16} className="animate-bounce" /> : <Clock size={16} />}
                  </div>
                  <div>
                    <span className="font-semibold text-xs block">
                      {currentStep.duration ? `Timer (${currentStep.duration})` : `Timer (${currentStep.timerMinutes} mins)`}
                    </span>
                    <span className={`text-[10px] ${isActive || isFinished ? 'text-white/80' : 'text-slate-400'}`}>
                      {displayName}
                    </span>
                  </div>
                </div>

                {/* Digital Countdown */}
                <div className="text-xl font-mono font-bold tracking-wider">
                  {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </div>
              </div>

              {/* Progress bar */}
              <div
                className={`w-full h-1.5 rounded-full overflow-hidden my-2.5 ${
                  isActive || isFinished ? 'bg-white/25' : 'bg-slate-200'
                }`}
              >
                <div
                  className={`h-full transition-all duration-500 ${
                    isFinished ? 'bg-white' : isActive ? 'bg-white' : 'bg-orange-500'
                  }`}
                  style={{ width: `${timerProgress}%` }}
                />
              </div>

              {/* Timer Controls */}
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[11px] font-medium">
                  {isFinished ? (
                    <span className="flex items-center gap-1 font-semibold text-white">
                      <Sparkles size={13} /> Time is up! Step ready.
                    </span>
                  ) : isActive ? (
                    <span className="text-white/90">Timing in progress...</span>
                  ) : (
                    <span className={isActive || isFinished ? 'text-white/80' : 'text-slate-400'}>
                      Ready to time this step
                    </span>
                  )}
                </span>

                <div className="flex items-center gap-2">
                  {!isFinished && (
                    <button
                      type="button"
                      onClick={() => setIsActive(!isActive)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition active:scale-95 ${
                        isActive
                          ? 'bg-white text-orange-600 hover:bg-orange-50 shadow-sm'
                          : 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm'
                      }`}
                    >
                      {isActive ? <Pause size={13} /> : <Play size={13} />}
                      <span>{isActive ? 'Pause' : 'Start Timer'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsActive(false);
                      setIsFinished(false);
                      setSecondsLeft(totalSeconds);
                    }}
                    title="Reset Timer"
                    className={`p-1 rounded-lg transition active:scale-95 ${
                      isActive || isFinished
                        ? 'bg-white/20 hover:bg-white/30 text-white'
                        : 'bg-slate-200/70 hover:bg-slate-300 text-slate-600'
                    }`}
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Navigation Footer with Previous and Next */}
      <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
        {/* Previous Button */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0 || isAllDone}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition active:scale-95 ${
            currentIndex === 0 || isAllDone
              ? 'opacity-40 cursor-not-allowed text-slate-400 bg-slate-100'
              : 'text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 shadow-sm'
          }`}
        >
          <ArrowLeft size={14} />
          <span>Previous</span>
        </button>

        <span className="text-xs text-slate-500 font-medium">
          Step {currentIndex + 1} of {total}
        </span>

        {/* Next / Finish Button */}
        <button
          type="button"
          onClick={handleNext}
          className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm hover:shadow transition"
        >
          <span>{isLastStep ? 'Finish Cooking' : 'Next Step'}</span>
          {isLastStep ? <Sparkles size={15} /> : <ArrowRight size={15} />}
        </button>
      </div>
    </div>
  );
};
