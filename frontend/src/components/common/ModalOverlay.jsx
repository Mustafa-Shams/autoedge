import { useLayoutEffect, useRef } from 'react';

export default function ModalOverlay({ onDismiss, children, className = '', ...props }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} {...props} className={`m-0 h-dvh w-screen max-h-none max-w-none border-0 text-inherit ${className}`}
    onKeyDown={event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onDismiss?.();
      }
    }}
    onCancel={event => { event.preventDefault(); onDismiss?.(); }}>
    {children}
  </dialog>;
}
