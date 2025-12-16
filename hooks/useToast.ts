import { useState, useCallback } from 'react';

export type ToastType = 'info' | 'success' | 'error' | 'warning';

export interface ToastMessage {
    id: string;
    message: string;
    type: ToastType;
}

export const useToast = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const showToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
        const id = Date.now().toString() + Math.random().toString(36);
        const toast: ToastMessage = { id, message, type };

        setToasts((prev) => [...prev, toast]);

        // Auto remove after duration (0 = persistent, won't auto-dismiss)
        if (duration > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
        }

        return id;
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return { toasts, showToast, removeToast };
};
