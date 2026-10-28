import React, { forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, helperText, error, leftIcon, rightIcon, id, containerClassName, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const classTokens = (className || '').split(/\s+/).filter(Boolean);
    const widthTokens = classTokens.filter((cls) =>
      /^([a-z0-9]+:)?(w-|max-w-|min-w-|flex-1|flex-auto|flex-initial|flex-none|shrink|grow)/.test(cls)
    );
    const inputTokens = classTokens.filter(
      (cls) => !/^([a-z0-9]+:)?(w-|max-w-|min-w-|flex-1|flex-auto|flex-initial|flex-none|shrink|grow)/.test(cls)
    );

    const hasWidth = widthTokens.length > 0;
    const containerWidth = hasWidth ? widthTokens.join(' ') : 'w-full';

    return (
      <div className={cn(containerWidth, 'space-y-1.5', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="block text-xs font-medium text-slate-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center w-full">
          {leftIcon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              'w-full bg-slate-900/90 text-slate-100 placeholder:text-slate-500 text-sm rounded-lg px-3.5 py-2 border transition-colors',
              'border-slate-700/80 hover:border-slate-600 focus:border-blue-500 focus:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              error && 'border-red-500 focus:border-red-500',
              inputTokens.join(' ')
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-400">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
