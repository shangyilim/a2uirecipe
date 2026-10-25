import { Clock, Flame, Sparkles, ChefHat, Eye } from 'lucide-react';

export interface RecipeSummaryCardProps {
  id?: string;
  name: string;
  description?: string;
  cookTime?: string;
  prepTime?: string;
  difficulty?: string;
  calories?: string;
  cuisine?: string;
  badge?: string;
  imageUrl?: string;
  onAction?: (action: { type: string; parameters?: Record<string, any> }) => void;
}

export const RecipeSummaryCard = ({
  id,
  name,
  description,
  cookTime,
  prepTime,
  difficulty,
  calories,
  cuisine,
  badge,
  imageUrl,
  onAction,
}: RecipeSummaryCardProps) => {
  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200 my-2 overflow-hidden">
      {/* Recipe Image if available */}
      {imageUrl && (
        <div className="relative w-full h-40 sm:h-44 mb-3 rounded-xl overflow-hidden bg-slate-100">
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Top Header with Badges */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {badge && (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {badge}
              </span>
            )}
            {cuisine && (
              <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                {cuisine}
              </span>
            )}
            {difficulty && (
              <span className="bg-slate-100 text-slate-600 text-[10px] font-medium px-2 py-0.5 rounded-full">
                {difficulty}
              </span>
            )}
          </div>

          <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <ChefHat size={18} className="text-emerald-600 shrink-0" />
            <span>{name}</span>
          </h3>
        </div>
      </div>

      {/* Short Description */}
      {description && (
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
          {description}
        </p>
      )}

      {/* Compact Quick Stats */}
      <div className="flex items-center gap-4 text-xs text-slate-500 py-2 border-y border-slate-100 mb-3">
        {(cookTime || prepTime) && (
          <div className="flex items-center gap-1.5 font-medium text-slate-700">
            <Clock size={14} className="text-emerald-600" />
            <span>{cookTime ? `${cookTime} cook` : prepTime}</span>
          </div>
        )}
        {calories && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <Flame size={14} className="text-orange-500" />
            <span>{calories}</span>
          </div>
        )}
      </div>

      {/* Action Buttons: View Details & Let's Cook This */}
      <div className="flex items-center justify-center gap-2.5 pt-1 flex-wrap sm:flex-nowrap">
        <button
          type="button"
          onClick={() =>
            onAction?.({
              type: 'view_recipe',
              parameters: {
                recipe_id: id,
                recipe_name: name,
              },
            })
          }
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95 text-xs font-semibold rounded-xl border border-slate-200/80 transition"
        >
          <Eye size={14} className="text-slate-500" />
          View
        </button>

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
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-sm hover:shadow transition"
        >
          <Sparkles size={14} />
          Let's Cook This
        </button>
      </div>
    </div>
  );
};
