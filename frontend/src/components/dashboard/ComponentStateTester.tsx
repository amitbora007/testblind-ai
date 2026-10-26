import React from 'react';
import { Button } from '@/components/ui/Button';
import { Layers, Loader2, FolderX, AlertTriangle, MessageSquare, Bell } from 'lucide-react';

export type DashboardViewState = 'normal' | 'loading' | 'empty' | 'error';

export interface ComponentStateTesterProps {
  viewState: DashboardViewState;
  onViewStateChange: (state: DashboardViewState) => void;
  onOpenSampleDialog: () => void;
  onTriggerToast: () => void;
}

export function ComponentStateTester({
  viewState,
  onViewStateChange,
  onOpenSampleDialog,
  onTriggerToast,
}: ComponentStateTesterProps) {
  return (
    <div className="p-3.5 rounded-xl bg-card border border-blue-500/30 shadow-glow-primary/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-md bg-blue-950/80 border border-blue-500/40 text-blue-400">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <span className="text-xs font-semibold text-white block">
            Design System & Component State Harness
          </span>
          <span className="text-[11px] text-slate-400">
            Validate reactive component states across the TraceAI Studio shell
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
        {/* State Toggle Buttons */}
        <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
          <button
            onClick={() => onViewStateChange('normal')}
            className={`px-2.5 py-1 rounded-md transition-colors font-medium ${
              viewState === 'normal'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Normal Data
          </button>
          <button
            onClick={() => onViewStateChange('loading')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 font-medium ${
              viewState === 'loading'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Loader2 className="w-3 h-3" />
            Loading
          </button>
          <button
            onClick={() => onViewStateChange('empty')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 font-medium ${
              viewState === 'empty'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FolderX className="w-3 h-3" />
            Empty
          </button>
          <button
            onClick={() => onViewStateChange('error')}
            className={`px-2.5 py-1 rounded-md transition-colors flex items-center gap-1 font-medium ${
              viewState === 'error'
                ? 'bg-red-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Error
          </button>
        </div>

        {/* Modal & Toast Triggers */}
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<MessageSquare className="w-3.5 h-3.5 text-blue-400" />}
          onClick={onOpenSampleDialog}
        >
          Test Dialog
        </Button>

        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Bell className="w-3.5 h-3.5 text-amber-400" />}
          onClick={onTriggerToast}
        >
          Fire Toast
        </Button>
      </div>
    </div>
  );
}
