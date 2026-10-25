import { useState } from 'react';
import { Clock, Flame, Users, Sparkles, CheckCircle2, Circle, ChefHat, Bookmark } from 'lucide-react';

export interface RecipeDetailCardProps {
  id?: string;
  name: string;
  description?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: number | string;
  difficulty?: string;
  calories?: string;
  cuisine?: string;
  badge?: string;
  ingredients?: string[];
  imageUrl?: string;
  showCookButton?: boolean;
  onAction?: (action: { type: string; parameters?: Record<string, any> }) => void;
}

export const RecipeDetailCard = ({
  id,
  name,
  description,
  prepTime,
  cookTime,
  servings,
  difficulty,
  calories,
  cuisine,
  badge,
  ingredients = [],
  imageUrl,
  showCookButton = true,
  onAction,
}: RecipeDetailCardProps) => {
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState(false);

  const toggleIngredient = (idx: number) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const completedCount = Object.values(checkedIngredients).filter(Boolean).length;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden my-3">
      {/* Hero Recipe Image */}
      {imageUrl && (
        <div className="relative w-full h-52 sm:h-64 overflow-hidden bg-slate-100">
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        </div>
      )}

      {/* Top Banner / Badges */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-5 text-white">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            {badge && (
              <span className="bg-white/20 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {badge}
              </span>
            )}
            {cuisine && (
              <span className="bg-black/20 text-white/90 text-[11px] font-medium px-2 py-0.5 rounded-full">
                {cuisine}
              </span>
            )}
            {difficulty && (
              <span className="bg-white/15 text-white/90 text-[11px] font-medium px-2 py-0.5 rounded-full">
                {difficulty}
              </span>
            )}
          </div>

          <button
            onClick={() => setSaved(!saved)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-90"
            title={saved ? 'Recipe saved' : 'Save recipe'}
          >
            <Bookmark size={16} className={saved ? 'fill-amber-300 text-amber-300' : ''} />
          </button>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <ChefHat size={22} className="text-emerald-200 shrink-0" />
          <span>{name}</span>
        </h2>

        {description && (
          <p className="text-emerald-50/90 text-xs mt-1.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 bg-slate-50/70 border-b border-slate-100 text-xs text-slate-600">
        {prepTime && (
          <div className="flex items-center gap-2.5 p-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
              <Clock size={16} />
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Prep Time</p>
              <p className="font-semibold text-slate-800">{prepTime}</p>
            </div>
          </div>
        )}

        {cookTime && (
          <div className="flex items-center gap-2.5 p-3">
            <div className="w-8 h-8 rounded-lg bg-orange-100/70 text-orange-600 flex items-center justify-center shrink-0">
              <Flame size={16} />
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Cook Time</p>
              <p className="font-semibold text-slate-800">{cookTime}</p>
            </div>
          </div>
        )}

        {servings && (
          <div className="flex items-center gap-2.5 p-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100/70 text-blue-600 flex items-center justify-center shrink-0">
              <Users size={16} />
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Servings</p>
              <p className="font-semibold text-slate-800">{servings} people</p>
            </div>
          </div>
        )}

        {calories && (
          <div className="flex items-center gap-2.5 p-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100/70 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-400 font-semibold">Calories</p>
              <p className="font-semibold text-slate-800">{calories}</p>
            </div>
          </div>
        )}
      </div>

      {/* Ingredients Checklist */}
      {ingredients.length > 0 && (
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Ingredients Checklist ({ingredients.length})
            </h3>
            <span className="text-[11px] text-slate-400">
              {completedCount} of {ingredients.length} ready in pantry
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ingredients.map((item, idx) => {
              const isChecked = Boolean(checkedIngredients[idx]);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleIngredient(idx)}
                  className={`flex items-start gap-2.5 p-2 rounded-xl text-left text-xs transition border ${
                    isChecked
                      ? 'bg-emerald-50/60 border-emerald-200 text-slate-400 line-through'
                      : 'bg-slate-50/50 border-slate-200/60 text-slate-700 hover:bg-slate-100/60'
                  }`}
                >
                  {isChecked ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={16} className="text-slate-300 shrink-0 mt-0.5" />
                  )}
                  <span className="flex-1 leading-snug">{item}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Footer */}
      {showCookButton ? (
        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ChefHat size={18} className="text-emerald-600 shrink-0" />
            <span>Ready to cook? Click to start step-by-step guidance!</span>
          </div>

          <button
            type="button"
            onClick={() =>
              onAction?.({
                type: 'start_cooking',
                parameters: {
                  recipe_id: id,
                  recipe_name: name,
                },
              })
            }
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm hover:shadow transition"
          >
            <Sparkles size={16} />
            Let's Cook This
          </button>
        </div>
      ) : (
        <div className="px-5 py-3 bg-emerald-50/60 border-t border-emerald-100 flex items-center justify-center gap-2 text-xs font-medium text-emerald-800">
          <ChefHat size={16} className="text-emerald-600" />
          <span>Guided Cooking Mode — follow the step-by-step instructions below!</span>
        </div>
      )}
    </div>
  );
};
