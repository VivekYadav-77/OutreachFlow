import React, { useEffect, useState } from "react";
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { ToastMessage } from "../context/ToastContext";

interface ToastProps {
  toast: ToastMessage;
  onClose: () => void;
}

const icons = {
  success: <CheckCircle size={20} className="toast-icon text-success" />,
  error: <AlertCircle size={20} className="toast-icon text-error" />,
  warning: <AlertTriangle size={20} className="toast-icon text-warning" />,
  info: <Info size={20} className="toast-icon text-info" />
};

export function Toast({ toast, onClose }: ToastProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300); // match animation duration
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, 4700); // Start closing slightly before actual removal
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`toast toast-${toast.type} ${isClosing ? "toast-closing" : ""}`}>
      <div className="toast-content">
        {icons[toast.type]}
        <p className="toast-message">{toast.message}</p>
      </div>
      <button onClick={handleClose} className="toast-close" aria-label="Close">
        <X size={16} />
      </button>
    </div>
  );
}
