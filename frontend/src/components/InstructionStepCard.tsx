import { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  Circle,
  ChefHat,
  Lightbulb,
  Play,
  Pause,
  RotateCcw,
  Bell,
  Sparkles,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

export interface InstructionStepCardProps {
  step?: number | string;
  totalSteps?: number | string;
  title?: string;
  instruction: string;
  duration?: string;
  timerMinutes?: number | string;
  dish?: string;
  tip?: string;
  isLastStep?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  hasPrev?: boolean;
  showNextButton?: boolean;
  onAction?: (action: { type: string; parameters?: Record<string, any> }) => void;
}

export const InstructionStepCard = ({
  step,
  totalSteps,
  title,
  instruction,
  duration,
  timerMinutes,
  dish,
  tip,
  isLastStep,
  onNext,
  onPrev,
  hasPrev,
  showNextButton = true,
  onAction,
}: InstructionStepCardProps) => {
  const [completed, setCompleted] = useState<boolean>(false);

  // Timer state (if timerMinutes is provided and > 0)
  const hasTimer = Boolean(timerMinutes && Number(timerMinutes) > 0);
  const totalSeconds = hasTimer ? Math.max(1, Math.round(Number(timerMinutes) * 60)) : 0;
  const [secondsLeft, setSecondsLeft] = useState<number>(totalSeconds);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  useEffect(() => {
    if (hasTimer) {
      setSecondsLeft(totalSeconds);
      setIsActive(false);
      setIsFinished(false);
    }
  }, [totalSeconds, hasTimer]);

  useEffect(() => {
    let interval: any = null;

    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0 && isActive) {
      setIsActive(false);
      setIsFinished(true);
      setCompleted(true);
    }

    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progressPercent = totalSeconds > 0
    ? Math.min(100, Math.max(0, ((totalSeconds - secondsLeft) / totalSeconds) * 100))
    : 0;

  const handleReset = () => {
    setIsActive(false);
    setIsFinished(false);
    setSecondsLeft(totalSeconds);
  };

  return (
    <div
      className={`rounded-2xl border transition-all duration-200 overflow-hidden my-3 shadow-sm ${
        completed
          ? 'bg-slate-50/80 border-emerald-300/80 shadow-none'
          : hasTimer && isActive
          ? 'bg-white border-orange-300 shadow-orange-100 shadow-md ring-1 ring-orange-200'
          : 'bg-white border-slate-200/90 hover:shadow-md'
      }`}
    >
      {/* Top Header */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            {step && (
              <span
                className={`inline-flex items-center justify-center font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  completed
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                Step {step}
              </span>
            )}

            {title && (
              <h4 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                <span>{title}</span>
              </h4>
            )}
          </div>

          <div className="flex items-center gap-2">
            {(duration || hasTimer) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200/70">
                <Clock size={12} className="text-amber-600" />
                <span>{duration || `${timerMinutes} mins`}</span>
              </span>
            )}

            <button
              type="button"
              onClick={() => setCompleted(!completed)}
              className={`p-1 rounded-lg transition active:scale-95 ${
                completed
                  ? 'text-emerald-600 hover:text-emerald-700 bg-emerald-50'
                  : 'text-slate-300 hover:text-slate-400'
              }`}
              title={completed ? 'Mark step as incomplete' : 'Mark step as completed'}
            >
              {completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
            </button>
          </div>
        </div>

        {/* Instruction Text */}
        <p
          className={`text-xs sm:text-sm leading-relaxed mt-1 ${
            completed ? 'text-slate-400 line-through' : 'text-slate-700'
          }`}
        >
          {instruction}
        </p>

        {/* Optional Chef Tip */}
        {tip && (
          <div className="mt-3 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/60 flex items-start gap-2 text-xs text-amber-900">
            <Lightbulb size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-semibold text-amber-800 mr-1">Chef Tip:</span>
              <span>{tip}</span>
            </div>
          </div>
        )}

        {/* Built-in Interactive Timer Section for Timed Steps */}
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
                    {duration ? `Timer (${duration})` : `Timer (${timerMinutes} mins)`}
                  </span>
                  {dish && (
                    <span className={`text-[10px] ${isActive || isFinished ? 'text-white/80' : 'text-slate-400'}`}>
                      {dish}
                    </span>
                  )}
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
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[11px] font-medium">
                {isFinished ? (
                  <span className="flex items-center gap-1 font-semibold text-white">
                    <Sparkles size={13} /> Time is up! Step ready.
                  </span>
                ) : isActive ? (
                  <span className="text-white/90">Timing step...</span>
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
                  onClick={handleReset}
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

      {/* Done Checkbox Footer */}
      <div
        onClick={() => setCompleted(!completed)}
        className={`px-4 py-2.5 text-xs flex items-center justify-between cursor-pointer border-t select-none transition ${
          completed
            ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
            : 'bg-slate-50/60 hover:bg-slate-100/60 text-slate-500 border-slate-100'
        }`}
      >
        <span className="flex items-center gap-1.5 font-medium">
          <ChefHat size={14} className={completed ? 'text-emerald-600' : 'text-slate-400'} />
          <span>{completed ? 'Step Completed! Click to uncheck' : 'Click when finished with this step'}</span>
        </span>
        <div className="flex items-center gap-1 text-[11px] font-semibold">
          {completed ? (
            <span className="text-emerald-700 flex items-center gap-1">
              <CheckCircle2 size={14} /> Done
            </span>
          ) : (
            <span className="text-slate-400">Incomplete</span>
          )}
        </div>
      </div>

      {/* Navigation Footer with Next Step button */}
      {showNextButton !== false && (
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {hasPrev && onPrev && (
              <button
                type="button"
                onClick={onPrev}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 transition active:scale-95 flex items-center gap-1"
              >
                <ArrowLeft size={14} />
                <span>Prev</span>
              </button>
            )}
            <span className="text-xs text-slate-500 font-medium">
              {totalSteps ? `Step ${step} of ${totalSteps}` : `Step ${step}`}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setCompleted(true);
              if (onNext) {
                onNext();
              } else {
                onAction?.({
                  type: 'next_step',
                  parameters: {
                    recipe_name: dish,
                    current_step: step,
                    total_steps: totalSteps,
                    is_last_step: isLastStep,
                  },
                });
              }
            }}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm hover:shadow transition"
          >
            <span>{isLastStep ? 'Finish Cooking' : 'Next Step'}</span>
            {isLastStep ? <Sparkles size={15} /> : <ArrowRight size={15} />}
          </button>
        </div>
      )}
    </div>
  );
};
