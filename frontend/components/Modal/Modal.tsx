"use client";

import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useModalContext } from "./context/ModalContext";

interface Props {
    children: React.ReactNode;
    // Con id el modal usa la pila del context (se puede abrir uno encima de otro).
    // Sin id usa el estado global simple (state / setState).
    id?: string;
    // Si se pasa, se llama al cerrar (Escape, fondo o botón) en lugar de cerrar directamente.
    onClose?: () => void;
    loading?: boolean;
    loadingText?: string;
    className?: string;
    containerClassName?: string;
    zIndexClass?: string;
}

const BASE_Z_INDEX = 100;

export const Modal = ({
    children,
    id,
    onClose,
    loading = false,
    loadingText = "Cargando...",
    className = "",
    containerClassName = "",
    zIndexClass = "z-[150]",
}: Props) => {

    const modalRef = useRef<HTMLDivElement>(null);
    const { state, setState, isOpen, isTop, close, level } = useModalContext();
    const [modalRoot, setModalRoot] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setModalRoot(document.getElementById("modal-root"));
    }, []);

    const usesStack = id !== undefined;
    const abierto = usesStack ? isOpen(id) : state;
    const arriba = usesStack ? isTop(id) : true;

    const closeModal = () => {
        if (onClose) onClose();
        else if (usesStack) close(id);
        else setState(false);
    };

    // Ref para que el listener de Escape siempre use el closeModal más reciente
    const closeRef = useRef(closeModal);
    closeRef.current = closeModal;

    useEffect(() => {
        // Solo el modal de arriba escucha Escape
        if (!abierto || !arriba) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                closeRef.current();
            }
        };
        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc);
    }, [abierto, arriba]);

    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
    };

    if (!abierto || !modalRoot) {
        return null;
    }

    return createPortal(
        <div
            className={`fixed inset-0 ${usesStack ? "" : zIndexClass} flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto ${containerClassName}`}
            style={usesStack ? { zIndex: BASE_Z_INDEX + level(id) * 10 } : undefined}
            onClick={closeModal}
        >
            <div className={`modal bg-slate-900 border border-slate-800 rounded-2xl w-full lg:w-4xl max-h-[90vh] shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150 overflow-y-auto text-slate-300 max-w-4xl flex flex-col overflow-hidden p-6 ${className}`} onClick={handleClick} ref={modalRef}>
                <button
                    type="button"
                    onClick={closeModal}
                    className="absolute top-4 right-4 z-50 text-slate-400 hover:text-white hover:bg-slate-800/80 p-2 rounded-xl transition cursor-pointer flex items-center justify-center"
                    title="Cerrar modal"
                    aria-label="Cerrar modal"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
                {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16" role="status">
                        <div className="w-10 h-10 border-4 border-slate-700 border-t-sky-400 rounded-full animate-spin" />
                        <p className="text-sm text-slate-400">{loadingText}</p>
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>,
        modalRoot
    );
};
