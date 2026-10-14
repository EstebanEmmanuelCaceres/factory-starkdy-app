"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface ModalContextType {
    // Modo simple (un único modal global). Lo sigue usando tareas/page.tsx.
    state: boolean;
    setState: (value: boolean) => void;

    // Pila de modales por id: el último de la lista es el que está arriba.
    stack: string[];
    open: (id: string) => void;
    close: (id: string) => void;
    isOpen: (id: string) => boolean;
    isTop: (id: string) => boolean;
    level: (id: string) => number;
}

export const ModalContext = createContext<ModalContextType | null>(null);

export const ModalProvider = ({ children }: { children: React.ReactNode }) => {
    const [state, setState] = useState(false);
    const [stack, setStack] = useState<string[]>([]);

    const open = useCallback((id: string) => {
        setStack(prev => (prev.includes(id) ? prev : [...prev, id]));
    }, []);

    // Cierra ese modal y todos los que estén por encima de él
    const close = useCallback((id: string) => {
        setStack(prev => {
            const index = prev.indexOf(id);
            return index === -1 ? prev : prev.slice(0, index);
        });
    }, []);

    const isOpen = useCallback((id: string) => stack.includes(id), [stack]);
    const isTop = useCallback((id: string) => stack[stack.length - 1] === id, [stack]);
    const level = useCallback((id: string) => stack.indexOf(id), [stack]);

    // Bloquear el scroll del body mientras haya algún modal de la pila abierto
    useEffect(() => {
        if (stack.length === 0) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [stack.length]);

    return (
        <ModalContext.Provider value={{ state, setState, stack, open, close, isOpen, isTop, level }}>
            {children}
        </ModalContext.Provider>
    );
};

export const useModalContext = () => {
    const context = useContext(ModalContext);
    if (!context) {
        throw new Error("useModalContext debe estar dentro de ModalProvider");
    }
    return context;
};

// Atajo para manejar un modal concreto de la pila
export const useModal = (id: string) => {
    const { open, close, isOpen } = useModalContext();
    return {
        isOpen: isOpen(id),
        open: () => open(id),
        close: () => close(id),
    };
};
