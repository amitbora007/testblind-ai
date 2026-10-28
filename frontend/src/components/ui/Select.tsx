import React, { forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { ChevronDown } from 'lucide-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: { value: string; label: string }[];
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, children, id, containerClassName, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    // Extract sizing & flex layout classes from className so the outer container matches
    // the intended select width and the chevron icon stays perfectly docked inside.
    const classTokens = (className || '').split(/\s+/).filter(Boolean);
    const widthTokens = classTokens.filter((cls) =>
      /^([a-z0-9]+:)?(w-|max-w-|min-w-|flex-1|flex-auto|flex-initial|flex-none|shrink|grow)/.test(cls)
    );
    const selectTokens = classTokens.filter(
      (cls) => !/^([a-z0-9]+:)?(w-|max-w-|min-w-|flex-1|flex-auto|flex-initial|flex-none|shrink|grow)/.test(cls)
    );

    const hasWidth = widthTokens.length > 0;
    const containerWidth = hasWidth ? widthTokens.join(' ') : 'w-full';

    return (
      <div className={cn(containerWidth, 'space-y-1.5', containerClassName)}>
        {label && (
          <label htmlFor={selectId} className="block text-xs font-medium text-slate-300">
            {label}
          </label>
        )}
        <div className="relative w-full">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'w-full appearance-none bg-slate-900/90 text-slate-100 text-sm rounded-lg px-3 py-1.5 pr-8 border transition-colors cursor-pointer',
              'border-slate-700/80 hover:border-slate-600 focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-red-500',
              selectTokens.join(' ')
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
          </div>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
