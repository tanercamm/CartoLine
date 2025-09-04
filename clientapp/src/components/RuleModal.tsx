import React, { useEffect } from "react";

type Props = {
    open: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode | null;
};

export default function Modal({ open, title, onClose, children, footer }: Props) {
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handler);
        return () => {
            window.removeEventListener("keydown", handler);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <>
            <style>{`
        @keyframes modalIn {
          0% { opacity:0; transform: translateY(4px) scale(.98) }
          100%{ opacity:1; transform: translateY(0) scale(1) }
        }
        .modal-overlay{
          position:fixed; inset:0; background:rgba(0,0,0,.25);
          backdrop-filter: blur(6px) saturate(120%);
          -webkit-backdrop-filter: blur(6px) saturate(120%);
          display:flex; align-items:center; justify-content:center; z-index:1000;
        }
        .modal-card{
          width:min(680px,92vw); max-height:80vh; background:#fff;
          border-radius:14px; box-shadow:0 24px 72px rgba(0,0,0,.25);
          overflow:hidden; display:flex; flex-direction:column; animation:modalIn .18s ease-out both;
        }
        .modal-header{ padding:14px 18px; border-bottom:1px solid #eee; font-weight:700; }
        .modal-body{ padding:18px; overflow-y:auto; }
        .modal-footer{
          padding:12px; border-top:1px solid #eee; display:flex; gap:10px; justify-content:flex-end;
        }

        /* ---- Ortak buton temeli (oval + animasyon) ---- */
        .modal-footer button,
        .modal-btn{
          appearance:none; font-weight:600; padding:10px 16px; border-radius:9999px; cursor:pointer;
          transition: transform .16s cubic-bezier(.2,.8,.2,1), box-shadow .16s ease,
                      background-color .16s ease, border-color .16s ease, color .16s ease;
        }
        .modal-footer button:focus-visible,
        .modal-btn:focus-visible{ outline:3px solid rgba(14,165,233,.35); outline-offset:2px; }
        .modal-footer button:disabled,
        .modal-btn:disabled{ opacity:.65; cursor:not-allowed; transform:none; box-shadow:none; }

        /* ---- Auto-style: ilk buton (İptal = ghost) ---- */
        .modal-footer button:first-of-type{
          background:#fff; color:#111827; border:1px solid #e5e7eb; box-shadow:0 8px 18px rgba(0,0,0,.10);
        }
        .modal-footer button:first-of-type:hover{
          background:#f9fafb; border-color:#d1d5db; transform:translateY(-1px) scale(1.03);
          box-shadow:0 12px 26px rgba(0,0,0,.12);
        }
        .modal-footer button:first-of-type:active{ background:#f3f4f6; transform:translateY(0) scale(.98); }

        /* ---- Auto-style: son buton (Primary = Çizime Başla stili) ---- */
        .modal-footer button:last-of-type{
          background:#0ea5e9; color:#fff; border:1px solid #0284c7; box-shadow:0 10px 24px rgba(14,165,233,.25);
        }
        .modal-footer button:last-of-type:hover{
          transform:translateY(-1px) scale(1.03); box-shadow:0 14px 32px rgba(14,165,233,.35);
        }
        .modal-footer button:last-of-type:active{
          transform:translateY(0) scale(.98); box-shadow:0 8px 18px rgba(14,165,233,.28);
        }

        /* İstersen sınıfla da kullan: */
        .modal-btn--primary{
          background:#0ea5e9; color:#fff; border:1px solid #0284c7; box-shadow:0 10px 24px rgba(14,165,233,.25);
        }
        .modal-btn--ghost{
          background:#fff; color:#111827; border:1px solid #e5e7eb; box-shadow:0 8px 18px rgba(0,0,0,.10);
        }
      `}</style>

            <div className="modal-overlay" onClick={onClose}>
                <div
                    className="modal-card"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div id="modal-title" className="modal-header">{title}</div>
                    <div className="modal-body">{children}</div>

                    {footer !== null && (
                        <div className="modal-footer">
                            {footer ?? (
                                <button onClick={onClose}>İptal</button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
