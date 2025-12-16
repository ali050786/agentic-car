import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { ToastMessage, ToastType } from '../hooks/useToast';

interface ToastProps {
    toasts: ToastMessage[];
    onRemove: (id: string) => void;
}

const getToastStyles = (type: ToastType) => {
    switch (type) {
        case 'success':
            return {
                bg: 'bg-green-600/90',
                border: 'border-green-500',
                icon: <CheckCircle size={20} />,
            };
        case 'error':
            return {
                bg: 'bg-red-600/90',
                border: 'border-red-500',
                icon: <AlertCircle size={20} />,
            };
        case 'warning':
            return {
                bg: 'bg-orange-600/90',
                border: 'border-orange-500',
                icon: <AlertTriangle size={20} />,
            };
        case 'info':
        default:
            return {
                bg: 'bg-blue-600/90',
                border: 'border-blue-500',
                icon: <Info size={20} />,
            };
    }
};

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);
    const styles = getToastStyles(toast.type);

    const handleRemove = () => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300);
    };

    return (
        <div
            className={`flex items-center gap-4 px-6 py-4 ${styles.bg} ${styles.border} border-2 rounded-xl shadow-2xl backdrop-blur-md text-white transition-all duration-300 min-w-[400px] max-w-[600px] ${isExiting ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'
                }`}
        >
            <div className="flex-shrink-0">{styles.icon}</div>
            <p className="flex-1 text-base font-bold">{toast.message}</p>
            <button
                onClick={handleRemove}
                className="flex-shrink-0 p-1.5 hover:bg-white/10 rounded transition-colors"
                aria-label="Close"
            >
                <X size={18} />
            </button>
        </div>
    );
};

export const Toast: React.FC<ToastProps> = ({ toasts, onRemove }) => {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-3 pointer-events-none">
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto animate-slideDown">
                    <ToastItem toast={toast} onRemove={onRemove} />
                </div>
            ))}
        </div>
    );
};
