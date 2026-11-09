import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Timer, Bell, CheckCircle2 } from 'lucide-react';

export interface CookingTimerProps {
  minutes: number | string;
  label?: string;
  dish?: string;
}

export const CookingTimer = ({ minutes, label, dish }: CookingTimerProps) => {
  const totalSeconds = Math.max(1, Math.round(Number(minutes) * 60) || 300);
  const [secondsLeft, setSecondsLeft] = useState<number>(totalSeconds);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  useEffect(() => {
    setSecondsLeft(totalSeconds);
    setIsActive(false);
    setIsFinished(false);
  }, [totalSeconds]);

  useEffect(() => {
    let interval: any = null;

    if (isActive && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((s) => s - 1);
      }, 1000);
    } else if (secondsLeft === 0 && isActive) {
      setIsActive(false);
      setIsFinished(true);
    }

    return () => clearInterval(interval);
  }, [isActive, secondsLeft]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const progressPercent = Math.min(100, Math.max(0, ((totalSeconds - secondsLeft) / totalSeconds) * 100));

  const handleReset = () => {
    setIsActive(false);
    setIsFinished(false);
    setSecondsLeft(totalSeconds);
  };

  return (
    <div className={`rounded-2xl p-4 my-2.5 border transition-all duration-300 shadow-sm ${
      isFinished
        ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse'
        : isActive
        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-orange-600 shadow-orange-100 shadow-md'
        : 'bg-white text-slate-800 border-slate-200'
    }`}>
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${isActive || isFinished ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'}`}>
            {isFinished ? <Bell size={18} className="animate-bounce" /> : <Timer size={18} />}
          </div>
          <div>
            <span className="font-semibold text-xs tracking-tight block">
              {label || 'Cooking Timer'}
            </span>
            {dish && (
              <span className={`text-[10px] ${isActive || isFinished ? 'text-white/80' : 'text-slate-400'}`}>
                {dish}
              </span>
            )}
          </div>
        </div>

        {/* Formatted Time Display */}
        <div className="text-2xl font-mono font-bold tracking-wider">
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
      </div>

      {/* Progress Bar */}
      <div className={`w-full h-1.5 rounded-full overflow-hidden my-3 ${isActive || isFinished ? 'bg-white/25' : 'bg-slate-100'}`}>
        <div
          className={`h-full transition-all duration-500 ${isFinished ? 'bg-white' : isActive ? 'bg-white' : 'bg-orange-500'}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Status & Control Buttons */}
      <div className="flex items-center justify-between pt-1">
        <div className="text-[11px] font-medium flex items-center gap-1">
          {isFinished ? (
            <span className="flex items-center gap-1 font-semibold text-white">
              <CheckCircle2 size={14} /> Time is up!
            </span>
          ) : isActive ? (
            <span className="text-white/90">Cooking in progress...</span>
          ) : (
            <span className="text-slate-400">Ready to time</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isFinished && (
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 ${
                isActive
                  ? 'bg-white text-orange-600 hover:bg-orange-50 shadow-sm'
                  : 'bg-orange-600 hover:bg-orange-700 text-white shadow-sm'
              }`}
            >
              {isActive ? <Pause size={14} /> : <Play size={14} />}
              <span>{isActive ? 'Pause' : 'Start'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            title="Reset Timer"
            className={`p-1.5 rounded-xl transition active:scale-95 ${
              isActive || isFinished
                ? 'bg-white/15 hover:bg-white/25 text-white'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
            }`}
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
