import { Fragment } from "react";

export type WizardStep =
    | 'select_client'
    | 'client_confirmation'
    | 'order_details'
    | 'order_summary'
    | 'order_confirmation';

type StepStatus = 'active' | 'completed' | 'pending';

interface StepConfig {
    label: string;
    /** Pasos del wizard que corresponden a esta etapa */
    steps: WizardStep[];
}

const STEPS: StepConfig[] = [
    { label: 'Cliente', steps: ['select_client', 'client_confirmation'] },
    { label: 'Pedido', steps: ['order_details'] },
    { label: 'Resumen', steps: ['order_summary', 'order_confirmation'] },
];

const CIRCLE_STYLES: Record<StepStatus, string> = {
    active: 'bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.6)]',
    completed: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    pending: 'bg-slate-800 text-slate-500 border border-slate-700/30',
};

const LABEL_STYLES: Record<StepStatus, string> = {
    active: 'text-blue-400',
    completed: 'text-slate-400',
    pending: 'text-slate-500',
};

interface WizardStepperProps {
    currentStep: WizardStep;
    className?: string;
}

export function WizardStepper({ currentStep, className = '' }: WizardStepperProps) {
    const currentIndex = STEPS.findIndex((s) => s.steps.includes(currentStep));

    const getStatus = (index: number): StepStatus => {
        if (index === currentIndex) return 'active';
        return index < currentIndex ? 'completed' : 'pending';
    };

    return (
        <div
            className={`flex items-center w-full order-last mt-4 lg:order-none lg:mt-0 lg:absolute lg:top-0 lg:left-1/2 lg:-translate-x-1/2 lg:w-80 ${className}`}
        >
            {STEPS.map((step, index) => {
                const status = getStatus(index);
                return (
                    <Fragment key={step.label}>
                        {index > 0 && (
                            <div className={`flex-1 h-px mx-3 transition-colors ${index <= currentIndex ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />
                        )}
                        <div className="flex items-center gap-2">
                            <span
                                className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all ${CIRCLE_STYLES[status]}`}
                            >
                                {status === 'completed' ? '✓' : index + 1}
                            </span>
                            <span className={`text-xs font-semibold ${LABEL_STYLES[status]}`}>
                                {step.label}
                            </span>
                        </div>
                    </Fragment>
                );
            })}
        </div>
    );
}