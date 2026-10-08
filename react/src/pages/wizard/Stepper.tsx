import React from "react";

interface StepperProps {
  steps: string[];
  current: number;
  // Steps that have been saved/visited, shown with a check mark
  completed: boolean[];
  disabled?: boolean;
  onSelect: (index: number) => void;
}

// Circles joined by a track, labels underneath. Same layout at every width.
// Every step is clickable so users can move freely between them.
export const Stepper: React.FC<StepperProps> = ({ steps, current, completed, disabled, onSelect }) => (
  <nav aria-label="Setup progress" className="mb-8">
    <ol className="grid" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((label, i) => {
        const active = i === current;
        const done = completed[i] && !active;
        return (
          <li key={label} className="relative flex justify-center">
            {/* Track to the next step, drawn behind the circles */}
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={`absolute top-[16px] left-1/2 w-full h-[4px] -translate-y-1/2 ${
                  completed[i] && completed[i + 1] ? "bg-[#C7D2FE]" : "bg-gray-200"
                }`}
              />
            )}

            <button
              type="button"
              onClick={() => onSelect(i)}
              disabled={active || disabled}
              aria-current={active ? "step" : undefined}
              className="group relative flex flex-col items-center gap-2 px-1 rounded-[6px] disabled:cursor-default focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-[#0071EC] focus-visible:outline-offset-[2px]"
            >
              <span
                className={`flex items-center justify-center w-8 h-8 rounded-full text-[15px] font-bold transition-colors ${
                  active
                    ? "bg-[#4F46E5] text-white"
                    : done
                      ? "bg-[#E0E7FF] text-[#4338CA] group-enabled:group-hover:bg-[#C7D2FE]"
                      : "bg-gray-200 text-gray-900 group-enabled:group-hover:bg-gray-300"
                }`}
              >
                {done ? (
                  <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true">
                    <path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`text-[12px] sm:text-[13px] leading-tight text-center ${
                  active ? "font-semibold text-[#4F46E5]" : "text-gray-800 group-enabled:group-hover:text-gray-950"
                }`}
              >
                {label}
                {done && <span className="sr-only"> (completed)</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  </nav>
);
