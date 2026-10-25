import { useState } from 'react';
import { InstructionStepCard } from './InstructionStepCard';
import { ChefHat, Sparkles, CheckCircle2 } from 'lucide-react';

export interface StepItem {
  id: string;
  stepData: any;
}

interface InstructionStepFlowProps {
  steps: StepItem[];
  onAction?: (action: { type: string; parameters?: Record<string, any> }) => void;
}

export const InstructionStepFlow = ({ steps, onAction }: InstructionStepFlowProps) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [completedIndices, setCompletedIndices] = useState<Record<number, boolean>>({});
  const [isAllDone, setIsAllDone] = useState<boolean>(false);

  if (steps.length === 0) return null;

  const currentStep = steps[currentIndex];
  const total = steps.length;
  const isLastStep = currentIndex === total - 1;

  const handleNext = () => {
    setCompletedIndices((prev) => ({ ...prev, [currentIndex]: true }));
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsAllDone(true);
      onAction?.({
        type: 'finish_cooking',
        parameters: {
          recipe_name: currentStep.stepData.dish,
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
  const progressPercent = Math.round((completedCount / total) * 100);

  return (
    <div className="my-3 space-y-3">
      {/* Step Stepper Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <ChefHat size={16} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Step-by-Step Cooking Guide
              </h4>
              <p className="text-[11px] text-slate-400">
                Step {currentIndex + 1} of {total} · {progressPercent}% completed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => {
              const isCurrent = idx === currentIndex;
              const isDone = Boolean(completedIndices[idx]);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-7 h-7 rounded-full text-xs font-bold transition flex items-center justify-center ${
                    isCurrent
                      ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-200'
                      : isDone
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                  title={`Go to Step ${idx + 1}`}
                >
                  {isDone && !isCurrent ? <CheckCircle2 size={14} /> : idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Linear progress bar */}
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Celebratory Banner if All Steps Finished */}
      {isAllDone ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center shadow-sm">
            <Sparkles size={24} />
          </div>
          <h3 className="text-base font-bold text-emerald-950">
            Cooking Complete! Your Dish is Ready!
          </h3>
          <p className="text-xs text-emerald-800 max-w-md mx-auto leading-relaxed">
            All {total} steps have been executed. Plate your dish nicely and enjoy your culinary creation!
          </p>
          <button
            type="button"
            onClick={() => {
              setIsAllDone(false);
              setCurrentIndex(0);
            }}
            className="mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800 underline"
          >
            Review steps again
          </button>
        </div>
      ) : (
        /* The Current Step Card */
        <InstructionStepCard
          key={currentStep.id}
          step={currentStep.stepData.step ?? currentIndex + 1}
          totalSteps={total}
          title={currentStep.stepData.title}
          instruction={currentStep.stepData.instruction || currentStep.stepData.text || currentStep.stepData.description}
          duration={currentStep.stepData.duration}
          timerMinutes={currentStep.stepData.timerMinutes || currentStep.stepData.minutes}
          dish={currentStep.stepData.dish}
          tip={currentStep.stepData.tip}
          isLastStep={isLastStep}
          hasPrev={currentIndex > 0}
          onPrev={handlePrev}
          onNext={handleNext}
          onAction={onAction}
        />
      )}
    </div>
  );
};
